/**
 * Effects — animated weapon/engine/shield effects as looping previews and
 * exportable sprite sheets. Six effect species, all deterministic from seed.
 */
import { mulberry32, rgbFromHex } from "../rng.js";
import { cell, easeOutQuad, renderSheet, startPreview } from "../fx-core.js";

const rgba = (hex, a) => {
  const [r, g, b] = rgbFromHex(hex);
  return `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${a})`;
};

const FX = {
  bolt: { label: "Bolt", loop: true },
  zap: { label: "Lightning", loop: true },
  flash: { label: "Muzzle flash", loop: false },
  shield: { label: "Shield hit", loop: false },
  plume: { label: "Engine plume", loop: true },
  warp: { label: "Warp ring", loop: false },
};

function drawEffect(ctx, kind, t, i, s) {
  const { w, h, px, color1, color2, rng } = s;
  const cx = w / 2, cy = h / 2;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  if (kind === "bolt") {
    // projectile crossing the frame, hot core + fading trail
    const progress = s.direction > 0 ? t : 1 - t;
    const x = -10 + (w + 20) * progress;
    const y = cy + s.offsetY + Math.sin(i * s.waveFrequency + s.phase) * px * s.waveAmplitude;
    for (let k = 0; k < 9; k++) {
      const tx = x - s.direction * k * s.trailStep;
      if (tx < -px || tx > w + px) continue;
      const ty = cy + s.offsetY + Math.sin((i - s.direction * k) * s.waveFrequency + s.phase) * px * s.waveAmplitude;
      const a = Math.max(0, 0.85 - k * 0.11);
      cell(ctx, tx, ty, px, rgba(color1, a));
    }
    const grd = ctx.createRadialGradient(x, y, 0, x, y, px * s.glowScale);
    grd.addColorStop(0, rgba(color2, 0.9));
    grd.addColorStop(1, rgba(color1, 0));
    ctx.fillStyle = grd;
    ctx.fillRect(x - px * 4, y - px * 4, px * 8, px * 8);
    cell(ctx, x, y, px, "#ffffff");
  } else if (kind === "zap") {
    // jagged arc across the frame, re-rolled each frame, with a branch
    const frameRng = mulberry32((s.seed + i * 101) >>> 0);
    const segs = 10;
    let py = cy;
    let branch = null;
    for (let k = 0; k <= segs; k++) {
      const x = (w / segs) * k;
      const ny = k === 0 || k === segs ? cy : cy + (frameRng() - 0.5) * h * 0.5;
      ctx.strokeStyle = rgba(color1, 0.4);
      ctx.lineWidth = px * 1.6;
      ctx.beginPath(); ctx.moveTo(x - w / segs, py); ctx.lineTo(x, ny); ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = Math.max(1, px * 0.5);
      ctx.beginPath(); ctx.moveTo(x - w / segs, py); ctx.lineTo(x, ny); ctx.stroke();
      if (k === Math.floor(segs / 2) && frameRng() < 0.7) branch = { x, y: ny };
      py = ny;
    }
    if (branch) {
      let bx = branch.x, by = branch.y;
      for (let k = 0; k < 4; k++) {
        const nx = bx + w * 0.06, ny2 = by + (frameRng() - 0.5) * h * 0.4;
        ctx.strokeStyle = rgba(color2, 0.6);
        ctx.lineWidth = Math.max(1, px * 0.5);
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(nx, ny2); ctx.stroke();
        bx = nx; by = ny2;
      }
    }
  } else if (kind === "flash") {
    // muzzle burst: rays + core, brightest early then gone
    const a = Math.max(0, 1 - easeOutQuad(t) * 1.15);
    if (a > 0) {
      const rays = 7;
      for (let k = 0; k < rays; k++) {
        const ang = (k / rays) * Math.PI * 2 + s.spin;
        const len = (h * 0.42) * (0.5 + rng() * 0.0 + [1, 0.55, 0.8, 0.5, 0.9, 0.6, 0.7][k % 7] * 0.5) * (0.6 + 0.4 * (1 - t));
        ctx.strokeStyle = rgba(color1, a * 0.8);
        ctx.lineWidth = px;
        ctx.beginPath(); ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(ang) * len, cy + Math.sin(ang) * len); ctx.stroke();
      }
      const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, h * 0.3 * (0.4 + 0.6 * (1 - t)));
      grd.addColorStop(0, `rgba(255,255,255,${a})`);
      grd.addColorStop(0.4, rgba(color2, a * 0.9));
      grd.addColorStop(1, rgba(color1, 0));
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);
    }
  } else if (kind === "shield") {
    // bubble flares at the hit point, ripple travels the rim, then fades
    const R = h * 0.36;
    const hit = s.spin; // seeded hit angle
    const fade = Math.max(0, 1 - t * 1.1);
    ctx.strokeStyle = rgba(color1, 0.25 + 0.3 * fade);
    ctx.lineWidth = px;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
    // ripple arcs spreading from the hit angle
    const spread = t * Math.PI * 1.6;
    ctx.strokeStyle = rgba(color2, 0.85 * fade);
    ctx.lineWidth = px * 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, R, hit - spread, hit + spread); ctx.stroke();
    // impact bloom
    const ix = cx + Math.cos(hit) * R, iy = cy + Math.sin(hit) * R;
    const grd = ctx.createRadialGradient(ix, iy, 0, ix, iy, R * 0.5 * (0.3 + t));
    grd.addColorStop(0, `rgba(255,255,255,${0.9 * fade})`);
    grd.addColorStop(1, rgba(color1, 0));
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);
  } else if (kind === "plume") {
    // engine exhaust: nozzle at left, flickering cone
    const frameRng = mulberry32((s.seed + i * 733) >>> 0);
    const len = w * (0.55 + frameRng() * 0.25);
    const half = h * 0.16;
    for (let x = 0; x < len; x += px) {
      const p = x / len;
      const spreadY = half * (0.35 + p * 1.1) * (0.8 + frameRng() * 0.4);
      const count = Math.max(1, Math.round((1 - p) * 4));
      for (let k = 0; k < count; k++) {
        const y = cy + (frameRng() * 2 - 1) * spreadY;
        const col = p < 0.18 ? "#ffffff" : p < 0.5 ? color2 : color1;
        cell(ctx, x, y, px, rgba(col === "#ffffff" ? "#ffffff" : col, (1 - p) * 0.95));
      }
    }
    const grd = ctx.createRadialGradient(0, cy, 0, 0, cy, h * 0.5);
    grd.addColorStop(0, rgba(color2, 0.7));
    grd.addColorStop(1, rgba(color1, 0));
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);
  } else if (kind === "warp") {
    // collapsing entry ring with radial star streaks
    const R = h * 0.44 * (1 - easeOutQuad(t) * 0.85);
    const a = t < 0.85 ? 0.9 : 0.9 * (1 - (t - 0.85) / 0.15);
    ctx.strokeStyle = rgba(color1, a);
    ctx.lineWidth = px * (1 + 2 * (1 - t));
    ctx.beginPath(); ctx.arc(cx, cy, Math.max(2, R), 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = rgba(color2, a * 0.7);
    ctx.lineWidth = Math.max(1, px * 0.5);
    const streaks = 12;
    for (let k = 0; k < streaks; k++) {
      const ang = (k / streaks) * Math.PI * 2 + s.spin + t * 0.6;
      const r0 = R * 1.15, r1 = R * (1.5 + 0.8 * (1 - t));
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0);
      ctx.lineTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1);
      ctx.stroke();
    }
    cell(ctx, cx, cy, px, `rgba(255,255,255,${a})`);
  }
  ctx.restore();
}

