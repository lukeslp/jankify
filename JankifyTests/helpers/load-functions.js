"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function extractFunction(src, name) {
  const sig = "function " + name + "(";
  const start = src.indexOf(sig);
  if (start === -1) throw new Error("function not found in index.html: " + name);
  let depth = 0;
  let started = false;
  for (let j = src.indexOf("{", start); j < src.length; j++) {
    const c = src[j];
    if (c === "{") { depth++; started = true; }
    else if (c === "}") { depth--; if (started && depth === 0) return src.slice(start, j + 1); }
  }
  throw new Error("unbalanced braces extracting: " + name);
}

function loadFunctions(names) {
  const html = fs.readFileSync(path.join(__dirname, "..", "..", "index.html"), "utf8");
  const sandbox = {
    console, Math, Array, Map, Set, String, Number, isNaN, Infinity,
    Uint8Array, Uint8ClampedArray, Uint16Array, Uint32Array, Int32Array,
    Float32Array, Float64Array, DataView, ArrayBuffer, Object, JSON
  };
  vm.createContext(sandbox);
  const code = names.map(n => extractFunction(html, n)).join("\n\n");
  vm.runInContext(code, sandbox);
  return sandbox;
}

module.exports = { loadFunctions, extractFunction };
