/*
 * File Purpose: Adapt SpaceJank export and copy actions to Jankify's native bridge.
 * Primary Functions: Validate PNG data URLs, share exports, copy public recipe links,
 *   and show the Android licenses dialog.
 * Inputs/Outputs: Receives calls from SpaceJank; emits the existing constrained bridge messages.
 */
(() => {
  "use strict";

  const iosHandler = window.webkit?.messageHandlers?.jankify;
  const androidHandler = window.JankifyAndroid;
  if (!iosHandler?.postMessage && !androidHandler?.postMessage) return;

  const post = (action, payload) => {
    const message = { action, payload };
    if (iosHandler?.postMessage) iosHandler.postMessage(message);
    else androidHandler.postMessage(JSON.stringify(message));
  };

  window.jankifyShell = Object.freeze({
    async shareDataURL(dataURL, filename) {
      const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(String(dataURL));
      if (!match) throw new Error("Only PNG exports can be shared from Create.");
      post("share", {
        filename: String(filename || "spacejank-export.png"),
        mimeType: "image/png",
        base64: match[1]
      });
    },

    async copyText(text) {
      post("copyText", { text: String(text) });
    }
  });

  // Open-source licenses: a dialog over the current page, so nothing in progress is lost.
  function openLicenses(source) {
    let dialog = document.getElementById("licenses-dialog");
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.id = "licenses-dialog";
      dialog.setAttribute("aria-label", "Open-source licenses");
      dialog.style.cssText = "width:min(720px,94vw);height:88vh;max-width:none;max-height:none;padding:0;"
        + "border:1px solid #6b6862;border-radius:6px;background:#fafaf7;color:#1a1a1a;";
      const close = document.createElement("button");
      close.type = "button";
      close.textContent = "Close";
      close.style.cssText = "display:block;width:100%;min-height:48px;border:0;border-bottom:1px solid #6b6862;"
        + "background:#1a1a1a;color:#fafaf7;font:600 16px system-ui,sans-serif;";
      close.addEventListener("click", () => dialog.close());
      const frame = document.createElement("iframe");
      frame.title = "Open-source licenses";
      frame.src = source;
      frame.style.cssText = "display:block;width:100%;height:calc(100% - 49px);border:0;";
      dialog.append(close, frame);
      document.body.appendChild(dialog);
    }
    if (!dialog.open) dialog.showModal();
  }

  // The Android app lists its bundled open-source code from the Create footer.
  function addLicensesLink() {
    const footer = document.querySelector(".footer p");
    if (!footer || document.getElementById("licenses-link")) return;
    const link = document.createElement("a");
    link.id = "licenses-link";
    link.href = "../../licenses.html";
    link.textContent = "Open-source licenses";
    link.style.cssText = "display:inline-block;padding:12px 0;color:inherit;";
    link.addEventListener("click", event => {
      event.preventDefault();
      openLicenses(link.href);
    });
    footer.append(" · ", link);
  }

  if (androidHandler?.postMessage) {
    window.jankifyBack = () => {
      const licenses = document.getElementById("licenses-dialog");
      if (licenses?.open) { licenses.close(); return true; }
      return false;
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", addLicensesLink);
    else addLicensesLink();
  }

  if (!window.location.hash) {
    window.location.hash = "#/effects";
  }
})();
