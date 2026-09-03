/*
 * File Purpose: Verify the Android web bridge intercepts canonical controls correctly.
 * Primary Functions: Exercise picker, SVG share, and clipboard JSON messages in isolation.
 * Inputs/Outputs: Simulates DOM clicks and asserts messages sent to the native interface.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

const bridgeSource = fs.readFileSync(
  "android/app/src/main/assets/android-bridge.js",
  "utf8"
);
const bundledHtml = fs.readFileSync(
  "android/app/src/main/assets/index.html",
  "utf8"
);

test("Android bundle hides web-only store links before first paint", () => {
  assert.match(bundledHtml, /html\[data-native\] #store-link/);
  assert.match(bundledHtml, /html\[data-native\] #android-link/);
  assert.match(bundledHtml, /window\.JankifyAndroid/);
});

function makeSandbox(mode = "hatch") {
  const messages = [];
  let clickHandler;
  const sandbox = {
    Blob,
    File: class {},
    Uint8Array,
    atob,
    alert: message => assert.fail(message),
    handleIncomingFile: async () => {},
    state: {
      mode,
      seed: 42,
      hatchSegments: mode === "hatch" ? [{}] : null,
      asciiGrid: mode === "ascii" ? [{}] : null
    },
    svgHatch: () => "<svg>hatch</svg>",
    asciiText: () => "ASCII",
    document: {
      addEventListener: (_name, handler) => { clickHandler = handler; }
    },
    window: {
      JankifyAndroid: {
        postMessage: json => messages.push(JSON.parse(json))
      }
    },
    FileReader: class {
      readAsDataURL(blob) {
        blob.arrayBuffer().then(buffer => {
          this.result = `data:${blob.type};base64,${Buffer.from(buffer).toString("base64")}`;
          this.onload();
        });
      }
    },
    $: id => {
      if (id === "status") return { textContent: "" };
      return {
        classList: { add() {}, remove() {} },
        innerHTML: "Copy"
      };
    },
    setTimeout: callback => callback()
  };
  vm.runInNewContext(bridgeSource, sandbox);
  return { messages, clickHandler, sandbox };
}

async function click(clickHandler, target) {
  await clickHandler({
    preventDefault() {},
    stopImmediatePropagation() {},
    target: { closest: () => target }
  });
}

test("Photo control requests the native document picker", async () => {
  const { messages, clickHandler } = makeSandbox();
  await click(clickHandler, { id: "file-input", matches: () => true });
  assert.deepEqual(messages, [{ action: "pickImage" }]);
});

test("Hatch SVG uses the Android share bridge", async () => {
  const { messages, clickHandler } = makeSandbox();
  await click(clickHandler, { id: "download-vector", matches: () => false });
  assert.equal(messages[0].action, "share");
  assert.equal(messages[0].payload.mimeType, "image/svg+xml");
  assert.equal(
    Buffer.from(messages[0].payload.base64, "base64").toString("utf8"),
    "<svg>hatch</svg>"
  );
});

test("ASCII output uses the native clipboard bridge", async () => {
  const { messages, clickHandler } = makeSandbox("ascii");
  await click(clickHandler, { id: "copy-output", matches: () => false });
  assert.deepEqual(messages, [{ action: "copyText", payload: { text: "ASCII" } }]);
});

test("Animation downloads use native sharing with canonical video MIME types", async () => {
  const { messages, sandbox } = makeSandbox();
  await vm.runInNewContext(
    "window.downloadBlob(new Blob(['video'], { type: 'video/mp4;codecs=avc1.42E01E' }), 'jankify.mp4')",
    sandbox
  );
  assert.equal(messages[0].action, "share");
  assert.equal(messages[0].payload.mimeType, "video/mp4");
  assert.equal(messages[0].payload.filename, "jankify.mp4");
});
