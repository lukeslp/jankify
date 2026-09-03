let modeLines = false;
let mountainStart = 300;

let skyColor, skyColor2, skyAccentColor, skyAccentColor2, mountainColor,
mountainColor2, starColor, starColor2, cloudColor;

var cols, rows;
var flowfield;
var particles = [];
var inc = 0.1;
let mountainDetail = 10;
var particleScl = 15;
let resolutionX = 600;
let resolutionY = 900;
let seed = 1;

function getRandomInt(max) {
  return Math.floor(Math.random() * Math.floor(max));
}

/**
 * rAF doesn't fire in hidden tabs, which froze generation mid-run whenever
 * the user switched away. Race it against a timeout: repaint-yield when
 * visible, timer-driven progress when hidden.
 */
/**
 * Report true content height (progress strip + canvas). documentElement
 * scrollHeight is useless here: it never reads below the iframe's own
 * viewport, so a too-tall frame measures itself and stays too tall.
 */
window.__pixelgenPostSize = function () {
  try {
    const container = document.getElementById("container");
    const h = Math.ceil(container ? container.getBoundingClientRect().bottom : 0) + 2;
    if (h > 60) {
      window.parent.postMessage({ type: "pixelgen-starscapes", event: "size", h }, "*");
    }
  } catch (_) {}
};

window.__pixelgenYield = function (cb) {
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    cb();
  };
  requestAnimationFrame(run);
  setTimeout(run, 90);
};

// ——— Seeded palettes: the seed should pick the mood, not just the shapes ———

