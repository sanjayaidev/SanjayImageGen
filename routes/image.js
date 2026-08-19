const express = require('express');
const AlibabaProvider = require('../providers/alibaba');
const CloudflareProvider = require('../providers/cloudflare');
const PixazoProvider = require('../providers/pixazo');
const TransloaditProvider = require('../providers/transloadit');
const catalog = require('../providers/model-catalog');
const { uploadToImgbb } = require('../services/imgbb');
const db = require('../db');

const router = express.Router();

const GENERATE_PROVIDERS = ['alibaba', 'cloudflare', 'pixazo', 'transloadit'];
const EDIT_PROVIDERS = ['alibaba', 'transloadit']; // only these two support image-to-image

// GET /api/image/catalog?type=generate|edit
// Powers the dynamic provider/model/param dropdowns on the frontend —
// only the fields a given model actually supports are ever shown.
router.get('/catalog', (req, res) => {
  const type = req.query.type === 'edit' ? 'edit' : 'generate';
  res.json(type === 'edit' ? catalog.getEditCatalog() : catalog.getGenerateCatalog());
});

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not configured on the server`);
  return v;
}

function getAlibaba() {
  return new AlibabaProvider(
    requireEnv('ALIBABA_API_KEY'),
    requireEnv('ALIBABA_WORKSPACE_ID'),
    process.env.ALIBABA_REGION
  );
}
function getCloudflare() {
  return new CloudflareProvider(requireEnv('CLOUDFLARE_API_TOKEN'), requireEnv('CLOUDFLARE_ACCOUNT_ID'));
}
function getPixazo() {
  return new PixazoProvider(requireEnv('PIXAZO_API_KEY'));
}
function getTransloadit() {
  return new TransloaditProvider(requireEnv('TRANSLOADIT_AUTH_KEY'), requireEnv('TRANSLOADIT_AUTH_SECRET'));
}

// Transloads a provider result (URL or base64 data URL) to imgbb and
// persists a history row. Returns the saved row.
async function transloadAndSave({ type, prompt, provider, model, sourceImageUrl, providerImageUrl, dataUrl, parameters }) {
  const imgbbKey = requireEnv('IMGBB_API_KEY');
  const uploaded = await uploadToImgbb(imgbbKey, dataUrl ? { dataUrl } : { imageUrl: providerImageUrl });

  const id = await db.saveImage({
    type,
    prompt,
    provider,
    model,
    source_image_url: sourceImageUrl,
    provider_image_url: providerImageUrl || null,
    imgbb_url: uploaded.url,
    imgbb_thumb_url: uploaded.thumbUrl,
    imgbb_delete_url: uploaded.deleteUrl,
    parameters,
  });

  return db.getImage(id);
}

// POST /api/image/generate
// body: { prompt, provider?: alibaba|cloudflare|pixazo|transloadit, model?, ...providerParams }
router.post('/generate', async (req, res) => {
  try {
    const {
      prompt, provider = 'alibaba', model,
      width, height, size, seed, num_steps, aspect_ratio, format, style, num_outputs,
      n, negative_prompt, prompt_extend, watermark,
    } = req.body || {};
    if (!prompt || !prompt.trim()) return res.status(400).json({ error: 'prompt is required' });
    if (!GENERATE_PROVIDERS.includes(provider)) {
      return res.status(400).json({ error: `provider must be one of: ${GENERATE_PROVIDERS.join(', ')}` });
    }

    let providerImageUrl = null;
    let dataUrl = null;
    let usedModel = model || null;

    if (provider === 'alibaba') {
      const alibaba = getAlibaba();
      usedModel = catalog.ALIBABA_GENERATE_MODELS.includes(model) ? model : catalog.ALIBABA_DEFAULT_GENERATE_MODEL;
      const result = await alibaba.imageGeneration(prompt, {
        model: usedModel, size, seed, n, negative_prompt, prompt_extend, watermark,
      });
      providerImageUrl = result._imageUrls?.[0];
      if (!providerImageUrl) throw new Error('Alibaba returned no image');
    } else if (provider === 'cloudflare') {
      const cloudflare = getCloudflare();
      usedModel = catalog.CLOUDFLARE_MODEL;
      const result = await cloudflare.textToImage({ prompt, num_steps, seed });
      dataUrl = result.imageDataUrl;
    } else if (provider === 'pixazo') {
      const pixazo = getPixazo();
      usedModel = catalog.PIXAZO_MODEL;
      const result = await pixazo.generateImage({ prompt, width, height, num_steps, seed });
      providerImageUrl = result.output;
      if (!providerImageUrl) throw new Error('Pixazo returned no image');
    } else if (provider === 'transloadit') {
      const transloadit = getTransloadit();
      usedModel = catalog.TRANSLOADIT_GENERATE_MODELS.includes(model) ? model : catalog.TRANSLOADIT_DEFAULT_MODEL;
      const result = await transloadit.generateImage(prompt, { model: usedModel, width, height, aspect_ratio, seed, format, style, num_outputs });
      providerImageUrl = result.imageUrl;
    }

    const saved = await transloadAndSave({
      type: 'generate',
      prompt,
      provider,
      model: usedModel,
      providerImageUrl,
      dataUrl,
      parameters: { width, height, size, seed, num_steps, aspect_ratio, format, style, num_outputs, n, negative_prompt, prompt_extend, watermark },
    });

    res.json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/image/edit
// body: { prompt, image_url, provider?: alibaba|transloadit, model?, ...providerParams }
router.post('/edit', async (req, res) => {
  try {
    const { prompt, image_url, provider = 'alibaba', model, width, height, size, seed, aspect_ratio, format } = req.body || {};
    if (!prompt || !prompt.trim()) return res.status(400).json({ error: 'edit instruction (prompt) is required' });
    if (!image_url || !image_url.trim()) return res.status(400).json({ error: 'image_url is required' });
    if (!EDIT_PROVIDERS.includes(provider)) {
      return res.status(400).json({ error: `provider must be one of: ${EDIT_PROVIDERS.join(', ')}` });
    }

    let providerImageUrl = null;
    let usedModel = model || null;

    if (provider === 'alibaba') {
      const alibaba = getAlibaba();
      usedModel = catalog.ALIBABA_EDIT_MODELS.includes(model) ? model : catalog.ALIBABA_DEFAULT_EDIT_MODEL;
      const size2 = size || ((width && height) ? `${parseInt(width)}*${parseInt(height)}` : undefined);
      const result = await alibaba.imageEdit(prompt, image_url, { model: usedModel, size: size2, seed });
      providerImageUrl = result._imageUrls?.[0];
      if (!providerImageUrl) throw new Error('Alibaba returned no edited image');
    } else if (provider === 'transloadit') {
      const transloadit = getTransloadit();
      usedModel = catalog.TRANSLOADIT_EDIT_MODELS.includes(model) ? model : catalog.TRANSLOADIT_DEFAULT_MODEL;
      const result = await transloadit.editImage(prompt, image_url, { model: usedModel, width, height, aspect_ratio, seed, format });
      providerImageUrl = result.imageUrl;
    }

    const saved = await transloadAndSave({
      type: 'edit',
      prompt,
      provider,
      model: usedModel,
      sourceImageUrl: image_url,
      providerImageUrl,
      parameters: { width, height, size, seed, aspect_ratio, format },
    });

    res.json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
