import json
from calco import save
g=json.load(open('huargo_calco.json'))
H=len(g); W=len(g[0])
R=['#0e0b18','#191a30','#232a48','#2f3a60','#3e4c78','#566694','#7a88b0']
def P(x,y,c):
    if 0<=y<H and 0<=x<W: g[y][x]=c
def S(x,y,s,pal):
    for i,ch in enumerate(s):
        if ch!='_': P(x+i,y,pal[ch])
EYE='#fee761'; EYE2='#feae34'
pal={'o':R[0],'1':R[1],'2':R[2],'3':R[3],'4':R[4],'5':R[5],'6':R[6],
     'w':'#f2ece0','W':'#c8bfae','g':'#a8323e','m':'#3a0f1a','t':'#c4485a','y':EYE,'Y':EYE2}
# ojo con la ceja fruncida
S(73,19,'oo1',pal); S(74,20,'oyY',pal); S(74,21,'_1',pal)
# la boca, a lo largo del hocico: el labio de arriba sube hacia la punta (gruñido),
# dientes con colmillos, la boca abierta (más delante que en la comisura) y la mandíbula
S(79,24,'2_2',pal); S(80,25,'3_3',pal)
for x in range(75,87):
    yl = 28 - round((x - 75) * 0.32)
    ylow = 29 + round((x - 75) * 0.12)
    P(x, yl, pal['o'])
    if x >= 76:
        P(x, yl + 1, pal['g'] if x in (79, 82) else (pal['w'] if x % 2 == 0 else pal['W']))
    for y in range(yl + 2, ylow - 1):
        P(x, y, pal['m'] if y < ylow - 2 or x < 82 else pal['t'])
    if x in (77, 83):
        P(x, yl + 2, pal['W'])
    if x >= 79:
        P(x, ylow - 1, pal['w'] if x % 2 else pal['m'])
    if x == 81:
        P(x, ylow - 2, pal['W'])
    P(x, ylow, pal['o'])
    P(x, ylow + 1, pal['3'])
P(87, 25, pal['o']); P(87, 26, pal['o']); P(87, 27, pal['o']); P(86, 30, pal['o'])
# garras: en la última fila de cada pata, píxeles claros alternos
CLAW='#d8d0c0'
for y in range(H-1,0,-1):
    for x in range(W):
        if g[y][x] and (y+1>=H or not g[y+1][x]) and y>=54 and x%2==0 and g[y-1][x]:
            g[y][x]=CLAW
json.dump(g,open('huargo_final.json','w'))
save(g,8,'huargo_final.png'); save(g,3,'huargo_final3.png')
from PIL import Image
im=Image.open('huargo_final.png').crop((560,100,736,280)); im.resize((im.width*2,im.height*2),Image.NEAREST).save('huargo_boca.png')
