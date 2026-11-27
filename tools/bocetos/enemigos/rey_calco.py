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
def fuera(p):  # la estela pálida del barrido y las salpicaduras del golpe (el barro se queda: con él
    r, g, b = p  # se iba también el borde de la corona)
    return b > r + 15 and (r + g + b) / 3 > 165
ojo = lambda p: p[2] > 170 and p[1] > 160 and p[0] < 170
verdin = lambda p: p[1] > p[0] + 22 and p[1] > p[2] + 4
fr = C.criatura(I + '18.webp', BOX, 2.875, 16, (225, 216, 187), drop=fuera, minc=0.03, exact=True, edge=1.0,
                keep=('#f0b030', '#c88a20'), acc=[(ojo, '#9ae6f2', 1), (verdin, '#3f7552', 3)])
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
        rm = [(i, j) for j in range(H) for i in range(W) if g[j][i] == '#9ae6f2' and any(
            not (0 <= i + dx < W and 0 <= j + dy < H) or g[j + dy][i + dx] is None
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
        for i, j in rm: g[j][i] = None
    return g
fr = [sin_brillos(g) for g in fr]
def pie(g):
    xs = [x for r in g[-3:] for x, c in enumerate(r) if c]
    return round(sum(xs) / len(xs))
an = [pie(g) for g in fr]; m = max(an)
out = {'rey': [[[None] * (m - p) + r for r in g] for g, p in zip(fr, an)]}
print([(len(g[0]), len(g)) for g in out['rey']])
json.dump(out, open('rey_calco.json', 'w'))
C.hoja(out, S + '/scratchpad/rey.png', esc=3)
