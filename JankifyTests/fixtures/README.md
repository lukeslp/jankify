# GIF decoder fixture

`external-lzw.gif` contains three original 48 × 48 pixel patterns created by Luke Steuber's `generate-external-lzw.py` and encoded with Pillow 12.1.1. The pixels and generator are covered by the repository MIT license. No third-party photograph or artwork is used.

The independent encoder tests compatibility beyond Jankify's own encoder/decoder round trips. Pillow is needed only to regenerate the fixture; normal tests read the checked-in GIF and require only Node.js.

```sh
python3 -m pip install Pillow==12.1.1
python3 JankifyTests/fixtures/generate-external-lzw.py
node --test JankifyTests/gif-codec.test.js
```
