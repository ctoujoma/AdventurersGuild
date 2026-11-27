"""El Rey Ahogado (jefe de la historia «El Rey Ahogado»), calcado de la hoja del usuario: 0–4 quieto,
5–10 ataque (ancla atrás, arriba, barrido, la clava en el suelo, la recoge, vuelve), 11–14 herido
(se echa atrás, se encoge, se rehace, vuelve), 15–20 muere (pierde la corona y el ancla, se dobla,
de rodillas, tendido)."""
import json
import calco3 as C
S = '/tmp/claude-0/-home-user-AdventurersGuild/40ff8843-c43b-5ced-88ab-6b5c5084b85c'
I = S + '/images/'
BOX = [(63,20,173,192),(258,20,368,192),(452,20,562,192),(644,19,754,192),(846,19,957,192),
       (20,228,176,383),(240,218,390,383),(478,210,737,383),(756,244,945,385),(1005,232,1116,385),
       (1223,214,1331,383),(13,408,236,576),(287,407,425,575),(473,427,636,575),(687,408,794,575),
       (26,587,233,762),(252,590,460,762),(464,636,726,762),(733,639,911,761),(917,714,1098,764),
       (1146,714,1325,764)]
def fuera(p, box):  # el cian de los ojos y las gotas (los ojos se ponen luego, uno por ojo) y, solo
    r, g, b = p       # en el barrido y el golpe, la estela pálida (en el resto, eso son las costillas);
    # el barro se queda: con él se iba el borde de la corona
    pale = BOX.index(box) in (7, 8) and b > r + 15 and (r + g + b) / 3 > 170
    cyan = g - r > 45 and b > 185 and b - r > 45
    return pale or cyan
OJO = '#a4e6f3'
def ojos(a, box):
    """Los ojos, siempre una pupila cian por ojo (en la hoja unas veces brillan y otras no): bajo la
    corona, los dos puntos más cian de la cara (o uno, de perfil). Sin corona (al morir, se le cae),
    sin luz en los ojos."""
    import numpy as np
    if BOX.index(box) >= 15: return []  # muere: se le va la luz de los ojos
    x0, y0, x1, y1 = box
    reg = a[y0:y1, x0:x1]
    r, g, b = reg[:, :, 0], reg[:, :, 1], reg[:, :, 2]
    gold = (r > 160) & (g > 100) & (b < 110) & (r - b > 70)
    ys, xs = np.nonzero(gold)
    if len(ys) < 30: return []
    # la corona puesta: la mancha de oro más alta; la cara, justo debajo
    top = ys.min(); sel = ys < top + 40
    cy0, cx0, cx1 = ys[sel].max() + 2, xs[sel].min() - 6, xs[sel].max() + 6
    if cy0 - top > 45: return []
    face = reg[cy0:cy0 + 28, max(0, cx0):cx1]
    sc = (face[:, :, 1] - face[:, :, 0]) + (face[:, :, 2] - face[:, :, 0]) + face.sum(2) / 6
    order = np.argsort(-sc.ravel())
    pts = []
    for k in order[:400]:
        y, x = divmod(int(k), sc.shape[1])
        if all(abs(x - px) > 4 or abs(y - py) > 4 for px, py, _ in pts):
            pts.append((x, y, sc[y, x]))
        if len(pts) == 6: break
    a1 = pts[0]
    pair = [p for p in pts[1:] if abs(p[1] - a1[1]) <= 5 and 6 <= abs(p[0] - a1[0]) <= 22 and p[2] > a1[2] * 0.8]
    eyes = [a1] + pair[:1]
    return [(x0 + max(0, cx0) + x, y0 + cy0 + y, OJO) for x, y, _ in eyes]
ojo = lambda p: p[2] > 170 and p[1] > 160 and p[0] < 170
verdin = lambda p: p[1] > p[0] + 22 and p[1] > p[2] + 4
fr = C.criatura(I + '18.webp', BOX, 2.875, 16, (225, 216, 187), drop=fuera, minc=0.03, exact=True, edge=1.0,
                keep=('#f0b030', '#c88a20'), acc=[(verdin, '#3f7552', 3)], marks=ojos)
