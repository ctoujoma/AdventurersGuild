import calco2 as C, json
from boca_limpia import limpia, sanea
from PIL import Image
import numpy as np
COLS={'ojo':'#fee761','diente':'#e8e0d0','encia':'#d07888','rojo':'#9a2c40','boca':'#3a0c1c'}
I2='../../images/2.webp'; I4='../../images/4.webp'
AN={
 'huargo':dict(src=I4,bg=(231,225,207),w=54,red=(30,0.25),
   ramp=['#0e0b18','#191a30','#232a48','#2f3a60','#3e4c78','#566694','#7a88b0'],
   boxes=[(58,55,351,252),(432,61,734,257),(821,55,1138,257),(99,359,453,563),(704,354,1068,554),(92,652,454,858),(613,680,882,858),(908,680,1176,858)],
   scale=[1,1,1,1,1,1,(882-613)/(351-58),(882-613)/(351-58)]),
 'oso':dict(src=I2,bg=(234,226,206),w=40,red=(4,0.6),
   ramp=['#1a0f10','#2e1a16','#4a2a1e','#663a24','#85502e','#a6683a','#c4874e'],
   boxes=[(709,100,859,212),(708,320,861,436),(711,539,864,660),(722,774,869,884)]),
 'jabali':dict(src=I2,bg=(234,226,206),w=34,red=(4,0.6),
   ramp=['#140c0c','#2a1812','#43261a','#5e3722','#7a4c2e','#97653e','#b88454'],
   boxes=[(494,139,595,213),(494,362,597,437),(495,580,606,660)]),
 'lobo':dict(src=I2,bg=(234,226,206),w=30,red=(30,0.25),
   ramp=['#14141e','#2c3040','#454c60','#626a7e','#848c9e','#a8afbe','#cdd2dc'],
   boxes=[(15,171,76,212),(15,396,76,436),(15,620,75,660),(18,842,80,884)]),
}
out={}
for name,a in AN.items():
    C.RED=a['red']
    arr=np.array(Image.open(a['src']).convert('RGB')).astype(int)
    b0=a['boxes'][0]; k0=(b0[2]-b0[0])/a['w']
    if name=='lobo': k0=(76-15)/a['w']  # el que corre manda la escala
    fr=[]; cuts=None
    for i,b in enumerate(a['boxes']):
        k=k0*a.get('scale',[1]*9)[i]
        b2=(b[0]-3,b[1]-3,b[2]+3,b[3]+3)
        best=C.mejor_rejilla(arr,b2,[k])
        g=C.calco(a['src'],b2,k,best[2],best[3],a['ramp'],COLS,cuts=cuts,bg=a['bg'])
        cuts=C.calco.cuts
        if name in('oso','jabali'):
            g=[[(a['ramp'][0] if c=='#fee761' else c) for c in r] for r in g]
        R=a['ramp']; z=max(10,len(g[0])//3)
        g=sanea(limpia(sanea(g,z,R),zona=z,gap=2,ramp=R),z,R) if name in('huargo','oso','lobo') else sanea(g,z,R)
        # recorta filas/columnas vacías
        ys=[y for y,r in enumerate(g) if any(r)]; xs=[x for x in range(len(g[0])) if any(r[x] for r in g)]
        g=[r[xs[0]:xs[-1]+1] for r in g[ys[0]:ys[-1]+1]]
        fr.append(g)
    out[name]=fr
    print(name,[(len(g[0]),len(g)) for g in fr])
json.dump(out,open('bosque_calco.json','w'))
# hoja ×4
rows=[]
for name,fr in out.items():
    H=max(len(g) for g in fr); Wt=sum(len(g[0])+4 for g in fr)
    im=Image.new('RGB',(Wt,H+4),(233,226,210)); x0=2
    for g in fr:
        for y,r in enumerate(g):
            for x,c in enumerate(r):
                if c: im.putpixel((x0+x,2+H-len(g)+y),tuple(int(c[j:j+2],16) for j in(1,3,5)))
        x0+=len(g[0])+4
    rows.append(im)
sh=Image.new('RGB',(max(r.width for r in rows),sum(r.height for r in rows)),(233,226,210)); y=0
for r in rows: sh.paste(r,(0,y)); y+=r.height
sh.save('bosque_calco1.png'); sh.resize((sh.width*4,sh.height*4),Image.NEAREST).save('bosque_calco4.png')
