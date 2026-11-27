"""Los del bosque rehechos con las hojas nuevas del usuario (una por enemigo, con sus cuatro
animaciones): sustituyen a los de `bosque_calco.py` del mismo nombre."""
import json
import calco3 as C
S = '/tmp/claude-0/-home-user-AdventurersGuild/40ff8843-c43b-5ced-88ab-6b5c5084b85c'
I = S + '/images/'
AN = {
  # 0–4 quieto (respira), 5–10 ataque (en guardia, se alza, zarpa arriba, zarpazo, pasado, vuelve),
  # 11–14 herido (ruge, se echa atrás, se encoge, vuelve), 15–20 muere (se alza rugiendo, se
  # tambalea, se desploma, tendido; 19–20 oscurecido, sin usar)
  'oso': dict(src='12.webp', bg=(231, 226, 201), k=4.4, n=11, keep=('#a83240', '#e8e0d0'),
    boxes=[(32,50,217,188),(319,48,503,187),(595,50,780,188),(870,48,1053,187),(1150,47,1336,187),
           (22,240,218,380),(262,198,441,380),(489,196,680,380),(702,228,912,380),(933,233,1128,380),
           (1166,240,1352,380),(24,405,217,575),(265,392,443,575),(481,432,667,572),(709,435,898,573),
           (27,583,209,767),(239,621,446,767),(458,643,686,767),(690,673,916,767),(920,664,1145,767),
           (1151,676,1374,767)]),
}
out = {}
for name, a in AN.items():
    fr = C.criatura(I + a['src'], a['boxes'], a['k'], a['n'], a['bg'], keep=a['keep'])
    # alineados por los pies
    def pie(g):
        xs = [x for r in g[-3:] for x, c in enumerate(r) if c]
        return round(sum(xs) / len(xs))
    an = [pie(g) for g in fr]; m = max(an)
    out[name] = [[[None] * (m - p) + r for r in g] for g, p in zip(fr, an)]
    print(name, [(len(g[0]), len(g)) for g in out[name]])
json.dump(out, open('bosque2_calco.json', 'w'))
C.hoja(out, S + '/scratchpad/oso2.png', esc=2)
