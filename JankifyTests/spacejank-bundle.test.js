const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const iosRoot = "Jankify/Resources/Web";
const androidRoot = "android/app/src/main/assets";
const modes = [
  "backgrounds",
  "effects",
  "explosions",
  "planets",
  "ships",
  "sprites",
  "starscapes",
];

test("Create is bundled identically on web, iOS and Android", () => {
  const iosFiles = fs.readdirSync(path.join(iosRoot, "create"), { recursive: true })
    .filter(file => fs.statSync(path.join(iosRoot, "create", file)).isFile())
    .sort();
  const androidFiles = fs.readdirSync(path.join(androidRoot, "create"), { recursive: true })
    .filter(file => fs.statSync(path.join(androidRoot, "create", file)).isFile())
    .sort();

  assert.deepEqual(androidFiles, iosFiles);
  const webFiles = fs.readdirSync("create", { recursive: true })
    .filter(file => fs.statSync(path.join("create", file)).isFile())
    .sort();
  assert.deepEqual(webFiles, iosFiles);
  for (const file of iosFiles) {
    assert.deepEqual(
      fs.readFileSync(path.join(androidRoot, "create", file)),
      fs.readFileSync(path.join(iosRoot, "create", file)),
      file,
    );
    assert.deepEqual(fs.readFileSync(path.join("create", file)), fs.readFileSync(path.join(iosRoot, "create", file)), file);
  }
});

test("Backgrounds ignores legacy embed recipes and exports the seeded canvas", async () => {
  const source = fs.readFileSync("scripts/assets/spacejank-backgrounds.js", "utf8");
  let commands = [];
  const context = new Proxy({}, {
    get(_target, key) {
      if (key === "createLinearGradient") return (...args) => {
        commands.push([key, ...args]);
        return { addColorStop: (...values) => commands.push(["stop", ...values]) };
      };
      return (...args) => commands.push([key, ...args]);
    },
    set(_target, key, value) { commands.push([key, value]); return true; },
  });
  const canvas = { getContext: () => context, toDataURL: () => "data:image/png;base64,seeded" };
  const sandbox = {};
  vm.runInNewContext(source.replace("export const starscapesMode =", "globalThis.mode ="), sandbox);
  const mode = sandbox.mode;
  mode._canvas = canvas;
  const recipe = { seed: 42, width: 200, height: 200, embed: true };
  assert.equal(mode.generate(recipe), canvas);
  const first = JSON.stringify(commands);
  commands = [];
  mode.generate(recipe);
  assert.equal(JSON.stringify(commands), first);
  commands = [];
  mode.generate({ ...recipe, seed: 43 });
  assert.notEqual(JSON.stringify(commands), first);
  assert.equal(mode.exportCanvas(), canvas);
  assert.equal(await mode.exportAsync(), "data:image/png;base64,seeded");
});

test("recipe links preserve browser hosting and select canvas Backgrounds in native links", async () => {
  const { canonicalRecipeURL } = await import("../scripts/assets/spacejank-recipes.mjs");
  const browser = { location: new URL("https://example.org/games/jankify/create/app/index.html#/ships") };
  assert.equal(
    canonicalRecipeURL("#/planets?seed=42", browser),
    "https://example.org/games/jankify/create/app/index.html#/planets?seed=42",
  );
  assert.equal(
    canonicalRecipeURL("#/starscapes?seed=42&embed=true", browser),
    "https://example.org/games/jankify/create/app/index.html#/starscapes?seed=42&embed=false",
  );
  const native = {
    location: new URL("https://appassets.androidplatform.net/assets/create/app/index.html"),
    jankifyShell: { shareDataURL() {}, copyText() {} },
  };
  assert.equal(
    canonicalRecipeURL("#/starscapes?seed=42", native),
    "https://jankify.app/create/app/#/starscapes?seed=42&embed=false",
  );
  native.location = new URL("file:///bundle/Web/create/app/index.html");
  assert.equal(canonicalRecipeURL("#/effects?seed=42", native), "https://jankify.app/create/app/#/effects?seed=42");
});

test("Create has all seven modes and no hosted executable dependencies", () => {
  const html = fs.readFileSync(path.join(iosRoot, "create/app/index.html"), "utf8");
  assert.match(html, /\.\.\/native-shell\.js/);
  assert.doesNotMatch(html, /stats\.dr\.eamer\.dev|<script[^>]+https?:\/\//i);
  assert.match(html, /href="\.\.\/\.\.\/index\.html"/);
  for (const mode of modes) {
    assert.ok(fs.existsSync(path.join(iosRoot, `create/app/js/modes/${mode}.js`)), mode);
  }
  assert.ok(!fs.existsSync(path.join(iosRoot, "create/Starscapes")));
  const backgrounds = fs.readFileSync(path.join(iosRoot, "create/app/js/modes/starscapes.js"), "utf8");
  assert.doesNotMatch(backgrounds, /iframe|postMessage|p5\.js/);
  assert.match(backgrounds, /_preview\(state\)/);
  assert.ok(fs.existsSync(path.join(iosRoot, "create/SOURCE.json")));
});

test("native adapter maps SpaceJank share and copy actions onto the iOS bridge", async () => {
  const source = fs.readFileSync(path.join(iosRoot, "create/native-shell.js"), "utf8");
  const messages = [];
  const sandbox = {
    window: {
      webkit: { messageHandlers: { jankify: { postMessage: message => messages.push(message) } } },
      location: { hash: "" },
    },
  };
  vm.runInNewContext(source, sandbox);

  assert.equal(sandbox.window.location.hash, "#/effects");

  await sandbox.window.jankifyShell.shareDataURL(
    "data:image/png;base64,iVBORw==",
    "spacejank-effects-42.png",
  );
  await sandbox.window.jankifyShell.copyText("https://jankify.app/create/app/#/effects?seed=42");

  assert.equal(messages[0].action, "share");
  assert.equal(messages[0].payload.mimeType, "image/png");
  assert.equal(messages[0].payload.base64, "iVBORw==");
  assert.equal(messages[1].action, "copyText");
});

test("native adapter emits JSON for Android and rejects non-PNG data", async () => {
  const source = fs.readFileSync(path.join(androidRoot, "create/native-shell.js"), "utf8");
  const messages = [];
  const sandbox = {
    window: {
      JankifyAndroid: { postMessage: message => messages.push(JSON.parse(message)) },
      location: { hash: "#/ships?seed=42" },
    },
  };
  vm.runInNewContext(source, sandbox);

  await sandbox.window.jankifyShell.copyText("recipe");
  assert.deepEqual(messages, [{ action: "copyText", payload: { text: "recipe" } }]);
  await assert.rejects(
    sandbox.window.jankifyShell.shareDataURL("data:text/plain;base64,SGk=", "bad.txt"),
    /Only PNG exports/,
  );
});
