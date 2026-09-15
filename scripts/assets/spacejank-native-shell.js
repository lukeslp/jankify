/*
 * File Purpose: Adapt SpaceJank export and copy actions to Jankify's native bridge.
 * Primary Functions: Validate PNG data URLs, share exports, and copy public recipe links.
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

  if (!window.location.hash) {
    window.location.hash = "#/effects";
  }
})();
