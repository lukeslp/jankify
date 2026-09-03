/** Session generation history (localStorage, bounded). */

const KEY = "pixelgen.history.v1";
const MAX = 24;

export function loadHistory() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveHistory(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* quota / private mode */
  }
}

export function pushHistory(entry) {
  const list = loadHistory().filter(
    (e) => !(e.mode === entry.mode && e.seed === entry.seed && e.thumb === entry.thumb)
  );
  list.unshift(entry);
  saveHistory(list);
  return list.slice(0, MAX);
}

export function clearHistory() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Make a small JPEG data URL from a canvas (lossy, for thumbs). */
export function thumbFromCanvas(canvas, maxSide = 72) {
  if (!canvas || !canvas.width) return null;
  const scale = Math.min(1, maxSide / Math.max(canvas.width, canvas.height));
  const w = Math.max(1, Math.round(canvas.width * scale));
  const h = Math.max(1, Math.round(canvas.height * scale));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(canvas, 0, 0, w, h);
  try {
    return c.toDataURL("image/jpeg", 0.72);
  } catch {
    return null;
  }
}
