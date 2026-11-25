import calco2 as C, json
from PIL import Image
RAMP=['#0e0b18','#191a30','#232a48','#2f3a60','#3e4c78','#566694','#7a88b0']
COLS={'ojo':'#fee761','diente':'#e8e0d0','encia':'#d07888','rojo':'#9a2c40','boca':'#3a0c1c'}
SRC='../../images/4.webp'
B=[(58,55,351,252),(432,61,734,257),(821,55,1138,257),(99,359,453,563),(704,354,1068,554),(92,652,454,858),(613,680,882,858),(908,680,1176,858)]
import numpy as np
a=np.array(Image.open(SRC).convert('RGB')).astype(int)
fr=[];info=[]
for i,b in enumerate(B):
    b2=(b[0]-4,b[1]-4,b[2]+4,b[3]+4)
    kk=3.2 if i<6 else 3.2*(882-613)/(351-58); best=C.mejor_rejilla(a,b2,[kk])
    info.append(best); print(i,best)
    fr.append(C.calco(SRC,b2,best[1],best[2],best[3],RAMP,COLS))
json.dump(fr,open('huargo10.json','w'))
H=max(len(g) for g in fr); Wm=max(len(g[0]) for g in fr)
sheet=Image.new('RGB',((Wm+4)*4,(H+4)*2),(231,225,207))
for i,g in enumerate(fr):
    for y,row in enumerate(g):
        for x,c in enumerate(row):
            if c: sheet.putpixel(((i%4)*(Wm+4)+2+x,(i//4)*(H+4)+2+H-len(g)+y),tuple(int(c[j:j+2],16) for j in(1,3,5)))
sheet.resize((sheet.width*4,sheet.height*4),Image.NEAREST).save('huargo10_4.png'); sheet.save('huargo10_1.png')
