"""La muerte del huargo (hoja del usuario): se encabrita, agacha la cabeza, se desploma, tendido, se
oscurece y queda en ceniza. Con la paleta del huargo que ya hay (`expCalcos.ts`), para añadirlos a
sus fotogramas: `a_ts.py` los pone detrás (del 8 en adelante)."""
import json
import calco3 as C
S = '/tmp/claude-0/-home-user-AdventurersGuild/40ff8843-c43b-5ced-88ab-6b5c5084b85c'
RAMP = ['#0e0b18', '#191a30', '#232a48', '#2f3a60', '#3e4c78', '#566694', '#7a88b0']
BOCA = ['#fee761', '#e8e0d0', '#d07888', '#9a2c40', '#3a0c1c']
fr = C.criatura(S + '/images/11.webp',
                [(7,0,398,301),(468,65,858,303),(892,117,1320,311),(1330,117,1791,311),
                 (904,427,1325,592),(1348,430,1772,592)],
                6.7, 0, (230, 224, 203), pal=RAMP + BOCA,
                acc=(lambda p: p[0] > 150 and p[1] > 130 and p[2] < 110, '#fee761', 2))
print([(len(g[0]), len(g)) for g in fr])
json.dump(fr, open('huargo_muerte.json', 'w'))
C.hoja({'h': fr}, S + '/scratchpad/huargo_muerte.png', esc=3)
