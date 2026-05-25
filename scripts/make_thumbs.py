"""
Fairchild Alchemy — product thumbnail generator.
Creates 820×920 premium dark product cards using Pillow.
Matches the store palette: near-black bg, gold accents, Cormorant-style elegance.
"""
import math, os, urllib.request
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "public" / "images"
DEST.mkdir(parents=True, exist_ok=True)

SOURCE_ASSET_DIR = DEST / "thumb-sources"
SOURCE_ASSET_DIR.mkdir(parents=True, exist_ok=True)

W, H = 820, 920
ART_BOX = (78, 112, 742, 642)
ASSET_EXTS = (".png", ".jpg", ".jpeg", ".webp")

# ─── Palette ──────────────────────────────────────────────────────────────────
BG_DARK   = (14,  12,  8)
BG_MID    = (24,  21, 14)
BG_SURF   = (32,  28, 18)
GOLD      = (201, 168, 76)
GOLD_DIM  = (140, 112, 44)
GOLD_PALE = (230, 205, 130)
MUTED     = (110, 100, 78)
TEXT_MAIN = (212, 200, 168)
TEXT_DIM  = (140, 132, 106)

# ─── Font download ─────────────────────────────────────────────────────────────
FONT_DIR = ROOT / ".cache" / "fonts"
FONT_DIR.mkdir(exist_ok=True)

FONT_URLS = {
    "cormorant-light-italic.ttf": "https://github.com/CatharsisFonts/Cormorant/raw/master/fonts/ttf/Cormorant-LightItalic.ttf",
    "cormorant-regular.ttf":      "https://github.com/CatharsisFonts/Cormorant/raw/master/fonts/ttf/Cormorant-Regular.ttf",
    "cormorant-semibold.ttf":     "https://github.com/CatharsisFonts/Cormorant/raw/master/fonts/ttf/Cormorant-SemiBold.ttf",
}

def ensure_fonts():
    for fname, url in FONT_URLS.items():
        fpath = FONT_DIR / fname
        if not fpath.exists():
            print(f"  Downloading {fname}...")
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(req) as r, open(fpath, "wb") as f:
                    f.write(r.read())
            except Exception as e:
                print(f"  Warning: couldn't download {fname}: {e}")

ensure_fonts()

def load_font(name, size):
    fpath = FONT_DIR / name
    if fpath.exists():
        try:
            return ImageFont.truetype(str(fpath), size)
        except Exception:
            pass
    return ImageFont.load_default()

# ─── Drawing helpers ──────────────────────────────────────────────────────────

