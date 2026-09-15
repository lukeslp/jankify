/**
 * Warship engine — the shared core behind PixelGen's Ships mode, the Hangar,
 * and external consumers (Solar War war-table vignettes).
 *
 * Part-based pixel ships on a nose-up grid: hull half-width profile, swept
 * wings, cockpit glass, trim, panels, guns, engines with exhaust glow.
 * Everything is deterministic from (seed, class).
 */
import { mulberry32, rgbFromHex, hexFromRgb, hslToRgb } from "./rng.js";

// Cell codes in the ship grid
export const EMPTY = 0, HULL = 1, TRIM = 2, PANEL = 3, GLASS = 4, ENGINE = 5, GUN = 6;

/**
 * Class silhouettes. W must be odd (center spine column).
 * body: hull half-width as fraction of half grid; nose/tail: taper fractions.
 * wing: {at, len, span} — band position/length (fractions of H), span of half W.
 */
export const CLASSES = {
  interceptor: { W: 19, H: 42, body: 0.3, nose: 0.4, tail: 0.15, wing: { at: 0.6, len: 0.22, span: 0.95 }, engines: 1, guns: 2, spinal: false },
  fighter: { W: 25, H: 36, body: 0.34, nose: 0.32, tail: 0.18, wing: { at: 0.5, len: 0.3, span: 1.0 }, engines: 2, guns: 2, spinal: false },
  gunship: { W: 29, H: 34, body: 0.42, nose: 0.24, tail: 0.2, wing: { at: 0.38, len: 0.42, span: 0.9 }, engines: 2, guns: 4, spinal: false },
  cruiser: { W: 27, H: 50, body: 0.5, nose: 0.28, tail: 0.14, wing: { at: 0.55, len: 0.26, span: 0.75 }, engines: 3, guns: 4, spinal: false },
  dreadnought: { W: 33, H: 58, body: 0.58, nose: 0.22, tail: 0.12, wing: { at: 0.5, len: 0.3, span: 0.7 }, engines: 4, guns: 6, spinal: true },
  carrier: { W: 35, H: 54, body: 0.72, nose: 0.16, tail: 0.12, wing: { at: 0.42, len: 0.2, span: 0.55 }, engines: 3, guns: 2, spinal: false },
};
export const CLASS_IDS = Object.keys(CLASSES);
export const CAPITAL_IDS = ["cruiser", "dreadnought", "carrier"];
export const ESCORT_IDS = ["interceptor", "fighter", "gunship"];

export function pickClass(rng, idea) {
  if (idea && idea !== "mixed" && CLASSES[idea]) return idea;
  return CLASS_IDS[Math.floor(rng() * CLASS_IDS.length)];
}

