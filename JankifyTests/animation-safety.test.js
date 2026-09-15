"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { loadFunctions } = require("./helpers/load-functions.js");

const anim = loadFunctions(["frameLuma", "analyzeFlash", "clampDelays"]);

const solid = v => ({ data: new Uint8ClampedArray([v, v, v, 255]), width: 1, height: 1, delayMs: 100 });

test("clampDelays raises sub-floor delays and leaves others", () => {
  const out = anim.clampDelays([
    { ...solid(0), delayMs: 20 },
    { ...solid(0), delayMs: 600 }
  ], 500);
  assert.strictEqual(out[0].delayMs, 500);
  assert.strictEqual(out[1].delayMs, 600);
});

test("analyzeFlash flags a black/white strobe above 3 Hz", () => {
  const frames = [solid(0), solid(255), solid(0), solid(255), solid(0), solid(255)];
  const res = anim.analyzeFlash(frames, 15);
  assert.ok(res.maxFlashesPerSec >= 3, "strobe should exceed the WCAG 2.3.1 threshold, got " + res.maxFlashesPerSec);
});

test("analyzeFlash clears a gentle ramp", () => {
  const frames = [solid(100), solid(110), solid(120), solid(130)];
  const res = anim.analyzeFlash(frames, 8);
  assert.ok(res.maxFlashesPerSec < 3, "gentle ramp should be safe, got " + res.maxFlashesPerSec);
});

test("analyzeFlash counts the loop seam (last->first) transition", () => {
  const frames = [solid(255), solid(255), solid(255), solid(0)];
  const res = anim.analyzeFlash(frames, 4);
  assert.ok(res.maxFlashesPerSec >= 1, "seam transition white->black should register");
});
