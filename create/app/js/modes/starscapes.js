// Seeded canvas backgrounds by Luke Steuber. The recipe id remains compatible.
export const starscapesMode = {
  id: "starscapes",
  name: "Backgrounds",
  key: "1",
  blurb: "Seeded night skies and layered mountain silhouettes.",

  defaults() {
    return { seed: Math.floor(Math.random() * 1e9), width: 512, height: 512 };
  },

  controls() {
    return [
      { type: "number", key: "seed", label: "Seed", min: 0, max: 2e9, step: 1 },
      { type: "number", key: "width", label: "Width", min: 200, max: 900, step: 10 },
      { type: "number", key: "height", label: "Height", min: 200, max: 1200, step: 10 },
    ];
  },

  mount(host) {
    host.innerHTML = "";
    const stack = document.createElement("div");
    stack.className = "canvas-stack starscapes-stack";
    this._canvas = document.createElement("canvas");
    this._canvas.className = "gen-canvas";
    stack.append(this._canvas);
    host.append(stack);
  },

  unmount() {
    this._canvas = null;
  },

  generate(state) {
    this._preview(state);
    return this._canvas;
  },

  _preview(state) {
    const w = state.width | 0;
    const h = state.height | 0;
    const c = this._canvas;
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    let s = state.seed >>> 0;
    const rnd = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, `hsl(${220 + rnd() * 40},55%,18%)`);
    g.addColorStop(0.55, `hsl(${280 + rnd() * 30},45%,28%)`);
    g.addColorStop(1, `hsl(${200 + rnd() * 20},40%,22%)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 500; i++) {
      ctx.fillStyle = `rgba(255,255,255,${rnd()})`;
      ctx.fillRect(rnd() * w, rnd() * h * 0.55, rnd() * 2, rnd() * 2);
    }
    const base = h * 0.55;
    for (let layer = 0; layer < 5; layer++) {
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 6) {
        const n = Math.sin(x * 0.01 + layer + state.seed) * 20 + Math.sin(x * 0.03 + layer * 2) * 12;
        const y = base + layer * 24 + n + rnd() * 8;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fillStyle = `hsla(${100 + layer * 15},40%,${25 + layer * 8}%,0.9)`;
      ctx.fill();
    }
  },

  exportCanvas() {
    return this._canvas;
  },

  exportAsync() {
    return Promise.resolve(this._canvas?.toDataURL("image/png") || null);
  },
};