def draw_gradient_bg(img):
    """Radial vignette gradient background."""
    draw = ImageDraw.Draw(img)
    # Base fill
    img.paste(BG_DARK, [0, 0, W, H])
    # Top-center warm glow
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    for r in range(320, 0, -4):
        alpha = int(18 * (1 - r / 320))
        od.ellipse([(W//2 - r, -r//2), (W//2 + r, r * 3 // 2)],
                   fill=(*GOLD_DIM, alpha))
    img = img.convert("RGBA")
    img = Image.alpha_composite(img, overlay)
    return img.convert("RGB")

def draw_border(draw, inset=18):
    """Double border: outer thin gold, inner faint rule."""
    draw.rectangle([inset, inset, W - inset - 1, H - inset - 1],
                   outline=(*GOLD, 55), width=1)
    draw.rectangle([inset + 10, inset + 10, W - inset - 11, H - inset - 11],
                   outline=(*GOLD, 18), width=1)

def draw_grain(img):
    """Subtle noise overlay for tactile feel."""
    import random
    grain = Image.new("L", (W, H))
    px = grain.load()
    rng = random.Random(42)
    for y in range(H):
        for x in range(W):
            px[x, y] = rng.randint(0, 255)
    grain = grain.filter(ImageFilter.GaussianBlur(0.4))
    grain_rgba = Image.merge("RGBA", [grain, grain, grain,
                                       Image.new("L", (W, H), 8)])
    img_rgba = img.convert("RGBA")
    return Image.alpha_composite(img_rgba, grain_rgba).convert("RGB")

def centered_text(draw, text, y, font, fill, max_w=720, letter_spacing=0):
    """Draw centered text with optional letter spacing."""
    if letter_spacing == 0:
        bbox = draw.textbbox((0, 0), text, font=font)
        tw = bbox[2] - bbox[0]
        draw.text(((W - tw) // 2, y), text, font=font, fill=fill)
    else:
        # Manual letter-spaced rendering
        chars = list(text.upper())
        total_w = sum(draw.textbbox((0, 0), c, font=font)[2] for c in chars)
        total_w += letter_spacing * (len(chars) - 1)
        x = (W - total_w) // 2
        for c in chars:
            draw.text((x, y), c, font=font, fill=fill)
            cw = draw.textbbox((0, 0), c, font=font)[2]
            x += cw + letter_spacing

def draw_horizontal_rule(draw, y, width=200, color=None):
    color = color or (*GOLD, 60)
    cx = W // 2
    draw.line([(cx - width//2, y), (cx + width//2, y)], fill=GOLD_DIM, width=1)

def draw_diamond(draw, cx, cy, size=4):
    draw.polygon([(cx, cy - size), (cx + size, cy),
                  (cx, cy + size), (cx - size, cy)],
                 fill=GOLD_DIM)

def find_source_asset(pid, suffix):
    """Return a generated/photo source asset for this product view if one exists."""
    stems = (f"{pid}-{suffix}", pid)
    for stem in stems:
        for ext in ASSET_EXTS:
            path = SOURCE_ASSET_DIR / f"{stem}{ext}"
            if path.exists():
                return path
    return None

def feather_mask(size, feather=46):
    """Soft rectangular mask so photo assets blend into the card background."""
    mask = Image.new("L", size, 255)
    edge = Image.new("L", size, 0)
    draw = ImageDraw.Draw(edge)
    draw.rectangle([feather, feather, size[0] - feather, size[1] - feather], fill=255)
    return edge.filter(ImageFilter.GaussianBlur(feather // 2))

def composite_source_asset(img, source_path):
    """Composite a generated/photo product layer into the central art area."""
    x1, y1, x2, y2 = ART_BOX
    box_w, box_h = x2 - x1, y2 - y1
    source = Image.open(source_path).convert("RGBA")
    source = ImageOps.contain(source, (box_w, box_h), Image.Resampling.LANCZOS)

    layer = Image.new("RGBA", (box_w, box_h), (0, 0, 0, 0))
    ox = (box_w - source.width) // 2
    oy = (box_h - source.height) // 2

    if source.getbbox():
        alpha = source.getchannel("A")
        if alpha.getextrema() == (255, 255):
            alpha = feather_mask(source.size)
        source.putalpha(alpha)
    layer.alpha_composite(source, (ox, oy))

    canvas = img.convert("RGBA")
    canvas.alpha_composite(layer, (x1, y1))
    result = canvas.convert("RGB")
    return result, ImageDraw.Draw(result)

# ─── Product-specific art elements ───────────────────────────────────────────

def art_globe_smoke(draw, img):
    """Sphere with misty inclusions."""
    cx, cy = W // 2, H // 2 - 30
    # Glow behind sphere
    for r in range(180, 80, -6):
        alpha = int(6 * (1 - (r - 80) / 100))
        ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(ov)
        d.ellipse([(cx - r, cy - r), (cx + r, cy + r)], fill=(*GOLD_DIM, alpha))
        img = img.convert("RGBA")
        img = Image.alpha_composite(img, ov).convert("RGB")
        draw = ImageDraw.Draw(img)
    # Main sphere
    draw.ellipse([(cx - 120, cy - 120), (cx + 120, cy + 120)],
                 outline=(*GOLD, 80), width=2)
    draw.ellipse([(cx - 115, cy - 115), (cx + 115, cy + 115)],
                 outline=(*GOLD, 30), width=1)
    # Smoke wisps
    for i in range(8):
        angle = i * 45 + 15
        r1, r2 = 40 + (i % 3) * 20, 70 + (i % 4) * 15
        x1 = cx + int(r1 * math.cos(math.radians(angle)))
        y1 = cy + int(r1 * math.sin(math.radians(angle)))
        x2 = cx + int(r2 * math.cos(math.radians(angle + 12)))
        y2 = cy + int(r2 * math.sin(math.radians(angle + 12)))
        draw.line([(x1, y1), (x2, y2)], fill=(*MUTED, 60), width=1)
    # Tripod legs
    for angle in [225, 270, 315]:
        x = cx + int(130 * math.cos(math.radians(angle)))
        y = cy + int(130 * math.sin(math.radians(angle)))
        draw.line([(cx, cy + 120), (x, y + 40)], fill=GOLD_DIM, width=2)
    return img, draw

def art_letter_opener(draw, img):
    """Blade with damascus pattern lines."""
    # Blade silhouette
    blade_pts = [(W//2 - 8, H//2 - 160), (W//2 + 5, H//2 - 160),
                 (W//2 + 6, H//2 + 40), (W//2 - 10, H//2 + 40)]
    draw.polygon(blade_pts, fill=BG_SURF, outline=(*GOLD, 90))
    # Damascus lines
    for i in range(-140, 40, 8):
        y = H//2 + i
        wave = int(4 * math.sin(i * 0.18))
        draw.line([(W//2 - 7, y), (W//2 + 4 + wave, y + 3)],
                  fill=(*MUTED, 70), width=1)
    # Handle
    draw.rectangle([(W//2 - 14, H//2 + 40), (W//2 + 14, H//2 + 140)],
                   fill=BG_MID, outline=(*GOLD, 60))
    # Copper collar
    draw.rectangle([(W//2 - 14, H//2 + 38), (W//2 + 14, H//2 + 58)],
                   fill=GOLD_DIM, outline=(*GOLD, 90))
    return img, draw

def art_bronze_sphere(draw, img):
    """Engraved celestial sphere."""
    cx, cy = W // 2, H // 2 - 20
    # Sphere body
    draw.ellipse([(cx - 130, cy - 130), (cx + 130, cy + 130)],
                 fill=(*BG_MID,), outline=(*GOLD, 100), width=2)
    # Constellation lines
    stars = [(cx + 40, cy - 80), (cx - 60, cy - 40), (cx + 80, cy + 20),
             (cx - 20, cy + 90), (cx + 60, cy + 70), (cx - 80, cy + 50),
             (cx + 10, cy - 110), (cx - 50, cy - 90)]
    connections = [(0,1),(1,5),(5,3),(3,4),(4,2),(2,0),(6,0),(1,6),(5,7)]
    for a, b in connections:
        draw.line([stars[a], stars[b]], fill=(*GOLD_DIM, 80), width=1)
    for sx, sy in stars:
        draw.ellipse([(sx-3, sy-3), (sx+3, sy+3)], fill=GOLD)
    # Latitude/longitude guides (faint)
    for r in [50, 100]:
        draw.ellipse([(cx-r, cy-r//3), (cx+r, cy+r//3)],
                     outline=(*GOLD, 20), width=1)
    draw.line([(cx, cy - 128), (cx, cy + 128)], fill=(*GOLD, 20), width=1)
    return img, draw

def art_copper_still(draw, img):
    """Alchemical distillation vessel."""
    cx = W // 2
    # Cucurbit (main body — rounded base)
    draw.ellipse([(cx - 90, H//2 - 20), (cx + 90, H//2 + 140)],
                 fill=BG_SURF, outline=(*GOLD_DIM, 120), width=2)
    # Neck
    draw.rectangle([(cx - 30, H//2 - 120), (cx + 30, H//2 - 20)],
                   fill=BG_SURF, outline=(*GOLD_DIM, 80), width=1)
    # Alembic cap (dome)
    draw.ellipse([(cx - 50, H//2 - 170), (cx + 50, H//2 - 80)],
                 fill=BG_SURF, outline=(*GOLD_DIM, 100), width=2)
    # Hammer facets (lines across surface)
    for i in range(-80, 140, 12):
        y = H//2 + i
        w = int(88 * math.sqrt(max(0, 1 - ((y - (H//2 + 60)) / 100)**2))) if i > 0 else 88
        w = max(5, min(88, w))
        offset = int(3 * math.sin(i * 0.3))
        draw.line([(cx - w + offset, y), (cx + w + offset, y)],
                  fill=(*GOLD_DIM, 25), width=1)
    # Spout
    draw.line([(cx + 48, H//2 - 130), (cx + 90, H//2 - 160)],
              fill=GOLD_DIM, width=3)
    return img, draw

def art_mova_globe(draw, img):
    """Spinning globe with cartographic lines."""
    cx, cy = W // 2, H // 2 - 20
    # Outer acrylic sphere
    draw.ellipse([(cx - 120, cy - 120), (cx + 120, cy + 120)],
                 outline=(*GOLD, 40), width=1)
    # Inner globe
    draw.ellipse([(cx - 95, cy - 95), (cx + 95, cy + 95)],
                 fill=BG_MID, outline=(*GOLD_DIM, 80), width=2)
    # Latitude lines
    for lat in [-60, -30, 0, 30, 60]:
        r_lat = int(95 * math.cos(math.radians(lat)))
        y_lat = cy + int(95 * math.sin(math.radians(lat)))
        if r_lat > 0:
            draw.ellipse([(cx - r_lat, y_lat - r_lat//4),
                          (cx + r_lat, y_lat + r_lat//4)],
                         outline=(*GOLD_DIM, 35), width=1)
    # Longitude lines
    for lon in range(0, 180, 30):
        x1 = cx + int(95 * math.sin(math.radians(lon)))
        draw.line([(cx, cy - 95), (x1, cy), (cx, cy + 95)], fill=(*GOLD_DIM, 25), width=1)
    draw.line([(cx, cy - 95), (cx, cy + 95)], fill=(*GOLD_DIM, 40), width=1)
    return img, draw

def art_calendar(draw, img):
    """Three rotating brass dials."""
    cx = W // 2
    dial_ys = [H//2 - 80, H//2 + 10, H//2 + 100]
    labels = ["MON", "14", "MAY"]
    for i, (dy, lbl) in enumerate(zip(dial_ys, labels)):
        # Dial body
        draw.rounded_rectangle([(cx - 110, dy - 30), (cx + 110, dy + 30)],
                                radius=6, fill=BG_SURF, outline=(*GOLD_DIM, 100), width=2)
        # Knurl marks
        for k in range(-100, 110, 10):
            draw.line([(cx + k, dy - 30), (cx + k, dy - 24)],
                      fill=(*GOLD, 50), width=1)
            draw.line([(cx + k, dy + 24), (cx + k, dy + 30)],
                      fill=(*GOLD, 50), width=1)
        # Label
        f = load_font("cormorant-semibold.ttf", 30)
        bbox = draw.textbbox((0, 0), lbl, font=f)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]
        draw.text(((W - tw) // 2, dy - th // 2), lbl, font=f, fill=TEXT_MAIN)
    return img, draw

def art_desk_pad(draw, img):
    """Leather pad with stitched edge."""
    mx, my = 80, 200
    pw, ph = W - 2*mx, H - my - 280
    # Leather surface
    draw.rectangle([(mx, my), (mx + pw, my + ph)], fill=(*BG_SURF,))
    # Grain lines
    for gy in range(my + 10, my + ph, 6):
        offset = int(3 * math.sin(gy * 0.07))
        draw.line([(mx + 5, gy + offset), (mx + pw - 5, gy)],
                  fill=(*MUTED, 15), width=1)
    # Stitched border
    for sx in range(mx + 20, mx + pw - 18, 12):
        draw.line([(sx, my + 18), (sx + 6, my + 18)], fill=GOLD_DIM, width=2)
        draw.line([(sx, my + ph - 18), (sx + 6, my + ph - 18)], fill=GOLD_DIM, width=2)
    for sy in range(my + 24, my + ph - 22, 12):
        draw.line([(mx + 18, sy), (mx + 18, sy + 6)], fill=GOLD_DIM, width=2)
        draw.line([(mx + pw - 18, sy), (mx + pw - 18, sy + 6)], fill=GOLD_DIM, width=2)
    # Corner detail
    draw.rectangle([(mx, my), (mx + pw, my + ph)], outline=(*GOLD, 50), width=1)
    return img, draw

def art_spinner(draw, img):
    """Three-lobe brass spinner."""
    cx, cy = W//2, H//2 - 20
    for angle in [0, 120, 240]:
        rad = math.radians(angle)
        ex = cx + int(100 * math.cos(rad))
        ey = cy + int(100 * math.sin(rad))
        draw.ellipse([(ex - 38, ey - 38), (ex + 38, ey + 38)],
                     fill=BG_SURF, outline=(*GOLD, 120), width=2)
        # Polish sheen
        hx = ex + int(12 * math.cos(rad - 1.2))
        hy = ey + int(12 * math.sin(rad - 1.2))
        draw.ellipse([(hx - 8, hy - 5), (hx + 8, hy + 5)],
                     fill=(*GOLD_PALE, 60))
    # Center bearing
    draw.ellipse([(cx - 24, cy - 24), (cx + 24, cy + 24)],
                 fill=BG_DARK, outline=(*GOLD, 150), width=2)
    draw.ellipse([(cx - 10, cy - 10), (cx + 10, cy + 10)],
                 fill=(*GOLD, 80))
    # Connecting arms
    for angle in [0, 120, 240]:
        rad = math.radians(angle)
        ex = cx + int(62 * math.cos(rad))
        ey = cy + int(62 * math.sin(rad))
        draw.line([(cx, cy), (ex, ey)], fill=(*GOLD_DIM, 120), width=5)
    return img, draw

def art_cranes(draw, img):
    """Three iron cranes at staggered heights."""
    for i, (x, h) in enumerate([(W//2 - 80, 60), (W//2, 80), (W//2 + 80, 100)]):
        base_y = H//2 + 100
        # Body
        draw.ellipse([(x - 14, base_y - h), (x + 14, base_y - h + 30)],
                     fill=BG_MID, outline=(*MUTED, 120), width=2)
        # Neck
        draw.line([(x, base_y - h + 5), (x + 20, base_y - h - 30)],
                  fill=(*MUTED, 150), width=3)
        # Head
        draw.ellipse([(x + 14, base_y - h - 38), (x + 30, base_y - h - 22)],
                     fill=BG_MID, outline=(*MUTED, 100), width=1)
        # Beak
        draw.line([(x + 30, base_y - h - 30), (x + 46, base_y - h - 28)],
                  fill=(*MUTED, 150), width=2)
        # Legs
        draw.line([(x, base_y), (x - 10, base_y + 40)], fill=(*MUTED, 100), width=2)
        draw.line([(x, base_y), (x + 10, base_y + 40)], fill=(*MUTED, 100), width=2)
        # Wing
        pts = [(x - 14, base_y - h + 15), (x - 50, base_y - h - 10),
               (x - 14, base_y - h + 22)]
        draw.polygon(pts, fill=(*BG_MID,), outline=(*MUTED, 80))
        # Incense smoke on tallest
        if i == 2:
            for s in range(0, 120, 15):
                sx = x + int(6 * math.sin(s * 0.25))
                draw.ellipse([(sx - 1, base_y - h - 60 - s),
                               (sx + 1, base_y - h - 54 - s)],
                              fill=(*MUTED, max(0, 60 - s//2)))
    return img, draw

def art_pour_set(draw, img):
    """Wabi pour-over dripper + cup."""
    cx = W // 2
    # Dripper
    pts = [(cx - 70, H//2 - 140), (cx + 70, H//2 - 140),
           (cx + 40, H//2 - 20), (cx - 40, H//2 - 20)]
    draw.polygon(pts, fill=BG_SURF, outline=(*MUTED, 100), width=2)
    # Glaze crawl texture on dripper
    for gx in range(cx - 60, cx + 65, 15):
        for gy in range(H//2 - 135, H//2 - 25, 18):
            if (gx + gy) % 30 < 15:
                draw.ellipse([(gx, gy), (gx + 10, gy + 8)],
                             outline=(*GOLD, 20), width=1)
    # Spout
    draw.polygon([(cx - 40, H//2 - 80), (cx - 70, H//2 - 100),
                  (cx - 75, H//2 - 90), (cx - 44, H//2 - 72)],
                 fill=BG_MID, outline=(*MUTED, 60))
    # Cup
    pts2 = [(cx - 55, H//2 + 0), (cx + 55, H//2 + 0),
            (cx + 50, H//2 + 110), (cx - 50, H//2 + 110)]
    draw.polygon(pts2, fill=BG_SURF, outline=(*MUTED, 100), width=2)
    # Steam
    for s in range(0, 50, 12):
        sx = cx - 10 + int(6 * math.sin(s * 0.4))
        draw.line([(sx, H//2 - 10 - s), (sx + 4, H//2 - 18 - s)],
                  fill=(*TEXT_DIM, max(0, 50 - s)), width=1)
    return img, draw

def art_candle(draw, img):
    """Beeswax candle in stoneware vessel."""
    cx = W // 2
    base_y = H//2 + 100
    # Vessel body (cylinder)
    draw.rounded_rectangle([(cx - 55, base_y - 120), (cx + 55, base_y)],
                            radius=8, fill=BG_SURF, outline=(*MUTED, 100), width=2)
    # Wax surface
    draw.ellipse([(cx - 52, base_y - 128), (cx + 52, base_y - 100)],
                 fill=(*BG_MID,), outline=(*GOLD_DIM, 60), width=1)
    # Wick
    draw.line([(cx, base_y - 128), (cx + 2, base_y - 148)],
              fill=(*MUTED, 180), width=2)
    # Flame
    flame_pts = [(cx + 2, base_y - 148), (cx - 8, base_y - 172),
                 (cx + 2, base_y - 184), (cx + 10, base_y - 172)]
    draw.polygon(flame_pts, fill=(*GOLD, 200))
    draw.ellipse([(cx - 3, base_y - 160), (cx + 7, base_y - 150)],
                 fill=(*GOLD_PALE, 180))
    # Warm glow
    for r in range(60, 10, -5):
        alpha = int(4 * (1 - r / 60))
        ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(ov)
        d.ellipse([(cx + 2 - r, base_y - 166 - r),
                   (cx + 2 + r, base_y - 166 + r)],
                  fill=(*GOLD, alpha))
        img = img.convert("RGBA")
        img = Image.alpha_composite(img, ov).convert("RGB")
        draw = ImageDraw.Draw(img)
    return img, draw

def art_whisky_stones(draw, img):
    """Eight Connemara marble stones."""
    cx, cy = W//2, H//2 - 20
    positions = [(-90,-60),(-40,-80),(20,-70),(80,-50),
                 (-70, 10),(-20, 30),(50, 20),(90, 10)]
    for i, (ox, oy) in enumerate(positions):
        x, y = cx + ox, cy + oy
        size = 22 + (i % 3) * 5
        # Stone base
        draw.ellipse([(x - size, y - size//2), (x + size, y + size//2)],
                     fill=(*BG_SURF,), outline=(*MUTED, 80), width=1)
        # Green veining
        for v in range(2):
            vx1 = x - size + (v + 1) * size // 2
            draw.line([(vx1, y - size//3), (vx1 + int(size * 0.4), y + size//4)],
                      fill=(80, 110, 70, 60), width=1)
    # Leather pouch
    pouch_y = cy + 80
    draw.rounded_rectangle([(cx - 70, pouch_y - 40), (cx + 70, pouch_y + 50)],
                            radius=10, fill=BG_MID, outline=(*GOLD_DIM, 80), width=2)
    draw.line([(cx, pouch_y - 40), (cx - 20, pouch_y - 65)], fill=GOLD_DIM, width=2)
    draw.line([(cx, pouch_y - 40), (cx + 20, pouch_y - 65)], fill=GOLD_DIM, width=2)
    return img, draw

def art_journal(draw, img):
    """Open Coptic-stitch journal."""
    cx = W // 2
    # Left page
    draw.rectangle([(cx - 180, H//2 - 150), (cx - 5, H//2 + 150)],
                   fill=(*TEXT_DIM,), outline=(*MUTED, 80), width=1)
    # Right page
    draw.rectangle([(cx + 5, H//2 - 150), (cx + 180, H//2 + 150)],
                   fill=(*TEXT_DIM,), outline=(*MUTED, 80), width=1)
    # Coptic spine — exposed thread
    for y in range(H//2 - 140, H//2 + 140, 20):
        draw.ellipse([(cx - 8, y - 4), (cx + 8, y + 4)],
                     outline=(*GOLD_DIM, 150), width=2)
        draw.line([(cx - 5, y), (cx + 5, y)], fill=(*MUTED, 120), width=1)
    # Ruled lines
    for lp in [-1, 1]:
        for ly in range(H//2 - 120, H//2 + 130, 20):
            draw.line([(cx + lp * 20, ly), (cx + lp * 160, ly)],
                      fill=(*MUTED, 40), width=1)
    return img, draw

def art_walnut_sphere(draw, img):
    """Segmented walnut puzzle sphere."""
    cx, cy = W//2, H//2 - 20
    # Main sphere
    draw.ellipse([(cx - 110, cy - 110), (cx + 110, cy + 110)],
                 fill=BG_MID, outline=(*GOLD_DIM, 80), width=1)
    # Segment divisions (12 pieces)
    for i in range(12):
        angle = i * 30
        rad = math.radians(angle)
        x = cx + int(110 * math.cos(rad))
        y = cy + int(110 * math.sin(rad))
        draw.line([(cx, cy), (x, y)], fill=(*MUTED, 40), width=1)
    # Walnut grain rings
    for r in [40, 70, 95]:
        draw.ellipse([(cx - r, cy - r), (cx + r, cy + r)],
                     outline=(*MUTED, 30), width=1)
    # Partially separated piece (top-right)
    pts = [(cx + 10, cy - 110), (cx + 110, cy - 10),
           (cx + 78, cy), (cx, cy - 78)]
    draw.polygon(pts, fill=(*BG_SURF,), outline=(*GOLD_DIM, 60), width=1)
    return img, draw

def art_compass(draw, img):
    """Brass compass with rose."""
    cx, cy = W//2, H//2 - 30
    # Base plate
    draw.ellipse([(cx - 120, cy - 30), (cx + 120, cy + 30)],
                 fill=BG_SURF, outline=(*GOLD_DIM, 80), width=2)
    # Compass body
    draw.ellipse([(cx - 100, cy - 115), (cx + 100, cy + 85)],
                 fill=BG_SURF, outline=(*GOLD, 100), width=3)
    draw.ellipse([(cx - 95, cy - 110), (cx + 95, cy + 80)],
                 outline=(*GOLD, 40), width=1)
    # Compass rose
    for d, lbl in [(0, "N"), (90, "E"), (180, "S"), (270, "W")]:
        rad = math.radians(d - 90)
        px = cx + int(65 * math.cos(rad))
        py = cy - 15 + int(65 * math.sin(rad))
        f = load_font("cormorant-semibold.ttf", 18)
        bbox = draw.textbbox((0, 0), lbl, font=f)
        draw.text((px - (bbox[2]-bbox[0])//2, py - (bbox[3]-bbox[1])//2),
                  lbl, font=f, fill=GOLD if lbl == "N" else TEXT_DIM)
    # Intercardinal ticks
    for d in range(0, 360, 45):
        rad = math.radians(d - 90)
        ix = cx + int(80 * math.cos(rad))
        iy = cy - 15 + int(80 * math.sin(rad))
        ox = cx + int(92 * math.cos(rad))
        oy = cy - 15 + int(92 * math.sin(rad))
        draw.line([(ix, iy), (ox, oy)], fill=(*GOLD_DIM, 100), width=1)
    # Needle
    draw.polygon([(cx, cy - 75), (cx + 6, cy - 15), (cx, cy - 8), (cx - 6, cy - 15)],
                 fill=GOLD)
    draw.polygon([(cx, cy + 45), (cx + 5, cy - 15), (cx, cy - 8), (cx - 5, cy - 15)],
                 fill=(*MUTED,))
    # Center pin
    draw.ellipse([(cx - 4, cy - 19), (cx + 4, cy - 11)], fill=BG_DARK, outline=GOLD)
    return img, draw


# ─── Product definitions ──────────────────────────────────────────────────────

PRODUCTS = [
    # (id, symbol, category, name_line1, name_line2, price, art_fn, is_alt)
    # Sanctum
    ("obsidian-smoke-globe",    "☿", "THE SANCTUM", "Obsidian Smoke", "Globe",            "$485", art_globe_smoke,   False),
    ("obsidian-smoke-globe",    "☿", "THE SANCTUM", "Obsidian Smoke", "Globe — Night",     "$485", art_globe_smoke,   True),
    ("damascus-letter-opener",  "☿", "THE SANCTUM", "Damascus-Fold",  "Letter Opener",     "$265", art_letter_opener, False),
    ("damascus-letter-opener",  "☿", "THE SANCTUM", "Damascus",       "Detail",            "$265", art_letter_opener, True),
    ("bronze-celestial-weight", "☿", "THE SANCTUM", "Bronze Celestial","Weight",           "$380", art_bronze_sphere, False),
    ("bronze-celestial-weight", "☿", "THE SANCTUM", "Celestial",      "Overhead",          "$380", art_bronze_sphere, True),
    ("copper-still-vessel",     "☿", "THE SANCTUM", "Copper Still",   "Vessel",            "$620", art_copper_still,  False),
    ("copper-still-vessel",     "☿", "THE SANCTUM", "Still Vessel",   "Detail",            "$620", art_copper_still,  True),
    # Study
    ("mova-globe-earth",        "⊞", "THE STUDY",   "MOVA Globe",     "Antique Earth",     "$149", art_mova_globe,    False),
    ("mova-globe-earth",        "⊞", "THE STUDY",   "MOVA Globe",     "Close-Up",          "$149", art_mova_globe,    True),
    ("meridian-calendar",       "⊞", "THE STUDY",   "Meridian",       "Perpetual Calendar","$125", art_calendar,      False),
    ("meridian-calendar",       "⊞", "THE STUDY",   "Calendar",       "Dial Detail",       "$125", art_calendar,      True),
    ("vachetta-desk-pad",       "⊞", "THE STUDY",   "Vachetta",       "Desk Pad",          "$145", art_desk_pad,      False),
    ("vachetta-desk-pad",       "⊞", "THE STUDY",   "Vachetta Pad",   "Stitch Detail",     "$145", art_desk_pad,      True),
    ("aerospace-fidget-spinner","⊞", "THE STUDY",   "Aerospace Brass","Fidget Spinner",    "$68",  art_spinner,       False),
    ("aerospace-fidget-spinner","⊞", "THE STUDY",   "Spinner",        "In Motion",         "$68",  art_spinner,       True),
    # Ritual
    ("tsuru-incense-holder",    "⌘", "RITUAL",      "Tsuru Cast-Iron","Incense Set",       "$92",  art_cranes,        False),
    ("tsuru-incense-holder",    "⌘", "RITUAL",      "Tsuru",          "At Night",          "$92",  art_cranes,        True),
    ("wabi-ceramic-pour-set",   "⌘", "RITUAL",      "Wabi-Sabi",      "Pour Set",          "$165", art_pour_set,      False),
    ("wabi-ceramic-pour-set",   "⌘", "RITUAL",      "Pour Set",       "Glaze Detail",      "$165", art_pour_set,      True),
    ("fig-cypress-candle",      "⌘", "RITUAL",      "Black Fig &",    "Cypress Candle",    "$46",  art_candle,        False),
    ("fig-cypress-candle",      "⌘", "RITUAL",      "Candle",         "Unlit",             "$46",  art_candle,        True),
    ("highland-whisky-stones",  "⌘", "RITUAL",      "Highland Whisky","Stones",            "$58",  art_whisky_stones, False),
    ("highland-whisky-stones",  "⌘", "RITUAL",      "Stones +",       "Pouch",             "$58",  art_whisky_stones, True),
    # Library
    ("coptic-journal",          "☽", "THE LIBRARY", "Coptic-Stitch",  "Journal",           "$78",  art_journal,       False),
    ("coptic-journal",          "☽", "THE LIBRARY", "Journal",        "Open Spine",        "$78",  art_journal,       True),
    ("gravity-paradox-sphere",  "☽", "THE LIBRARY", "Gravity Paradox","Sphere",            "$52",  art_walnut_sphere, False),
    ("gravity-paradox-sphere",  "☽", "THE LIBRARY", "Paradox",        "Disassembled",      "$52",  art_walnut_sphere, True),
    ("maritime-compass-weight", "☽", "THE LIBRARY", "Maritime Brass", "Compass",           "$88",  art_compass,       False),
    ("maritime-compass-weight", "☽", "THE LIBRARY", "Compass",        "Rose Detail",       "$88",  art_compass,       True),
]

# Suffix: first occurrence -> -a, second -> -b
seen = {}

for (pid, symbol, cat, name1, name2, price, art_fn, is_alt) in PRODUCTS:
    count = seen.get(pid, 0)
    suffix = "b" if count > 0 else "a"
    seen[pid] = count + 1

    fname = f"{pid}-{suffix}.jpg"
    out_path = DEST / fname
    source_asset = find_source_asset(pid, suffix)

    # Existing cards are left alone unless a generated/photo source asset is present.
    if out_path.exists() and not source_asset:
        print(f"  [skip] {fname}")
        continue

    print(f"  Rendering {fname}...")

    # ─── Build canvas ───────────────────────────────────────────────────────
    img = Image.new("RGB", (W, H), BG_DARK)
    img = draw_gradient_bg(img)
    draw = ImageDraw.Draw(img)

    # Art element: use generated/photo source art when present, otherwise draw fallback.
    if source_asset:
        try:
            img, draw = composite_source_asset(img, source_asset)
            print(f"    Using source asset: {source_asset.name}")
        except Exception as e:
            print(f"    Source asset error: {e}")
            try:
                img, draw = art_fn(draw, img)
            except Exception as fallback_e:
                print(f"    Art error: {fallback_e}")
    else:
        try:
            img, draw = art_fn(draw, img)
        except Exception as e:
            print(f"    Art error: {e}")

    # Slight vignette corners
    vig = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    vd = ImageDraw.Draw(vig)
    for v in range(80, 0, -4):
        alpha = int(10 * (1 - v / 80))
        vd.rectangle([0, 0, W, v], fill=(0, 0, 0, alpha))
        vd.rectangle([0, H - v, W, H], fill=(0, 0, 0, alpha))
        vd.rectangle([0, 0, v, H], fill=(0, 0, 0, alpha))
        vd.rectangle([W - v, 0, W, H], fill=(0, 0, 0, alpha))
    img = Image.alpha_composite(img.convert("RGBA"), vig).convert("RGB")
    draw = ImageDraw.Draw(img)

    # Double border
    draw_border(draw)

    # Category kicker
    f_tiny = load_font("cormorant-semibold.ttf", 14)
    centered_text(draw, f"{symbol}  {cat}", 52, f_tiny, GOLD_DIM, letter_spacing=3)

    # Top rule
    draw_horizontal_rule(draw, 78, 160)

    # Product name (italic serif)
    f_big = load_font("cormorant-light-italic.ttf", 72)
    f_med = load_font("cormorant-light-italic.ttf", 52)

    # Two-line name in bottom zone
    y_name = H - 220
    draw_horizontal_rule(draw, y_name - 16, 200)

    name_font = f_big if len(name1) <= 12 else f_med
    centered_text(draw, name1, y_name, name_font, TEXT_MAIN)

    name2_font = f_med if len(name2) <= 14 else load_font("cormorant-light-italic.ttf", 40)
    centered_text(draw, name2, y_name + 68, name2_font, TEXT_DIM)

    # Price
    f_price = load_font("cormorant-semibold.ttf", 18)
    centered_text(draw, price, H - 80, f_price, GOLD, letter_spacing=4)

    # Bottom rule + diamond
    draw_horizontal_rule(draw, H - 92, 120)
    draw_diamond(draw, W//2, H - 104)

    # Grain overlay
    img = draw_grain(img)

    # Save
    img.save(str(out_path), "JPEG", quality=92, optimize=True)
    print(f"    → Saved ({os.path.getsize(out_path) // 1024}KB)")

print("\n✓ All thumbnails rendered.")
