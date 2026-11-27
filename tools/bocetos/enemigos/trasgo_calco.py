"""El trasgo de la sierra, calcado de la hoja del usuario: 0–4 quieto, 5–10 ataque (garrote atrás,
arriba, golpe con estela, golpe, sigue, vuelve), 11–14 herido (suelta el garrote, lo recoge, ...),
15–20 muere (se tambalea sin el garrote, cae, tendido)."""
import json
import calco3 as C
S = '/tmp/claude-0/-home-user-AdventurersGuild/40ff8843-c43b-5ced-88ab-6b5c5084b85c'
I = S + '/images/'
BOX = [(69,48,218,192),(344,48,493,192),(619,48,769,192),(894,48,1044,192),(1170,48,1319,192),
       (57,203,189,382),(229,203,402,382),(458,203,686,382),(745,203,952,382),(975,203,1147,382),
       (1181,203,1353,382),(57,398,259,571),(430,398,597,571),(780,398,964,571),(1152,398,1273,571),
       (29,573,206,760),(264,562,447,748),(527,639,694,760),(711,673,935,760),(946,673,1135,760),
       (1146,674,1365,760)]
fr = C.criatura(I + '17.webp', BOX, 6.4, 9, (227, 215, 187), minc=0.04,
                keep=('#fee761', '#f0f0f0'))
def pie(g):
    xs = [x for r in g[-3:] for x, c in enumerate(r) if c]
    return round(sum(xs) / len(xs))
an = [pie(g) for g in fr]; m = max(an)
out = {'trasgo': [[[None] * (m - p) + r for r in g] for g, p in zip(fr, an)]}
print([(len(g[0]), len(g)) for g in out['trasgo']])
json.dump(out, open('trasgo_calco.json', 'w'))
C.hoja(out, S + '/scratchpad/trasgo.png', esc=5)
