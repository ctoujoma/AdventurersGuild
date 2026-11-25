"""Animación por piezas: cada pieza (pata, cola, cabeza) se mueve con un desplazamiento y un
cizallado por filas (un giro pequeño sin romper los píxeles) alrededor de su articulación."""
import json, math
from PIL import Image, ImageDraw
def inpoly(x,y,poly):
    c=False; n=len(poly)
    for i in range(n):
        x1,y1=poly[i]; x2,y2=poly[(i+1)%n]
        if (y1>y)!=(y2>y) and x<(x2-x1)*(y-y1)/(y2-y1)+x1: c=not c
    return c
class Rig:
    def __init__(self, grid, parts, order):
        self.g=grid; self.H=len(grid); self.W=len(grid[0]); self.parts=parts; self.order=order
        self.owner={}
        for y in range(self.H):
            for x in range(self.W):
                if not grid[y][x]: continue
                o='cuerpo'
                for name,p in parts.items():
                    if inpoly(x+0.5,y+0.5,p['poly']): o=name; break
                self.owner[(x,y)]=o
    def frame(self, pose, pad=12):
        W,H=self.W+pad*2,self.H+pad*2
        out=[[None]*W for _ in range(H)]
        body=pose.get('cuerpo',{})
        bx,by=body.get('dx',0),body.get('dy',0)
        for name in self.order:
            p=pose.get(name,{})
            piv=self.parts[name]['pivot'] if name!='cuerpo' else (0,0)
            dx=p.get('dx',0)+(bx if name!='cuerpo' else 0); dy=p.get('dy',0)+(by if name!='cuerpo' else 0)
            sh=p.get('shear',0); vs=p.get('vshear',0); lift=p.get('lift',0); ln=self.parts.get(name,{}).get('len',20)
            for (x,y),o in self.owner.items():
                if o!=name: continue
                ox=x+dx+round((y-piv[1])*sh)
                oy=y+dy+round((x-piv[0])*vs)-round(lift*max(0,(y-piv[1]))/ln)
                if 0<=ox+pad<W and 0<=oy+pad<H: out[oy+pad][ox+pad]=self.g[y][x]
        # tapar las rendijas que abren las piezas al moverse (copia el vecino)
        for _ in range(3):
            for y in range(1,H-1):
                for x in range(1,W-1):
                    if out[y][x]: continue
                    l,r,u,d=out[y][x-1],out[y][x+1],out[y-1][x],out[y+1][x]
                    if l and r: out[y][x]=l
                    elif u and d and (l or r): out[y][x]=u
        # píxeles sueltos (sin vecinos): fuera
        for y in range(H):
            for x in range(W):
                if out[y][x] and not any(0<=y+dy<H and 0<=x+dx<W and out[y+dy][x+dx] for dx,dy in((1,0),(-1,0),(0,1),(0,-1))):
                    out[y][x]=None
        return out
def save_frames(frames, scale, path, bg=(233,226,210), dur=90):
    ims=[]
    for f in frames:
        h=len(f); w=len(f[0]); im=Image.new('RGB',(w,h),bg)
        for y in range(h):
            for x in range(w):
                if f[y][x]: im.putpixel((x,y),tuple(int(f[y][x][i:i+2],16) for i in (1,3,5)))
        ims.append(im.resize((w*scale,h*scale),Image.NEAREST))
    ims[0].save(path,save_all=True,append_images=ims[1:],duration=dur,loop=0,disposal=2)
    return ims
