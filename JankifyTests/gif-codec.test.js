"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { loadFunctions } = require("./helpers/load-functions.js");

const codec = loadFunctions([
  "lzwDecode", "lzwEncode", "deinterlace", "decodeGif", "gifQuantize", "encodeGif"
]);

test("lzw round-trips a small index stream", () => {
  const indices = Uint8Array.from([0, 1, 1, 2, 3, 3, 3, 0, 2, 1, 0, 0]);
  const compressed = codec.lzwEncode(indices, 2);
  const back = codec.lzwDecode(compressed, 2);
  assert.deepStrictEqual(Array.from(back), Array.from(indices));
});

test("lzw round-trips a 4096-symbol stream across code-size growth and reset", () => {
  const indices = new Uint8Array(4096);
  for (let i = 0; i < indices.length; i++) indices[i] = (i * 31) & 0xff;
  const compressed = codec.lzwEncode(indices, 8);
  const back = codec.lzwDecode(compressed, 8);
  assert.deepStrictEqual(Array.from(back), Array.from(indices));
});

test("lzw round-trips a repetitive run (clear/EOI + dictionary fill)", () => {
  const indices = new Uint8Array(5000).fill(7);
  const back = codec.lzwDecode(codec.lzwEncode(indices, 4), 4);
  assert.deepStrictEqual(Array.from(back), Array.from(indices));
});

function solidFrame(r, g, b, delayMs) {
  const data = new Uint8ClampedArray(2 * 2 * 4);
  for (let i = 0; i < 4; i++) { data[i * 4] = r; data[i * 4 + 1] = g; data[i * 4 + 2] = b; data[i * 4 + 3] = 255; }
  return { data, width: 2, height: 2, delayMs };
}

test("encodeGif emits GIF89a header and Netscape loop block", () => {
  const bytes = codec.encodeGif({ width: 2, height: 2, frames: [solidFrame(255, 255, 255, 80)], loop: 0 });
  assert.strictEqual(String.fromCharCode(...bytes.slice(0, 6)), "GIF89a");
  const s = Array.from(bytes).map(c => String.fromCharCode(c)).join("");
  assert.ok(s.includes("NETSCAPE2.0"), "loop extension present");
  assert.strictEqual(bytes[bytes.length - 1], 0x3b, "trailer present");
});

test("encode -> decode round-trips two flat frames with delays", () => {
  const bytes = codec.encodeGif({
    width: 2, height: 2,
    frames: [solidFrame(255, 0, 0, 100), solidFrame(0, 0, 255, 100)],
    loop: 0
  });
  const decoded = codec.decodeGif(bytes);
  assert.strictEqual(decoded.width, 2);
  assert.strictEqual(decoded.height, 2);
  assert.strictEqual(decoded.frames.length, 2);
  assert.deepStrictEqual(Array.from(decoded.frames[0].data.slice(0, 4)), [255, 0, 0, 255]);
  assert.deepStrictEqual(Array.from(decoded.frames[1].data.slice(0, 4)), [0, 0, 255, 255]);
  assert.strictEqual(decoded.frames[0].delayMs, 100);
});

test("encode -> decode preserves a multi-color gradient frame within palette error", () => {
  const w = 16, h = 16;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = (y * w + x) * 4;
    data[o] = x * 16; data[o + 1] = y * 16; data[o + 2] = 128; data[o + 3] = 255;
  }
  const bytes = codec.encodeGif({ width: w, height: h, frames: [{ data, width: w, height: h, delayMs: 100 }], loop: 0 });
  const decoded = codec.decodeGif(bytes);
  assert.strictEqual(decoded.frames.length, 1);
  let maxErr = 0;
  for (let i = 0; i < data.length; i += 4) {
    maxErr = Math.max(maxErr, Math.abs(data[i] - decoded.frames[0].data[i]));
    maxErr = Math.max(maxErr, Math.abs(data[i + 1] - decoded.frames[0].data[i + 1]));
  }
  assert.ok(maxErr <= 8, "palette mapping error within tolerance, got " + maxErr);
});

test("decodeGif bounds retained high-frame GIFs at the requested cap", () => {
  const frames = [
    solidFrame(255, 0, 0, 100),
    solidFrame(0, 255, 0, 100),
    solidFrame(0, 0, 255, 100),
  ];
  const bytes = codec.encodeGif({ width: 2, height: 2, frames, loop: 0 });

  const decoded = codec.decodeGif(bytes, { maxFrames: 2, maxDecodedBytes: 1_024 });

  assert.strictEqual(decoded.frames.length, 2);
  assert.strictEqual(decoded.truncated, true);
  assert.deepStrictEqual(Array.from(decoded.frames[1].data.slice(0, 4)), [0, 255, 0, 255]);
});

test("decodeGif downscales frames before retaining them", () => {
  const width = 8, height = 4;
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  const bytes = codec.encodeGif({
    width,
    height,
    frames: [{ data, width, height, delayMs: 100 }],
    loop: 0
  });

  const decoded = codec.decodeGif(bytes, { maxFrames: 1, maxDimension: 4, maxDecodedBytes: 1_024 });

  assert.strictEqual(decoded.frames[0].width, 4);
  assert.strictEqual(decoded.frames[0].height, 2);
  assert.strictEqual(decoded.frames[0].data.byteLength, 32);
});

test("decodeGif rejects frames that exceed the decoded-pixel-byte budget", () => {
  const bytes = codec.encodeGif({
    width: 8,
    height: 8,
    frames: [solidFrame(255, 255, 255, 100)],
    loop: 0
  });

  assert.throws(
    () => codec.decodeGif(bytes, { maxFrames: 1, maxDecodedBytes: 128 }),
    /decoded pixel budget/i
  );
});

test("decodeGif reads an independently encoded original GIF fixture", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const fixture = path.join(__dirname, "fixtures", "external-lzw.gif");
  const bytes = fs.readFileSync(fixture);
  const decoded = codec.decodeGif(bytes, {
    maxFrames: 8,
    maxDimension: 512,
    maxDecodedBytes: 16 * 1_024 * 1_024
  });
  assert.strictEqual(decoded.frames.length, 3, "expected three independent frames");
  assert.strictEqual(decoded.frames[0].width, 48);
  assert.strictEqual(decoded.frames[0].height, 48);
  assert.strictEqual(decoded.frames[0].data.length, 48 * 48 * 4);
});