export const effectsMode = {
  id: "effects",
  name: "Effects",
  key: "6",
  blurb: "Animated weapon, engine, and shield effects — looping preview, sprite-sheet export.",

  defaults() {
    return {
      seed: Math.floor(Math.random() * 1e9),
      fx: "bolt",
      frames: 12,
      size: 96,
      px: 4,
      color1: "#6ee7ff",
      color2: "#b7f6ff",
    };
  },

  controls() {
    return [
      {
        type: "select",
        key: "fx",
        label: "Effect",
        options: Object.entries(FX).map(([value, def]) => ({ value, label: def.label })),
      },
      { type: "number", key: "seed", label: "Seed", min: 0, max: 2e9, step: 1 },
      { type: "number", key: "frames", label: "Frames", min: 4, max: 24, step: 1 },
      { type: "number", key: "size", label: "Frame size", min: 48, max: 160, step: 8 },
      { type: "number", key: "px", label: "Pixel size", min: 2, max: 8, step: 1 },
      { type: "color", key: "color1", label: "Glow" },
      { type: "color", key: "color2", label: "Core" },
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
    const w = Math.max(48, state.size | 0);
    const h = w;
    const n = Math.max(4, Math.min(24, state.frames | 0));
    const rng = mulberry32(state.seed >>> 0);
    const s = {
      w, h,
      px: Math.max(2, state.px | 0),
      color1: state.color1,
      color2: state.color2,
      seed: state.seed >>> 0,
      spin: rng() * Math.PI * 2,
      phase: rng() * Math.PI * 2,
      offsetY: (rng() - 0.5) * h * 0.28,
      waveFrequency: 0.8 + rng() * 1.5,
      waveAmplitude: 0.45 + rng() * 1.35,
      trailStep: Math.max(2, state.px | 0) * (1.15 + rng() * 1.1),
      glowScale: 2.5 + rng() * 1.8,
      direction: rng() < 0.5 ? -1 : 1,
      rng,
    };
    const kind = FX[state.fx] ? state.fx : "bolt";
    this._sheet = renderSheet(n, w, h, (ctx, t, i) => drawEffect(ctx, kind, t, i, s));
    // filmstrip under the loop so the export artifact is visible
    this._strip.width = this._sheet.width;
    this._strip.height = this._sheet.height;
    this._strip.getContext("2d").drawImage(this._sheet, 0, 0);
    this._stop = startPreview(this._preview, this._sheet, n, w, h, 14);
    this._lastLabel = `${FX[kind].label.toLowerCase()} · ${n}f`;
    return this._sheet;
  },

  exportCanvas() {
    return this._sheet || null;
  },

  recipeExtra() {
    return this._lastLabel || null;
  },
};
