// public/js/adaptive-params.js
//
// Renders a model's parameter panel purely from its schema object — the
// same `schemas` object GET /api/image/catalog returns. Control types:
// <select>, <input type=range>, a checkbox, and <input type=number> (used
// for free-entry custom width/height on models that support arbitrary
// resolutions — see the `number` type below).
//
// Schema field shape:
//   {
//     type: 'select' | 'range' | 'checkbox' | 'number',
//     label?: string,
//     default: any,
//     options?: (string|number|{value, label})[],   // select only
//     min?, max?, step?: number,                     // range & number only
//     dependsOn?: string,    // name of a checkbox field gating this one —
//                            // when that checkbox is off, this field is
//                            // dimmed AND omitted entirely from getValues()
//     disabledWhen?: string, // name of a checkbox field that, when ON,
//                            // dims this field AND omits it from
//                            // getValues() (the inverse of dependsOn — e.g.
//                            // an aspect_ratio select that should stop
//                            // applying once a "custom resolution" toggle
//                            // is on and width/height take over)
//   }
//
// Usage:
//   const panel = AdaptiveParams.mount(containerEl, schema);
//   const values = panel.getValues();     // read right before submit
//   panel.setSchema(newSchema);           // swap when model changes

window.AdaptiveParams = (function () {
  let styleInjected = false;

  function injectStyle() {
    if (styleInjected) return;
    styleInjected = true;
    const style = document.createElement('style');
    style.textContent = `
      .ap-panel { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 4px; }
      @media (max-width: 640px) { .ap-panel { grid-template-columns: 1fr; } }
      .ap-field { transition: opacity .15s; }
      .ap-field.ap-full { grid-column: 1 / -1; }
      .ap-field.ap-disabled { opacity: .4; pointer-events: none; }
      .ap-label {
        display:flex; justify-content:space-between; align-items:baseline;
        font-size:11px; text-transform:uppercase; letter-spacing:.1em; color:#8a8378;
        margin:0 0 6px;
      }
      .ap-range-value { font-family: var(--mono); color: var(--developer); }
      .ap-control.ap-select, .ap-control.ap-number {
        width:100%; background:var(--paper); color:var(--ink); border:1px solid var(--line);
        border-radius:2px; padding:10px 12px; font-family:var(--mono); font-size:13px;
        box-sizing: border-box;
      }
      .ap-control.ap-range { width:100%; accent-color: var(--safelight); }
      .ap-toggle-row { display:flex; align-items:center; justify-content:space-between; padding-top:2px; }
      .ap-toggle { position:relative; width:36px; height:20px; flex-shrink:0; display:inline-block; }
      .ap-toggle input { opacity:0; width:0; height:0; }
      .ap-toggle .ap-slider {
        position:absolute; inset:0; background:#4a453e; border-radius:20px; transition:.15s; cursor:pointer;
      }
      .ap-toggle .ap-slider::before {
        content:''; position:absolute; width:14px; height:14px; left:3px; top:3px;
        background:#efe9df; border-radius:50%; transition:.15s;
      }
      .ap-toggle input:checked + .ap-slider { background: var(--developer); }
      .ap-toggle input:checked + .ap-slider::before { transform: translateX(16px); }
      .ap-empty { color:#5c574e; font-size:12px; padding:6px 0; grid-column:1/-1; }
    `;
    document.head.appendChild(style);
  }

  function labelFor(key, def) {
    return def.label || key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function mount(container, initialSchema) {
    injectStyle();

    let schema = {};
    let state = {};
    let fieldEls = {};

    function updateDependents() {
      Object.keys(schema).forEach((key) => {
        const def = schema[key];
        if (!def.dependsOn && !def.disabledWhen) return;
        const wrap = fieldEls[key] && fieldEls[key].wrap;
        if (!wrap) return;
        let disabled = false;
        if (def.dependsOn) disabled = disabled || !state[def.dependsOn];
        if (def.disabledWhen) disabled = disabled || !!state[def.disabledWhen];
        wrap.classList.toggle('ap-disabled', disabled);
      });
    }

    function getValues() {
      const out = {};
      Object.keys(schema).forEach((key) => {
        const def = schema[key];
        if (def.dependsOn && !state[def.dependsOn]) return; // gated off — omit entirely
        if (def.disabledWhen && state[def.disabledWhen]) return; // overridden by another field — omit entirely
        out[key] = state[key];
      });
      return out;
    }

    function buildField(key, def) {
      const wrap = document.createElement('div');
      wrap.className = 'ap-field';
      if (def.type === 'select' && (def.options || []).length > 4) wrap.classList.add('ap-full');

      if (def.type === 'checkbox') {
        const row = document.createElement('div');
        row.className = 'ap-toggle-row';
        const lbl = document.createElement('span');
        lbl.className = 'ap-label';
        lbl.textContent = labelFor(key, def);
        const toggle = document.createElement('label');
        toggle.className = 'ap-toggle';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = !!def.default;
        const slider = document.createElement('span');
        slider.className = 'ap-slider';
        toggle.appendChild(input);
        toggle.appendChild(slider);
        row.appendChild(lbl);
        row.appendChild(toggle);
        wrap.appendChild(row);
        input.addEventListener('change', () => {
          state[key] = input.checked;
          updateDependents();
        });
        fieldEls[key] = { wrap, input };
        return wrap;
      }

      if (def.type === 'select') {
        const lbl = document.createElement('label');
        lbl.className = 'ap-label';
        lbl.textContent = labelFor(key, def);
        const select = document.createElement('select');
        select.className = 'ap-control ap-select';
        (def.options || []).forEach((opt) => {
          const isObj = opt && typeof opt === 'object';
          const value = isObj ? opt.value : opt;
          const text = isObj ? opt.label : String(opt);
          const o = document.createElement('option');
          o.value = value;
          o.textContent = text;
          if (value === def.default) o.selected = true;
          select.appendChild(o);
        });
        wrap.appendChild(lbl);
        wrap.appendChild(select);
        select.addEventListener('change', () => {
          state[key] = select.value;
          updateDependents();
        });
        fieldEls[key] = { wrap, input: select };
        return wrap;
      }

      if (def.type === 'range') {
        const lbl = document.createElement('label');
        lbl.className = 'ap-label';
        const nameSpan = document.createElement('span');
        nameSpan.textContent = labelFor(key, def);
        const valueSpan = document.createElement('span');
        valueSpan.className = 'ap-range-value';
        valueSpan.textContent = def.default;
        lbl.appendChild(nameSpan);
        lbl.appendChild(valueSpan);
        const input = document.createElement('input');
        input.type = 'range';
        input.className = 'ap-control ap-range';
        input.min = def.min;
        input.max = def.max;
        input.step = def.step || 1;
        input.value = def.default;
        wrap.appendChild(lbl);
        wrap.appendChild(input);
        input.addEventListener('input', () => {
          const isFloat = def.step && def.step < 1;
          state[key] = isFloat ? parseFloat(input.value) : parseInt(input.value, 10);
          valueSpan.textContent = input.value;
          updateDependents();
        });
        fieldEls[key] = { wrap, input };
        return wrap;
      }

      if (def.type === 'number') {
        const lbl = document.createElement('label');
        lbl.className = 'ap-label';
        lbl.textContent = labelFor(key, def);
        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'ap-control ap-number';
        if (def.min !== undefined) input.min = def.min;
        if (def.max !== undefined) input.max = def.max;
        input.step = def.step || 1;
        input.value = def.default;
        wrap.appendChild(lbl);
        wrap.appendChild(input);

        function clamp() {
          let v = parseInt(input.value, 10);
          if (isNaN(v)) v = def.default;
          if (def.min !== undefined) v = Math.max(def.min, v);
          if (def.max !== undefined) v = Math.min(def.max, v);
          input.value = v;
          return v;
        }
        input.addEventListener('input', () => {
          const v = parseInt(input.value, 10);
          state[key] = isNaN(v) ? input.value : v; // let the user type freely; clamp on blur
          updateDependents();
        });
        input.addEventListener('blur', () => {
          state[key] = clamp();
        });
        fieldEls[key] = { wrap, input };
        return wrap;
      }

      // Unknown/unsupported type: never fall back to a free-text input.
      return null;
    }

    function setSchema(newSchema) {
      schema = newSchema || {};
      state = {};
      fieldEls = {};
      container.innerHTML = '';
      container.classList.add('ap-panel');

      const keys = Object.keys(schema);
      if (keys.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'ap-empty';
        empty.textContent = 'This model has no adjustable parameters.';
        container.appendChild(empty);
        return;
      }

      keys.forEach((key) => { state[key] = schema[key].default; });
      keys.forEach((key) => {
        const el = buildField(key, schema[key]);
        if (el) container.appendChild(el);
      });

      updateDependents();
    }

    setSchema(initialSchema);
    return { getValues, setSchema, container };
  }

  return { mount };
})();
