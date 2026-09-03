/** Mulberry32 seeded PRNG + helpers (deterministic generate). */
export function mulberry32(a) {
  let t = a >>> 0;
  return function () {
    t |= 0;
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(str) {
  let h = 2166136261;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function randInt(rng, max) {
  return Math.floor(rng() * max);
}

export function randRange(rng, a, b) {
  return a + rng() * (b - a);
}

/** Cosine palette (iq) — matches Deep-Fold colorscheme idea. */
export function cosinePalette(n, rng) {
  const a = [randRange(rng, 0.2, 0.55), randRange(rng, 0.2, 0.55), randRange(rng, 0.2, 0.55)];
  const b = [randRange(rng, 0.15, 0.55), randRange(rng, 0.15, 0.55), randRange(rng, 0.15, 0.55)];
  const c = [randRange(rng, 0.4, 1.2), randRange(rng, 0.4, 1.2), randRange(rng, 0.4, 1.2)];
  const d = [rng(), rng(), rng()];
  const cols = [];
  for (let i = 0; i < n; i++) {
    const t = n <= 1 ? 0 : i / (n - 1);
    cols.push([
      clamp01(a[0] + b[0] * Math.cos(6.28318 * (c[0] * t + d[0]))),
      clamp01(a[1] + b[1] * Math.cos(6.28318 * (c[1] * t + d[1]))),
      clamp01(a[2] + b[2] * Math.cos(6.28318 * (c[2] * t + d[2]))),
    ]);
  }
  return cols;
}

export function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

/** h in degrees (wraps), s/l in 0..1 → [r,g,b] 0..1 */
export function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s = clamp01(s);
  l = clamp01(l);
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let rgb;
  if (h < 60) rgb = [c, x, 0];
  else if (h < 120) rgb = [x, c, 0];
  else if (h < 180) rgb = [0, c, x];
  else if (h < 240) rgb = [0, x, c];
  else if (h < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  return rgb.map((v) => v + m);
}

export function hexFromRgb(rgb) {
  const h = (v) =>
    Math.round(clamp01(v) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${h(rgb[0])}${h(rgb[1])}${h(rgb[2])}`;
}

export function rgbFromHex(hex) {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}
