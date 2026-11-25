from calco import calco, save
import json
RAMP=['#1a0f10','#2e1a16','#4a2a1e','#663a24','#85502e','#a6683a','#c4874e']
g=calco('/tmp/claude-0/-home-user-AdventurersGuild/40ff8843-c43b-5ced-88ab-6b5c5084b85c/images/2.webp',(705,95,862,213),66,RAMP,None)
H=len(g); W=len(g[0])
json.dump(g,open('oso_calco.json','w'))
save(g,8,'oso_calco.png')
for y,r in enumerate(g):
  s=''.join(' ' if c is None else str(RAMP.index(c)) for c in r)
  print(f'{y:02d}',s)
