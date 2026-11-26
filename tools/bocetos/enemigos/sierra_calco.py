import json, colorsys
import calco3 as C
S = '/tmp/claude-0/-home-user-AdventurersGuild/40ff8843-c43b-5ced-88ab-6b5c5084b85c'
I5 = S + '/images/5.webp'; BG = (231, 226, 203)
def gris(p):  # sombra gris bajo las sanguijuelas
    h, s, v = colorsys.rgb_to_hsv(*(x / 255 for x in p)); return s < 0.25
AN = {
  'sanguijuela': dict(k=7.2, n=7, drop=gris, keep=(),
    boxes=[(5,197,107,284),(115,92,204,209),(187,181,307,258),(311,146,475,291),(492,194,678,291),
           (20,483,122,561),(243,440,462,561),(474,471,683,561)]),
  'gigante': dict(k=6.0, n=10, drop=None, keep=('#c8283a',),
    boxes=[(706,295,966,561),(670,3,961,291)]),
  'dragon': dict(k=5.8, n=10, drop=None, keep=('#d8202c',),
    boxes=[(1031,201,1392,561),(1381,298,1851,561)]),
}
out = {}
for name, a in AN.items():
    out[name] = C.criatura(I5, a['boxes'], a['k'], a['n'], BG, drop=a['drop'], keep=a['keep'])
    print(name, [(len(g[0]), len(g)) for g in out[name]])
json.dump(out, open('sierra_calco.json', 'w'))
C.hoja(out, S + '/scratchpad/sierra_calco.png')