function mulberry32(a) {
  let t = a >>> 0;
  return function () {
    t |= 0;
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function hslHex(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(1, s));
  l = Math.max(0, Math.min(1, l));
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
  return (
    "#" +
    rgb
      .map((v) => Math.round((v + m) * 255).toString(16).padStart(2, "0"))
      .join("")
  );
}

// [h, s, l] per input slot: sky1 (low sky), sky2 (zenith), accent1, accent2,
// mountain1 (body), mountain2 (bright faces), star1, star2, cloud
const SKY_FAMILIES = [
  // twilight — the original Deep-Fold mood
  [[205, 0.5, 0.44], [259, 0.15, 0.25], [330, 0.55, 0.6], [297, 0.34, 0.42], [130, 0.35, 0.35], [72, 0.6, 0.55], [43, 0.9, 0.53], [183, 0.75, 0.75], [174, 0.55, 0.93]],
  // sunset ember
  [[14, 0.7, 0.6], [275, 0.4, 0.16], [32, 1.0, 0.66], [340, 0.55, 0.55], [340, 0.2, 0.16], [18, 0.45, 0.42], [42, 1.0, 0.74], [55, 1.0, 0.87], [25, 0.75, 0.8]],
  // arctic dawn
  [[210, 0.35, 0.78], [222, 0.3, 0.42], [340, 0.55, 0.83], [212, 0.4, 0.72], [205, 0.2, 0.45], [200, 0.3, 0.93], [0, 0, 1.0], [215, 1.0, 0.87], [204, 0.45, 0.97]],
  // emerald aurora
  [[172, 0.45, 0.22], [215, 0.5, 0.1], [160, 0.6, 0.52], [215, 0.5, 0.54], [165, 0.45, 0.14], [130, 0.4, 0.55], [160, 1.0, 0.92], [183, 0.75, 0.75], [155, 0.35, 0.83]],
  // crimson dusk
  [[345, 0.5, 0.33], [290, 0.4, 0.1], [350, 0.7, 0.64], [300, 0.45, 0.44], [335, 0.35, 0.12], [16, 0.5, 0.54], [36, 1.0, 0.81], [14, 1.0, 0.73], [16, 0.5, 0.78]],
  // ink & gold
  [[222, 0.26, 0.28], [225, 0.28, 0.09], [46, 0.7, 0.47], [217, 0.2, 0.53], [214, 0.26, 0.15], [214, 0.15, 0.56], [47, 1.0, 0.77], [219, 1.0, 0.9], [214, 0.25, 0.73]],
];

const PALETTE_INPUT_IDS = [
  "skyColor1", "skyColor2", "skyAccentColor1", "skyAccentColor2",
  "mountainColor1", "mountainColor2", "starColor1", "starColor2", "cloudColor1",
];

function applyPaletteFromSeed(s) {
  const rng = mulberry32(s >>> 0);
  let cols;
  if (rng() < 0.35) {
    // curated family with a WIDE drift — anchors that still surprise
    const fam = SKY_FAMILIES[Math.floor(rng() * SKY_FAMILIES.length)];
    const hueDrift = (rng() - 0.5) * 70;
    cols = fam.map(([h, sat, l]) => [
      h + hueDrift + (rng() - 0.5) * 14,
      sat + (rng() - 0.5) * 0.14,
      l + (rng() - 0.5) * 0.08,
    ]);
  } else {
    // Fully procedural, with the constraints two outside reviews agreed on:
    // one harmony scheme per seed (not three free hue poles), mountains tied
    // to the sky, and explicit lightness separation between stacked bands.
    const skyHue = rng() * 360;
    const skySat = 0.35 + rng() * 0.3;
    const skyL = 0.4 + rng() * 0.2;
    const zenithHue = skyHue + (rng() - 0.5) * 50;
    // single harmony: split-complement (150–210°) or analogous (±40°)
    const split = rng() < 0.6;
    const accentHue = skyHue + (split ? 150 + rng() * 60 : (rng() < 0.5 ? 1 : -1) * (20 + rng() * 20));
    const accent2Hue = accentHue + (skyHue - accentHue) * (0.35 + rng() * 0.3); // bridge back toward sky
    // mountains: harmonized with the sky; free hue only rarely
    const mountainHue = rng() < 0.15 ? rng() * 360 : skyHue + 120 + rng() * 120;
    const mountainBodyL = Math.min(0.3, skyL - 0.15 - rng() * 0.08); // always darker than the sky
    const cloudL = 0.8 + rng() * 0.14;
    const mountainFaceL = Math.min(cloudL - 0.12, mountainBodyL + 0.22 + rng() * 0.14);
    const starWarm = rng() < 0.5;
    const cloudTint = rng() < 0.6 ? skyHue : accentHue;
    cols = [
      [skyHue, skySat, skyL], // low sky
      [zenithHue, 0.25 + rng() * 0.3, 0.08 + rng() * 0.16], // zenith (darker)
      [accentHue, Math.min(0.6, 0.4 + rng() * 0.25), 0.5 + rng() * 0.2], // accent 1 (sat-capped)
      [accent2Hue, 0.35 + rng() * 0.25, 0.4 + rng() * 0.2], // accent 2 bridges to sky
      [mountainHue, Math.min(skySat, 0.2 + rng() * 0.3), mountainBodyL], // mountain body
      [mountainHue + (rng() - 0.5) * 30, 0.3 + rng() * 0.35, mountainFaceL], // bright faces
      [starWarm ? 35 + rng() * 25 : 180 + rng() * 45, 0.7 + rng() * 0.3, 0.75 + rng() * 0.18], // star 1
      [starWarm ? 180 + rng() * 45 : 35 + rng() * 25, 0.6 + rng() * 0.4, 0.78 + rng() * 0.15], // star 2
      [cloudTint, 0.15 + rng() * 0.3, cloudL], // clouds stay the brightest band
    ];
  }
  cols.forEach((hsl, i) => {
    const el = document.getElementById(PALETTE_INPUT_IDS[i]);
    if (el) el.value = hslHex(hsl[0], hsl[1], hsl[2]);
  });
}

function readSeedFromQuery() {
  try {
    const q = new URLSearchParams(location.search);
    if (q.has("seed") && q.get("seed") !== "") {
      const n = Number(q.get("seed"));
      if (!Number.isNaN(n)) return n;
    }
  } catch (_) {}
  return null;
}

function initSeedField() {
  const el = document.getElementById("seedText");
  if (!el) return;
  const bootSeed = readSeedFromQuery();
  if (bootSeed != null) el.value = bootSeed;
  else if (!el.value || el.value === "0") el.value = getRandomInt(1e9);

  // Optional width/height/palette-variant from query (shell)
  try {
    const q = new URLSearchParams(location.search);
    if (q.has("width")) {
      const w = Number(q.get("width"));
      if (w > 0) document.getElementById("resolutionX").value = w;
    }
    if (q.has("height")) {
      const h = Number(q.get("height"));
      if (h > 0) document.getElementById("resolutionY").value = h;
    }
    if (q.has("pal")) {
      const p = Number(q.get("pal"));
      if (!Number.isNaN(p)) window.__pixelgenPal = p;
    }
  } catch (_) {}
}

// DOM may not be fully ready if script order changes; safe after body scripts
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSeedField);
} else {
  initSeedField();
}

function setBusy(busy) {
  document.querySelectorAll("button").forEach((b) => {
    b.disabled = !!busy;
  });
}

function setProgress(fraction, label, detail) {
  const root = document.getElementById("progress");
  const text = document.getElementById("progress-text");
  const det = document.getElementById("progress-detail");
  const fill = document.getElementById("progress-fill");
  const bar = document.getElementById("progress-bar");
  if (!root) return;
  if (fraction < 0) {
    root.hidden = true;
    // progress strip collapsed — re-report height so the frame shrinks to fit
    window.__pixelgenPostSize();
    return;
  }
  root.hidden = false;
  const pct = Math.max(0, Math.min(100, Math.round(fraction * 100)));
  if (text) text.textContent = label || "Generating…";
  if (det) det.textContent = detail || `${pct}%`;
  if (fill) fill.style.width = pct + "%";
  if (bar) bar.setAttribute("aria-valuenow", String(pct));
  try {
    window.parent.postMessage(
      {
        type: "pixelgen-starscapes",
        event: "progress",
        fraction,
        label: label || "Generating…",
        detail: detail || `${pct}%`,
        seed,
      },
      "*"
    );
  } catch (_) {}
}

