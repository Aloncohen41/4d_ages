"""
Builds every brand image for 4D Ages from TWO supplied pictures in this folder. The pictures themselves are used —
they are only resized, centred, and (where noted) have their flat cream backdrop removed. Nothing is redrawn.

    branding/4d-ages-icon.jpg       the app icon artwork (stack of photo cards, child and heart)
    branding/4d-ages-wordmark.png   the in-app logo: the same artwork with "4D Ages"

    python3 branding/make-assets.py          (needs: pip install pillow numpy scipy)

Writes into assets/:
  icon.png                      app icon, full bleed, on the picture's own cream
  adaptive-icon.png             Android adaptive icon foreground: the artwork is measured and kept inside the round safe zone
  adaptive-icon-monochrome.png  Android 13 themed icon (a white silhouette taken from the artwork)
  splash-icon.png               splash: the artwork centred, on the same cream as the splash background
  notification-icon.png         status-bar icon: a white silhouette taken from the artwork
  4d-ages-wordmark.png          the in-app logo with a transparent background (top-left of every screen, welcome screen, About card)
Prints the measurements the tests and src/brand.ts rely on.
"""
import os
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "assets")
save = lambda im, name: im.save(os.path.join(OUT, name))

def backdrop(arr):
    """The flat colour around the artwork (median of the border)."""
    b = np.concatenate([arr[:25].reshape(-1, 3), arr[-25:].reshape(-1, 3), arr[:, :25].reshape(-1, 3), arr[:, -25:].reshape(-1, 3)])
    return np.median(b, axis=0)

def unmix(rgb, bg, d0=6.0, d1=38.0):
    """Remove a flat backdrop: returns RGBA where the backdrop is transparent and soft glows keep a soft alpha."""
    dist = np.sqrt(((rgb - bg) ** 2).sum(-1))
    a = np.clip((dist - d0) / (d1 - d0), 0, 1)
    a = a * a * (3 - 2 * a)
    fg = np.clip((rgb - (1 - a)[..., None] * bg) / np.maximum(a, 1e-3)[..., None], 0, 255)  # un-mix, so edges have no cream fringe
    fg = np.where(a[..., None] > 0.98, rgb, fg)
    return np.dstack([fg, a * 255]).astype(np.uint8), dist

# ============================================================== the app icon artwork
icon = Image.open(os.path.join(HERE, "4d-ages-icon.jpg")).convert("RGB")
ia = np.array(icon).astype(np.float64)
H, W, _ = ia.shape
BG = backdrop(ia)
BG_HEX = "#%02X%02X%02X" % tuple(int(round(v)) for v in BG)
BG_RGB = tuple(int(round(v)) for v in BG)

_, dist = unmix(ia, BG)

# The artwork as the eye sees it: every card with its cream outline, but WITHOUT the soft glow around it. (The glow is lopsided —
# orange on the left only — so centring on it pushes the real artwork off-centre.) The cream outlines are the whitest thing in the
# picture and the glow lies outside the stack's outermost outline: thicken the outlines slightly to bridge the gaps where cards
# overlap, fill what they enclose, and shrink back so none of the glow is included.
whiteness = ia.min(axis=2)
cream = whiteness >= 230
clab, _ = ndi.label(cream)
outlines = cream & (clab != clab[10, 10])           # every cream stroke except the empty backdrop
BRIDGE = 12
enclosed = ndi.binary_erosion(ndi.binary_fill_holes(ndi.binary_dilation(outlines, iterations=BRIDGE)), iterations=BRIDGE)
ys_, xs_ = np.where(enclosed)
art_x0, art_x1, art_y0, art_y1 = xs_.min(), xs_.max(), ys_.min(), ys_.max()
# Where the middle of the canvas goes. The shape is heavier on the right (the big D-shaped card) than its outline suggests, so
# centring the bounding box alone still FEELS right-heavy. We start at the bounding-box centre and move OPTICAL of the way toward the
# visual mass: 0 = centre the box exactly, 1 = centre the mass exactly. 0.3 leaves both within ~10–20 px of the middle on a 1024 canvas.
OPTICAL = 0.30
box_c = np.array([(art_x0 + art_x1) / 2, (art_y0 + art_y1) / 2])
mass_c = np.array([xs_.mean(), ys_.mean()])
acx, acy = box_c + OPTICAL * (mass_c - box_c)
R = np.hypot(xs_ - acx, ys_ - acy).max()   # the farthest the artwork (outlines included) reaches from that point

