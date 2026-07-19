# Screenshot provenance

The 10 App Store screenshots in `en-US/` are authentic captures of Jankify
running in the iOS Simulator (iPhone 17 Pro Max for the 6.9" set, iPad Pro 13"
M5 for the 13" set), then composited into branded marketing frames.

- **Sample image:** the Apollo 17 "Blue Marble" photograph — NASA, public domain.
  Chosen because it is rights-clean, instantly recognizable, and rich enough in
  color and edges to show every render mode well.
- **Modes shown:** Pixel, Lite Brite, Emoji, Hatch, Polygon (both devices) plus
  ASCII (iPhone).
- **Frames:** dark gradient matching the app (#16140f family), accent #e07a52,
  one caption per shot, `No account · No cloud · No AI` footer.

To regenerate: re-capture raw simulator screenshots, then run the compositor
(kept out of the repo under `/tmp/jankify-shots/compose.py` during the build
session). Final sizes: iPhone 1320×2868, iPad 2064×2752 — both accepted by the
App Store for the 6.9" and 13" display classes.
