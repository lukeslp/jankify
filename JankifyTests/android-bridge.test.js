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
  const fileInput = { attributes: {}, setAttribute(name, value) { this.attributes[name] = value; } };
  const makeLabel = id => ({
    id, attributes: {}, handlers: {},
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(name, handler) { this.handlers[name] = handler; }
  });
  const pickerLabels = [makeLabel("upload-btn"), makeLabel("placeholder")];
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
      addEventListener: (_name, handler) => { clickHandler = handler; },
      getElementById: id => (id === "file-input" ? fileInput : null),
      querySelectorAll: () => pickerLabels
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
  return { messages, clickHandler, sandbox, fileInput, pickerLabels };
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

test("Licenses link opens the bundled licenses page in a dialog", async () => {
  const { messages, clickHandler, sandbox } = makeSandbox();
  const created = [];
  let shown = 0;
  sandbox.document.getElementById = () => null;
  sandbox.document.body = { appendChild() {} };
  sandbox.document.createElement = tag => {
    const element = {
      tag, style: {}, open: false,
      setAttribute() {}, addEventListener() {}, append() {},
      showModal() { shown += 1; this.open = true; }
    };
    created.push(element);
    return element;
  };
  await click(clickHandler, { id: "licenses-link", matches: () => false });
  assert.equal(shown, 1);
  assert.equal(created.find(element => element.tag === "iframe").src, "licenses.html");
  assert.deepEqual(messages, []);
});

test("Android Back closes the animation warning before leaving the page", () => {
  const { sandbox } = makeSandbox();
  const warning = { hidden: false };
  let closedWith;
  sandbox.document.getElementById = () => null;
  sandbox.$ = id => (id === "gif-warning" ? warning : null);
  sandbox.closeGifWarning = value => { closedWith = value; warning.hidden = true; };
  assert.equal(sandbox.window.jankifyBack(), true);
  assert.equal(closedWith, null);
  assert.equal(sandbox.window.jankifyBack(), false);
});

test("Android Back cancels a running animated export", () => {
  const { sandbox } = makeSandbox();
  let cancelled = 0;
  const cancel = { hidden: false, click() { cancelled += 1; this.hidden = true; } };
  sandbox.document.getElementById = () => null;
  sandbox.$ = id => (id === "cancel-anim" ? cancel : null);
  assert.equal(sandbox.window.jankifyBack(), true);
  assert.equal(cancelled, 1);
  assert.equal(sandbox.window.jankifyBack(), false);
});

test("Android page uses store-safe mode names and Android wording", () => {
  const visible = bundledHtml
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(visible, /Hasbro/);
  assert.doesNotMatch(visible, /Lite Brite/);
  assert.doesNotMatch(bundledHtml, /camera roll|⌘|your browser supports/);
  assert.doesNotMatch(bundledHtml, />Upload<|uploaded GIF|Download \/ Copy|GIF download|Download ready/);
  assert.match(bundledHtml, /<option value="brite">Peg Board<\/option>/);
  assert.match(bundledHtml, /id="licenses-link" href="licenses\.html"/);
});

test("Licenses page is generated from the packaged notices and names each library", () => {
  const { execFileSync } = require("node:child_process");
  const page = "android/app/src/main/assets/licenses.html";
  const committed = fs.readFileSync(page, "utf8");
  execFileSync("python3", ["scripts/build-android-licenses.py"]);
  assert.equal(fs.readFileSync(page, "utf8"), committed, "licenses.html is stale; run scripts/sync-web.sh");
  for (const name of ["Rough.js 4.6.6", "Deep-Fold", "Apache License"]) {
    assert.ok(committed.includes(name), name);
  }
  assert.ok(!committed.includes("<script"), "the licenses page must not run code");
});

test("Licenses page keeps every word of every notice, in order", () => {
  const unescape = text => text
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
  const page = unescape(
    fs.readFileSync("android/app/src/main/assets/licenses.html", "utf8").replace(/<[^>]+>/g, " ")
  ).split(/\s+/).filter(Boolean).join(" ");
  const files = [
    "LICENSE",
    "licenses/Rough-MIT.txt",
    "Jankify/Resources/Web/create/LICENSE.txt",
    "licenses/Deep-Fold-PixelPlanets-MIT.txt",
    "licenses/Deep-Fold-SpriteGenerator-MIT.txt",
    "licenses/Apache-2.0.txt",
  ];
  for (const name of files) {
    const words = fs.readFileSync(name, "utf8").split(/\s+/).filter(Boolean).join(" ");
    assert.ok(page.includes(words), `${name} is not printed word for word`);
  }
});

test("Licenses page lets the screen wrap prose instead of keeping 80-column lines", () => {
  const page = fs.readFileSync("android/app/src/main/assets/licenses.html", "utf8");
  assert.match(page, /<p class="license">Permission is hereby granted, free of charge, to any person obtaining a copy of this software/);
});

test("Offline icon fallbacks cover every icon the editor uses", () => {
  const css = fs.readFileSync("android/app/src/main/assets/offline.css", "utf8");
  const used = new Set(bundledHtml.match(/fa-[a-z-]+/g));
  for (const skip of ["fa-solid", "fa-brands", "fa-android", "fa-mobile-screen-button"]) used.delete(skip);
  for (const icon of used) assert.ok(css.includes(`.${icon}::before`), icon);
});

test("Screen readers get two picker buttons and no dead file input", () => {
  const { messages, fileInput, pickerLabels } = makeSandbox();
  assert.equal(fileInput.attributes["aria-hidden"], "true");
  assert.equal(fileInput.tabIndex, -1);
  for (const label of pickerLabels) {
    assert.equal(label.attributes.role, "button");
    assert.equal(label.tabIndex, 0);
  }
  assert.match(pickerLabels[1].attributes["aria-label"], /^Choose media/);
  pickerLabels[0].handlers.keydown({ key: "Enter", preventDefault() {} });
  pickerLabels[0].handlers.keydown({ key: "a", preventDefault() {} });
  assert.deepEqual(messages, [{ action: "pickImage" }]);
});
