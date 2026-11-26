import json, math
from rig import Rig, save_frames
g=json.load(open('huargo_final.json'))
PARTS={
 'mandibula':{'poly':[(76,29),(88,28),(88,35),(77,35)],'pivot':(76,29),'mouth':('#2a0a16','#b04858')},
 'cabeza':{'poly':[(67,5),(91,5),(91,40),(74,40),(67,28)],'pivot':(68,26)},
 'cola':{'poly':[(0,17),(21,17),(21,39),(0,39)],'pivot':(21,28),'len':20},
 'tras_cerca':{'poly':[(14,41),(32,41),(29,48),(27,64),(13,64)],'pivot':(24,40),'len':20},
 'tras_lejos':{'poly':[(31,41),(46,41),(47,61),(31,61)],'pivot':(38,40),'len':18},
 'del_cerca':{'poly':[(45,39),(58,39),(63,64),(46,64)],'pivot':(52,38),'len':22},
 'del_lejos':{'poly':[(59,39),(70,39),(84,62),(63,62)],'pivot':(64,38),'len':20},
}
ORDER=['tras_lejos','del_lejos','cola','cuerpo','cabeza','mandibula','tras_cerca','del_cerca']
r=Rig(g,PARTS,ORDER)
_frame=r.frame
def frame(p):
    p=dict(p); h=p.get('cabeza',{}); j=p.pop('jaw',0)
    p['mandibula']={'dx':h.get('dx',0),'dy':h.get('dy',0),'vshear':j}
    return _frame(p)
r.frame=frame
def walk(i,n=8):
    ph=2*math.pi*i/n; out={}
    for name,off in (('tras_cerca',0),('del_lejos',0),('tras_lejos',math.pi),('del_cerca',math.pi)):
        s=math.sin(ph+off); c=math.cos(ph+off)
        out[name]={'shear':0.22*s,'lift':3 if c>0.3 else 0}
    bob=round(abs(math.sin(ph))*1)
    out['cuerpo']={'dy':-bob}
    out['cabeza']={'dy':bob}
    out['cola']={'vshear':0.06*math.sin(ph)}
    return out
frames=[r.frame(walk(i)) for i in range(8)]
save_frames(frames,3,'huargo_andar.gif',dur=110)
# respirar (quieto): la cola se mece y el pecho sube y baja
idle=[r.frame({'cuerpo':{'dy':-(i%4==1 or i%4==2)},'cola':{'vshear':0.05*math.sin(i/8*2*math.pi)},'cabeza':{'dy':0}}) for i in range(8)]
save_frames(idle,3,'huargo_quieto.gif',dur=160)
# ataque: quieto, agacharse, embestida, golpe, volver
att=[]
P=lambda **k:k
seq=[
 {},
 {'cuerpo':{'dy':2,'dx':-2},'cabeza':{'dy':1,'dx':0},'cola':{'vshear':-0.1},'del_cerca':{'shear':+0.1},'del_lejos':{'shear':+0.1},'tras_cerca':{'shear':-0.15},'tras_lejos':{'shear':-0.15}},
 {'jaw':0.15,'cuerpo':{'dy':3,'dx':-3},'cabeza':{'dy':2,'dx':-1},'cola':{'vshear':-0.14},'del_cerca':{'shear':+0.15},'del_lejos':{'shear':+0.15},'tras_cerca':{'shear':-0.2},'tras_lejos':{'shear':-0.2}},
 {'jaw':0.6,'cuerpo':{'dy':-2,'dx':5},'cabeza':{'dy':-1,'dx':1},'cola':{'vshear':0.12},'del_cerca':{'shear':+0.35,'lift':4},'del_lejos':{'shear':+0.4,'lift':5},'tras_cerca':{'shear':-0.3},'tras_lejos':{'shear':-0.3}},
 {'jaw':0.0,'cuerpo':{'dy':0,'dx':7},'cabeza':{'dy':1,'dx':1},'cola':{'vshear':0.08},'del_cerca':{'shear':+0.25},'del_lejos':{'shear':+0.3},'tras_cerca':{'shear':-0.35},'tras_lejos':{'shear':-0.35}},
 {'cuerpo':{'dx':4},'cabeza':{'dx':1},'tras_cerca':{'shear':-0.15},'tras_lejos':{'shear':-0.15}},
 {'cuerpo':{'dx':1}},
]
att=[r.frame(p) for p in seq]
save_frames(att,3,'huargo_ataque.gif',dur=[300,140,140,90,220,140,200])
# herido: retrocede y levanta la cabeza
hurt=[r.frame({'cuerpo':{'dx':-3,'dy':-1},'cabeza':{'dy':-3,'dx':-1},'cola':{'vshear':-0.08},'del_cerca':{'shear':0.15},'del_lejos':{'shear':0.15}})]
json.dump({'andar':frames,'quieto':idle,'ataque':att,'herido':hurt},open('huargo_frames.json','w'))
print('ok')