def place(img, size, radius_frac, bg_rgb):
    """Centre the artwork's enclosing circle on a square canvas so its radius is `radius_frac` of the canvas."""
    sc = radius_frac * size / R
    w, h = int(round(img.width * sc)), int(round(img.height * sc))
    scaled = img.resize((w, h), Image.LANCZOS)
    # feather the picture's edges into the canvas so no rectangle can show
    yy, xx = np.mgrid[0:h, 0:w]
    edge = np.minimum(np.minimum(xx, w - 1 - xx), np.minimum(yy, h - 1 - yy)).astype(float)
    f = max(8.0, 0.05 * min(w, h)); m = np.clip(edge / f, 0, 1); m = m * m * (3 - 2 * m)
    canvas = Image.new("RGB", (size, size), bg_rgb)
    canvas.paste(scaled, (int(round(size / 2 - acx * sc)), int(round(size / 2 - acy * sc))), Image.fromarray((m * 255).astype(np.uint8)))
    return canvas

SAFE = 0.30  # the artwork (outlines included) reaches this far from the middle, as a share of the canvas. Android's strict safe circle is 66 dp of 108 = 0.306; the visible mask is 0.333
save(place(icon, 1024, 0.42, BG_RGB), "icon.png")
save(place(icon, 1024, SAFE, BG_RGB), "adaptive-icon.png")
save(place(icon, 1024, SAFE, BG_RGB), "splash-icon.png")

# ---- the one-colour glyph: for Android's themed icons (Pixel tints it with the wallpaper colour) and the status bar -------------------
# A themed launcher draws ONE layer in ONE colour, so the full-colour art can't just be flattened: four stacked cards, a child, a
# heart and hairline gaps turn into a blob. Google's guidance for this layer is "keep artwork simple, avoid multiple layers and
# complex shapes". So the glyph is built from the artwork's own shapes (found in the picture, not redrawn), kept whole and smooth,
# with deliberately wide gaps between the layers, and drawn smaller than the full-colour icon so it has room inside the circle.
S = ndi.binary_opening(enclosed & ~cream, iterations=1)          # everything coloured, inside the outlines
shrunk, _ = ndi.label(ndi.binary_erosion(S, iterations=9))        # shrink to split touching shapes, then regrow each inside S
def part(x, y):                                                  # (x, y) = a point inside that part of THIS picture
    lab_ = shrunk[y, x]
    assert lab_ != 0, "make-assets.py is tuned to the supplied icon picture: no shape found at (%d,%d)" % (x, y)
    return ndi.binary_dilation(shrunk == lab_, iterations=9, mask=S)
