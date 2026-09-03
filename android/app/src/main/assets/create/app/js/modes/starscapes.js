/**
 * Starscapes — p5 iframe with robust boot + postMessage bridge.
 * Attach listeners before append; child must self-generate on ready.
 */
export const starscapesMode = {
  // id stays "starscapes" so shared recipe URLs keep working;
  // the display name is Backgrounds — this mode paints skies and ridges.
  id: "starscapes",
  name: "Backgrounds",
  key: "1",
  blurb: "Painted skies, clouds, and mountain ridges — parallax background art.",

  defaults() {
    return {
      seed: Math.floor(Math.random() * 1e9),
      width: 512,
      height: 512,
      embed: true,
    };
  },

  controls() {
    return [
      { type: "number", key: "seed", label: "Seed", min: 0, max: 2e9, step: 1 },
      { type: "number", key: "width", label: "Width", min: 200, max: 900, step: 10 },
      { type: "number", key: "height", label: "Height", min: 200, max: 1200, step: 10 },
      { type: "checkbox", key: "embed", label: "Full Starscapes embed" },
    ];
  },

  mount(host) {
    host.innerHTML = "";
    const stack = document.createElement("div");
    stack.className = "canvas-stack starscapes-stack";

    const frame = document.createElement("iframe");
    frame.className = "mode-iframe";
    frame.title = "Starscapes";
    frame.removeAttribute("sandbox");
    frame.loading = "eager";
    frame.referrerPolicy = "same-origin";

    const canvas = document.createElement("canvas");
    canvas.className = "gen-canvas";
    canvas.hidden = true;

    this._frame = frame;
    this._canvas = canvas;
    this._host = host;
    this._ready = false;
    this._pending = null;
    this._state = null;

    // Register listeners before append/src so the ready event cannot race setup.
    this._onMsg = (ev) => {
      if (ev.source !== frame.contentWindow) return;
      const d = ev.data;
      if (!d || d.type !== "pixelgen-starscapes") return;
      if (d.event === "progress") {
        this._setShellProgress(d.fraction, d.label, d.detail);
      }
      if (d.event === "export") {
        const resolve = this._exportResolve;
        this._exportResolve = null;
        if (resolve) resolve(d.dataURL || null);
      }
      if (d.event === "size" && this._frame) {
        const h = Number(d.h) || 0;
        if (h > 120) this._frame.style.height = `${Math.min(h, 680)}px`;
      }
      if (d.event === "ready" || d.event === "generated") {
        this._ready = true;
        if (d.event === "generated") {
          this._setShellProgress(d.ok === false ? 1 : -1, d.ok === false ? "Failed" : "Done");
        }
        if (this._pending) {
          const msg = this._pending;
          this._pending = null;
          this._post(msg);
        }
      }
    };
    window.addEventListener("message", this._onMsg);

    frame.addEventListener("load", () => {
      // If ready was missed, push generate after load
      setTimeout(() => {
        if (this._state) this._sendGenerate(this._state, true);
      }, 200);
    });

    stack.append(frame, canvas);
    host.append(stack);
  },

  unmount() {
    window.removeEventListener("message", this._onMsg);
    this._setShellProgress(-1);
    if (this._frame) {
      try {
        this._frame.src = "about:blank";
      } catch (_) {}
      this._frame.remove();
    }
    this._frame = null;
    this._ready = false;
    this._pending = null;
    this._state = null;
  },

  _setShellProgress(fraction, label, detail) {
    const status = document.getElementById("status-pill");
    const recipe = document.getElementById("recipe-text");
    if (fraction < 0) {
      if (status) {
        status.textContent = "live";
        status.classList.remove("busy");
      }
      return;
    }
    const pct = Math.round(Math.max(0, Math.min(1, fraction)) * 100);
    if (status) {
      status.textContent = `gen ${pct}%`;
      status.classList.add("busy");
    }
    if (recipe && label) {
      recipe.textContent = `backgrounds · ${label}${detail ? " · " + detail : ""}`;
    }
  },

  _post(payload) {
    try {
      this._frame?.contentWindow?.postMessage({ type: "pixelgen-starscapes", ...payload }, "*");
    } catch (err) {
      console.warn("Starscapes postMessage failed", err);
    }
  },

  _srcFor(state) {
    const q = new URLSearchParams();
    if (state?.seed != null) q.set("seed", String(state.seed));
    if (state?.width) q.set("width", String(state.width));
    if (state?.height) q.set("height", String(state.height));
    if (state?.pal != null) q.set("pal", String(state.pal));
    q.set("embed", "1"); // hides the iframe's duplicate control panels
    q.set("v", "16"); // cache-buster, keep in sync with Starscapes/index.html
    return `../Starscapes/index.html?${q.toString()}`;
  },

  _sendGenerate(state, force = false) {
    const msg = {
      cmd: "generate",
      seed: state.seed,
      width: state.width,
      height: state.height,
      pal: state.pal ?? null,
    };
    if (this._ready || force) {
      this._post(msg);
    } else {
      this._pending = msg;
    }
  },

  generate(state) {
    this._state = state;
    if (state.embed) {
      this._canvas.hidden = true;
      if (this._frame) {
        this._frame.hidden = false;
        const next = this._srcFor(state);
        const cur = this._frame.getAttribute("src") || "";
        // First load or seed change: set src (triggers full boot + self-generate)
        if (!cur.includes("Starscapes") || cur === "about:blank") {
          this._ready = false;
          this._pending = {
            cmd: "generate",
            seed: state.seed,
            width: state.width,
            height: state.height,
            pal: state.pal ?? null,
          };
          this._frame.src = next;
        } else {
          // Same document — postMessage reseed
          this._sendGenerate(state, true);
        }
      }
      // Also keep a visible fallback preview under the fold? No — embed only.
      return null;
    }

    // Native preview path
    if (this._frame) {
      this._frame.hidden = true;
      if ((this._frame.getAttribute("src") || "").includes("Starscapes")) {
        this._frame.src = "about:blank";
        this._ready = false;
      }
    }
    this._canvas.hidden = false;
    this._preview(state);
    return this._canvas;
  },

  _preview(state) {
    const w = state.width | 0;
    const h = state.height | 0;
    const c = this._canvas;
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    let s = state.seed >>> 0;
    const rnd = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, `hsl(${220 + rnd() * 40},55%,18%)`);
    g.addColorStop(0.55, `hsl(${280 + rnd() * 30},45%,28%)`);
    g.addColorStop(1, `hsl(${200 + rnd() * 20},40%,22%)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 500; i++) {
      ctx.fillStyle = `rgba(255,255,255,${rnd()})`;
      ctx.fillRect(rnd() * w, rnd() * h * 0.55, rnd() * 2, rnd() * 2);
    }
    const base = h * 0.55;
    for (let layer = 0; layer < 5; layer++) {
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 6) {
        const n = Math.sin(x * 0.01 + layer + state.seed) * 20 + Math.sin(x * 0.03 + layer * 2) * 12;
        const y = base + layer * 24 + n + rnd() * 8;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fillStyle = `hsla(${100 + layer * 15},40%,${25 + layer * 8}%,0.9)`;
      ctx.fill();
    }
  },

  exportCanvas() {
    if (this._canvas && !this._canvas.hidden) return this._canvas;
    return null;
  },

  /** Embed export: ask the iframe for its canvas as a PNG data URL. */
  exportAsync() {
    if (this._canvas && !this._canvas.hidden) {
      return Promise.resolve(this._canvas.toDataURL("image/png"));
    }
    if (!this._frame || !this._ready) return Promise.resolve(null);
    return new Promise((resolve) => {
      this._exportResolve = resolve;
      this._post({ cmd: "export" });
      setTimeout(() => {
        if (this._exportResolve === resolve) {
          this._exportResolve = null;
          resolve(null);
        }
      }, 3000);
    });
  },
};
