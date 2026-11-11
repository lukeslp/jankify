const PUBLIC_CREATE_URL = "https://jankify.app/create/app/";

export function canonicalRecipeURL(hash = "", scope = globalThis) {
  let recipe = String(hash || "").replace(/^#/, "");
  const [mode, query = ""] = recipe.split("?");
  if (/^\/?(?:starscapes|1)$/.test(mode)) {
    const params = new URLSearchParams(query);
    params.set("embed", "false");
    recipe = `${mode}?${params}`;
  }
  let base = PUBLIC_CREATE_URL;
  if (!currentNativeShell(scope) && /^https?:$/.test(scope.location?.protocol || "")) {
    base = scope.location.href;
  }
  const url = new URL(base);
  url.hash = recipe;
  return url.href;
}

export function currentNativeShell(scope = globalThis) {
  const shell = scope?.jankifyShell;
  if (
    shell &&
    typeof shell.shareDataURL === "function" &&
    typeof shell.copyText === "function"
  ) {
    return shell;
  }
  return null;
}
