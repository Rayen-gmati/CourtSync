#!/usr/bin/env python3
"""Génère les icônes PWA CourtSync (PNG) dans public/."""
from PIL import Image, ImageDraw

GREEN = (30, 77, 43)
CREAM = (244, 241, 234)
LEMON = (201, 214, 66)
SIZE = 1024


def draw_icon(maskable: bool = False) -> Image.Image:
    img = Image.new("RGBA", (SIZE, SIZE), GREEN)
    d = ImageDraw.Draw(img)

    # Zone sûre maskable : contenu recentré à 80%
    scale = 0.8 if maskable else 1.0
    offset = (SIZE * (1 - scale)) / 2

    def s(v: float) -> float:
        return offset + v * scale

    # Court (vue de dessus, portrait)
    cx = s(512)
    court_w = 460 * scale
    court_h = 640 * scale
    top = s(512) - court_h / 2
    left = cx - court_w / 2
    right = cx + court_w / 2
    bottom = top + court_h
    lw = max(2, int(14 * scale))

    # Lignes extérieures
    d.rectangle([left, top, right, bottom], outline=CREAM, width=lw)

    # Couloirs (doubles)
    alley = 52 * scale
    d.line([left + alley, top, left + alley, bottom], fill=CREAM, width=lw)
    d.line([right - alley, top, right - alley, bottom], fill=CREAM, width=lw)

    # Lignes de service
    svc = 170 * scale
    d.line([left + alley, top + svc, right - alley, top + svc], fill=CREAM, width=lw)
    d.line([left + alley, bottom - svc, right - alley, bottom - svc], fill=CREAM, width=lw)
    # Ligne centrale de service
    d.line([cx, top + svc, cx, bottom - svc], fill=CREAM, width=lw)
    # Filet
    d.line([left, s(512), right, s(512)], fill=CREAM, width=lw + 2)

    # Balle citron avec coutures
    br = 78 * scale
    bx, by = s(512) + 180 * scale, s(512) - 240 * scale
    d.ellipse([bx - br, by - br, bx + br, by + br], fill=LEMON)
    sw = max(2, int(8 * scale))
    d.arc([bx - br * 1.6, by - br * 1.9, bx + br * 0.9, by + br * 0.6], start=20, end=160, fill=CREAM, width=sw)
    d.arc([bx - br * 0.9, by - br * 0.6, bx + br * 1.6, by + br * 1.9], start=200, end=340, fill=CREAM, width=sw)

    return img


full = draw_icon(maskable=False)
mask = draw_icon(maskable=True)

full.resize((512, 512), Image.LANCZOS).save("public/icon-512.png")
full.resize((192, 192), Image.LANCZOS).save("public/icon-192.png")
full.resize((180, 180), Image.LANCZOS).save("public/apple-touch-icon.png")
mask.resize((512, 512), Image.LANCZOS).save("public/icon-maskable-512.png")

# favicon.ico multi-tailles
full.resize((64, 64), Image.LANCZOS).save(
    "public/favicon.ico", format="ICO", sizes=[(64, 64)]
)
print("icons generated")
