# Screenshot provenance

The 10 App Store screenshots in `en-US/` use authentic captures of Jankify
running in the iOS Simulator: iPhone 17 Pro Max for the 6.9-inch set and iPad
Pro 13-inch (M5) for the 13-inch set. The captures are set into branded frames;
the app interface itself is not retouched.

- **Create subjects:** sprites, ships, and seeded explosions generated inside
  the bundled SpaceJank workspace.
- **Edit subject:** the Apollo 17 "Blue Marble" photograph from NASA, which is
  public domain.
- **Edit modes:** Pixel on iPhone and iPad, plus Emoji on iPad.
- **Privacy line:** `Private by design · Fully offline`.
- **Raw captures:** `fastlane/screenshot-source/en-US/`.

To regenerate the final assets from the checked-in captures:

```sh
swift scripts/compose-store-screenshots.swift
```

Final sizes are 1320×2868 for iPhone and 2064×2752 for iPad.
