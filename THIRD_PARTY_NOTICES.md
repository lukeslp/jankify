# Third-party notices

Jankify's original code is copyright 2026 Luke Steuber and distributed under [MIT](LICENSE). Components below retain their own copyrights and terms.

## Bundled code

| Component | Use | License and source |
|---|---|---|
| Rough.js 4.6.6 | Inline sketch renderer in `index.html` and generated mobile editors | Copyright 2019 Preet Shihn; [MIT text](licenses/Rough-MIT.txt); [source](https://github.com/rough-stuff/rough) |
| Deep-Fold PixelSpace | Origins of the WebGL Starscapes generator | Copyright 2021 Deep-Fold; [MIT text](Jankify/Resources/Web/create/LICENSE.txt); [source](https://github.com/Deep-Fold/PixelSpace) |
| Deep-Fold PixelPlanets | Origins of planet shaders | Copyright 2020 Deep-Fold; [MIT text](licenses/Deep-Fold-PixelPlanets-MIT.txt); [source](https://github.com/Deep-Fold/PixelPlanets) |
| Deep-Fold SpriteGenerator | Origins of sprite generation and name tables | Copyright 2021 Deep-Fold; [MIT text](licenses/Deep-Fold-SpriteGenerator-MIT.txt); [source](https://github.com/Deep-Fold/SpriteGenerator) |
| Gradle wrapper 8.14.5 | Android build bootstrap | [License text](licenses/Gradle-LICENSE.txt); [source](https://github.com/gradle/gradle/tree/v8.14.5) |

The Create workspace was adapted by Luke Steuber from PixelGen revision `da5ddb2eb810f35e2949b35eafec6332d549954b`. `Jankify/Resources/Web/create/SOURCE.json` records that origin and subsequent adaptations. It is a self-contained source snapshot; access to PixelGen is not needed to run or build Jankify.

The Backgrounds mode uses Luke Steuber's seeded canvas renderer, originally introduced in PixelGen commit `7ef9bb09833a5e03448a54957f728ac5144b1bbb`. It draws a night sky and mountain silhouettes. It differs from the older Deep-Fold Starscapes watercolor painter. That separate upstream painter and its p5.js dependency are not included. The Starscapes mode in the current menu is the separate WebGL space-background generator derived from PixelSpace. Existing recipe identifiers retain their original names.

Deep-Fold's [PixelSpace distribution page](https://deep-fold.itch.io/space-background-generator) permits generated images within games and other projects and asks that images not be distributed alone or as asset packs. Preserve that distinction when sharing outputs from the adapted generator; the source-code MIT grant is not a blanket license for every input image or generated asset.

## Browser resources and native dependencies

The browser editor loads IBM Plex fonts from Google Fonts and Font Awesome Free 6.5.1 from cdnjs. Those font/icon files are not checked in. [IBM Plex](https://github.com/IBM/plex/blob/master/LICENSE.txt) uses the SIL Open Font License; [Font Awesome Free](https://fontawesome.com/license/free) uses MIT for code, SIL OFL for fonts, and CC BY for SVG/JS icons. Native bundles use local system fonts and CSS icon fallbacks instead.

Android dependencies are declared in `android/app/build.gradle.kts` and fetched by Gradle. AndroidX is Apache-2.0; JUnit is EPL-1.0. Preserve the dependency notices when redistributing built applications. Platform emoji glyphs are rendered by the user's installed fonts; the repository does not bundle an emoji font.

## Artwork

The Jankify icon is drawn by `scripts/generate-icon.swift`; the Create bundle uses that same icon. `og.html` contains the social card's geometric artwork. Store screenshots show Jankify's own interface and generated scenes; photo-editing examples use NASA's [Apollo 17 Blue Marble photograph](https://www.nasa.gov/image-article/apollo-17-blue-marble/). See `fastlane/screenshots/SOURCE.md` for capture provenance. NASA is credited as the image source; no endorsement is implied. Product and platform names remain their respective owners' trademarks.
