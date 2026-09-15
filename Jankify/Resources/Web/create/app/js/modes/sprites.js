/**
 * Sprite generator — MapGenerator + CellularAutomata + flood-fill coloring.
 * Port of Deep-Fold SpriteGenerator core (canvas 2D).
 */
import { cosinePalette, mulberry32 } from "../rng.js";
import { generateName } from "../names.js";

function randBool(rng, chanceEmpty = 0.48) {
  return rng() > chanceEmpty;
}

function generateMap(rng, size, symmetry) {
  const w = size;
  const h = size;
  const map = Array.from({ length: w }, () => Array(h).fill(false));
  const half = Math.ceil(w * 0.5);

  for (let x = 0; x < half; x++) {
    for (let y = 0; y < h; y++) {
      let v = randBool(rng, 0.48);
      const toCenter = (Math.abs(y - h * 0.5) * 2.0) / h;
      if (x === Math.floor(w * 0.5) - 1 || x === Math.floor(w * 0.5) - 2) {
        if (rng() * 0.4 > toCenter) v = true;
      }
      map[x][y] = v;
      map[w - x - 1][y] = v;
    }
  }

  for (let walk = 0; walk < 2; walk++) {
    let px = Math.floor(rng() * w);
    let py = Math.floor(rng() * h);
    for (let i = 0; i < 100; i++) {
      if (px >= 0 && px < w && py >= 0 && py < h) {
        map[px][py] = true;
        map[w - px - 1][py] = true;
      }
      px += Math.floor(rng() * 3) - 1;
      py += Math.floor(rng() * 3) - 1;
    }
  }

  for (let x = Math.ceil(w * 0.5); x < w; x++) {
    for (let y = 0; y < h; y++) {
      if (rng() * 100 > symmetry) {
        map[x][y] = randBool(rng, 0.48);
        const toCenter = (Math.abs(y - h * 0.5) * 2.0) / h;
        if (x === Math.floor(w * 0.5) - 1 || x === Math.floor(w * 0.5) - 2) {
          if (rng() * 0.4 > toCenter) map[x][y] = true;
        }
      }
    }
  }
  return map;
}

function neighbors(map, x, y) {
  let n = 0;
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      if (i === 0 && j === 0) continue;
      const xx = x + i;
      const yy = y + j;
      if (xx >= 0 && xx < map.length && yy >= 0 && yy < map[0].length && map[xx][yy]) n++;
    }
  }
  return n;
}

function caStep(map, birth = 5, death = 4) {
  const w = map.length;
  const h = map[0].length;
  const next = map.map((col) => col.slice());
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      const n = neighbors(map, x, y);
      if (map[x][y] && n < death) next[x][y] = false;
      else if (!map[x][y] && n > birth) next[x][y] = true;
    }
  }
  return next;
}

function valueNoise2d(x, y, seed) {
  const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

function smoothNoise(x, y, seed) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = valueNoise2d(x0, y0, seed);
  const b = valueNoise2d(x0 + 1, y0, seed);
  const c = valueNoise2d(x0, y0 + 1, seed);
  const d = valueNoise2d(x0 + 1, y0 + 1, seed);
  return a + (b - a) * u + (c - a) * v * (1 - u) + (d - b) * u * v;
}

function fbmNoise(x, y, seed) {
  let val = 0;
  let amp = 0.5;
  let xx = x;
  let yy = y;
  for (let i = 0; i < 5; i++) {
    val += smoothNoise(xx, yy, seed) * amp;
    xx *= 2;
    yy *= 2;
    amp *= 0.5;
  }
  return val;
}

