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
  # 0 garrote al hombro, 1 garrote en alto (en guardia), 2 sobre la cabeza, 3 bajando, 4 pasado,
  # 5 contra el suelo, 6 recoge, 7 sin garrote (herido), 8 al hombro
  'gigante': dict(src='7.webp', bg=(228, 220, 194), k=6.8, n=11, drop=None, keep=('#a82838',),
    boxes=[(8,113,306,416),(310,119,537,421),(546,50,820,419),(836,62,1096,419),(1098,154,1337,417),
           (33,492,474,756),(481,503,821,758),(838,485,1080,756),(1079,447,1368,756)]),
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
    print(name, [(len(g[0]), len(g)) for g in out[name]])
json.dump(out, open('sierra_calco.json', 'w'))
C.hoja(out, S + '/scratchpad/sierra_calco2.png')
