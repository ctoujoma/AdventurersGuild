"""
Junta las capturas de tools/shots/galeria.mjs (las del «antes» y las del «después») en una
lámina por sala para el visor de la galería, ya a 1:1 (las capturas van a zoom 4).

Uso: python3 tools/shots/galeria.py <antes> <después> <salida>

Cada lámina tiene, por cada ancho de la sala (1 y el máximo), cuatro filas: antes de día,
antes de noche, después de día y después de noche; y una columna por nivel (0 a 3). Deja
también `salas.json` con el tamaño de cada celda y dónde empieza cada bloque.
"""

import json
import os
import re
import sys

from PIL import Image

antes, despues, out = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(out, exist_ok=True)
NAME = re.compile(r"^(\w+)-a(\d)-n(\d)-(dia|noche)\.png$")


def load(folder):
    shots = {}
    for f in os.listdir(folder):
        m = NAME.match(f)
        if not m:
            continue
        im = Image.open(os.path.join(folder, f)).convert("RGB")
        # A 1:1: un píxel de cada bloque de 4×4.
        im = im.resize((im.width // 4, im.height // 4), Image.NEAREST)
        shots[(m[1], int(m[2]), int(m[3]), m[4])] = im
    return shots


shots = {"antes": load(antes), "despues": load(despues)}
rooms = sorted({k[0] for k in shots["despues"]})
info = {}
for room in rooms:
    widths = sorted({k[1] for k in shots["despues"] if k[0] == room})
    blocks = []
    y = 0
    for w in widths:
        cells = [
            shots[v].get((room, w, lvl, t))
            for v in ("antes", "despues")
            for t in ("dia", "noche")
            for lvl in range(4)
        ]
        cw = max(c.width for c in cells if c)
        ch = max(c.height for c in cells if c)
        blocks.append({"w": w, "cw": cw, "ch": ch, "y": y})
        y += ch * 4
    sheet = Image.new("RGB", (max(b["cw"] * 4 for b in blocks), y), (24, 20, 37))
    for b in blocks:
        for r, (v, t) in enumerate(
            [("antes", "dia"), ("antes", "noche"), ("despues", "dia"), ("despues", "noche")]
        ):
            for lvl in range(4):
                im = shots[v].get((room, b["w"], lvl, t))
                if not im:
                    continue
                # Centrada abajo en su celda (la torre cambia de alto de una versión a otra).
                x = lvl * b["cw"] + (b["cw"] - im.width) // 2
                yy = b["y"] + r * b["ch"] + (b["ch"] - im.height)
                sheet.paste(im, (x, yy))
    sheet.save(os.path.join(out, f"{room}.png"), optimize=True)
    info[room] = blocks
with open(os.path.join(out, "salas.json"), "w") as f:
    json.dump(info, f)
print(len(rooms), "salas")
