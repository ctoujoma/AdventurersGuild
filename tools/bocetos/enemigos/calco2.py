"""Calco por celdas: rejilla nativa de la referencia (paso y fase buscados), cada celda por
mayoría de clase (fondo, ojo, diente, encía, boca, pelo) y el pelo por luminancia mediana."""
import colorsys
from PIL import Image
from collections import Counter
import numpy as np
BG=np.array((231,225,207))
def clase(p):
    r,g,b=p
    if abs(r-BG[0])+abs(g-BG[1])+abs(b-BG[2])<60: return 'bg'
    h,s,v=colorsys.rgb_to_hsv(r/255,g/255,b/255); h*=360
    if 30<=h<=90 and s>0.12 and v>0.55: return 'ojo'
    if v>0.68 and s<0.32 and (h<30 or h>300): return 'diente'
    if (h<30 or h>300) and s>0.25:
        if v>0.62: return 'encia'
        if v>0.28: return 'rojo'
        return 'boca'
    return 'pelo'
def mejor_rejilla(a,box,ks):
    x0,y0,x1,y1=box; best=None
    for k in ks:
        for ox in np.arange(0,k,0.5):
            for oy in np.arange(0,k,0.5):
                err=0;n=0
                for cy in np.arange(y0+oy,y1-k,k*3):
                    for cx in np.arange(x0+ox,x1-k,k*3):
                        c=a[int(cy):int(cy+k),int(cx):int(cx+k)].reshape(-1,3)
                        if len(c): err+=c.std(axis=0).sum(); n+=1
                e=err/max(n,1)
                if best is None or e<best[0]: best=(e,k,ox,oy)
    return best
def calco(src,box,k,ox,oy,ramp,cols,levels=None):
    a=np.array(Image.open(src).convert('RGB')).astype(int)
    x0,y0,x1,y1=box
    W=int((x1-x0-ox)/k); H=int((y1-y0-oy)/k)
    cls=[[None]*W for _ in range(H)]; lum={}
    for j in range(H):
        for i in range(W):
            sx=x0+ox+i*k; sy=y0+oy+j*k
            c=a[int(sy+0.6):int(sy+k-0.6), int(sx+0.6):int(sx+k-0.6)].reshape(-1,3)
            cl=Counter(clase(p) for p in c)
            v,n=cl.most_common(1)[0]
            # especiales con menos votos (detalles pequeños)
            for sp,th in(('ojo',0.25),('diente',0.4),('encia',0.4),('rojo',0.4),('boca',0.4)):
                if cl[sp]>=th*len(c) and v=='pelo': v=sp
            if v=='bg': continue
            cls[j][i]=v
            if v=='pelo':
                ps=[p for p in c if clase(p)=='pelo']
                lum[(i,j)]=float(np.median([0.3*p[0]+0.59*p[1]+0.11*p[2] for p in ps]))
    # sueltos
    for j in range(H):
        for i in range(W):
            if cls[j][i] and sum(1 for dx,dy in((1,0),(-1,0),(0,1),(0,-1)) if 0<=i+dx<W and 0<=j+dy<H and cls[j+dy][i+dx])<=1: cls[j][i]=None; lum.pop((i,j),None)
    vals=sorted(lum.values()); n=len(ramp)-1
    qs=levels or [i/n for i in range(1,n)]
    cuts=[vals[int(q*(len(vals)-1))] for q in qs]
    g=[[None]*W for _ in range(H)]
    for j in range(H):
        for i in range(W):
            v=cls[j][i]
            if v is None: continue
            if v=='pelo':
                t=1+sum(1 for c in cuts if lum[(i,j)]>c)
                edge=any(not(0<=i+dx<W and 0<=j+dy<H) or cls[j+dy][i+dx] is None for dx,dy in((1,0),(-1,0),(0,1),(0,-1)))
                g[j][i]=ramp[0] if edge else ramp[t]
            else: g[j][i]=cols[v]
    return g
