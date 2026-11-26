"""Calco: de una imagen de referencia a un sprite limpio en la rejilla del juego.
Silueta (máscara) y luces (luminancia por cuantiles) a W píxeles de ancho; tonos agrupados
(moda 3×3), colores especiales por tono (ojos, dientes, boca) y contorno selectivo."""
import sys, colorsys
from PIL import Image
from collections import Counter
BG=(233,226,210)
def calco(src, box, W, ramp, special=None, bgdist=55, levels=None, out='calco'):
    im=Image.open(src).convert('RGB').crop(box)
    k=im.width/W; H=round(im.height/k)
    big=im
    # máscara en grande y reducida por proporción
    m=Image.new('L',big.size,0)
    for y in range(big.height):
        for x in range(big.width):
            p=big.getpixel((x,y))
            if sum(abs(a-b) for a,b in zip(p,BG))>bgdist: m.putpixel((x,y),255)
    ms=m.resize((W,H),Image.BOX); s=big.resize((W,H),Image.BOX)
    mask=[[ms.getpixel((x,y))>140 for x in range(W)] for y in range(H)]
    # quitar píxeles sueltos
    for y in range(H):
        for x in range(W):
            if mask[y][x]:
                n=sum(1 for dx,dy in((1,0),(-1,0),(0,1),(0,-1)) if 0<=x+dx<W and 0<=y+dy<H and mask[y+dy][x+dx])
                if n<=1: mask[y][x]=False
    lum={}
    for y in range(H):
        for x in range(W):
            if mask[y][x]:
                r,g,b=s.getpixel((x,y)); lum[(x,y)]=0.3*r+0.59*g+0.11*b
    vals=sorted(lum.values()); n=len(ramp)-1
    qs=levels or [i/n for i in range(1,n)]
    cuts=[vals[int(q*(len(vals)-1))] for q in qs]
    tone=[[None]*W for _ in range(H)]
    for (x,y),v in lum.items(): tone[y][x]=1+sum(1 for c in cuts if v>c)
    # moda 3×3 (agrupa), sin tocar el borde
    t2=[row[:] for row in tone]
    for y in range(1,H-1):
        for x in range(1,W-1):
            if tone[y][x] is None: continue
            c=Counter(tone[y+dy][x+dx] for dx in(-1,0,1) for dy in(-1,0,1) if tone[y+dy][x+dx] is not None)
            v,cnt=c.most_common(1)[0]
            if cnt>=5 and v!=tone[y][x]: t2[y][x]=v
    tone=t2
    # el borde de la silueta es el contorno (la referencia trae el suyo, mezclado con el fondo)
    for y in range(H):
        for x in range(W):
            if tone[y][x] is None: continue
            if any(not(0<=x+dx<W and 0<=y+dy<H) or tone[y+dy][x+dx] is None for dx,dy in((1,0),(-1,0),(0,1),(0,-1))):
                tone[y][x]=0
    grid=[[None]*W for _ in range(H)]
    for y in range(H):
        for x in range(W):
            if tone[y][x] is None: continue
            grid[y][x]=ramp[tone[y][x]]
            if special and tone[y][x]>0:
                r,g,b=s.getpixel((x,y)); hh,ss,vv=colorsys.rgb_to_hsv(r/255,g/255,b/255)
                for test,col in special:
                    if test(hh*360,ss,vv): grid[y][x]=col; break
    # contorno selectivo: fuera de la máscara junto a ella
    outg=[[None]*(W+2) for _ in range(H+2)]
    for y in range(H):
        for x in range(W): outg[y+1][x+1]=grid[y][x]
    res=[row[:] for row in outg]
    def tidx(c): return ramp.index(c) if c in ramp else 3
    for y in range(H+2):
        for x in range(W+2):
            if True: continue
            nb=[(outg[y+dy][x+dx],dy) for dx,dy in((0,1),(0,-1),(1,0),(-1,0)) if 0<=y+dy<H+2 and 0<=x+dx<W+2 and outg[y+dy][x+dx]]
            if not nb: continue
            top=any(dy==1 for _,dy in nb)
            lo=min(tidx(c) for c,_ in nb)
            res[y][x]=ramp[max(0,lo-(1 if top and lo>2 else 3))]
    return res
def save(g,scale,path):
    h=len(g); w=len(g[0])
    im=Image.new('RGB',(w,h),BG)
    for y in range(h):
        for x in range(w):
            c=g[y][x]
            if c: im.putpixel((x,y),tuple(int(c[i:i+2],16) for i in (1,3,5)))
    im.resize((w*scale,h*scale),Image.NEAREST).save(path)
