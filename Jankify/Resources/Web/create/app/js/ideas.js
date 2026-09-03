/**
 * PixelGen idea lab — compose / vary beyond stock Deep-Fold defaults.
 * Each mode can register named ideas (presets + mutators).
 */

import { mulberry32, randRange, hexFromRgb, cosinePalette } from "./rng.js";

/** Named starting points — hull classes of the part-based warship builder. */
export const SHIP_IDEAS = [
  { id: "mixed", label: "Any class", apply: (s) => ({ ...s, idea: "mixed" }) },
  { id: "interceptor", label: "Interceptor", apply: (s) => ({ ...s, idea: "interceptor" }) },
  { id: "fighter", label: "Fighter", apply: (s) => ({ ...s, idea: "fighter" }) },
  { id: "gunship", label: "Gunship", apply: (s) => ({ ...s, idea: "gunship" }) },
  { id: "cruiser", label: "Cruiser", apply: (s) => ({ ...s, idea: "cruiser" }) },
  { id: "dreadnought", label: "Dreadnought", apply: (s) => ({ ...s, idea: "dreadnought" }) },
  { id: "carrier", label: "Carrier", apply: (s) => ({ ...s, idea: "carrier" }) },
];

export const SPRITE_IDEAS = [
  {
    id: "creature",
    label: "Creature (stock CA)",
    apply: (s) => ({ ...s, idea: "creature", symmetry: 100, caBirth: 5, caDeath: 4, caSteps: 4 }),
  },
  {
    id: "bug",
    label: "Bug swarm",
    apply: (s) => ({ ...s, idea: "bug", symmetry: 85, caBirth: 4, caDeath: 3, caSteps: 5, size: 28 }),
  },
  {
    id: "bot",
    label: "Hard bot",
    apply: (s) => ({ ...s, idea: "bot", symmetry: 100, caBirth: 6, caDeath: 5, caSteps: 3, outline: true }),
  },
  {
    id: "slime",
    label: "Soft slime",
    apply: (s) => ({ ...s, idea: "slime", symmetry: 60, caBirth: 4, caDeath: 4, caSteps: 6, outline: false }),
  },
  {
    id: "totem",
    label: "Tall totem",
    apply: (s) => ({ ...s, idea: "totem", size: 24, symmetry: 100, caBirth: 5, caDeath: 4, caSteps: 4 }),
  },
];

export function ideasFor(modeId) {
  if (modeId === "ships") return SHIP_IDEAS;
  if (modeId === "sprites") return SPRITE_IDEAS;
  return [];
}

/**
 * Vary: keep seed family or re-seed, mutate structural knobs for exploration.
 * lockSeed=true keeps seed, mutates shape/colors.
 */
export function varyState(modeId, state, { reseed = false, amount = 0.35 } = {}) {
  const rng = mulberry32((Date.now() ^ (state.seed || 0) ^ 0xdeadbeef) >>> 0);
  const next = { ...state };
  if (reseed) next.seed = Math.floor(rng() * 1e9);

  const jitter = (v, lo, hi, scale = amount) => {
    const n = Number(v);
    const span = (hi - lo) * scale;
    return Math.min(hi, Math.max(lo, n + (rng() * 2 - 1) * span));
  };

  if (modeId === "ships") {
    // same hull (seed + class unchanged), fresh paint job
    const pal = cosinePalette(3, rng);
    next.color1 = hexFromRgb(pal[0]);
    next.color2 = hexFromRgb(pal[1]);
    next.glow = hexFromRgb(pal[2].map((c) => Math.min(1, c * 1.3 + 0.25)));
  } else if (modeId === "sprites") {
    next.symmetry = Math.round(jitter(next.symmetry, 20, 100, amount));
    next.colors = Math.round(jitter(next.colors || 6, 3, 12, amount));
    next.size = Math.round(jitter(next.size || 32, 16, 48, amount * 0.5));
    if (rng() > 0.5) {
      const idea = SPRITE_IDEAS[Math.floor(rng() * SPRITE_IDEAS.length)];
      Object.assign(next, idea.apply(next));
    }
  } else if (modeId === "planets") {
    const types = ["rocky", "gas", "ice", "lava", "star", "blackhole", "asteroid", "galaxy"];
    if (rng() > 0.4) next.planetType = types[Math.floor(rng() * types.length)];
    next.rotation = jitter(next.rotation ?? 0.8, 0, 6.28, amount);
    next.pixels = Math.round(jitter(next.pixels || 120, 60, 180, amount * 0.4));
  } else if (modeId === "backgrounds") {
    // same composition, new palette (pal overrides the seed for colors only)
    next.pal = Math.floor(rng() * 1e9);
    if (rng() > 0.85) next.reduceBg = !next.reduceBg;
  } else if (modeId === "starscapes") {
    // same composition, new palette
    next.pal = Math.floor(rng() * 1e9);
  } else if (modeId === "effects") {
    // Switch archetypes as well as energy: a remix should never be only paint.
    const effects = ["bolt", "zap", "flash", "shield", "plume", "warp"];
    const current = effects.indexOf(next.fx);
    next.fx = effects[(Math.max(0, current) + 1 + Math.floor(rng() * (effects.length - 1))) % effects.length];
    const pal = cosinePalette(2, rng);
    next.color1 = hexFromRgb(pal[0].map((c) => Math.min(1, c * 1.2 + 0.2)));
    next.color2 = hexFromRgb(pal[1].map((c) => Math.min(1, c * 0.6 + 0.4)));
  } else if (modeId === "explosions") {
    // Move to a new silhouette, then tune its energy and debris.
    const shapes = ["nova", "ring", "cone", "cluster"];
    const current = shapes.indexOf(next.shape);
    next.shape = shapes[(Math.max(0, current) + 1 + Math.floor(rng() * (shapes.length - 1))) % shapes.length];
    const pals = ["fire", "plasma", "void", "emp"];
    next.palette = pals[(pals.indexOf(next.palette) + 1 + Math.floor(rng() * 3)) % pals.length];
    next.power = jitter(next.power ?? 1, 0.4, 2, amount);
    next.debris = Math.round(jitter(next.debris ?? 18, 0, 48, amount));
  }

  next.seed = next.seed ?? state.seed;
  return next;
}

export function applyIdea(modeId, ideaId, state) {
  const list = ideasFor(modeId);
  const idea = list.find((i) => i.id === ideaId);
  if (!idea) return state;
  return idea.apply({ ...state });
}
