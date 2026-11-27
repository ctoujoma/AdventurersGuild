"""El jabalí de ceniza (jefe de la historia «Ceniza»), calcado de la hoja del usuario: 0–4 quieto
(resopla), 5–10 ataque (escarba, arranca, embiste agachado, cornada hacia arriba, cae, vuelve),
11–14 herido (chilla, se echa atrás, se encoge, vuelve), 15–20 muere (se encabrita, tropieza, se
desploma, tendido, se deshace en ceniza, montón de ceniza)."""
import json
import calco3 as C
S = '/tmp/claude-0/-home-user-AdventurersGuild/40ff8843-c43b-5ced-88ab-6b5c5084b85c'
I = S + '/images/'
BOX = [(40,31,258,184),(308,31,556,184),(581,31,825,184),(844,30,1087,184),(1113,31,1362,184),
       (25,215,247,380),(247,205,506,380),(506,215,724,380),(731,205,924,380),(925,225,1139,380),
       (1145,227,1362,379),(80,398,325,569),(423,400,648,568),(764,420,964,569),(1100,417,1311,569),
       (30,584,231,761),(254,617,448,760),(484,616,672,760),(701,639,919,761),(934,605,1141,764),
       (1155,668,1362,763)]
def polvo(p):  # el polvo y el barro del suelo (marrones apagados), no el cuerpo ni las brasas
    r, g, b = p
    return 18 < r - b < 75 and r > 70 and g > 45 and r - g < 45
def brasa(p):
    r, g, b = p
    return r > 170 and g < 150 and b < 90
fr = C.criatura(I + '16.webp', BOX, 3.3, 10, (231, 227, 198), drop=polvo, lift=1.25,
                keep=('#f0a030', '#d8542a', '#8a2c1c', '#e8e0d0'), acc=(brasa, '#e8642a', 2))
def pie(g):
    xs = [x for r in g[-3:] for x, c in enumerate(r) if c]
    return round(sum(xs) / len(xs))
an = [pie(g) for g in fr]; m = max(an)
out = {'ceniza': [[[None] * (m - p) + r for r in g] for g, p in zip(fr, an)]}
print([(len(g[0]), len(g)) for g in out['ceniza']])
json.dump(out, open('ceniza_calco.json', 'w'))
C.hoja(out, S + '/scratchpad/ceniza.png', esc=3)
