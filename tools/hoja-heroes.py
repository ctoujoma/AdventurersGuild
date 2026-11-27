# Monta las hojas de héroes con sus rótulos a partir de lo que vuelca `tools/hoja-heroes.ts`:
# `python3 tools/hoja-heroes.py <carpeta>` → `<carpeta>/<hoja>.png` (y GIF de andar y pelear).
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

root = Path(sys.argv[1])
sheets = json.loads((root / "indice.json").read_text())

FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
f_title = ImageFont.truetype(BOLD, 30)
f_sec = ImageFont.truetype(BOLD, 20)
f_note = ImageFont.truetype(FONT, 14)
f_lab = ImageFont.truetype(FONT, 12)
f_row = ImageFont.truetype(BOLD, 14)

BG = (34, 30, 38)
CELL_BG = (52, 46, 58)
CELL_BG2 = (60, 54, 66)
INK = (236, 228, 210)
DIM = (170, 160, 150)
GAP = 10
ROW_LAB = 190
MAX_W = 2400


def checker(w, h, s):
    """Fondo a cuadros de 1 px de sprite: se ve qué es transparente."""
    im = Image.new("RGB", (w, h), CELL_BG)
    d = ImageDraw.Draw(im)
    for y in range(0, h, s):
        for x in range(0, w, s):
            if (x // s + y // s) % 2:
                d.rectangle([x, y, x + s - 1, y + s - 1], fill=CELL_BG2)
    return im


def wrap(text, font, width):
    words, lines, cur = text.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if font.getlength(t) > width and cur:
            lines.append(cur)
            cur = w
        else:
            cur = t
    if cur:
        lines.append(cur)
    return lines or [""]


def build(sheet):
    s = sheet["scale"]
    width = 900
    # Cada fila con su tamaño de celda (el dibujo más ancho y más alto de la fila); si no cabe a
    # lo ancho, se parte en varias.
    layout = []
    for sec in sheet["sections"]:
        lines = []
        for r in sec["rows"]:
            imgs = [Image.open(root / c["file"]) for c in r["cells"]]
            cw = max(max((i.width for i in imgs), default=1) * s, 64)
            ch = max((i.height for i in imgs), default=1) * s
            labs = max((len(wrap(c.get("label") or "", f_lab, cw + GAP - 4)) for c in r["cells"] if c.get("label")), default=0)
            per = max(1, (MAX_W - ROW_LAB - GAP * 2) // (cw + GAP))
            for k in range(0, max(1, len(imgs)), per):
                lines.append((r if k == 0 else {"label": ""}, r["cells"][k : k + per], imgs[k : k + per], cw, ch, labs))
                width = max(width, ROW_LAB + GAP + len(imgs[k : k + per]) * (cw + GAP) + GAP)
        layout.append((sec, lines))

    def note_of(sec):
        return wrap(sec["note"], f_note, width - 4 * GAP) if sec.get("note") else []

    height = 70 + sum(
        34 + 20 * len(note_of(sec)) + sum(ch + labs * 15 + GAP + 4 for *_, ch, labs in lines) + 18
        for sec, lines in layout
    )
    im = Image.new("RGB", (width, height), BG)
    d = ImageDraw.Draw(im)
    d.text((GAP * 2, 18), sheet["title"], font=f_title, fill=INK)
    d.text((width - 260, 30), f"(píxeles ×{s}; cuadros = transparente)", font=f_note, fill=DIM)
    y = 70
    for sec, lines in layout:
        d.text((GAP * 2, y), sec["title"], font=f_sec, fill=(240, 200, 120))
        y += 30
        for ln in note_of(sec):
            d.text((GAP * 2, y), ln, font=f_note, fill=DIM)
            y += 20
        y += 4
        for r, cells, row_imgs, cw, ch, labs in lines:
            for i, ln in enumerate(wrap(r.get("label") or "", f_row, ROW_LAB - GAP * 2)):
                d.text((GAP * 2, y + ch // 2 - 10 + i * 17), ln, font=f_row, fill=INK)
            x = ROW_LAB
            for c, img in zip(cells, row_imgs):
                cell = checker(cw, ch, s)
                big = img.convert("RGBA").resize((img.width * s, img.height * s), Image.NEAREST)
                # Abajo y al centro: los pies de todos en la misma línea.
                cell.paste(big, ((cw - big.width) // 2, ch - big.height), big)
                im.paste(cell, (x, y))
                for i, ln in enumerate(wrap(c.get("label") or "", f_lab, cw + GAP - 4)):
                    d.text((x, y + ch + 3 + i * 15), ln, font=f_lab, fill=DIM)
                x += cw + GAP
            y += ch + labs * 15 + GAP + 4
        y += 18
    im.save(root / f"{sheet['name']}.png", optimize=True)
    print(sheet["name"], im.size)


for sh in sheets:
    build(sh)


# GIF de cada clase: andar (8 tiempos) y una ronda de pelea, en bucle.
def gif(name, files, s, ms):
    frames = [Image.open(root / f).convert("RGBA") for f in files]
    w = max(f.width for f in frames) * s
    h = max(f.height for f in frames) * s
    out = []
    for f in frames:
        c = Image.new("RGBA", (w + 16, h + 16), BG + (255,))
        big = f.resize((f.width * s, f.height * s), Image.NEAREST)
        c.paste(big, (8 + (w - big.width) // 2, 8 + h - big.height), big)
        out.append(c.convert("P", palette=Image.ADAPTIVE))
    (root / "gif").mkdir(exist_ok=True)
    out[0].save(root / "gif" / f"{name}.gif", save_all=True, append_images=out[1:], duration=ms, loop=0, disposal=2)


for sh in sheets:
    if not sh["name"].split("-", 1)[1].startswith("animaciones"):
        continue
    cls = sh["name"].rsplit("-", 1)[1]
    rows = {r["label"]: r["cells"] for sec in sh["sections"] for r in sec["rows"]}
    gif(f"{cls}-andar", [c["file"] for c in rows["andar"]], 6, 110)
    idle = rows["de frente"]
    gif(f"{cls}-quieto", [idle[0]["file"]] * 6 + [idle[1]["file"]] * 6 + [idle[2]["file"]], 6, 120)
    pelea = {c["label"]: c["file"] for c in rows["con arma"]}
    seq = ["ready"] * 4 + ["windup"] * 3 + ["strike"] * 3 + ["ready"] * 3 + ["up"] * 2 + ["ready"] * 2 + ["thrust"] * 3
    gif(f"{cls}-pelea", [pelea[p] for p in seq], 6, 100)
print("gif hechos")
