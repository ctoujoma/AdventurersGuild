import json
from PIL import Image
from calco import save
g=json.load(open('huargo_calco.json')); H=len(g); W=len(g[0]); k=230/90
C={'o':'#0e0b18','g':'#8e3042','G':'#c25a6a','w':'#e2cfbf','W':'#a88f88','m':'#3a1020','y':'#fee761','Y':'#c8a040','2':'#232a48'}
def S(x,y,s):
    for i,ch in enumerate(s):
        if ch!='_': g[y][x+i]=C[ch]
S(74,19,'oo'); S(74,20,'oyY'); S(84,20,'Y')
S(75,24,'ooo')
S(75,25,'ogGooo')
S(75,26,'ogwWgooo')
S(76,27,'owwWwgooo')
S(77,28,'oWwwWwwgo')
S(78,29,'omWwwWwwo')
S(79,30,'ommwmwo')
S(80,31,'ooooo')
json.dump(g,open('huargo_boca7.json','w'))
save(g,8,'huargo_boca7_full.png')
a=Image.open('huargo_boca7_full.png').crop((568,112,712,272))
ref=Image.open('/tmp/claude-0/-home-user-AdventurersGuild/40ff8843-c43b-5ced-88ab-6b5c5084b85c/images/2.webp').convert('RGB')
rx0=925+(71-1)*k; ry0=62+(14-1)*k; rx1=925+(89-1)*k; ry1=62+(34-1)*k
r=ref.crop((int(rx0),int(ry0),int(rx1),int(ry1))).resize(a.size,Image.NEAREST)
o=Image.new('RGB',(a.width*2+10,a.height),(255,255,255)); o.paste(r,(0,0)); o.paste(a,(a.width+10,0))
o.resize((o.width*2,o.height*2),Image.NEAREST).save('boca7_cmp.png')
# y a tamaño real (×3) entero, para juzgar como se verá
full=Image.open('huargo_boca7_full.png'); full.resize((full.width*3//8,full.height*3//8),Image.NEAREST).save('huargo_boca7_x3.png')
