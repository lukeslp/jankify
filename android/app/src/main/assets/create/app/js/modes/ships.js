/**
 * Ships mode — PixelGen shell wiring around the shared warship engine
 * (see ../warship-engine.js for the generator itself).
 */
import { mulberry32 } from "../rng.js";
import {
  buildShip,
  composeBattleScene,
  makePalette,
  pickClass,
  renderShip,
} from "../warship-engine.js";

export const shipsMode = {
  id: "ships",
  name: "Ships",
  key: "5",
  blurb: "Part-built pixel warships — one hull at a time, six classes, your livery.",

  defaults() {
    return {
      seed: Math.floor(Math.random() * 1e9),
      idea: "mixed",
      scale: 10,
      fleet: 1,
      battle: false,
      outline: true,
      color1: "#5f7f9e",
      color2: "#c9862e",
      glow: "#ffa13c",
    };
  },

  controls() {
    return [
      {
        type: "select",
        key: "idea",
        label: "Class",
        options: [
          { value: "mixed", label: "Mixed wing" },
          { value: "interceptor", label: "Interceptor" },
          { value: "fighter", label: "Fighter" },
          { value: "gunship", label: "Gunship" },
          { value: "cruiser", label: "Cruiser" },
          { value: "dreadnought", label: "Dreadnought" },
          { value: "carrier", label: "Carrier" },
        ],
      },
      { type: "number", key: "seed", label: "Seed", min: 0, max: 2e9, step: 1 },
      { type: "number", key: "fleet", label: "Fleet size", min: 1, max: 9, step: 1 },
      { type: "checkbox", key: "battle", label: "Battle scene" },
      { type: "number", key: "scale", label: "Pixel scale", min: 4, max: 14, step: 1 },
      { type: "checkbox", key: "outline", label: "Outline" },
      { type: "color", key: "color1", label: "Hull" },
      { type: "color", key: "color2", label: "Trim" },
      { type: "color", key: "glow", label: "Engine glow" },
    ];
  },

  mount(host) {
    host.innerHTML = "";
    const c = document.createElement("canvas");
    c.className = "gen-canvas pixelated";
    host.append(c);
    this._canvas = c;
  },

  unmount() {},

  generate(state) {
    if (state.battle) {
      this._lastLabel = composeBattleScene(this._canvas, {
        seed: state.seed >>> 0,
        w: 512,
        h: 512,
        n: Math.max(1, Math.min(9, state.fleet | 0)),
        idea: state.idea,
        outline: state.outline,
        liveryA: { hull: state.color1, trim: state.color2, glow: state.glow },
      });
      return this._canvas;
    }
    return this._lineup(state);
  },

  /** Lineup: 1..n ships of the chosen class family on the standard backdrop. */
  _lineup(state) {
    const rng = mulberry32(state.seed >>> 0);
    const pal = makePalette(state.color1, state.color2, state.glow);
    const n = Math.max(1, Math.min(9, state.fleet | 0));
    const scale = Math.max(2, state.scale | 0);
    const ships = [];
    for (let i = 0; i < n; i++) {
      const cls = pickClass(rng, state.idea);
      const ship = buildShip(((state.seed >>> 0) + i * 7919) >>> 0, cls);
      ships.push({ canvas: renderShip(ship, pal, n === 1 ? scale : Math.max(3, scale - 2), state.outline), cls });
    }
    const cols = n === 1 ? 1 : Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);
    const cw = Math.max(...ships.map((s) => s.canvas.width));
    const ch = Math.max(...ships.map((s) => s.canvas.height));
    const gap = 10;
    const out = this._canvas;
    out.width = cols * cw + (cols - 1) * gap;
    out.height = rows * ch + (rows - 1) * gap;
    const ctx = out.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, out.width, out.height);
    ships.forEach((s, i) => {
      const x = (i % cols) * (cw + gap) + (cw - s.canvas.width) / 2;
      const y = Math.floor(i / cols) * (ch + gap) + (ch - s.canvas.height) / 2;
      ctx.drawImage(s.canvas, x, y);
    });
    this._lastLabel = n === 1 ? ships[0].cls : `${n}× ${state.idea}`;
    return out;
  },

  exportCanvas() {
    return this._canvas;
  },

  recipeExtra(state) {
    return [state.battle ? "battle" : null, this._lastLabel].filter(Boolean).join(" · ");
  },
};
