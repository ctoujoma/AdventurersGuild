import json
from calco import save
g=json.load(open('huargo_calco.json'))
H=len(g); W=len(g[0])
def P(x,y,c):
    if 0<=y<H and 0<=x<W and g[y][x]: g[y][x]=c
EYE='#fee761'; EYE2='#feae34'; TOOTH='#ece4d4'; GUM='#8a2232'; DARK='#2a0c16'; CLAW='#d8d0c0'
# ojo con su ceja
P(74,20,'#0e0b18'); P(75,20,EYE); P(76,20,EYE2); P(75,19,'#232a48'); P(76,19,'#232a48')
# boca: encías, dientes de arriba y de abajo, fondo oscuro
for x in range(72,83):
    P(x,27,TOOTH if x%2==0 else GUM)
    P(x,28,DARK)
    P(x,29,TOOTH if x%2==1 and x<81 else g[29][x] if g[29][x] else None)
P(83,27,'#0e0b18')
# garras: en la última fila de cada pata, píxeles claros alternos
for y in range(H-1,0,-1):
    for x in range(W):
        if g[y][x] and (y+1>=H or not g[y+1][x]) and y>=54 and x%2==0:
            if g[y-1][x] and g[y][x] not in (CLAW,):
                g[y][x]=CLAW
json.dump(g,open('huargo_final.json','w'))
save(g,8,'huargo_final.png'); save(g,3,'huargo_final3.png'); save(g,1,'huargo_final1.png')