/** Build one ship as a W×H grid of cell codes. Deterministic per (seed, class). */
export function buildShip(seed, clsName) {
  const rng = mulberry32(seed >>> 0);
  const cls = CLASSES[clsName];
  const W = cls.W, H = cls.H;
  const cx = (W - 1) / 2;
  const g = Array.from({ length: H }, () => new Array(W).fill(EMPTY));

  const bodyHW = Math.max(2, Math.round(cx * cls.body));
  const noseEnd = Math.round(H * cls.nose);
  const tailStart = Math.round(H * (1 - cls.tail));

  // — hull half-width profile, quantized noise so edges stay crisp —
  const hw = new Array(H).fill(0);
  let wob = 0;
  for (let y = 0; y < H; y++) {
    if (y % 4 === 0) wob = Math.floor(rng() * 3) - 1;
    if (y < noseEnd) {
      const t = y / noseEnd;
      hw[y] = Math.max(1, Math.round(1 + (bodyHW - 1) * t * t * (3 - 2 * t)));
    } else if (y >= tailStart) {
      const t = (y - tailStart) / Math.max(1, H - tailStart);
      hw[y] = Math.max(2, Math.round(bodyHW - (bodyHW * 0.35) * t));
    } else {
      hw[y] = Math.max(2, Math.min(cx, bodyHW + wob));
    }
  }

  // — swept wings: extent ramps up through the band (delta silhouette) —
  const wingHW = Math.round(cx * cls.wing.span);
  const wy0 = Math.round(H * cls.wing.at);
  const wLen = Math.max(3, Math.round(H * cls.wing.len));
  const wingTip = { x: 0, y: 0 };
  for (let r = 0; r < wLen && wy0 + r < tailStart; r++) {
    const y = wy0 + r;
    const ext = Math.round(wingHW * ((r + 1) / wLen));
    if (ext > hw[y]) {
      hw[y] = Math.min(cx, ext);
      if (hw[y] >= wingTip.x) { wingTip.x = hw[y]; wingTip.y = y; }
    }
  }

  for (let y = 0; y < H; y++)
    for (let x = cx - hw[y]; x <= cx + hw[y]; x++)
      if (x >= 0 && x < W) g[y][x] = HULL;

  // — carve notches on big hulls so they read as plated, not slabs —
  if (bodyHW >= 5) {
    const notches = 1 + Math.floor(rng() * 3);
    for (let i = 0; i < notches; i++) {
      const ny = noseEnd + Math.floor(rng() * Math.max(1, tailStart - noseEnd - 4));
      const nh = 2 + Math.floor(rng() * 3);
      const nd = 1 + Math.floor(rng() * 2);
      for (let y = ny; y < Math.min(ny + nh, H); y++) {
        const edge = hw[y];
        for (let d = 0; d < nd; d++) {
          g[y][cx - (edge - d)] = EMPTY;
          g[y][cx + (edge - d)] = EMPTY;
        }
      }
    }
  }

  const paint = (x, y, code) => {
    if (y >= 0 && y < H && x >= 0 && x < W && g[y][x] !== EMPTY) g[y][x] = code;
  };

  // — cockpit glass near the nose —
  const cy = Math.max(2, Math.round(H * (cls.nose * 0.7)));
  for (let y = cy; y < cy + 3; y++) { paint(cx, y, GLASS); paint(cx - 1, y, GLASS); paint(cx + 1, y, GLASS); }

  // — carrier flight deck: long bright center stripe —
  if (clsName === "carrier") {
    for (let y = noseEnd; y < tailStart; y++) { paint(cx, y, GLASS); paint(cx - 1, y, TRIM); paint(cx + 1, y, TRIM); }
  }

  // — trim stripes + spine —
  const stripes = 1 + Math.floor(rng() * 3);
  for (let i = 0; i < stripes; i++) {
    const sy = noseEnd + Math.floor(rng() * Math.max(1, tailStart - noseEnd));
    for (let x = cx - hw[sy]; x <= cx + hw[sy]; x++) paint(x, sy, TRIM);
  }
  if (rng() < 0.6 && clsName !== "carrier") for (let y = cy + 4; y < tailStart; y++) paint(cx, y, TRIM);

  // — dark panel blocks (mirrored) —
  const panels = 3 + Math.floor(rng() * 4);
  for (let i = 0; i < panels; i++) {
    const py = noseEnd + Math.floor(rng() * Math.max(1, tailStart - noseEnd - 3));
    const px = 1 + Math.floor(rng() * Math.max(1, bodyHW - 1));
    const pw = 1 + Math.floor(rng() * 2);
    const ph = 2 + Math.floor(rng() * 3);
    for (let y = py; y < py + ph; y++)
      for (let d = 0; d < pw; d++) { paint(cx - px - d, y, PANEL); paint(cx + px + d, y, PANEL); }
  }

  // — wing guns: barrels extend forward from the wingtips —
  const gunPairs = Math.max(1, Math.round(cls.guns / 2));
  for (let i = 0; i < gunPairs; i++) {
    const gx = Math.max(2, wingTip.x - 1 - i * 3);
    const gy = wingTip.y - 1;
    const len = 2 + Math.floor(rng() * 3);
    for (let d = 0; d <= len; d++) {
      const y = gy - d;
      if (y < 0) break;
      const code = d === 0 ? PANEL : GUN;
      if (g[y][cx - gx] === EMPTY) g[y][cx - gx] = code;
      if (g[y][cx + gx] === EMPTY) g[y][cx + gx] = code;
    }
  }
  // — spinal cannon on dreadnoughts: a heavy barrel past the nose —
  if (cls.spinal) {
    for (let d = 1; d <= 5; d++) {
      const y = 0 - d + Math.round(H * 0.06);
      if (y >= 0) { g[y][cx] = GUN; if (d < 3) { g[y][cx - 1] = GUN; g[y][cx + 1] = GUN; } }
    }
  }

  // — engines across the tail —
  const en = cls.engines;
  const tailHW = hw[H - 1];
  for (let e = 0; e < en; e++) {
    const off = en === 1 ? 0 : Math.round(((e / (en - 1)) * 2 - 1) * (tailHW - 1));
    for (const x of new Set([cx + off, cx - off])) {
      paint(x, H - 1, ENGINE); paint(x, H - 2, ENGINE); paint(x, H - 3, PANEL);
    }
  }

  // — greeble sprinkle —
  for (let y = noseEnd; y < tailStart; y++)
    for (let x = cx - hw[y]; x <= cx + hw[y]; x++)
      if (g[y][x] === HULL && rng() < 0.05) g[y][x] = rng() < 0.6 ? PANEL : TRIM;

  return { g, W, H, cx, cls: clsName };
}

export const shade = (rgb, k) => rgb.map((v) => Math.max(0, Math.min(1, v * k)));
export const css = (rgb, a = 1) => `rgba(${Math.round(rgb[0] * 255)},${Math.round(rgb[1] * 255)},${Math.round(rgb[2] * 255)},${a})`;

