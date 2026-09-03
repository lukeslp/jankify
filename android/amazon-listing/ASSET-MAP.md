# Amazon Appstore tablet assets — Jankify

Requirements source: [Amazon Appstore Details — Images and videos](https://developer.amazon.com/docs/app-submission/appstore-details.html#images-and-videos), retrieved 2026-09-03 for Fire OS tablet listings.

| Amazon field | Requirement | Local file | State |
|---|---|---|---|
| Small icon | 114×114 PNG | `images/icon-114.png` | ready |
| Large icon | 512×512 PNG | `images/icon-512.png` | ready |
| Screenshots | 3–10 PNG/JPEG files at an accepted tablet size | `screenshots/*.png` | ready — three signed-build captures |
| Promotional image | optional 1024×500 PNG/JPEG | — | intentionally omitted |

Accepted screenshot dimensions recorded by Amazon on the retrieved date are
800×480, 1024×600, 1280×720, 1280×800, 1920×1080, 1920×1200, and 2560×1600,
in landscape or portrait orientation.

The icon source is `Jankify/Assets.xcassets/AppIcon.appiconset/icon_1024x1024.png`.
The two store icons are deterministic reductions of that checked-in source;
they do not add a border, corner mask, badge, slogan, or new artwork.

The final screenshots come from the signed `1.0.10 (17)` APK running on the
KFRASWI Fire OS 8 tablet. The three distinct, truthful states are:

1. `screenshots/01_starscape-1280x800.png` — Create workspace, generated
   starscape.
2. `screenshots/02_planet-1280x800.png` — Create workspace, generated planet.
3. `screenshots/03_pixel-edit-1280x800.png` — Edit workspace, non-personal
   sample image and Pixel result.

They do not include the system picker, share sheet, personal media, account
names, or another platform's device chrome.