function paintSprite(map, scheme, eyeScheme, nColors, outline, seed) {
  const w = map.length;
  const h = map[0].length;
  const pixels = Array.from({ length: w }, () => Array(h).fill(null));
  const checked = Array.from({ length: w }, () => Array(h).fill(false));

  const get = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? null : map[x][y]);

  const colorAt = (x, y, isNeg, right, left, down, up) => {
    const colX = Math.ceil(Math.abs(x - (w - 1) * 0.5));
    let n = Math.pow(Math.abs(fbmNoise(colX * 0.3, y * 0.3, seed)), 1.5) * 3;
    let n2 = Math.pow(Math.abs(fbmNoise(colX * 0.2, y * 0.2, seed + 99)), 1.5) * 3;
    if (!down) {
      n = isNeg ? n2 - 0.1 : n - 0.45;
      n *= 0.8;
    }
    if (!right) {
      n = isNeg ? n2 + 0.1 : n + 0.2;
      n *= 1.1;
    }
    if (!up) {
      n = isNeg ? n2 + 0.15 : n + 0.45;
      n *= 1.2;
    }
    if (!left) {
      n = isNeg ? n2 + 0.1 : n + 0.2;
      n *= 1.1;
    }
    n = Math.max(0, Math.min(1, n));
    n2 = Math.max(0, Math.min(1, n2));
    const idx = Math.floor(n * (nColors - 1));
    const idx2 = Math.floor(n2 * (nColors - 1));
    return isNeg ? eyeScheme[idx2] : scheme[idx];
  };

  const flood = (targetMap, isNeg) => {
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        if (checked[x][y] || !targetMap[x][y]) {
          checked[x][y] = checked[x][y] || !targetMap[x][y];
          continue;
        }
        const bucket = [[x, y]];
        checked[x][y] = true;
        let valid = true;
        const cells = [];
        while (bucket.length) {
          const [cx, cy] = bucket.pop();
          const right = get(cx + 1, cy);
          const left = get(cx - 1, cy);
          const down = get(cx, cy + 1);
          const up = get(cx, cy - 1);
          // for negative eyes use inverted map occupancy
          const r = isNeg ? !map[cx + 1]?.[cy] && cx + 1 < w : right;
          const l = isNeg ? !map[cx - 1]?.[cy] && cx - 1 >= 0 : left;
          const d = isNeg ? !map[cx]?.[cy + 1] && cy + 1 < h : down;
          const u = isNeg ? !map[cx]?.[cy - 1] && cy - 1 >= 0 : up;

          if (isNeg && (cx === 0 || cy === 0 || cx === w - 1 || cy === h - 1)) valid = false;

          const col = colorAt(cx, cy, isNeg, r, l, d, u);
          cells.push({ x: cx, y: cy, col });
          if (outline && !isNeg) {
            if (!d) cells.push({ x: cx, y: cy + 1, col: [0, 0, 0] });
            if (!r) cells.push({ x: cx + 1, y: cy, col: [0, 0, 0] });
            if (!u) cells.push({ x: cx, y: cy - 1, col: [0, 0, 0] });
            if (!l) cells.push({ x: cx - 1, y: cy, col: [0, 0, 0] });
          }

          const tryPush = (nx, ny, filled) => {
            if (nx < 0 || ny < 0 || nx >= w || ny >= h || checked[nx][ny] || !filled) return;
            checked[nx][ny] = true;
            bucket.push([nx, ny]);
          };
          tryPush(cx + 1, cy, targetMap[cx + 1]?.[cy]);
          tryPush(cx - 1, cy, targetMap[cx - 1]?.[cy]);
          tryPush(cx, cy + 1, targetMap[cx]?.[cy + 1]);
          tryPush(cx, cy - 1, targetMap[cx]?.[cy - 1]);
        }
        if (!isNeg || valid) {
          for (const c of cells) {
            if (c.x >= 0 && c.y >= 0 && c.x < w && c.y < h) pixels[c.x][c.y] = c.col;
          }
        }
      }
    }
  };

  // reset checked for body
  for (let x = 0; x < w; x++) checked[x].fill(false);
  flood(map, false);

  // eyes = holes (negative)
  const neg = map.map((col) => col.map((v) => !v));
  for (let x = 0; x < w; x++) checked[x].fill(false);
  // only mark filled cells as unchecked for neg flood
  flood(neg, true);

  return pixels;
}

