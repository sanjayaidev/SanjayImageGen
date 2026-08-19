// providers/model-catalog.js
//
// Central catalog of providers/models/parameters for image GENERATE and
// EDIT, in the same shape as SanjayAIHub's modules/text-to-image.js:
// every tweakable knob is a `select`, `range`, or `checkbox` field, never
// free text. The frontend (public/js/adaptive-params.js) renders a form
// straight from whichever model's schema is active, so only the params a
// model actually supports are ever shown.
//
// Model lists / size presets for Alibaba are ported from
// https://github.com/sanjayaidev/SanjayAIHub (providers/alibaba-models.js,
// modules/text-to-image.js). Transloadit models/params are from
// https://transloadit.com/docs/robots/image-generate/.

// ── Alibaba (DashScope / Qwen-Image) ──────────────────────────────────
const ALIBABA_GENERATE_MODELS = [
  'qwen-image-2.0',       // default — "Qwen-Image 2"
  'qwen-image-2.0-pro',
  'qwen-image-3.0-pro',   // unified T2I + I2I, limited preview
  'qwen-image',
  'qwen-image-max',
  'qwen-image-plus',
  'wan2.6-t2i',
  'wan2.7-image-pro',
  'z-image-turbo',
];

const ALIBABA_EDIT_MODELS = [
  'qwen-image-edit-plus', // default
  'qwen-image-edit',
  'qwen-image-edit-max',
  'qwen-image-3.0-pro',   // also supports image-to-image (unified endpoint)
];

const ALIBABA_DEFAULT_GENERATE_MODEL = 'qwen-image-2.0';
const ALIBABA_DEFAULT_EDIT_MODEL = 'qwen-image-edit-plus';

// qwen-image-3.0-pro accepts any "W*H" between 512*512 and 2048*2048 (or
// no size at all, letting the model choose). Other Qwen-Image models are
// restricted to a fixed, verified set of sizes.
const ALIBABA_SIZE_OPTIONS_3PRO = [
  { value: '', label: 'Auto (model decides)' },
  { value: '1024*1024', label: 'Square (1024×1024)' },
  { value: '1328*1328', label: 'Square (1328×1328)' },
  { value: '1664*928', label: 'Landscape 16:9 (1664×928)' },
  { value: '1472*1104', label: 'Landscape 4:3 (1472×1104)' },
  { value: '1104*1472', label: 'Portrait 3:4 (1104×1472)' },
  { value: '928*1664', label: 'Portrait 9:16 (928×1664)' },
  { value: '2048*2048', label: 'Square Max (2048×2048)' },
];

const ALIBABA_SIZE_OPTIONS_STANDARD = [
  { value: '1328*1328', label: 'Square (1328×1328)' },
  { value: '1664*928', label: 'Landscape 16:9 (1664×928)' },
  { value: '1472*1104', label: 'Landscape 4:3 (1472×1104)' },
  { value: '1104*1472', label: 'Portrait 3:4 (1104×1472)' },
  { value: '928*1664', label: 'Portrait 9:16 (928×1664)' },
];

const ALIBABA_VALID_SIZES = ['1024*1024', '1328*1328', '1664*928', '1472*1104', '1104*1472', '928*1664', '2048*2048'];

function alibabaSchema(model) {
  const is3Pro = model === 'qwen-image-3.0-pro';
  return {
    size: {
      type: 'select',
      label: 'Aspect ratio / size',
      options: is3Pro ? ALIBABA_SIZE_OPTIONS_3PRO : ALIBABA_SIZE_OPTIONS_STANDARD,
      default: is3Pro ? '' : '1328*1328',
    },
    n: {
      type: 'range',
      label: 'Number of images',
      min: 1, max: is3Pro ? 6 : 4, step: 1,
      default: 1,
    },
    use_seed: {
      type: 'checkbox',
      label: 'Use fixed seed',
      default: false,
    },
    seed: {
      type: 'range',
      label: 'Seed',
      min: 0, max: 999999999, step: 1,
      default: 0,
      dependsOn: 'use_seed',
    },
    prompt_extend: {
      type: 'checkbox',
      label: 'Smart prompt rewriting',
      default: true,
    },
    watermark: {
      type: 'checkbox',
      label: 'Add watermark',
      default: false,
    },
  };
}

// ── Cloudflare (Flux 1 Schnell) ───────────────────────────────────────
const CLOUDFLARE_MODEL = '@cf/black-forest-labs/flux-1-schnell';

function cloudflareSchema() {
  return {
    num_steps: {
      type: 'range',
      label: 'Steps',
      min: 1, max: 8, step: 1,
      default: 4,
    },
    use_seed: {
      type: 'checkbox',
      label: 'Use fixed seed',
      default: false,
    },
    seed: {
      type: 'range',
      label: 'Seed',
      min: 0, max: 999999999, step: 1,
      default: 0,
      dependsOn: 'use_seed',
    },
  };
}

// ── Pixazo (Flux 1 Schnell) ───────────────────────────────────────────
const PIXAZO_MODEL = 'flux-1-schnell';

function pixazoSchema() {
  return {
    width: { type: 'select', label: 'Width', options: [512, 768, 1024], default: 1024 },
    height: { type: 'select', label: 'Height', options: [512, 768, 1024], default: 1024 },
    num_steps: { type: 'range', label: 'Steps', min: 1, max: 8, step: 1, default: 4 },
    use_seed: { type: 'checkbox', label: 'Use fixed seed', default: false },
    seed: { type: 'range', label: 'Seed', min: 0, max: 999999999, step: 1, default: 0, dependsOn: 'use_seed' },
  };
}

