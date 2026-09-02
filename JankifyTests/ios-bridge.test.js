const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

const bridgeSource = fs.readFileSync(
  "Jankify/Resources/Web/ios-bridge.js",
  "utf8"
);
const bundledHtml = fs.readFileSync(
  "Jankify/Resources/Web/index.html",
  "utf8"
);

test("iOS bundle omits the App Store link", () => {
  assert.doesNotMatch(bundledHtml, /id="store-link"/);
  assert.doesNotMatch(bundledHtml, /apps\.apple\.com\/app\/id6782693852/);
});

async function exportedTextFor(mode) {
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
      roughGrid: mode === "rough" ? [{}] : null
    },
    svgHatch: () => "<svg>hatch</svg>",
    svgRough: () => "<svg>rough</svg>",
    document: {
      addEventListener: (_name, handler) => { clickHandler = handler; }
    },
    window: {
      webkit: {
        messageHandlers: {
          jankify: { postMessage: message => messages.push(message) }
        }
      }
    },
    FileReader: class {
      readAsDataURL(blob) {
        blob.arrayBuffer().then(buffer => {
          this.result = `data:${blob.type};base64,${Buffer.from(buffer).toString("base64")}`;
          this.onload();
        });
      }
    }
  };

  vm.runInNewContext(bridgeSource, sandbox);
  await clickHandler({
    preventDefault() {},
    stopImmediatePropagation() {},
    target: {
      closest: () => ({ id: "download-vector", matches: () => false })
    }
  });

  assert.equal(messages.length, 1);
  assert.equal(messages[0].action, "share");
  assert.equal(messages[0].payload.mimeType, "image/svg+xml");
  return Buffer.from(messages[0].payload.base64, "base64").toString("utf8");
}

test("Hatch SVG uses the native share bridge", async () => {
  assert.equal(await exportedTextFor("hatch"), "<svg>hatch</svg>");
});

test("Rough SVG uses the native share bridge", async () => {
  assert.equal(await exportedTextFor("rough"), "<svg>rough</svg>");
});

test("Animation downloads use native sharing with canonical video MIME types", async () => {
  const messages = [];
  const sandbox = {
    Blob,
    File: class {},
    Uint8Array,
    atob,
    alert: message => assert.fail(message),
    handleIncomingFile: async () => {},
    state: { mode: "pixel", seed: 42 },
    document: { addEventListener() {} },
    window: {
      webkit: {
        messageHandlers: {
          jankify: { postMessage: message => messages.push(message) }
        }
      }
    },
    FileReader: class {
      readAsDataURL(blob) {
        blob.arrayBuffer().then(buffer => {
          this.result = `data:${blob.type};base64,${Buffer.from(buffer).toString("base64")}`;
          this.onload();
        });
      }
    }
  };

  vm.runInNewContext(bridgeSource, sandbox);
  await vm.runInNewContext(
    "window.downloadBlob(new Blob(['video'], { type: 'video/webm;codecs=vp9' }), 'jankify.webm')",
    sandbox
  );

  assert.equal(messages[0].action, "share");
  assert.equal(messages[0].payload.mimeType, "video/webm");
  assert.equal(messages[0].payload.filename, "jankify.webm");
});
