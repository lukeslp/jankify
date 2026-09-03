/**
 * p5 loadPixels() hammers getImageData. Force willReadFrequently on every 2d context
 * created after this script (must load BEFORE p5.min.js).
 */
(function () {
  const orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, attrs) {
    if (type === "2d") {
      attrs = Object.assign({}, attrs || {}, { willReadFrequently: true });
    }
    return orig.call(this, type, attrs);
  };
})();