// ── Transloadit (/image/generate robot) ───────────────────────────────
// Model list + params per https://transloadit.com/docs/robots/image-generate/
const TRANSLOADIT_GENERATE_MODELS = [
  'google/nano-banana',        // default
  'google/nano-banana-2',
  'google/nano-banana-pro',
  'flux-1.1-pro-ultra',
  'flux-schnell',
  'recraft-v3',
  'openai/gpt-image-2',
];
// Inpainting model only makes sense with a source/mask image, so it's
// offered on the edit side only.
const TRANSLOADIT_EDIT_MODELS = [
  ...TRANSLOADIT_GENERATE_MODELS,
  'stability-ai/stable-diffusion-inpainting',
];

const TRANSLOADIT_DEFAULT_MODEL = 'google/nano-banana';

const TRANSLOADIT_ASPECT_OPTIONS = [
  { value: '1:1', label: 'Square 1:1' },
  { value: '16:9', label: 'Landscape 16:9' },
  { value: '9:16', label: 'Portrait 9:16' },
  { value: '4:3', label: 'Landscape 4:3' },
  { value: '3:4', label: 'Portrait 3:4' },
  { value: '3:2', label: 'Landscape 3:2' },
  { value: '2:3', label: 'Portrait 2:3' },
];

const TRANSLOADIT_FORMAT_OPTIONS = ['png', 'jpeg', 'webp', 'gif', 'svg'];

const TRANSLOADIT_STYLE_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'photorealistic', label: 'Photorealistic' },
  { value: 'digital art', label: 'Digital art' },
  { value: 'anime', label: 'Anime' },
  { value: '3d render', label: '3D render' },
  { value: 'watercolor', label: 'Watercolor' },
  { value: 'oil painting', label: 'Oil painting' },
  { value: 'line art', label: 'Line art' },
];

function transloaditSchema() {
  return {
    aspect_ratio: { type: 'select', label: 'Aspect ratio', options: TRANSLOADIT_ASPECT_OPTIONS, default: '1:1' },
    format: { type: 'select', label: 'Format', options: TRANSLOADIT_FORMAT_OPTIONS, default: 'png' },
    style: { type: 'select', label: 'Style', options: TRANSLOADIT_STYLE_OPTIONS, default: '' },
    num_outputs: { type: 'range', label: 'Number of outputs', min: 1, max: 10, step: 1, default: 1 },
    use_seed: { type: 'checkbox', label: 'Use fixed seed', default: false },
    seed: { type: 'range', label: 'Seed', min: 0, max: 999999999, step: 1, default: 0, dependsOn: 'use_seed' },
  };
}

// ── Assemble full catalogs ────────────────────────────────────────────
function buildSchemas(models, schemaFn) {
  const out = {};
  for (const m of models) out[m] = schemaFn(m);
  return out;
}

function getGenerateCatalog() {
  return {
    providers: ['alibaba', 'cloudflare', 'pixazo', 'transloadit'],
    models: {
      alibaba: ALIBABA_GENERATE_MODELS,
      cloudflare: [CLOUDFLARE_MODEL],
      pixazo: [PIXAZO_MODEL],
      transloadit: TRANSLOADIT_GENERATE_MODELS,
    },
    defaults: {
      provider: 'alibaba',
      alibaba: ALIBABA_DEFAULT_GENERATE_MODEL,
      cloudflare: CLOUDFLARE_MODEL,
      pixazo: PIXAZO_MODEL,
      transloadit: TRANSLOADIT_DEFAULT_MODEL,
    },
    schemas: {
      ...buildSchemas(ALIBABA_GENERATE_MODELS, alibabaSchema),
      [CLOUDFLARE_MODEL]: cloudflareSchema(),
      [PIXAZO_MODEL]: pixazoSchema(),
      ...buildSchemas(TRANSLOADIT_GENERATE_MODELS, transloaditSchema),
    },
  };
}

function getEditCatalog() {
  return {
    providers: ['alibaba', 'transloadit'],
    models: {
      alibaba: ALIBABA_EDIT_MODELS,
      transloadit: TRANSLOADIT_EDIT_MODELS,
    },
    defaults: {
      provider: 'alibaba',
      alibaba: ALIBABA_DEFAULT_EDIT_MODEL,
      transloadit: TRANSLOADIT_DEFAULT_MODEL,
    },
    schemas: {
      ...buildSchemas(ALIBABA_EDIT_MODELS, alibabaSchema),
      ...buildSchemas(TRANSLOADIT_EDIT_MODELS, transloaditSchema),
    },
  };
}

module.exports = {
  ALIBABA_GENERATE_MODELS,
  ALIBABA_EDIT_MODELS,
  ALIBABA_DEFAULT_GENERATE_MODEL,
  ALIBABA_DEFAULT_EDIT_MODEL,
  ALIBABA_VALID_SIZES,
  CLOUDFLARE_MODEL,
  PIXAZO_MODEL,
  TRANSLOADIT_GENERATE_MODELS,
  TRANSLOADIT_EDIT_MODELS,
  TRANSLOADIT_DEFAULT_MODEL,
  getGenerateCatalog,
  getEditCatalog,
};
