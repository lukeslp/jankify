/**
 * Solar War war-table battle vignettes — progressive enhancement overlay.
 *
 * Loaded by dynasts-war-table/index.html with one script tag; everything else
 * lives here so the compiled table bundle is never touched. Watches the
 * narration card (<aside class="rage-moment">) and, when an event headline
 * describes combat or seizure between families, renders a small deterministic
 * battle vignette in family liveries beneath the caption.
 *
 * Fails closed: any error just means no vignette.
 */
import { renderVignette } from "./warship-engine.js";

// Okabe-Ito family liveries matching the table's canvas colors
const FAMILIES = {
  petrov: "#CC79A7",
  kesteral: "#E8D44D",
  vane: "#56B4E9",
  harrow: "#E69F00",
  marsh: "#009E73",
};

const COMBAT = /\b(strike|struck|attack|raid|raided|boarders?|boarded|took|captur\w*|impound\w*|seiz\w*|crippl\w*|fleet is on its final run)\b/i;

function hashText(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function familiesIn(text) {
  const found = [];
  const lower = text.toLowerCase();
  for (const name of Object.keys(FAMILIES)) {
    const idx = lower.indexOf(name);
    if (idx >= 0) found.push({ name, idx });
  }
  found.sort((a, b) => a.idx - b.idx);
  return found.map((f) => f.name);
}

let lastHeadline = null;

function update() {
  const aside = document.querySelector("aside.rage-moment");
  if (!aside) return;
  const headline = aside.querySelector(".headline")?.textContent?.trim() || "";
  if (headline === lastHeadline) return;
  lastHeadline = headline;

  const old = aside.querySelector(".pixelgen-vignette");
  const fams = familiesIn(headline);
  const combat = COMBAT.test(headline) && fams.length >= 1;
  if (!combat) {
    old?.remove();
    return;
  }

  const attacker = FAMILIES[fams[0]];
  const defender = fams[1] ? FAMILIES[fams[1]] : FAMILIES[Object.keys(FAMILIES).find((f) => f !== fams[0])];

  let canvas = old;
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.className = "pixelgen-vignette";
    canvas.style.cssText =
      "display:block;width:100%;height:auto;margin-top:10px;border:1px solid rgba(255,255,255,0.12);border-radius:6px;image-rendering:pixelated;";
    canvas.setAttribute("role", "img");
    aside.append(canvas);
  }
  canvas.setAttribute("aria-label", `Battle vignette: ${headline}`);
  renderVignette(canvas, {
    seed: hashText(headline),
    w: 300,
    h: 110,
    attacker,
    defender,
    intensity: /final|twelve|war fleet|crippl/i.test(headline) ? 2 : 1,
  });
}

try {
  const observer = new MutationObserver(() => {
    try {
      update();
    } catch (_) {}
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  update();
} catch (_) {}
