"""Generate the app's PNG icons (an original "V" mark, no Toastmasters logo)."""
from PIL import Image, ImageDraw
import os

BLUE = (0, 65, 101)
YELLOW = (242, 223, 116)
OUT = os.path.join(os.path.dirname(__file__), '..', 'public')


def icon(size, maskable=False, name=None):
    s = size * 4  # supersample for smooth edges
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if maskable:
        d.rectangle([0, 0, s, s], fill=BLUE)
        pad = s * 0.22
    else:
        d.rounded_rectangle([0, 0, s, s], radius=s * 0.22, fill=BLUE)
        pad = s * 0.18
    inner = s - 2 * pad
    p = lambda x, y: (pad + x * inner, pad + y * inner)
    w = int(inner * 0.13)
    pts = [p(0.08, 0.12), p(0.5, 0.9), p(0.92, 0.12)]
    d.line(pts, fill='white', width=w, joint='curve')
    for x, y in pts:
        d.ellipse([x - w / 2, y - w / 2, x + w / 2, y + w / 2], fill='white')
    cx, cy = pts[2]
    r = inner * 0.11
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=YELLOW)
    img = img.resize((size, size), Image.LANCZOS)
    img.save(os.path.join(OUT, name))


icon(192, name='icon-192.png')
icon(512, name='icon-512.png')
icon(512, maskable=True, name='icon-maskable-512.png')
icon(180, maskable=True, name='apple-touch-icon.png')
