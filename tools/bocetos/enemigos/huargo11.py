import json
from boca_limpia import limpia
from PIL import Image
fr=json.load(open('huargo10.json'))
# ojos: quitar amarillos pegados al borde (fleco de las orejas)
for g in fr:
    H=len(g);W=len(g[0])
    for y in range(H):
        for x in range(W):
            if g[y][x]=='#fee761' and any(not(0<=x+dx<W and 0<=y+dy<H) or g[y+dy][x+dx] is None for dx,dy in((1,0),(-1,0),(0,1),(0,-1),(1,1),(-1,-1),(1,-1),(-1,1))): g[y][x]='#0e0b18'
from boca_limpia import sanea
fr=[sanea(limpia(sanea(g))) for g in fr]
json.dump(fr,open('huargo11.json','w'))
S=10; tiles=[]
for g in fr:
    w=len(g[0]); h=len(g)
    rx=max((x,y) for y in range(h) for x in range(w) if g[y][x])
    x0=w-30; y0=max(0,rx[1]-16); cw=ch=30
    im=Image.new('RGB',(cw,ch),(231,225,207))
    for y in range(ch):
        for x in range(cw):
            if y0+y<h and g[y0+y][x0+x]: c=g[y0+y][x0+x]; im.putpixel((x,y),tuple(int(c[j:j+2],16) for j in(1,3,5)))
    tiles.append(im.resize((cw*S,ch*S),Image.NEAREST))
sh=Image.new('RGB',(4*310,2*310),(255,255,255))
for i,t in enumerate(tiles): sh.paste(t,((i%4)*310,(i//4)*310))
sh.save('cab11.png')
