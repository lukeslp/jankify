/**
 * PixelGen — unified web shell for all generator modes.
 * Shareable hash recipes, session history, export, keyboard.
 */
import { backgroundsMode } from "./modes/backgrounds.js";
import { effectsMode } from "./modes/effects.js";
import { explosionsMode } from "./modes/explosions.js";
import { planetsMode } from "./modes/planets.js";
import { shipsMode } from "./modes/ships.js";
import { spritesMode } from "./modes/sprites.js";
import { starscapesMode } from "./modes/starscapes.js";
import { clearHistory, loadHistory, pushHistory, thumbFromCanvas } from "./history.js";
import { varyState } from "./ideas.js";
import { canonicalRecipeURL, currentNativeShell } from "./native-shell.mjs";

const MODES = [starscapesMode, backgroundsMode, planetsMode, spritesMode, shipsMode, effectsMode, explosionsMode];

/** State keys safe for URL recipe (short, serializable). */
const RECIPE_KEYS = {
  starscapes: ["seed", "pal", "width", "height", "embed"],
  backgrounds: ["seed", "pal", "width", "height", "tile", "reduceBg", "showDust", "showNebulae", "showStars", "showPlanets", "transparent"],
  planets: ["seed", "pixels", "size", "planetType", "dither", "animate", "rotation", "lightX", "lightY", "useSeedLight"],
  sprites: ["seed", "size", "colors", "symmetry", "outline", "scale", "variants", "showName", "bg", "idea", "caBirth", "caDeath", "caSteps"],
  ships: ["seed", "idea", "scale", "fleet", "battle", "outline", "color1", "color2", "glow"],
  effects: ["seed", "fx", "frames", "size", "px", "color1", "color2"],
  explosions: ["seed", "shape", "palette", "frames", "size", "power", "debris", "px", "shockwave", "smoke"],
};

const els = {
  rail: document.getElementById("mode-rail"),
  stage: document.getElementById("stage-host"),
  controls: document.getElementById("controls-host"),
  blurb: document.getElementById("mode-blurb"),
  recipe: document.getElementById("recipe-text"),
  seed: document.getElementById("global-seed"),
  btnGen: document.getElementById("btn-generate"),
  btnRand: document.getElementById("btn-random"),
  btnVary: document.getElementById("btn-vary"),
  btnExport: document.getElementById("btn-export"),
  btnCopy: document.getElementById("btn-copy"),
  status: document.getElementById("status-pill"),
  history: document.getElementById("history-host"),
  toast: document.getElementById("toast"),
};

const store = {
  modeId: null,
  mode: null,
  state: {},
  history: loadHistory(),
  suppressHash: false,
  lastHistKey: null,
};

let genTimer = null;

function toast(msg, ms = 2200) {
  if (!els.toast) return;
  els.toast.textContent = msg;
  els.toast.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    els.toast.hidden = true;
  }, ms);
}

