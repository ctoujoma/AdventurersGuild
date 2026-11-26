from calco import calco, save
RAMP=['#0e0b18','#191a30','#232a48','#2f3a60','#3e4c78','#566694','#7a88b0']
SP=[(lambda h,s,v: 40<=h<=70 and s>0.45 and v>0.6,'#fee761'),
    (lambda h,s,v: s<0.25 and v>0.72,'#e8e0d0'),
    (lambda h,s,v: (h<20 or h>330) and s>0.35 and v>0.35,'#b0303c')]
g=calco('/tmp/claude-0/-home-user-AdventurersGuild/40ff8843-c43b-5ced-88ab-6b5c5084b85c/images/2.webp',(925,62,1155,218),90,RAMP,SP)
save(g,8,'huargo_calco.png'); save(g,3,'huargo_calco3.png')
import json; json.dump(g,open('huargo_calco.json','w'))
