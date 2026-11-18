"""Overlay the palm-right.json points on the PNG → artifacts/palm-right-debug.png (needs Pillow)."""
import json, sys
from PIL import Image, ImageDraw
png, js, out = sys.argv[1:4]
im = Image.open(png).convert("RGBA")
bg = Image.new("RGBA", im.size, (40, 60, 80, 255)); bg.alpha_composite(im)
d = ImageDraw.Draw(bg); P = json.load(open(js))["points"]
for k, (x, y) in P.items():
    d.ellipse([x - 5, y - 5, x + 5, y + 5], fill=(255, 0, 60), outline=(255, 255, 255)); d.text((x + 7, y - 6), k, fill=(255, 255, 0))
bg.save(out); print(im.mode, im.size, "corner", im.getpixel((5, 5)))
