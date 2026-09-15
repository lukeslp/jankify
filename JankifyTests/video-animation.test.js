"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const { loadFunctions } = require("./helpers/load-functions.js");

const video = loadFunctions(["fileLooksLikeVideo"]);
const html = fs.readFileSync("index.html", "utf8");

test("recognizes browser-decodable video MIME types and extensions", () => {
  assert.equal(video.fileLooksLikeVideo({ type: "video/mp4", name: "clip" }), true);
  assert.equal(video.fileLooksLikeVideo({ type: "", name: "clip.MOV" }), true);
  assert.equal(video.fileLooksLikeVideo({ type: "", name: "clip.webm" }), true);
  assert.equal(video.fileLooksLikeVideo({ type: "application/pdf", name: "clip.pdf" }), false);
});

test("animation UI exposes GIF, sprite-sheet, and video exports", () => {
  assert.match(html, /id="make-gif"/);
  assert.match(html, /id="make-sheet"/);
  assert.match(html, /id="make-video"/);
  assert.match(html, /accept="image\/\*,video\/\*/);
});

test("video sampling remains bounded", () => {
  assert.match(html, /MAX_VIDEO_SECONDS:\s*10/);
  assert.match(html, /MAX_FRAMES:\s*300/);
  assert.match(html, /id="animation-fps"[^>]+max="30"/);
});