export function makePalette(hullHex, trimHex, glowHex) {
  const hull = rgbFromHex(hullHex), trim = rgbFromHex(trimHex), glow = rgbFromHex(glowHex);
  return {
    hull, hullLight: shade(hull, 1.35), hullDark: shade(hull, 0.6),
    trim, trimDark: shade(trim, 0.65),
    panel: shade(hull, 0.38),
    glass: [0.62, 0.91, 1.0], glassCore: [0.95, 1.0, 1.0],
    engine: glow, engineCore: [1.0, 0.95, 0.75],
    gun: shade(hull, 0.3),
    outline: [0.02, 0.04, 0.07],
    glow,
  };
}

/** Hue-rotate a hex color — enemy faction gets the complementary fleet livery. */
export function hueShift(hex, deg) {
  const [r, gg, b] = rgbFromHex(hex);
  const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), d = mx - mn;
  let h = 0;
  if (d > 0) {
    if (mx === r) h = 60 * (((gg - b) / d) % 6);
    else if (mx === gg) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - gg) / d + 4);
  }
  const l = (mx + mn) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return hexFromRgb(hslToRgb(h + deg, s, l));
}

/** Render a built ship to its own canvas. 1 grid cell = `scale` px, 1-cell outline pad. */
export function renderShip(ship, pal, scale, outline = true) {
  const { g, W, H } = ship;
  const c = document.createElement("canvas");
  c.width = (W + 2) * scale;
  c.height = (H + 2) * scale;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? EMPTY : g[y][x]);

  for (let y = -1; y <= H; y++) {
    for (let x = -1; x <= W; x++) {
      const v = at(x, y);
      let col = null;
      if (v === EMPTY) {
        if (outline && (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1))) col = pal.outline;
      } else if (v === HULL) {
        col = at(x, y - 1) === EMPTY ? pal.hullLight : at(x, y + 1) === EMPTY ? pal.hullDark : pal.hull;
      } else if (v === TRIM) {
        col = at(x, y - 1) === EMPTY ? pal.trim : pal.trimDark;
      } else if (v === PANEL) col = pal.panel;
      else if (v === GLASS) col = at(x, y - 1) === GLASS ? pal.glass : pal.glassCore;
      else if (v === ENGINE) col = y >= H - 1 || at(x, y + 1) === EMPTY ? pal.engineCore : pal.engine;
      else if (v === GUN) col = pal.gun;
      if (col) {
        ctx.fillStyle = css(col);
        ctx.fillRect((x + 1) * scale, (y + 1) * scale, scale, scale);
      }
    }
  }
  // engine exhaust glow
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (g[y][x] === ENGINE && (y === H - 1 || at(x, y + 1) === EMPTY)) {
        const gx = (x + 1.5) * scale, gy = (y + 2.2) * scale;
        const grd = ctx.createRadialGradient(gx, gy, 0, gx, gy, scale * 2.6);
        grd.addColorStop(0, css(pal.glow, 0.8));
        grd.addColorStop(1, css(pal.glow, 0));
        ctx.fillStyle = grd;
        ctx.fillRect(gx - scale * 3, gy - scale * 3, scale * 6, scale * 6);
      }
  return c;
}

/** Draw `img` centered at (x,y) rotated so nose-up faces `dir` (+1 → right, −1 → left). */
export function drawFacing(ctx, img, x, y, dir) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((dir > 0 ? 1 : -1) * Math.PI / 2);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, -img.width / 2, -img.height / 2);
  ctx.restore();
}

export function drawBolt(ctx, x1, y1, x2, y2, glowRgb) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = css(glowRgb, 0.35);
  ctx.lineWidth = 3.5;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.restore();
}

