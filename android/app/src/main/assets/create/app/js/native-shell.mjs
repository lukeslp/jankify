const PUBLIC_CREATE_URL = "https://jankify.app/create/app/";

export function canonicalRecipeURL(hash = "") {
  const recipe = String(hash || "");
  return recipe ? `${PUBLIC_CREATE_URL}${recipe.startsWith("#") ? recipe : `#${recipe}`}` : PUBLIC_CREATE_URL;
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