# Fuera de la muerte (donde vuelan la corona y el ancla), sin trozos sueltos (restos de la estela).
def limpia(g):
    H, W = len(g), len(g[0]); seen = set(); comps = []
    for j in range(H):
        for i in range(W):
            if g[j][i] and (i, j) not in seen:
                st = [(i, j)]; seen.add((i, j)); comp = []
                while st:
                    x, y = st.pop(); comp.append((x, y))
                    for dx in (-1, 0, 1):
                        for dy in (-1, 0, 1):
                            q = (x + dx, y + dy)
                            if 0 <= q[0] < W and 0 <= q[1] < H and q not in seen and g[q[1]][q[0]]:
                                seen.add(q); st.append(q)
                comps.append(comp)
    big = max(len(c) for c in comps)
    for c in comps:
        if len(c) < big * 0.15:
            for x, y in c: g[y][x] = None
    return g
fr = [limpia(g) if i < 15 else g for i, g in enumerate(fr)]
# Los ojos van dentro de la cara: el cian que toca el borde de la figura son brillos de la capa.
def sin_brillos(g):
    H, W = len(g), len(g[0])
    for _ in range(2):
        rm = [(i, j) for j in range(H) for i in range(W) if g[j][i] == '#a4e6f3' and False and any(
            not (0 <= i + dx < W and 0 <= j + dy < H) or g[j + dy][i + dx] is None
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
        for i, j in rm: g[j][i] = None
    return g
fr = [sin_brillos(g) for g in fr]
# Motas: un píxel mucho más claro que todos los de alrededor (brillos sueltos del agrandado) toma el
# color que más hay a su alrededor. Ni el oro de la corona ni los ojos.
def lum(h): return int(h[1:3], 16) * .3 + int(h[3:5], 16) * .59 + int(h[5:7], 16) * .11
def oro(h): return int(h[1:3], 16) > int(h[3:5], 16) + 30
def sin_motas(g):
    H, W = len(g), len(g[0]); out = [r[:] for r in g]
    for j in range(H):
        for i in range(W):
            c = g[j][i]
            if not c or c == OJO or oro(c): continue
            nb = [g[j + dy][i + dx] for dx in (-1, 0, 1) for dy in (-1, 0, 1)
                  if (dx or dy) and 0 <= i + dx < W and 0 <= j + dy < H and g[j + dy][i + dx]]
            nb = [n for n in nb if n != OJO and not oro(n)]
            if len(nb) >= 3 and lum(c) > max(lum(n) for n in nb) + 25:
                out[j][i] = max(set(nb), key=nb.count)
    return out
fr = [sin_motas(g) for g in fr]
# Las costillas: en la hoja, de pie, unas veces se ven y otras no (el cuarto de quieto, sin ellas).
# Al resto de fotogramas de pie va el pecho del primero, alineado por la corona y sin tocar su silueta.
def corona(g):
    pts = [(x, y) for y, r in enumerate(g) for x, c in enumerate(r) if c and oro(c)]
    top = min(y for _, y in pts)
    return min(x for x, y in pts if y < top + 4), top
def pecho(dst, src):
    (sx, sy), (dx, dy) = corona(src), corona(dst)
    for y in range(sy + 14, sy + 35):
        for x in range(sx - 6, sx + 17):
            ty, tx = y - sy + dy, x - sx + dx
            if 0 <= ty < len(dst) and 0 <= tx < len(dst[0]) and dst[ty][tx] and src[y][x] and dst[ty][tx] != OJO:
                dst[ty][tx] = src[y][x]
for i in (1, 2, 3, 4, 10, 14):
    pecho(fr[i], fr[0])
def pie(g):
    xs = [x for r in g[-3:] for x, c in enumerate(r) if c]
    return round(sum(xs) / len(xs))
an = [pie(g) for g in fr]; m = max(an)
out = {'rey': [[[None] * (m - p) + r for r in g] for g, p in zip(fr, an)]}
print([(len(g[0]), len(g)) for g in out['rey']])
json.dump(out, open('rey_calco.json', 'w'))
C.hoja(out, S + '/scratchpad/rey.png', esc=3)
