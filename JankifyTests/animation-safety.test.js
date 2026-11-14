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

test("analyzeFlash flags a dark/mid-gray strobe that never reaches white", () => {
  const frames = [solid(20), solid(180), solid(20), solid(180), solid(20), solid(180)];
  const res = anim.analyzeFlash(frames, 15);
  assert.ok(res.maxFlashesPerSec > 3, "a 0.007 to 0.46 luminance strobe is a WCAG general flash, got " + res.maxFlashesPerSec);
});

test("analyzeFlash ignores changes between two bright frames", () => {
  const frames = [solid(235), solid(255), solid(235), solid(255), solid(235), solid(255)];
  const res = anim.analyzeFlash(frames, 15);
  assert.strictEqual(res.maxFlashesPerSec, 0, "the darker frame is above 0.80 luminance, so WCAG counts no flash");
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

test("analyzeFlash counts a 2 Hz strobe as two flashes per second", () => {
  const frames = [solid(0), solid(0), solid(255), solid(255)];
  const res = anim.analyzeFlash(frames, 8);
  assert.ok(res.maxFlashesPerSec <= 3, "a 2 Hz strobe is within WCAG 2.3.1, got " + res.maxFlashesPerSec);
});

test("analyzeFlash counts a slow fade and its loop back as one flash", () => {
  const frames = [0, 30, 60, 90, 120, 150, 180, 210].map(solid);
  const res = anim.analyzeFlash(frames, 8);
  assert.ok(res.maxFlashesPerSec <= 1, "a one-second fade is not a strobe, got " + res.maxFlashesPerSec);
});

test("analyzeFlash flags a 4 Hz strobe", () => {
  const frames = [solid(0), solid(255)];
  const res = anim.analyzeFlash(frames, 8);
  assert.ok(res.maxFlashesPerSec > 3, "a 4 Hz strobe exceeds WCAG 2.3.1, got " + res.maxFlashesPerSec);
});
