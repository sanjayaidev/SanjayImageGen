// Transloadit provider wrapper — image generation AND editing via the
// 🤖 /image/generate Robot (https://transloadit.com/docs/robots/image-generate/).
//
// Auth: Auth Key + Auth Secret (from your Transloadit Workspace's
// Credentials page). The official SDK signs requests for you.
//
// - Text-to-image: just a prompt, no input image.
// - Image editing: pass a source image URL — Transloadit imports it via the
//   /http/import Robot in the same Assembly, then feeds it into
//   /image/generate tagged `as: "image"`. Supported edit models (e.g.
//   google/nano-banana*) apply the prompt as an edit instruction to that
//   image, no mask required for general edits.
//
// Default model: google/nano-banana (per Transloadit's own Robot default).

const Transloadit = require('transloadit');

const DEFAULT_MODEL = 'google/nano-banana';

class TransloaditProvider {
  constructor(authKey, authSecret) {
    if (!authKey) throw new Error('Transloadit Auth Key is required');
    if (!authSecret) throw new Error('Transloadit Auth Secret is required');
    this.client = new Transloadit({ authKey, authSecret });
  }

  // Runs an Assembly with a single /image/generate step (plus an optional
  // /http/import step feeding it, for edits) and returns the resulting
  // file's URL.
  async _runGenerate({ prompt, model, imageUrl, format, width, height, aspect_ratio, seed, style, num_outputs }) {
    if (!prompt || !prompt.trim()) throw new Error('prompt is required');

    const steps = {};
    const generateStep = {
      robot: '/image/generate',
      model: model || DEFAULT_MODEL,
      prompt,
      result: true,
    };
    if (format) generateStep.format = format;
    if (width) generateStep.width = width;
    if (height) generateStep.height = height;
    if (aspect_ratio) generateStep.aspect_ratio = aspect_ratio;
    if (seed !== undefined && seed !== null && seed !== '') generateStep.seed = seed;
    if (style) generateStep.style = style;
    if (num_outputs) generateStep.num_outputs = num_outputs;

    if (imageUrl) {
      steps[':original'] = { robot: '/http/import', url: imageUrl };
      generateStep.use = [{ name: ':original', as: 'image' }];
    }
    steps.generated = generateStep;

    let result;
    try {
      result = await this.client.createAssembly({
        params: { steps },
        waitForCompletion: true,
      });
    } catch (err) {
      const reason = err?.assembly?.error || err?.message || 'request failed';
      throw new Error(`Transloadit error: ${reason}`);
    }

    if (result?.error) {
      throw new Error(`Transloadit error: ${result.message || result.error}`);
    }

    const files = result?.results?.generated || [];
    if (!files.length) {
      throw new Error('Transloadit returned no generated image');
    }

    return {
      raw: result,
      imageUrl: files[0].ssl_url || files[0].url,
      assemblyId: result.assembly_id,
    };
  }

  // Text-to-image
  async generateImage(prompt, options = {}) {
    return this._runGenerate({ prompt, ...options });
  }

  // Image editing: options.imageUrl is required (single source image URL)
  async editImage(prompt, imageUrl, options = {}) {
    if (!imageUrl) throw new Error('imageUrl is required for Transloadit image editing');
    return this._runGenerate({ prompt, imageUrl, ...options });
  }
}

TransloaditProvider.DEFAULT_MODEL = DEFAULT_MODEL;

module.exports = TransloaditProvider;
