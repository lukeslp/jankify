/* Duo fold shim. One fold state for a web page on iPhone Duo (and any foldable).
 *
 * Sources, best first:
 *   1. The web's own Viewport Segments and Device Posture APIs, when the browser
 *      has them (Safari 27.1 ships both behind feature flags; Chrome on Android
 *      foldables ships them).
 *   2. The native bridge (DuoBridge.swift), which calls DuoFold._native(payload)
 *      with the hinge status and angle and the fold's reserved region.
 *   3. A same-origin parent frame that already runs this shim: a child frame
 *      takes its parent's state, with the fold moved into its own coordinates.
 *
 * What a page gets:
 *   <html data-duo-pose="book|laptop|flat" data-duo-status="closed|partially-open|fully-open|unknown"
 *         data-duo-axis="vertical|horizontal">
 *     data-duo-pose is "book" (vertical fold, side by side) or "laptop" (horizontal
 *     fold, stacked) only while a fold crosses this page; "flat" otherwise. All three
 *     attributes are absent on a device with no hinge, so other layouts never change.
 *     data-duo-axis also names a fold that is not active yet (the device lies flat),
 *     so a layout can reserve room ahead of time instead of jumping on the first fold.
 *   CSS variables on <html>, in CSS px, only while a fold crosses this page:
 *     --duo-fold-left, --duo-fold-top, --duo-fold-right, --duo-fold-bottom,
 *     --duo-fold-width, --duo-fold-height; and --duo-hinge-angle (degrees, unitless)
 *     whenever the hinge reports one.
 *   window event "duo:fold", detail = DuoFold.state, on every change.
 *   window.DuoFold.state and DuoFold.subscribe(fn) -> unsubscribe.
 *
 * Layout comes from the fold region; the angle is for effects (Apple's guidance).
 * Install once per frame, before page scripts: a WKUserScript at document start with
 * forMainFrameOnly false, or a plain <script> at the top of <head>. Safe to load twice.
 * A frame's first page reuses the window of its initial about:blank document, so the
 * shim installs per document, not per window.
 */
