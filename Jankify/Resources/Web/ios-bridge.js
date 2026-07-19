/*
 * File Purpose: Adapt Jankify's canonical web controls to the trusted iOS bridge.
 * Primary Functions: Native media picking, export sharing, animation sharing, and clipboard writes.
 * Inputs/Outputs: Receives DOM actions and native media callbacks; emits validated bridge messages.
 */
(() => {
  "use strict";

  const handler = window.webkit?.messageHandlers?.jankify;
  if (!handler) return;

  const post = (action, payload) => handler.postMessage({ action, payload });
  const imageSignatures = [
    {
      mimeType: "image/gif",
      extension: "gif",
      matches: bytes => bytes.length >= 6
        && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46
        && bytes[3] === 0x38 && (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61
    },
    {
      mimeType: "image/png",
      extension: "png",
      matches: bytes => bytes.length >= 8
        && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47
        && bytes[4] === 0x0D && bytes[5] === 0x0A && bytes[6] === 0x1A && bytes[7] === 0x0A
    },
    {
      mimeType: "image/jpeg",
      extension: "jpg",
      matches: bytes => bytes.length >= 3
        && bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF
    }
  ];

  function sniffImageType(bytes) {
    return imageSignatures.find(signature => signature.matches(bytes)) || null;
  }

  window.jankifyReceiveImage = async (base64, mimeType) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    const sniffed = sniffImageType(bytes);
    const type = sniffed?.mimeType || mimeType || "application/octet-stream";
    const filename = sniffed ? `jankify-source.${sniffed.extension}` : "jankify-source";
    const file = new File([bytes], filename, { type });
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
    button.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
    setTimeout(() => {
      button.classList.remove("copy-flash");
      button.innerHTML = original;
    }, 1200);
  }

  window.triggerGifDownload = async function(bytes) {
    const blob = new Blob([bytes], { type: "image/gif" });
    await shareBlob(blob, `jankify-${state.mode}-${state.seed}.gif`);
  };

  document.addEventListener("click", async event => {
    const target = event.target.closest(
      'label[for="file-input"], #file-input, #download-png, #download-vector, #copy-output'
    );
    if (!target) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    try {
      if (target.matches('label[for="file-input"], #file-input')) {
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
