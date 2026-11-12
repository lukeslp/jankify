/*
 * File Purpose: Adapt Jankify's canonical web controls to the trusted Android bridge.
 * Primary Functions: Native media picking, export sharing, animation sharing, clipboard writes,
 *   the licenses dialog, and Back handling for dialogs.
 * Inputs/Outputs: Receives DOM actions and native media callbacks; emits JSON bridge messages.
 */
(() => {
  "use strict";

  const handler = window.JankifyAndroid;
  if (!handler?.postMessage) return;

  const post = (action, payload) => {
    handler.postMessage(JSON.stringify({ action, payload }));
  };

  window.jankifyReceiveImage = async (base64, mimeType) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    const isGif = mimeType === "image/gif"
      || (bytes.length >= 6
        && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46
        && bytes[3] === 0x38 && (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61);
    const type = isGif ? "image/gif" : (mimeType || "application/octet-stream");
    const file = new File([bytes], isGif ? "jankify-source.gif" : "jankify-source", { type });
    await handleIncomingFile(file);
  };

  const blobBase64 = blob => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1]);
    reader.readAsDataURL(blob);
  });

  async function shareBlob(blob, filename) {
    const mimeType = blob.type.startsWith("video/mp4")
      ? "video/mp4"
      : blob.type.startsWith("video/webm") ? "video/webm" : blob.type;
    post("share", {
      filename,
      mimeType: mimeType || "application/octet-stream",
      base64: await blobBase64(blob)
    });
  }

  window.downloadBlob = shareBlob;

  function currentVectorExport() {
    let text, ext, mimeType;
    if (state.mode === "polygon" && state.triangles) {
      text = svgPolygon(); ext = "svg"; mimeType = "image/svg+xml";
    } else if (state.mode === "voronoi" && state.voronoi) {
      text = svgVoronoi(); ext = "svg"; mimeType = "image/svg+xml";
    } else if (state.mode === "emoji" && state.emojiGrid) {
      text = svgEmoji(); ext = "svg"; mimeType = "image/svg+xml";
    } else if (state.mode === "ascii" && state.asciiGrid) {
      text = asciiText(); ext = "txt"; mimeType = "text/plain";
    } else if (state.mode === "pixel" && state.pixelGrid) {
      const output = getPixelOutput();
      text = output.text; ext = output.ext; mimeType = output.mime;
    } else if (state.mode === "hatch" && state.hatchSegments) {
      text = svgHatch(); ext = "svg"; mimeType = "image/svg+xml";
    } else if (state.mode === "rough" && state.roughGrid) {
      text = svgRough(); ext = "svg"; mimeType = "image/svg+xml";
    } else {
      return null;
    }
    return { text, ext, mimeType };
  }

  function currentTextExport() {
    if (state.mode === "ascii" && state.asciiGrid) return asciiText();
    if (state.mode === "pixel" && state.pixelGrid) return getPixelOutput().text;
    if (state.mode === "emoji" && state.emojiGrid) return svgEmoji();
    return null;
  }

  function flashCopied() {
    const button = $("copy-output");
    const original = button.innerHTML;
    button.classList.add("copy-flash");
    button.innerHTML = '<i class="fa-solid fa-check" aria-hidden="true"></i> Copied!';
    $("status").textContent = "Output copied to the clipboard.";
    setTimeout(() => {
      button.classList.remove("copy-flash");
      button.innerHTML = original;
    }, 1200);
  }

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

  // Android Back closes an open dialog or cancels a running animated export before it
  // leaves the page. Returns true when it did.
  window.jankifyBack = () => {
    const licenses = document.getElementById("licenses-dialog");
    if (licenses?.open) { licenses.close(); return true; }
    const warning = $("gif-warning");
    if (warning && !warning.hidden) { closeGifWarning(null); return true; }
    const cancel = $("cancel-anim");
    if (cancel && !cancel.hidden) { cancel.click(); return true; }
    return false;
  };

  window.triggerGifDownload = async function(bytes) {
    const blob = new Blob([bytes], { type: "image/gif" });
    await shareBlob(blob, `jankify-${state.mode}-${state.seed}.gif`);
  };

  document.addEventListener("click", async event => {
    const target = event.target.closest(
      'label[for="file-input"], #file-input, #download-png, #download-vector, #copy-output, #licenses-link'
    );
    if (!target) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    try {
      if (target.id === "licenses-link") {
        openLicenses("licenses.html");
      } else if (target.matches('label[for="file-input"], #file-input')) {
        post("pickImage");
      } else if (target.id === "download-png") {
        const canvas = $("canvas-area").querySelector("canvas");
        if (!canvas) return;
        const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
        if (blob) await shareBlob(blob, `jankify-${state.mode}-${state.seed}.png`);
      } else if (target.id === "download-vector") {
        const output = currentVectorExport();
        if (!output) return;
        await shareBlob(
          new Blob([output.text], { type: output.mimeType }),
          `jankify-${state.mode}-${state.seed}.${output.ext}`
        );
      } else if (target.id === "copy-output") {
        const text = currentTextExport();
        if (!text) return;
        post("copyText", { text });
        flashCopied();
      }
    } catch (error) {
      alert("Could not complete that action: " + error.message);
    }
  }, true);
})();