(() => {
  'use strict';
  const prior = window.DuoFold;
  if (prior && prior.document === document) return;
  try { prior && prior._retire && prior._retire(); } catch (_) {}
  const cleanups = [];

  const EMPTY = Object.freeze({ hinge: false, status: 'unknown', angle: null, pose: null, axis: null, fold: null, source: 'none' });
  const listeners = new Set();
  let native = null;     // the last payload from the app
  let inherited = null;  // the parent frame's state, when this is a child frame
  let state = EMPTY;
  let key = JSON.stringify(EMPTY);

  const rect = r => r && r.width >= 0 && r.height >= 0 ? { x: +r.x || 0, y: +r.y || 0, width: +r.width, height: +r.height } : null;
  const axisOf = r => r ? (r.height > r.width ? 'vertical' : 'horizontal') : null;
  // A rectangle moved into this frame's coordinates and clipped to its viewport; null if it
  // misses. A frame's viewport is whole CSS px, so a frame that ends at y 455.5 reports 456:
  // overlaps under 1 px are rounding, not a fold.
  const clip = (r, dx, dy) => {
    if (!r) return null;
    const x = Math.max(0, r.x - dx), y = Math.max(0, r.y - dy);
    const right = Math.min(innerWidth, r.x - dx + r.width), bottom = Math.min(innerHeight, r.y - dy + r.height);
    return right - x >= 1 && bottom - y >= 1 ? { x, y, width: right - x, height: bottom - y } : null;
  };

  // The web APIs, where the browser has them.
  function fromWeb() {
    let segments = null;
    try { segments = window.viewport && window.viewport.segments; } catch (_) {}
    let posture = null;
    try { posture = navigator.devicePosture && navigator.devicePosture.type; } catch (_) {}
    if (!segments && !posture) return null;
    let fold = null;
    if (segments && segments.length === 2) {
      const [a, b] = [...segments].sort((p, q) => (p.x - q.x) || (p.y - q.y));
      fold = b.x >= a.x + a.width
        ? { x: a.x + a.width, y: 0, width: b.x - (a.x + a.width), height: innerHeight }
        : { x: 0, y: a.y + a.height, width: innerWidth, height: b.y - (a.y + a.height) };
    }
    return { posture, fold };
  }

  function compute() {
    if (inherited) {
      // A child frame: the parent's hinge, and the fold only where it crosses this frame.
      let dx = 0, dy = 0;
      try { const box = window.frameElement.getBoundingClientRect(); dx = box.left; dy = box.top; } catch (_) {}
      const fold = clip(inherited.fold, dx, dy);
      return { hinge: inherited.hinge, status: inherited.status, angle: inherited.angle,
        pose: fold ? (axisOf(fold) === 'vertical' ? 'book' : 'laptop') : (inherited.hinge ? 'flat' : null),
        axis: inherited.axis, fold, source: inherited.source };
    }
    const web = fromWeb();
    const hinge = !!(native && native.hinge) || !!(web && (web.fold || web.posture === 'folded'));
    if (!hinge) return EMPTY;
    const fold = (web && web.fold) || (native && rect(native.fold)) || null;
    const status = native && native.status ? native.status : web && web.posture === 'folded' ? 'partially-open' : 'unknown';
    const angle = native && typeof native.angle === 'number' ? native.angle : null;
    const axis = axisOf(fold) || axisOf(native && rect(native.reserved));
    return { hinge, status, angle, pose: fold ? axisOf(fold) === 'vertical' ? 'book' : 'laptop' : 'flat', axis,
      fold, source: web && web.fold ? 'web' : native ? 'native' : 'web' };
  }

  function paint() {
    const root = document.documentElement;
    if (!root) return false;
    const set = (name, value) => value == null ? root.removeAttribute(name) : root.setAttribute(name, value);
    set('data-duo-pose', state.pose);
    set('data-duo-status', state.hinge ? state.status : null);
    set('data-duo-axis', state.axis);
    const f = state.fold, px = v => Math.round(v * 100) / 100 + 'px';
    const vars = f ? { left: f.x, top: f.y, right: f.x + f.width, bottom: f.y + f.height, width: f.width, height: f.height } : {};
    for (const name of ['left', 'top', 'right', 'bottom', 'width', 'height']) {
      if (name in vars) root.style.setProperty('--duo-fold-' + name, px(vars[name]));
      else root.style.removeProperty('--duo-fold-' + name);
    }
    if (state.angle == null) root.style.removeProperty('--duo-hinge-angle');
    else root.style.setProperty('--duo-hinge-angle', String(Math.round(state.angle * 10) / 10));
    return true;
  }

  function update() {
    const next = compute();
    const nextKey = JSON.stringify(next);
    if (nextKey === key) return;
    state = Object.freeze({ ...next, fold: next.fold && Object.freeze({ ...next.fold }) });
    key = nextKey;
    if (!paint()) document.addEventListener('readystatechange', paint, { once: true });
    window.dispatchEvent(new CustomEvent('duo:fold', { detail: state }));
    for (const fn of [...listeners]) { try { fn(state); } catch (_) {} }
  }

  window.DuoFold = Object.freeze({
    document,
    get state() { return state; },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    // Called by the app: {hinge, status, angle (degrees), fold: rect|null, reserved: rect|null}.
    _native(payload) { native = payload && typeof payload === 'object' ? payload : null; update(); },
    // A later document in this window takes over; this one lets go of its listeners.
    _retire() { for (const fn of cleanups.splice(0)) { try { fn(); } catch (_) {} } listeners.clear(); },
  });

  // A same-origin parent that runs the shim speaks for the device.
  let parentFold = null;
  try { if (window.frameElement && window.parent !== window) parentFold = window.parent.DuoFold || null; } catch (_) {}
  if (parentFold) {
    inherited = parentFold.state;
    const off = parentFold.subscribe(s => { inherited = s; update(); });
    cleanups.push(off);
    window.addEventListener('pagehide', off, { once: true });
  } else {
    try {
      if (navigator.devicePosture) {
        navigator.devicePosture.addEventListener('change', update);
        cleanups.push(() => navigator.devicePosture.removeEventListener('change', update));
      }
    } catch (_) {}
    // The app asks for a fresh payload once the page exists (DuoBridge answers).
    try { window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.duoFold && window.webkit.messageHandlers.duoFold.postMessage('ready'); } catch (_) {}
  }
  window.addEventListener('resize', update);
  cleanups.push(() => window.removeEventListener('resize', update));
  update();
  if (!document.documentElement) document.addEventListener('readystatechange', paint, { once: true });
})();
