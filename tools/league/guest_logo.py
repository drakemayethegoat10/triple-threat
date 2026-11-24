"""Cuts Garden State Made's logo (src/sim/guests.js) out of the owner's picture of it, a round avatar under a navy
strip: the strip and its badge painted out, the white round the logo made clear (a flood fill from the edges through
near-white and the circle's grey rim), only the logo's own piece kept, trimmed, and centred on a 512 square with the
league logos' margin (see logos.py). Usage:
    python3 -I tools/league/guest_logo.py "<picture>" assets/logos/gsm.png
"""
import sys
from collections import deque
from PIL import Image, ImageFilter

src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGBA')
w, h = im.size
px = im.load()
# The navy strip and the badge: dark blue pixels in the top 60 rows become white.
for y in range(60):
    for x in range(w):
        r, g, b, a = px[x, y]
        if b > r + 20 and r < 120:
            px[x, y] = (255, 255, 255, 255)
NEAR = 52
light = lambda c: min(c[:3]) >= 255 - NEAR and max(c[:3]) - min(c[:3]) < 24
seen = bytearray(w * h)
todo = deque([(x, 0) for x in range(w)] + [(x, h - 1) for x in range(w)] + [(0, y) for y in range(h)] + [(w - 1, y) for y in range(h)])
while todo:
    x, y = todo.popleft()
    if x < 0 or y < 0 or x >= w or y >= h or seen[y * w + x]:
        continue
    seen[y * w + x] = 1
    if not light(px[x, y]):
        continue
    px[x, y] = (255, 255, 255, 0)
    todo.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
# Keep only the logo itself: the largest connected piece of what is left (the circle's faint rim and the strip's last
# traces are pieces of their own).
seen = bytearray(w * h)
best = []
for sy in range(h):
    for sx in range(w):
        if seen[sy * w + sx] or px[sx, sy][3] == 0:
            continue
        piece, todo = [], deque([(sx, sy)])
        seen[sy * w + sx] = 1
        while todo:
            x, y = todo.popleft()
            piece.append((x, y))
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and px[nx, ny][3] > 0:
                    seen[ny * w + nx] = 1
                    todo.append((nx, ny))
        if len(piece) > len(best):
            for x, y in best:
                px[x, y] = (255, 255, 255, 0)
            best = piece
        else:
            for x, y in piece:
                px[x, y] = (255, 255, 255, 0)
box = im.getbbox()
logo = im.crop(box)
SIZE, MARGIN = 512, 0.04
inner = int(SIZE * (1 - 2 * MARGIN))
scale = inner / max(logo.size)
logo = logo.resize((round(logo.size[0] * scale), round(logo.size[1] * scale)), Image.LANCZOS)
square = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
square.paste(logo, ((SIZE - logo.size[0]) // 2, (SIZE - logo.size[1]) // 2), logo)
square.save(out, optimize=True)
print(box, logo.size)
