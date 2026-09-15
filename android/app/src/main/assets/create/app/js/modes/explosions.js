/**
 * Explosions — chunky procedural blasts: flash, fireball, shockwave, debris,
 * smoke. Looping preview + sprite-sheet export, deterministic from seed.
 */
import { mulberry32 } from "../rng.js";
import { easeOutCubic, easeOutQuad, renderSheet, startPreview } from "../fx-core.js";

/** Color ramps, hot core → cool edge → smoke. */
const PALETTES = {
  fire: { label: "Fire", ramp: ["#ffffff", "#ffe98a", "#ffb13c", "#f4632a", "#a8262a", "#511d24"], smoke: "#3a3a42" },
  plasma: { label: "Plasma", ramp: ["#ffffff", "#b7f6ff", "#6ee7ff", "#4a90e0", "#7048c9", "#2a1a52"], smoke: "#2c3350" },
  void: { label: "Void", ramp: ["#ffffff", "#f2b7ff", "#cc79e0", "#8a3fb0", "#4a1a70", "#1c0a30"], smoke: "#241c33" },
  emp: { label: "EMP", ramp: ["#ffffff", "#d8fff6", "#8affe0", "#3fd0c0", "#1a8090", "#0a3a4a"], smoke: "#1c3038" },
};

const BLAST_SHAPES = {
  nova: { label: "Nova" },
  ring: { label: "Shock ring" },
  cone: { label: "Directed" },
  cluster: { label: "Cluster" },
};

function buildBlast(state) {
  const rng = mulberry32(state.seed >>> 0);
  const id = BLAST_SHAPES[state.shape] ? state.shape : "nova";
  const shape = {
    id,
    offsetX: (rng() - 0.5) * state.size * 0.18,
    offsetY: (rng() - 0.5) * state.size * 0.18,
    stretchX: 0.78 + rng() * 0.44,
    stretchY: 0.78 + rng() * 0.44,
    lobes: 2 + Math.floor(rng() * 4),
    lobePhase: rng() * Math.PI * 2,
    lobeStrength: 0.08 + rng() * 0.16,
    direction: rng() * Math.PI * 2,
    clusterCenters: [],
  };
  if (id === "cluster") {
    shape.lobes = 5 + Math.floor(rng() * 4);
    shape.lobeStrength = 0.18 + rng() * 0.14;
    for (let i = 0; i < 3; i++) {
      const angle = rng() * Math.PI * 2;
      shape.clusterCenters.push({
        x: Math.cos(angle) * state.size * (0.08 + rng() * 0.15),
        y: Math.sin(angle) * state.size * (0.08 + rng() * 0.15),
        scale: 0.55 + rng() * 0.3,
      });
    }
  }
  const debris = [];
  const nD = Math.max(0, Math.min(48, state.debris | 0));
  for (let i = 0; i < nD; i++) {
    const ang = rng() * Math.PI * 2;
    const speed = 0.45 + rng() * 0.8;
    debris.push({
      ang,
      speed,
      wobble: (rng() - 0.5) * 0.6,
      life: 0.55 + rng() * 0.45,
    });
  }
  // per-cell noise field for the fireball's ragged edge
  const noise = new Map();
  const noiseAt = (gx, gy) => {
    const k = `${gx},${gy}`;
    if (!noise.has(k)) {
      const n = mulberry32(((state.seed >>> 0) ^ (gx * 73856093) ^ (gy * 19349663)) >>> 0)();
      noise.set(k, n);
    }
    return noise.get(k);
  };
  return { debris, noiseAt, shape, smokeSpin: rng() * Math.PI * 2 };
}

