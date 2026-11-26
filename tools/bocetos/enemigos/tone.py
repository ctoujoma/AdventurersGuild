"""Sprites por tonos: cada dígito es un escalón de la rampa; las letras, colores sueltos.
El contorno selectivo se calcula: un escalón (arriba) o dos (abajo) más oscuro que lo de al lado."""
from PIL import Image
def build(rows, ramp, extra, outline_dark='#120f1c'):
    w=max(len(r) for r in rows); h=len(rows)
    grid=[[None]*(w+2) for _ in range(h+2)]
    for y,r in enumerate(rows):
        for x,c in enumerate(r):
            if c!=' ' and c!='.': grid[y+1][x+1]=c
    out=[[None]*(w+2) for _ in range(h+2)]
    def col(c):
        if c.isdigit(): return ramp[int(c)]
        return extra[c]
    for y in range(h+2):
        for x in range(w+2):
            c=grid[y][x]
            if c: out[y][x]=col(c); continue
            # contorno: mirar vecinos
            nb=[(grid[y+dy][x+dx],dy) for dx,dy in ((0,1),(0,-1),(1,0),(-1,0)) if 0<=y+dy<h+2 and 0<=x+dx<w+2 and grid[y+dy][x+dx]]
            if not nb: continue
            best=None
            for c2,dy in nb:
                if c2.isdigit():
                    # dy=1: el relleno está debajo (borde de arriba, con luz): un escalón; si no, dos o tres
                    k=int(c2)-(2 if dy==1 else 4)
                    k=max(0,k)
                    cc=ramp[k] if k>0 else outline_dark
                else: cc=outline_dark
                if best is None or (dy!=1): best=cc
            out[y][x]=best
    return out
def save(img, scale, path, bg=(233,226,210)):
    h=len(img); w=len(img[0])
    im=Image.new('RGB',(w,h),bg)
    for y in range(h):
        for x in range(w):
            c=img[y][x]
            if c: im.putpixel((x,y),tuple(int(c[i:i+2],16) for i in (1,3,5)))
    im.resize((w*scale,h*scale),Image.NEAREST).save(path)