export function drawImpact(ctx, x, y, glowRgb, r) {
  const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
  grd.addColorStop(0, "rgba(255,255,255,0.95)");
  grd.addColorStop(0.35, css(glowRgb, 0.85));
  grd.addColorStop(1, css(glowRgb, 0));
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = grd;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/**
 * Compose a two-faction engagement onto `canvas`.
 * opts: { seed, w, h, n, idea, outline, capScale, escScale, stars, bg,
 *         liveryA: {hull, trim, glow}, liveryB: {hull, trim, glow} | null (auto hue-shift) }
 * Returns a short label describing the scene.
 */
export function composeBattleScene(canvas, opts) {
  const {
    seed = 1, w = 512, h = 512, n = 5, idea = "mixed", outline = true,
    capScale = 4, escScale = 3, stars = 130, bg = "#0b0f16",
    liveryA = { hull: "#5f7f9e", trim: "#c9862e", glow: "#ffa13c" },
    liveryB = null,
  } = opts;
  const rng = mulberry32(seed >>> 0);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  if (bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
  } else {
    ctx.clearRect(0, 0, w, h);
  }
  for (let i = 0; i < stars; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.12 + rng() * 0.5})`;
    const r = rng() < 0.9 ? 1 : 2;
    ctx.fillRect(rng() * w, rng() * h, r, r);
  }

  const palA = makePalette(liveryA.hull, liveryA.trim, liveryA.glow);
  const shift = 140 + rng() * 80;
  const lb = liveryB || { hull: hueShift(liveryA.hull, shift), trim: hueShift(liveryA.trim, shift), glow: hueShift(liveryA.glow, shift) };
  const palB = makePalette(lb.hull, lb.trim, lb.glow);

  const makeFleet = (pal, dir, baseSeed) => {
    const fleet = [];
    const capCls = idea !== "mixed" && CLASSES[idea] ? idea : CAPITAL_IDS[Math.floor(rng() * CAPITAL_IDS.length)];
    const cap = buildShip(baseSeed, capCls);
    fleet.push({ img: renderShip(cap, pal, capScale, outline), x: 0, y: h * (0.35 + rng() * 0.3), capital: true });
    for (let i = 1; i < n; i++) {
      const cls = idea !== "mixed" && CLASSES[idea] ? idea : ESCORT_IDS[Math.floor(rng() * ESCORT_IDS.length)];
      const s = buildShip((baseSeed + i * 7919) >>> 0, cls);
      fleet.push({ img: renderShip(s, pal, escScale, outline), x: 0, y: 0, capital: false });
    }
    // position: capital mid-column, escorts staggered ahead of it;
    // clamp so rotated hulls (width = img.height) stay on canvas
    const colX = dir > 0 ? w * 0.16 : w * 0.84;
    const clampX = (f, x) => Math.max(f.img.height / 2 + 4, Math.min(w - f.img.height / 2 - 4, x));
    const clampY = (f, y) => Math.max(f.img.width / 2 + 4, Math.min(h - f.img.width / 2 - 4, y));
    fleet.forEach((f, i) => {
      if (f.capital) { f.x = clampX(f, colX); f.y = clampY(f, f.y); return; }
      f.x = clampX(f, colX + dir * (w * 0.08 + rng() * w * 0.18));
      f.y = clampY(f, h * 0.12 + ((i - 0.5) / Math.max(1, n - 1)) * h * 0.76 + (rng() - 0.5) * h * 0.06);
    });
    fleet.dir = dir;
    return fleet;
  };

  const fleetA = makeFleet(palA, 1, seed >>> 0);
  const fleetB = makeFleet(palB, -1, ((seed >>> 0) ^ 0x9e3779b9) >>> 0);

  const volleys = [];
  const fire = (from, to, glowRgb) => {
    const shots = Math.min(7, 2 + Math.floor(rng() * (n + 2)));
    for (let i = 0; i < shots; i++) {
      const a = from[Math.floor(rng() * from.length)];
      const b = to[Math.floor(rng() * to.length)];
      const noseX = a.x + from.dir * (a.img.height / 2);
      const sy = a.y + (rng() - 0.5) * a.img.width * 0.4;
      const tx = b.x + (rng() - 0.5) * 14;
      const ty = b.y + (rng() - 0.5) * b.img.width * 0.6;
      volleys.push({ x1: noseX, y1: sy, x2: tx, y2: ty, glow: glowRgb, hit: rng() < 0.45 });
    }
  };
  fire(fleetA, fleetB, palA.glow);
  fire(fleetB, fleetA, palB.glow);
  for (const v of volleys) drawBolt(ctx, v.x1, v.y1, v.x2, v.y2, v.glow);

  for (const f of fleetA) drawFacing(ctx, f.img, f.x, f.y, 1);
  for (const f of fleetB) drawFacing(ctx, f.img, f.x, f.y, -1);
  for (const v of volleys) if (v.hit) drawImpact(ctx, v.x2, v.y2, v.glow, 5 + rng() * 9);

  return `battle ${n}v${n}`;
}

/**
 * Small event vignette: attacker fleet firing on a defender — sized for a
 * caption card. liveries are plain hex hull colors; trim/glow derived.
 */
export function renderVignette(canvas, { seed = 1, w = 280, h = 120, attacker = "#CC79A7", defender = "#E8D44D", intensity = 1 } = {}) {
  return composeBattleScene(canvas, {
    seed, w, h,
    n: intensity > 1 ? 2 : 1, // capital duel; escorts only for big engagements
    idea: "mixed",
    capScale: 2,
    escScale: 2,
    stars: 40,
    bg: "#070b12",
    liveryA: { hull: attacker, trim: hueShift(attacker, 40), glow: attacker },
    liveryB: { hull: defender, trim: hueShift(defender, 40), glow: defender },
  });
}