function generate() {
  if (typeof color !== "function" || typeof drawFromSeed !== "function") {
    window.__pixelgenPendingGenerate = true;
    return;
  }
  if (window.__pixelgenGenerating) return;
  // Claim the lock NOW — boot fires generate from up to three paths (self-start,
  // shell pending post, shell load fallback) and drawFromSeed runs one rAF later.
  window.__pixelgenGenerating = true;

  resolutionX = Math.max(1.0, Number(document.getElementById("resolutionX").value) || 600);
  resolutionY = Math.max(1.0, Number(document.getElementById("resolutionY").value) || 900);

  mountainDetail = Math.max(1.0, Number(document.getElementById("mountainDetail").value) || 5);
  // Higher particleScl = fewer particles = faster (default 15 can freeze for minutes)
  particleScl = Math.max(8.0, Number(document.getElementById("particleDetail").value) || 18);

  modeLines = Boolean(document.getElementById("modeSelectLines").checked);

  skyColor = color(document.getElementById("skyColor1").value);
  skyColor2 = color(document.getElementById("skyColor2").value);
  skyAccentColor = color(document.getElementById("skyAccentColor1").value);
  skyAccentColor2 = color(document.getElementById("skyAccentColor2").value);
  mountainColor = color(document.getElementById("mountainColor1").value);
  mountainColor2 = color(document.getElementById("mountainColor2").value);
  starColor = color(document.getElementById("starColor1").value);
  starColor2 = color(document.getElementById("starColor2").value);
  cloudColor = color(document.getElementById("cloudColor1").value);

  seed = Number(document.getElementById("seedText").value) || 1;
  // Palette follows the seed unless a palette variant (Vary) overrides it.
  // Same palette seed keeps any manual color tweaks.
  const palSeed = (window.__pixelgenPal ?? seed) >>> 0;
  if (palSeed !== window.__pixelgenPaletteSeed) {
    applyPaletteFromSeed(palSeed);
    window.__pixelgenPaletteSeed = palSeed;
    skyColor = color(document.getElementById("skyColor1").value);
    skyColor2 = color(document.getElementById("skyColor2").value);
    skyAccentColor = color(document.getElementById("skyAccentColor1").value);
    skyAccentColor2 = color(document.getElementById("skyAccentColor2").value);
    mountainColor = color(document.getElementById("mountainColor1").value);
    mountainColor2 = color(document.getElementById("mountainColor2").value);
    starColor = color(document.getElementById("starColor1").value);
    starColor2 = color(document.getElementById("starColor2").value);
    cloudColor = color(document.getElementById("cloudColor1").value);
  }
  randomSeed(seed);
  noiseSeed(seed);
  mountainStart = resolutionY / 2.5;

  setBusy(true);
  setProgress(0.02, "Starting…", "preparing canvas");
  // Yield so the progress bar paints before heavy work
  window.__pixelgenYield(() => {
    try {
      drawFromSeed();
    } catch (err) {
      console.error(err);
      window.__pixelgenGenerating = false;
      setBusy(false);
      setProgress(1, "Failed", String(err.message || err));
    }
  });
}

function generateRandom() {
  seed = getRandomInt(1e9);
  document.getElementById("seedText").value = seed;
  mountainStart = resolutionY / 2.5;
  generate();
}

window.addEventListener("message", (ev) => {
  const d = ev.data;
  if (!d || d.type !== "pixelgen-starscapes") return;
  if (d.cmd === "generate" || d.cmd === "set") {
    if (d.seed != null && !Number.isNaN(Number(d.seed))) {
      document.getElementById("seedText").value = Number(d.seed);
    }
    if (d.width != null) document.getElementById("resolutionX").value = Number(d.width);
    if (d.height != null) document.getElementById("resolutionY").value = Number(d.height);
    window.__pixelgenPal = d.pal != null && !Number.isNaN(Number(d.pal)) ? Number(d.pal) : null;
    generate();
  } else if (d.cmd === "random") {
    generateRandom();
  } else if (d.cmd === "export") {
    let dataURL = null;
    try {
      const cvs = document.querySelector("#container canvas");
      if (cvs) dataURL = cvs.toDataURL("image/png");
    } catch (err) {
      console.error("Starscapes export failed", err);
    }
    try {
      window.parent.postMessage(
        { type: "pixelgen-starscapes", event: "export", dataURL, seed },
        "*"
      );
    } catch (_) {}
  }
});

window.__pixelgenStarscapesReady = false;
window.__pixelgenPendingGenerate = false;

/** Called from sketch setup once p5 + canvas exist. Always paints once. */
window.__pixelgenMarkReady = function () {
  window.__pixelgenStarscapesReady = true;
  try {
    window.parent.postMessage({ type: "pixelgen-starscapes", event: "ready" }, "*");
  } catch (_) {}
  // Always self-start so the canvas is never left empty.
  try {
    generate();
  } catch (err) {
    console.error("Starscapes generate failed", err);
  }
  window.__pixelgenPendingGenerate = false;
};
