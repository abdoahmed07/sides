"""
Draws the Hifz Tracker logo and writes every icon the app needs:
the ۞ Rub el Hizb (two interlaced squares, the mushaf's section marker) with a
gold progress ring inside, on a green background.

    python3 scripts/make-icons.py      (needs Pillow: pip install pillow)

Variant "1" is the logo; "2" and "3" were the other candidates.
"""
import math, os
from PIL import Image, ImageDraw, ImageChops

GREEN_TOP = (47, 107, 79)
GREEN_BOT = (30, 74, 53)
CREAM = (243, 234, 215)
GOLD = (222, 186, 112)

def sq(cx, cy, R, rot):
    return [(cx + R * math.cos(math.radians(rot + 45 + 90 * k)), cy + R * math.sin(math.radians(rot + 45 + 90 * k))) for k in range(4)]

def star(cx, cy, R, ratio):
    return [(cx + (R if k % 2 == 0 else R * ratio) * math.cos(math.radians(-90 + k * 22.5)),
             cy + (R if k % 2 == 0 else R * ratio) * math.sin(math.radians(-90 + k * 22.5))) for k in range(16)]

def background(S, rounded):
    img = Image.new("RGBA", (S, S))
    d = ImageDraw.Draw(img)
    for y in range(S):
        t = y / S
        d.line([(0, y), (S, y)], fill=tuple(int(GREEN_TOP[i] * (1 - t) + GREEN_BOT[i] * t) for i in range(3)) + (255,))
    if rounded:
        m = Image.new("L", (S, S), 0)
        ImageDraw.Draw(m).rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.22), fill=255)
        img.putalpha(m)
    return img

def paint(img, mask, color):
    layer = Image.new("RGBA", img.size, color + (255,))
    img.paste(layer, (0, 0), mask)

def rub_el_hizb_mask(S, c, R, w):
    """Two interlaced square outlines (the ۞ star) as a mask."""
    out = Image.new("L", (S, S), 0)
    for rot in (0, 45):
        m = Image.new("L", (S, S), 0)
        d = ImageDraw.Draw(m)
        d.polygon(sq(c, c, R, rot), fill=255)
        d.polygon(sq(c, c, R - w * math.sqrt(2), rot), fill=0)
        out = ImageChops.lighter(out, m)
    return out

def ring(img, c, r, w, start, end, color):
    d = ImageDraw.Draw(img)
    d.arc([c - r, c - r, c + r, c + r], start=start, end=end, fill=color, width=int(w))
    for a in (start, end):
        x = c + (r - w / 2) * math.cos(math.radians(a)); y = c + (r - w / 2) * math.sin(math.radians(a))
        d.ellipse([x - w / 2, y - w / 2, x + w / 2, y + w / 2], fill=color)

def variant(v, S=1024, rounded=False, scale=1.0):
    img = background(S, rounded)
    c = S / 2
    R = S * 0.37 * scale
    if v == "1":   # interlaced ۞ outline + progress ring inside
        paint(img, rub_el_hizb_mask(S, c, R, S * 0.045), CREAM)
        ring(img, c, R * 0.42, S * 0.045, -90, 180, GOLD)
    elif v == "2":  # interlaced ۞ outline + solid centre
        paint(img, rub_el_hizb_mask(S, c, R, S * 0.045), CREAM)
        d = ImageDraw.Draw(img); r = R * 0.26
        d.ellipse([c - r, c - r, c + r, c + r], fill=GOLD)
    elif v == "3":  # sharp filled star + green hole + progress ring
        d = ImageDraw.Draw(img)
        d.polygon(star(c, c, R * 1.05, 0.62), fill=CREAM)
        hole = R * 0.44
        d.ellipse([c - hole, c - hole, c + hole, c + hole], fill=GREEN_BOT)
        ring(img, c, hole * 0.72, S * 0.04, -90, 180, GOLD)
    return img

LOGO = "1"

if __name__ == "__main__":
    root = os.path.join(os.path.dirname(__file__), "..")
    app = os.path.join(root, "src", "app")
    icons = os.path.join(root, "public", "icons")
    os.makedirs(icons, exist_ok=True)
    rounded = variant(LOGO, rounded=True)
    square = variant(LOGO).convert("RGB")             # iOS and Android round the corners themselves
    maskable = variant(LOGO, scale=0.78).convert("RGB")  # Android may crop to a circle: keep it in the middle
    rounded.resize((48, 48), Image.LANCZOS).save(os.path.join(app, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)])
    rounded.resize((192, 192), Image.LANCZOS).save(os.path.join(app, "icon.png"))
    square.resize((180, 180), Image.LANCZOS).save(os.path.join(app, "apple-icon.png"))
    for n in (192, 512):
        square.resize((n, n), Image.LANCZOS).save(os.path.join(icons, f"icon-{n}.png"))
    maskable.resize((512, 512), Image.LANCZOS).save(os.path.join(icons, "icon-maskable-512.png"))
    print("icons written")
