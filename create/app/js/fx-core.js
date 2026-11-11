/**
 * FX core — shared machinery for the animated modes (Effects, Explosions).
 * Frames render into a horizontal sprite sheet (the export artifact for
 * game engines); the stage shows a looping preview of the same sheet.
 */

/** Render n frames into a transparent horizontal sheet. drawFrame(ctx, t, i). */
export function renderSheet(n, w, h, drawFrame) {
  const sheet = document.createElement("canvas");
  sheet.width = n * w;
  sheet.height = h;
  const sctx = sheet.getContext("2d");
  const frame = document.createElement("canvas");
  frame.width = w;
  frame.height = h;
  const fctx = frame.getContext("2d");
  for (let i = 0; i < n; i++) {
    fctx.clearRect(0, 0, w, h);
    drawFrame(fctx, n <= 1 ? 0 : i / (n - 1), i);
    sctx.drawImage(frame, i * w, 0);
  }
  return sheet;
}

/** Loop a sheet on a visible canvas at fps. Returns a stop() function. */
export function startPreview(canvas, sheet, n, w, h, fps = 14) {
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  let raf = 0;
  let last = 0;
  let i = 0;
  const step = (now) => {
    if (now - last >= 1000 / fps) {
      last = now;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(sheet, i * w, 0, w, h, 0, 0, w, h);
      i = (i + 1) % n;
    }
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}

/** Chunky pixel rect helper — snaps to a px-cell grid for the crunchy look. */
export function cell(ctx, x, y, px, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.floor(x / px) * px, Math.floor(y / px) * px, px, px);
}

export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeOutQuad = (t) => 1 - (1 - t) * (1 - t);
