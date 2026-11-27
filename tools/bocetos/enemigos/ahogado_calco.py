"""El ahogado de las marismas (un esqueleto con verdín y garrote), calcado de la hoja del usuario a
media escala sobre sus píxeles (`exact=2`): 0–4 quieto, 5–10 ataque (garrote arriba, atrás,
barrido, golpe en el agua, sigue, vuelve), 11–14 herido, 15–20 muere. Dos muertes (usuario): cae,
se desarma y queda tendido (15, 16, 17, 18, 20) o se sienta y se queda así (15, 19)."""
import json
import calco3 as C
S = '/tmp/claude-0/-home-user-AdventurersGuild/40ff8843-c43b-5ced-88ab-6b5c5084b85c'
I = S + '/images/'
BOX = [(53,23,184,189),(237,23,371,189),(430,23,551,189),(604,23,737,188),(797,23,924,188),
       (60,200,218,383),(246,206,373,382),(447,210,723,383),(742,243,952,383),(992,231,1136,383),
       (1206,214,1325,383),(40,392,195,571),(261,421,388,571),(458,415,539,571),(636,410,740,571),
       (45,587,219,755),(263,583,451,755),(492,622,660,755),(699,668,893,761),(929,622,1122,761),
       (1152,679,1351,761)]
def idx(box):
    return next(i for i, b in enumerate(BOX) if tuple(b) == tuple(box))
def fuera(p, box):  # las gotas de agua y, en el barrido y el golpe, la estela pálida
    r, g, b = p
    agua = b > g + 5 and b > r + 35 and (r + g + b) / 3 > 140
    estela = idx(box) in (7, 8) and b >= r + 8 and (r + g + b) / 3 > 165
    return agua or estela
verdin = lambda p: p[1] > p[0] + 35 and p[1] > p[2] + 20
fr = C.criatura(I + '19.webp', BOX, 2.875, 14, (226, 219, 192), drop=fuera, minc=0.05, exact=True,
                edge=1.0, acc=[(verdin, '#4f8a4a', 2)])
# A media escala: de cada 2×2 de la hoja, el contorno si lo hay (lo más oscuro); si no, el color que
# más se repite, y a la par, el más claro (para que no se pierdan los huesos ni las costillas).
def lum(h): return int(h[1:3], 16) * .3 + int(h[3:5], 16) * .59 + int(h[5:7], 16) * .11
def mitad(g):
    H, W = (len(g) + 1) // 2, (len(g[0]) + 1) // 2
    out = [[None] * W for _ in range(H)]
    for j in range(H):
        for i in range(W):
            cs = [g[y][x] for y in (2 * j, 2 * j + 1) for x in (2 * i, 2 * i + 1)
                  if y < len(g) and x < len(g[0]) and g[y][x]]
            if len(cs) < 2: continue
            dark = min(cs, key=lum)
            if lum(dark) < 38: out[j][i] = dark; continue
            out[j][i] = max(set(cs), key=lambda c: (cs.count(c), lum(c)))
    return out
# A dos tercios: de cada 3×3 de la hoja, 2×2 (el de cada esquina de arriba a la izquierda y el del
# centro, por filas y columnas: 0 y 1,5 → 0 y 2 alternos), sin mezclar colores.
def dos_tercios(g):
    H, W = len(g), len(g[0])
    ys = [y for y in range(H) if y % 3 != 1]
    xs = [x for x in range(W) if x % 3 != 1]
    return [[g[y][x] for x in xs] for y in ys]
grande = fr  # a escala de la hoja: para un jefe más adelante (usuario)
fr = [dos_tercios(g) for g in fr]
def pie(g):
    xs = [x for r in g[-3:] for x, c in enumerate(r) if c]
    return round(sum(xs) / len(xs))
def alinea(fr):
    an = [pie(g) for g in fr]; m = max(an)
    return [[[None] * (m - p) + r for r in g] for g, p in zip(fr, an)]
out = {'ahogado': alinea(fr), 'ahogado_grande': alinea(grande)}
print([(len(g[0]), len(g)) for g in out['ahogado']], [(len(g[0]), len(g)) for g in out['ahogado_grande']][:1])
json.dump(out, open('ahogado_calco.json', 'w'))
C.hoja(out, S + '/scratchpad/ahogado.png', esc=6)