function parseHash() {
  const raw = (location.hash || "").replace(/^#\/?/, "");
  const [pathPart, queryPart] = raw.split("?");
  const idPart = (pathPart || "").split(/[/#]/)[0];
  const mode = MODES.find((m) => m.id === idPart || m.key === idPart) || MODES[0];
  const params = {};
  if (queryPart) {
    const sp = new URLSearchParams(queryPart);
    for (const [k, v] of sp.entries()) {
      if (v === "true") params[k] = true;
      else if (v === "false") params[k] = false;
      else if (v !== "" && !Number.isNaN(Number(v)) && !/^#/.test(v) && !/^[a-zA-Z]/.test(v)) {
        // numeric unless hex color
        params[k] = Number(v);
      } else if (/^#[0-9a-fA-F]{6}$/.test(v)) {
        params[k] = v;
      } else if (v !== "" && !Number.isNaN(Number(v)) && k !== "planetType" && k !== "bg" && !k.startsWith("color")) {
        params[k] = Number(v);
      } else {
        params[k] = v;
      }
    }
  }
  // fix numeric fields that are strings of digits
  for (const k of Object.keys(params)) {
    if (typeof params[k] === "string" && /^-?\d+(\.\d+)?$/.test(params[k])) {
      params[k] = Number(params[k]);
    }
  }
  return { modeId: mode.id, params };
}

function buildHash(modeId, state) {
  const keys = RECIPE_KEYS[modeId] || ["seed"];
  const sp = new URLSearchParams();
  for (const k of keys) {
    if (state[k] === undefined || state[k] === null) continue;
    sp.set(k, String(state[k]));
  }
  const q = sp.toString();
  return q ? `#/${modeId}?${q}` : `#/${modeId}`;
}

function writeHash(replace = false) {
  if (store.suppressHash) return;
  const url = buildHash(store.modeId, store.state);
  if (location.hash === url) return;
  if (replace) history.replaceState(null, "", url);
  else history.pushState(null, "", url);
}

function renderRail() {
  els.rail.innerHTML = "";
  for (const mode of MODES) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mode-btn";
    btn.dataset.mode = mode.id;
    btn.setAttribute("aria-current", mode.id === store.modeId ? "page" : "false");
    btn.innerHTML = `
      <span class="mode-key">${mode.key}</span>
      <span class="mode-name">${mode.name}</span>
    `;
    btn.addEventListener("click", () => activate(mode.id));
    els.rail.appendChild(btn);
  }
}

function buildControls() {
  const host = els.controls;
  host.innerHTML = "";
  const defs = store.mode.controls(store.state) || [];
  for (const def of defs) {
    const row = document.createElement("label");
    row.className = "ctrl-row";
    const span = document.createElement("span");
    span.className = "ctrl-label";
    span.textContent = def.label;
    row.appendChild(span);

    let input;
    const apply = (val, debounce = false) => {
      store.state[def.key] = val;
      if (def.key === "seed") els.seed.value = store.state.seed;
      if (debounce) scheduleGenerate();
      else generate();
    };

    if (def.type === "checkbox") {
      input = document.createElement("input");
      input.type = "checkbox";
      input.checked = !!store.state[def.key];
      input.addEventListener("change", () => apply(input.checked));
    } else if (def.type === "select") {
      input = document.createElement("select");
      for (const opt of def.options || []) {
        const o = document.createElement("option");
        o.value = opt.value;
        o.textContent = opt.label;
        if (store.state[def.key] === opt.value) o.selected = true;
        input.appendChild(o);
      }
      input.addEventListener("change", () => apply(input.value));
    } else if (def.type === "color") {
      input = document.createElement("input");
      input.type = "color";
      input.value = store.state[def.key] || "#ffffff";
      input.addEventListener("input", () => apply(input.value, true));
    } else if (def.type === "range") {
      input = document.createElement("input");
      input.type = "range";
      input.min = def.min;
      input.max = def.max;
      input.step = def.step ?? 0.01;
      input.value = store.state[def.key];
      const val = document.createElement("span");
      val.className = "ctrl-val";
      val.textContent = store.state[def.key];
      input.addEventListener("input", () => {
        val.textContent = input.value;
        apply(Number(input.value), true);
      });
      row.append(input, val);
      host.appendChild(row);
      continue;
    } else {
      input = document.createElement("input");
      input.type = "number";
      if (def.min != null) input.min = def.min;
      if (def.max != null) input.max = def.max;
      if (def.step != null) input.step = def.step;
      input.value = store.state[def.key];
      input.addEventListener("change", () => apply(Number(input.value)));
    }
    row.appendChild(input);
    host.appendChild(row);
  }
}

function scheduleGenerate() {
  clearTimeout(genTimer);
  genTimer = setTimeout(() => generate(), 80);
}

function updateRecipe() {
  const s = store.state;
  const extra = store.mode.recipeExtra?.(s);
  const bits = [
    store.mode.name.toLowerCase(),
    `seed ${s.seed ?? "—"}`,
    s.width && s.height ? `${s.width}×${s.height}` : s.size ? `${s.size}px` : null,
    s.planetType || null,
    s.variants > 1 ? `${s.variants} variants` : null,
    extra,
  ].filter(Boolean);
  els.recipe.textContent = bits.join(" · ");
  els.status.textContent = "live";
  const frameLabel = document.getElementById("frame-label");
  if (frameLabel) frameLabel.textContent = store.mode.name;
  document.title = `SpaceJank · ${store.mode.name} · ${s.seed ?? ""}`;
}

function recordHistory() {
  const canvas = store.mode?.exportCanvas?.();
  if (!canvas) return;
  const key = `${store.modeId}:${store.state.seed}:${store.state.planetType || ""}:${store.state.variants || 1}`;
  if (key === store.lastHistKey) return;
  store.lastHistKey = key;
  const thumb = thumbFromCanvas(canvas);
  if (!thumb) return;
  store.history = pushHistory({
    mode: store.modeId,
    seed: store.state.seed,
    label: els.recipe.textContent,
    thumb,
    hash: buildHash(store.modeId, store.state),
    t: Date.now(),
  });
  renderHistory();
}

function renderHistory() {
  if (!els.history) return;
  els.history.innerHTML = "";
  const head = document.createElement("div");
  head.className = "history-head";
  head.innerHTML = `<span>Recent</span>`;
  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.className = "btn ghost tiny";
  clearBtn.textContent = "Clear";
  clearBtn.addEventListener("click", () => {
    clearHistory();
    store.history = [];
    renderHistory();
  });
  head.appendChild(clearBtn);
  els.history.appendChild(head);

  if (!store.history.length) {
    const empty = document.createElement("p");
    empty.className = "history-empty";
    empty.textContent = "Generate to fill history.";
    els.history.appendChild(empty);
    return;
  }

  const row = document.createElement("div");
  row.className = "history-row";
  for (const item of store.history) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "history-thumb";
    btn.title = item.label || `${item.mode} ${item.seed}`;
    const img = document.createElement("img");
    img.src = item.thumb;
    img.alt = "";
    img.width = 56;
    img.height = 56;
    const label = document.createElement("span");
    label.textContent = MODES.find((m) => m.id === item.mode)?.name || item.mode;
    btn.append(img, label);
    btn.addEventListener("click", () => {
      if (item.hash) {
        store.suppressHash = true;
        location.hash = item.hash.replace(/^#/, "#");
        // force parse
        const { modeId, params } = parseHashFromString(item.hash);
        store.suppressHash = false;
        activate(modeId, { fromHash: true, params });
      }
    });
    row.appendChild(btn);
  }
  els.history.appendChild(row);
}

function parseHashFromString(hash) {
  const prev = location.hash;
  try {
    // temporary: use URL parser on absolute-like hash
    const h = hash.startsWith("#") ? hash : `#${hash}`;
    const raw = h.replace(/^#\/?/, "");
    const [pathPart, queryPart] = raw.split("?");
    const idPart = (pathPart || "").split(/[/#]/)[0];
    const mode = MODES.find((m) => m.id === idPart) || MODES[0];
    const params = {};
    if (queryPart) {
      const sp = new URLSearchParams(queryPart);
      for (const [k, v] of sp.entries()) {
        if (v === "true") params[k] = true;
        else if (v === "false") params[k] = false;
        else if (/^#[0-9a-fA-F]{6}$/.test(v)) params[k] = v;
        else if (/^-?\d+(\.\d+)?$/.test(v)) params[k] = Number(v);
        else params[k] = v;
      }
    }
    return { modeId: mode.id, params };
  } finally {
    void prev;
  }
}

function generate() {
  if (!store.mode) return;
  if (store.state.seed != null) els.seed.value = store.state.seed;
  try {
    store.mode.generate(store.state);
    updateRecipe();
    els.blurb.textContent = store.mode.blurb;
    writeHash(true);
    // thumbs after paint
    requestAnimationFrame(() => recordHistory());
  } catch (err) {
    console.error(err);
    els.recipe.textContent = `error: ${err.message}`;
    els.status.textContent = "error";
    toast(err.message || "Generate failed");
  }
}

function activate(id, { fromHash = false, params = null } = {}) {
  const mode = MODES.find((m) => m.id === id) || MODES[0];
  if (store.mode?.unmount) store.mode.unmount();
  store.modeId = mode.id;
  store.mode = mode;
  store.state = { ...mode.defaults(), ...(params || {}) };
  // coerce known booleans from hash params
  const defs = mode.defaults();
  for (const k of Object.keys(defs)) {
    if (typeof defs[k] === "boolean") {
      const v = store.state[k];
      store.state[k] = v === true || v === "true" || v === 1 || v === "1";
    }
  }
  if (!fromHash) writeHash(false);
  else if (!location.hash) history.replaceState(null, "", buildHash(mode.id, store.state));
  renderRail();
  mode.mount(els.stage);
  buildControls();
  els.seed.value = store.state.seed ?? "";
  generate();
}

/** New piece: a fresh seed, everything else re-derived from it. */
function randomize() {
  store.state.seed = Math.floor(Math.random() * 1e9);
  delete store.state.pal; // palette follows the new seed again
  buildControls();
  generate();
  toast("New piece");
}

/** Same piece, new look: keep the seed, mutate the treatment. */
function vary(reseed = false) {
  store.state = varyState(store.modeId, store.state, { reseed, amount: 0.4 });
  buildControls();
  generate();
  toast(reseed ? "New piece, varied" : "Same seed, new look");
}

async function exportPng() {
  const canvas = store.mode?.exportCanvas?.();
  let href = canvas ? canvas.toDataURL("image/png") : null;
  if (!href && store.mode?.exportAsync) {
    toast("Fetching PNG…");
    href = await store.mode.exportAsync(store.state);
  }
  if (!href) {
    toast("Nothing to export yet — generate first.");
    return;
  }
  const nameBit = store.mode.recipeExtra?.(store.state)?.replace(/[^\w]+/g, "-").slice(0, 40) || "export";
  const filename = `pixelgen-${store.modeId}-${store.state.seed || nameBit}.png`;
  const nativeShell = currentNativeShell(window);
  if (nativeShell) {
    await nativeShell.shareDataURL(href, filename);
    toast("PNG ready to share");
    return;
  }
  const a = document.createElement("a");
  a.download = filename;
  a.href = href;
  a.click();
  toast("PNG downloaded");
}

async function copyLink() {
  writeHash(true);
  const url = canonicalRecipeURL(location.hash);
  const nativeShell = currentNativeShell(window);
  if (nativeShell) {
    await nativeShell.copyText(url);
    toast("Recipe link copied");
    return;
  }
  try {
    await navigator.clipboard.writeText(url);
    toast("Recipe link copied");
  } catch {
    prompt("Copy recipe link:", url);
  }
}

function onKey(e) {
  if (e.target.matches("input, textarea, select") || e.metaKey || e.ctrlKey || e.altKey) return;
  const byKey = MODES.find((m) => m.key === e.key);
  if (byKey) {
    e.preventDefault();
    activate(byKey.id);
    return;
  }
  if (e.key === "g" || e.key === "G") {
    e.preventDefault();
    generate();
  } else if (e.key === "r" || e.key === "R") {
    e.preventDefault();
    randomize();
  } else if (e.key === "v" || e.key === "V") {
    e.preventDefault();
    vary(e.shiftKey); // V: same seed, new look · Shift+V: new seed too
  } else if (e.key === "e" || e.key === "E") {
    e.preventDefault();
    exportPng();
  } else if (e.key === "c" || e.key === "C") {
    e.preventDefault();
    copyLink();
  } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
    e.preventDefault();
    const i = MODES.findIndex((m) => m.id === store.modeId);
    activate(MODES[(i + 1) % MODES.length].id);
  } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
    e.preventDefault();
    const i = MODES.findIndex((m) => m.id === store.modeId);
    activate(MODES[(i - 1 + MODES.length) % MODES.length].id);
  }
}

function boot() {
  els.btnGen.addEventListener("click", generate);
  els.btnRand.addEventListener("click", randomize);
  if (els.btnVary) els.btnVary.addEventListener("click", () => vary(false));
  // mobile action bar mirrors the primary actions
  document.getElementById("bar-vary")?.addEventListener("click", () => vary(false));
  document.getElementById("bar-new")?.addEventListener("click", randomize);
  // hide the fixed bar while typing (iOS keyboard resizes the viewport)
  document.addEventListener("focusin", (e) => {
    if (e.target.matches("input, select, textarea")) document.body.classList.add("typing");
  });
  document.addEventListener("focusout", () => document.body.classList.remove("typing"));
  els.btnExport.addEventListener("click", exportPng);
  if (els.btnCopy) els.btnCopy.addEventListener("click", copyLink);
  els.seed.addEventListener("change", () => {
    store.state.seed = Number(els.seed.value) || 0;
    buildControls();
    generate();
  });
  window.addEventListener("hashchange", () => {
    if (store.suppressHash) return;
    const { modeId, params } = parseHash();
    activate(modeId, { fromHash: true, params });
  });
  window.addEventListener("keydown", onKey);
  renderHistory();
  const { modeId, params } = parseHash();
  activate(modeId, { fromHash: true, params });
}

boot();