front, orange, mauve, heart = part(500, 800), part(260, 620), part(950, 330), part(810, 525)  # front card (+child), left card, right card, heart
assert 250000 < front.sum() < 400000 and 40000 < orange.sum() < 120000 and 30000 < mauve.sum() < 90000 and 15000 < heart.sum() < 40000, "unexpected shape sizes"
# the child sits in a cream disc on the front card; its head is the roundest blob in the upper half of the figure
yy_, xx_ = np.mgrid[0:H, 0:W]
child = (((xx_ - 685.0) ** 2 + (yy_ - 688.0) ** 2) <= 250.0 ** 2) & S
dtc = np.where(child & (yy_ < 698), ndi.distance_transform_edt(child), 0)
hy, hx = np.unravel_index(dtc.argmax(), dtc.shape); head_r = dtc[hy, hx]
assert 70 < head_r < 120, "unexpected head size"
# gaps (in source pixels; the picture is 1254 px, the glyph ends up about 0.4x that): wide enough to stay open at launcher size
GAP_BACK, GAP_HEART, GAP_HEAD = 50, 48, 40
heart_c = ndi.binary_opening(heart, iterations=10)               # drop the little tail left where the heart was regrown
heart_c &= ((xx_ - hx) ** 2 + (yy_ - hy) ** 2) > (head_r + GAP_HEAD) ** 2   # and keep it a clear distance from the head
front_c = front & ~ndi.binary_dilation(heart_c, iterations=GAP_HEART)                         # a ring of space round the heart
front_c &= ~(((xx_ - hx) ** 2 + (yy_ - hy) ** 2 <= (head_r + GAP_HEAD) ** 2) & ~((xx_ - hx) ** 2 + (yy_ - hy) ** 2 <= head_r ** 2))  # …and round the child's head
backs = (orange | mauve) & ~ndi.binary_dilation(front, iterations=GAP_BACK)                  # back cards stay clear of the front card
sm = ndi.binary_opening(front_c | heart_c | backs, iterations=4)                              # no specks or hairlines
reg, nreg = ndi.label(sm)
sm = np.isin(reg, 1 + np.where(ndi.sum(sm, reg, range(1, nreg + 1)) > 2500)[0])
sil = Image.fromarray((sm * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(6)).point(lambda v: 255 if v > 127 else 0)  # smooth, crisp edges

def white(mask, size, radius_frac=None, frac=None):
    """Pure white where the shape is, transparent elsewhere: the shape lives only in the alpha channel (that is all a launcher reads)."""
    if radius_frac is not None:   # the glyph's own farthest reach from the middle of the canvas = radius_frac of the canvas
        gy, gx = np.where(np.array(mask) > 0)
        sc = radius_frac * size / np.hypot(gx - acx, gy - acy).max()
        m = mask.resize((int(mask.width * sc), int(mask.height * sc)), Image.LANCZOS)
        L = Image.new("L", (size, size), 0); L.paste(m, (int(round(size / 2 - acx * sc)), int(round(size / 2 - acy * sc))))
    else:                         # fill the icon
        bb = mask.getbbox(); m = mask.crop(bb); s = max(m.size); sq = Image.new("L", (s, s), 0)
        sq.paste(m, ((s - m.width) // 2, (s - m.height) // 2)); n = int(size * frac); sq = sq.resize((n, n), Image.LANCZOS)
        L = Image.new("L", (size, size), 0); L.paste(sq, ((size - n) // 2, (size - n) // 2))
    px = np.zeros((size, size, 4), np.uint8); px[..., :3] = 255; px[..., 3] = np.array(L)
    return Image.fromarray(px)
THEMED_R = 0.24   # themed glyphs need breathing room: the launcher shows them inside a plain circle (visible radius 0.333) in one tint
save(white(sil, 96, frac=0.92), "notification-icon.png")
save(white(sil, 1024, radius_frac=THEMED_R), "adaptive-icon-monochrome.png")

# ============================================================== the in-app logo (artwork + "4D Ages")
wm = np.array(Image.open(os.path.join(HERE, "4d-ages-wordmark.png")).convert("RGB")).astype(np.float64)
rgba_wm, wdist = unmix(wm, backdrop(wm))
ys, xs = np.where(rgba_wm[..., 3] > 12)
pd = 24
cropped = Image.fromarray(rgba_wm).crop((max(0, xs.min() - pd), max(0, ys.min() - pd), min(wm.shape[1], xs.max() + pd), min(wm.shape[0], ys.max() + pd)))
if cropped.width > 1300:
    cropped = cropped.resize((1300, int(round(cropped.height * 1300 / cropped.width))), Image.LANCZOS)
save(cropped, "4d-ages-wordmark.png")

print("backdrop colour (splash background): %s" % BG_HEX)
print("artwork (outlines included, glow excluded): x %d–%d, y %d–%d of a %dx%d picture; box centre (%.0f,%.0f), visual mass (%.0f,%.0f), placed on (%.0f,%.0f), reaches %.0f px from there" % (art_x0, art_x1, art_y0, art_y1, W, H, box_c[0], box_c[1], mass_c[0], mass_c[1], acx, acy, R))
print("safe zone: the artwork reaches %.2f of the canvas from the middle in the adaptive icon and splash (strict safe circle 0.306, visible mask 0.333); %.2f in icon.png" % (SAFE, 0.42))
print("in-app logo: %dx%d  aspect %.4f" % (cropped.width, cropped.height, cropped.width / cropped.height))
