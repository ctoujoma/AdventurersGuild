import json
d=json.load(open('bosque_calco.json'))
d.update(json.load(open('sierra_calco.json')))
IDX='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
RAMPS={'huargo':['#0e0b18','#191a30','#232a48','#2f3a60','#3e4c78','#566694','#7a88b0'],
 'oso':['#1a0f10','#2e1a16','#4a2a1e','#663a24','#85502e','#a6683a','#c4874e'],
 'jabali':['#140c0c','#2a1812','#43261a','#5e3722','#7a4c2e','#97653e','#b88454'],
 'lobo':['#14141e','#2c3040','#454c60','#626a7e','#848c9e','#a8afbe','#cdd2dc']}
SP={'#0e0b18':'0','#191a30':'1','#232a48':'2','#2f3a60':'3','#3e4c78':'4','#566694':'5','#7a88b0':'6','#fee761':'y','#e8e0d0':'w','#d07888':'p','#9a2c40':'r','#3a0c1c':'m'}
out=['/**',' * Los enemigos calcados de las referencias (y limpiados a mano: bocas, ojos,',' * huecos): cada uno, sus fotogramas mirando a la derecha. Generado con',' * `tools/bocetos/enemigos/a_ts.py`; no se edita a mano.',' */','',
'/** `.` vacío, `0`–`9` y `A`–`Z` los colores de `ramp` (de oscuro a claro), y en minúscula los de la boca y los ojos. */',
"export const BOCA = { y: '#fee761', w: '#e8e0d0', p: '#d07888', r: '#9a2c40', m: '#3a0c1c' } as const;",'',
'export interface Calco {','  ramp: readonly string[];','  frames: readonly (readonly string[])[];','}','',
'export const CALCOS: Record<string, Calco> = {']
for name,fr in d.items():
    R=RAMPS.get(name) or sorted({c for g in fr for r in g for c in r if c}, key=lambda h: sum(int(h[i:i+2],16)*w for i,w in((1,.3),(3,.59),(5,.11))))
    out.append(f'  {name}: {{')
    out.append('    ramp: ['+', '.join(f"'{c}'" for c in R)+'],')
    out.append('    frames: [')
    for g in fr:
        out.append('      [')
        for r in g:
            s=''.join('.' if c is None else (IDX[R.index(c)] if c in R else SP[c]) for c in r)
            out.append(f"        '{s}',")
        out.append('      ],')
    out.append('    ],')
    out.append('  },')
out.append('};')
open('/home/user/AdventurersGuild/src/art/expCalcos.ts','w').write('\n'.join(out)+'\n')
