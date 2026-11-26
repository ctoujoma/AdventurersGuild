"""Los enemigos de sierra y marismas calcados de las hojas del usuario (segunda vuelta)."""
import json, colorsys
import calco3 as C
S = '/tmp/claude-0/-home-user-AdventurersGuild/40ff8843-c43b-5ced-88ab-6b5c5084b85c'
I = S + '/images/'
def gris(p):  # sombra gris bajo la sanguijuela que salta
    h, s, v = colorsys.rgb_to_hsv(*(x / 255 for x in p)); return s < 0.2 and v > 0.25
AN = {
  # 0 quieta, 1 enroscada, 2 se alza, 3 salto, 4 encogida, 5 estirada, 6 quieta, 7 roja alzada,
  # 8 roja lanzada, 9 quieta
  'sanguijuela': dict(src='6.png', bg=(229, 223, 200), k=5.6, n=14, drop=None, keep=(), edge=0.65, lift=1.45, split=True,
    boxes=[(17,64,140,167),(143,77,239,167),(245,49,367,167),(375,0,461,140),(466,100,592,164),
           (598,105,752,167),(758,64,878,167),(878,55,1003,166),(998,77,1183,167),(1180,72,1302,167)]),
  # v2 (sin la fila de andar, que trae el brazo y el garrote mal): 0 quieto, 1 en guardia, 2–3 alza
  # el garrote, 4–5 lo estampa, 6 lo recoge, 7–8 herido, 9–13 muere (se tambalea, suelta el garrote,
  # cae, tendido); 14, quieto con los hombros un píxel abajo (respira)
  'gigante': dict(src='9.webp', bg=(227, 220, 191), k=4.35, n=11, drop=None, keep=('#a82838',), feet=True,
    boxes=[(11,215,196,407),(204,220,347,407),(362,195,522,407),(534,195,694,407),(712,254,958,411),
           (963,254,1181,410),(1192,189,1350,407),(869,422,1025,597),(1040,417,1183,597),
           (16,600,240,764),(277,604,582,764),(597,616,819,764),(859,669,1074,764),(1120,681,1344,764)]),
  # 0–5 de pie y andando, 6 ruge, 7–9 aliento, 10 herido (se encabrita), 11 agachado,
  # 12 caído, 13–17 quieto (respira), 18 alas arriba
  'dragon': dict(src='8.webp', bg=(228, 223, 198), k=2.45, n=11, drop=None, keep=(), acc=(lambda p: p[0] > p[1] + 25 and p[0] > p[2] + 8, '#c8203a', 2),
    boxes=[(18,5,175,150),(187,5,345,150),(349,10,510,150),(510,10,672,150),(675,10,838,150),
           (836,5,1002,150),(849,152,1002,292),(1117,148,1312,292),(1315,148,1600,292),
           (1600,148,1840,292),(189,272,332,418),(341,285,488,418),(1187,345,1366,418),
           (8,280,160,418),(1377,280,1525,418),(1531,280,1676,418),(1676,280,1830,418),
           (1846,293,1992,418),(849,285,1002,418)]),
}
out = {}
for name, a in AN.items():
    out[name] = C.criatura(I + a['src'], a['boxes'], a['k'], a['n'], a['bg'], drop=a['drop'], keep=a['keep'], acc=a.get('acc'), edge=a.get('edge', 0.55), lift=a.get('lift', 1.0), split=a.get('split', False))
    if name == 'gigante':  # respira: el quieto con una fila menos a la altura del pecho
        g = out[name][0]; y = round(len(g) * 0.42)
        out[name].append([[None] * len(g[0])] + g[:y] + g[y + 1:])
    if a.get('feet'):  # alineados por los pies (el centro de lo que pisa), no por la izquierda
        def pie(g):
            xs = [x for r in g[-3:] for x, c in enumerate(r) if c]
            return round(sum(xs) / len(xs))
        an = [pie(g) for g in out[name]]; m = max(an)
        out[name] = [[[None] * (m - p) + r for r in g] for g, p in zip(out[name], an)]
    print(name, [(len(g[0]), len(g)) for g in out[name]])
json.dump(out, open('sierra_calco.json', 'w'))
C.hoja(out, S + '/scratchpad/sierra_calco2.png')
