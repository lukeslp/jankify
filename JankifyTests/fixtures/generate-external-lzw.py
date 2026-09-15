"""Generate original test pixels with an independent GIF encoder (Pillow 12.1.1)."""
from pathlib import Path
from PIL import Image

frames = []
palette = [channel for i in range(256) for channel in (i, (i * 5) % 256, (i * 11) % 256)]
for frame_index in range(3):
    frame = Image.new("P", (48, 48))
    frame.putpalette(palette)
    frame.putdata([(x * 7 + y * 13 + frame_index * 29) % 256 for y in range(48) for x in range(48)])
    frames.append(frame)
frames[0].save(Path(__file__).with_name("external-lzw.gif"), save_all=True,
               append_images=frames[1:], duration=400, loop=0, optimize=False,
               disposal=2)