function drawBlast(ctx, t, i, state, blast) {
  const w = state.size, h = state.size;
  const { debris, noiseAt, shape } = blast;
  const cx = w / 2 + shape.offsetX, cy = h / 2 + shape.offsetY;
  const px = Math.max(2, state.px | 0);
  const pal = PALETTES[state.palette] || PALETTES.fire;
  const R = h * 0.34 * (0.6 + (state.power ?? 1) * 0.4);

  ctx.save();

  // — shockwave ring —
  if (state.shockwave) {
    const sr = R * 1.7 * easeOutCubic(t);
    const sa = Math.max(0, 0.7 * (1 - t * 1.15));
    if (sa > 0) {
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = `rgba(255,255,255,${sa * 0.6})`;
      ctx.lineWidth = Math.max(1, px * (1 - t) * 1.5);
      ctx.beginPath(); ctx.ellipse(cx, cy, sr * shape.stretchX, sr * shape.stretchY, 0, 0, Math.PI * 2); ctx.stroke();
    }
  }

  // — fireball: chunky cells, hot centre, ragged noisy rim, cooling over time —
  const growth = easeOutCubic(Math.min(1, t / 0.55));
  const r = R * growth;
  const cool = Math.max(0, (t - 0.35) / 0.65); // 0 → hot, 1 → burnt out
  ctx.globalCompositeOperation = "source-over";
  for (let gy = Math.floor((cy - r * 1.7) / px); gy <= (cy + r * 1.7) / px; gy++) {
    for (let gx = Math.floor((cx - r * 1.7) / px); gx <= (cx + r * 1.7) / px; gx++) {
      const x = gx * px + px / 2, y = gy * px + px / 2;
      const dx = (x - cx) / shape.stretchX;
      const dy = (y - cy) / shape.stretchY;
      let d = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);
      const n = noiseAt(gx, gy);
      const lobedEdge = 1 + Math.sin(angle * shape.lobes + shape.lobePhase) * shape.lobeStrength;
      let edge = r * (0.75 + n * 0.45) * lobedEdge;
      if (shape.id === "cone") {
        const forward = Math.cos(angle - shape.direction);
        if (forward < -0.15) continue;
        edge *= 0.5 + 0.9 * Math.max(0, forward);
      } else if (shape.id === "cluster") {
        for (const cluster of shape.clusterCenters) {
          d = Math.min(d, Math.hypot(dx - cluster.x, dy - cluster.y) / cluster.scale);
        }
      }
      if (d > edge) continue;
      if (shape.id === "ring" && d < edge * (0.42 + 0.1 * n)) continue;
      // heat: 1 at centre → 0 at rim, dragged down as the blast cools
      let heat = (1 - d / Math.max(1, edge)) * (1 - cool * 0.9) + n * 0.15 - cool * 0.25;
      if (heat <= 0.02) {
        if (state.smoke && t > 0.4 && n > 0.35) {
          const sa = Math.max(0, (1 - t) * 0.8) * (0.3 + n * 0.4);
          ctx.fillStyle = pal.smoke;
          ctx.globalAlpha = sa;
          ctx.fillRect(gx * px, gy * px, px, px);
          ctx.globalAlpha = 1;
        }
        continue;
      }
      const idx = Math.min(pal.ramp.length - 1, Math.floor((1 - heat) * pal.ramp.length));
      ctx.fillStyle = pal.ramp[idx];
      ctx.fillRect(gx * px, gy * px, px, px);
    }
  }

  // — initial flash —
  if (t < 0.14) {
    const fa = 1 - t / 0.14;
    ctx.globalCompositeOperation = "lighter";
    const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.1);
    grd.addColorStop(0, `rgba(255,255,255,${fa})`);
    grd.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);
  }

  // — debris: embers flying straight out, cooling along the ramp —
  ctx.globalCompositeOperation = "lighter";
  for (const p of debris) {
    if (t > p.life) continue;
    const dist = R * 0.3 + R * 1.6 * easeOutQuad(t) * p.speed;
    const ang = p.ang + p.wobble * t;
    const x = cx + Math.cos(ang) * dist;
    const y = cy + Math.sin(ang) * dist;
    const heat = 1 - t / p.life;
    const idx = Math.min(PALETTES.fire.ramp.length - 2, Math.floor((1 - heat) * 4));
    ctx.fillStyle = (PALETTES[state.palette] || PALETTES.fire).ramp[idx];
    ctx.globalAlpha = 0.4 + heat * 0.6;
    ctx.fillRect(Math.floor(x / px) * px, Math.floor(y / px) * px, px, px);
    // 1-cell trail
    const tx = cx + Math.cos(ang) * (dist - px * 1.5);
    const ty = cy + Math.sin(ang) * (dist - px * 1.5);
    ctx.globalAlpha = 0.25 * heat;
    ctx.fillRect(Math.floor(tx / px) * px, Math.floor(ty / px) * px, px, px);
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

export const explosionsMode = {
  id: "explosions",
  name: "Explosions",
  key: "7",
  blurb: "Procedural pixel blasts — flash, fireball, shockwave, debris, smoke. Sheet export.",

  defaults() {
    return {
      seed: Math.floor(Math.random() * 1e9),
      shape: "nova",
      palette: "fire",
      frames: 14,
      size: 96,
      px: 4,
      power: 1,
      debris: 18,
      shockwave: true,
      smoke: true,
    };
  },

  controls() {
    return [
      {
        type: "select",
        key: "shape",
        label: "Blast shape",
        options: Object.entries(BLAST_SHAPES).map(([value, def]) => ({ value, label: def.label })),
      },
      {
        type: "select",
        key: "palette",
        label: "Palette",
        options: Object.entries(PALETTES).map(([value, def]) => ({ value, label: def.label })),
      },
      { type: "number", key: "seed", label: "Seed", min: 0, max: 2e9, step: 1 },
      { type: "number", key: "frames", label: "Frames", min: 6, max: 32, step: 1 },
      { type: "number", key: "size", label: "Frame size", min: 48, max: 192, step: 8 },
      { type: "range", key: "power", label: "Power", min: 0.4, max: 2, step: 0.05 },
      { type: "number", key: "debris", label: "Debris", min: 0, max: 48, step: 1 },
      { type: "number", key: "px", label: "Pixel size", min: 2, max: 8, step: 1 },
      { type: "checkbox", key: "shockwave", label: "Shockwave" },
      { type: "checkbox", key: "smoke", label: "Smoke" },
    ];
  },

  mount(host) {
    host.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "fx-wrap";
    const preview = document.createElement("canvas");
    preview.className = "gen-canvas pixelated fx-preview";
    const strip = document.createElement("canvas");
    strip.className = "gen-canvas pixelated fx-strip";
    wrap.append(preview, strip);
    host.append(wrap);
    this._preview = preview;
    this._strip = strip;
    this._stop = null;
  },

  unmount() {
    this._stop?.();
    this._stop = null;
  },

  generate(state) {
    this._stop?.();
    const size = Math.max(48, state.size | 0);
    const n = Math.max(6, Math.min(32, state.frames | 0));
    const st = { ...state, size };
    const blast = buildBlast(st);
    this._sheet = renderSheet(n, size, size, (ctx, t, i) => drawBlast(ctx, t, i, st, blast));
    this._strip.width = this._sheet.width;
    this._strip.height = this._sheet.height;
    this._strip.getContext("2d").drawImage(this._sheet, 0, 0);
    this._stop = startPreview(this._preview, this._sheet, n, size, size, 15);
    const shape = BLAST_SHAPES[st.shape] || BLAST_SHAPES.nova;
    this._lastLabel = `${shape.label.toLowerCase()} · ${(PALETTES[state.palette] || PALETTES.fire).label.toLowerCase()} · ${n}f`;
    return this._sheet;
  },

  exportCanvas() {
    return this._sheet || null;
  },

  recipeExtra() {
    return this._lastLabel || null;
  },
};