export const spritesMode = {
  id: "sprites",
  name: "Sprites",
  key: "4",
  blurb: "Cellular-automata pixel creatures (Deep-Fold SpriteGenerator port).",

  defaults() {
    return {
      seed: Math.floor(Math.random() * 1e9),
      size: 32,
      colors: 6,
      symmetry: 100,
      outline: true,
      scale: 16,
      bg: "#0b0f16", // standard stage backdrop, matches .gen-canvas + planets clear
      variants: 1,
      showName: true,
      idea: "creature",
      caBirth: 5,
      caDeath: 4,
      caSteps: 4,
    };
  },

  controls() {
    return [
      {
        type: "select",
        key: "idea",
        label: "Idea",
        options: [
          { value: "creature", label: "Creature (stock)" },
          { value: "bug", label: "Bug swarm" },
          { value: "bot", label: "Hard bot" },
          { value: "slime", label: "Soft slime" },
          { value: "totem", label: "Tall totem" },
          { value: "custom", label: "Custom (sliders)" },
        ],
      },
      { type: "number", key: "seed", label: "Seed", min: 0, max: 2e9, step: 1 },
      { type: "number", key: "size", label: "Grid", min: 12, max: 64, step: 1 },
      { type: "number", key: "colors", label: "Colors", min: 3, max: 12, step: 1 },
      { type: "range", key: "symmetry", label: "Symmetry", min: 0, max: 100, step: 1 },
      { type: "number", key: "scale", label: "Pixel scale", min: 4, max: 24, step: 1 },
      { type: "number", key: "variants", label: "Variants", min: 1, max: 9, step: 1 },
      { type: "number", key: "caSteps", label: "CA steps", min: 1, max: 8, step: 1 },
      { type: "number", key: "caBirth", label: "CA birth", min: 3, max: 8, step: 1 },
      { type: "number", key: "caDeath", label: "CA death", min: 2, max: 7, step: 1 },
      { type: "checkbox", key: "outline", label: "Outline" },
      { type: "checkbox", key: "showName", label: "Show name" },
      { type: "color", key: "bg", label: "Background" },
    ];
  },

  mount(host) {
    host.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "sprite-wrap";
    const nameEl = document.createElement("p");
    nameEl.className = "sprite-name";
    nameEl.hidden = true;
    const c = document.createElement("canvas");
    c.className = "gen-canvas pixelated";
    wrap.append(c, nameEl); // caption under the canvas so all modes share a top edge
    host.append(wrap);
    this._canvas = c;
    this._nameEl = nameEl;
  },

  unmount() {},

  _ideaState(state) {
    if (!state.idea || state.idea === "custom") return state;
    const presets = {
      creature: { symmetry: 100, caBirth: 5, caDeath: 4, caSteps: 4 },
      bug: { symmetry: 85, caBirth: 4, caDeath: 3, caSteps: 5 },
      bot: { symmetry: 100, caBirth: 6, caDeath: 5, caSteps: 3, outline: true },
      slime: { symmetry: 60, caBirth: 4, caDeath: 4, caSteps: 6, outline: false },
      totem: { size: Math.min(state.size || 32, 28), symmetry: 100, caBirth: 5, caDeath: 4, caSteps: 4 },
    };
    return { ...state, ...(presets[state.idea] || {}) };
  },

  _oneSprite(seed, state) {
    const rng = mulberry32(seed >>> 0);
    const size = state.size | 0;
    let map = generateMap(rng, size, Number(state.symmetry));
    const steps = Math.max(1, state.caSteps | 0);
    const birth = state.caBirth | 0;
    const death = state.caDeath | 0;
    for (let i = 0; i < steps; i++) map = caStep(map, birth, death);
    const scheme = cosinePalette(state.colors | 0, rng);
    const eyeScheme = cosinePalette(state.colors | 0, rng);
    return paintSprite(map, scheme, eyeScheme, state.colors | 0, !!state.outline, seed);
  },

  generate(state) {
    state = this._ideaState(state);
    const n = Math.max(1, Math.min(9, state.variants | 0));
    const size = state.size | 0;
    const scale = state.scale | 0;
    const cell = size * scale;
    const cols = n === 1 ? 1 : Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);
    const gap = Math.max(4, Math.floor(scale * 0.5));
    const canvas = this._canvas;
    canvas.width = cols * cell + (cols - 1) * gap;
    canvas.height = rows * cell + (rows - 1) * gap;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = state.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const names = [];
    for (let i = 0; i < n; i++) {
      const seed = ((state.seed >>> 0) + i * 9973) >>> 0;
      const pixels = this._oneSprite(seed, state);
      const col = i % cols;
      const row = Math.floor(i / cols);
      const ox = col * (cell + gap);
      const oy = row * (cell + gap);
      ctx.fillStyle = state.bg;
      ctx.fillRect(ox, oy, cell, cell);
      for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
          const c = pixels[x][y];
          if (!c) continue;
          ctx.fillStyle = `rgb(${c[0] * 255},${c[1] * 255},${c[2] * 255})`;
          ctx.fillRect(ox + x * scale, oy + y * scale, scale, scale);
        }
      }
      names.push(generateName(seed));
    }

    if (this._nameEl) {
      if (state.showName) {
        this._nameEl.hidden = false;
        this._nameEl.textContent = names.join(" · ");
      } else {
        this._nameEl.hidden = true;
      }
    }
    this._lastName = names[0] || "";
    return canvas;
  },

  exportCanvas() {
    return this._canvas;
  },

  recipeExtra(state) {
    const bits = [];
    if (state.idea && state.idea !== "creature") bits.push(state.idea);
    if (this._lastName) bits.push(`“${this._lastName}”`);
    return bits.length ? bits.join(" · ") : null;
  },
};
