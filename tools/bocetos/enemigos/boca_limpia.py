"""Limpia la boca calcada: región de boca (dientes, encía, rojo, interior y huecos que encierra)
y la redibuja por columnas: dientes arriba (con huecos), colmillo delante, interior oscuro,
lengua al fondo, dientes abajo, labio oscuro alrededor."""
RAMP=['#0e0b18','#191a30','#232a48','#2f3a60','#3e4c78','#566694','#7a88b0']
W_,P_,R_,M_='#e8e0d0','#d07888','#9a2c40','#3a0c1c'
SPEC={W_,P_,R_,M_}
def limpia(g, zona=26, gap=3, opts=None, ramp=RAMP):
    o=opts or {}
    H=len(g); W=len(g[0]); xa=W-zona
    R=set((x,y) for y in range(H) for x in range(xa,W) if g[y][x] in SPEC)
    if not R: return g
    # rellenar huecos encerrados (fondo o pelo suelto) entre celdas de boca
    for _ in range(3):
        add=set()
        for y in range(H):
            for x in range(xa,W):
                if (x,y) in R: continue
                l=any((x-d,y) in R for d in(1,2)); r=any((x+d,y) in R for d in(1,2))
                u=any((x,y-d) in R for d in(1,2)); dn=any((x,y+d) in R for d in(1,2))
                n4=sum((x+dx,y+dy) in R for dx,dy in((1,0),(-1,0),(0,1),(0,-1)))
                if (l and r and (u or dn)) or (u and dn and (l or r)) or n4>=3: add.add((x,y))
        R|=add
    # quitar islas de 1-2 celdas
    def comp(s):
        s=set(s); out=[]
        while s:
            st=[s.pop()]; c=set(st)
            while st:
                x,y=st.pop()
                for dx,dy in((1,0),(-1,0),(0,1),(0,-1)):
                    q=(x+dx,y+dy)
                    if q in s: s.remove(q); c.add(q); st.append(q)
            out.append(c)
        return out
    R=set().union(*[c for c in comp(R) if len(c)>=4]) if R else R
    if not R: return g
    g=[row[:] for row in g]
    xs=sorted(set(x for x,_ in R)); front=max(xs); back=min(xs)
    for x in xs:
        col=sorted(y for (xx,y) in R if xx==x); yt=col[0]; yb=col[-1]; n=yb-yt+1
        k=front-x  # distancia a la punta
        for y in col: g[y][x]=M_
        if n>=2:
            g[yt][x]=W_ if (k%gap)!=gap-1 else M_
            g[yb][x]=W_ if (k%gap)!=1 else M_
        else:
            g[yt][x]=W_ if k%2==0 else P_
        if n>=4 and x<back+(front-back)*0.6: g[yb-1][x]=R_; g[yb][x]=R_ if k%gap==1 else W_
        if n>=6 and x<back+(front-back)*0.5:
            for y in range(yb-2,yb): g[y][x]=R_
        if x==back: 
            for y in col: g[y][x]=P_ if n<3 else R_
    # colmillos: 2.ª columna desde la punta, arriba y abajo más largos
    fx=o.get('colmillo',2)
    for x in (front-fx,):
        col=sorted(y for (xx,y) in R if xx==x)
        if len(col)>=3: g[col[1]][x]=W_
        if len(col)>=5: g[col[-2]][x]=W_
    # labio: fondo junto a la boca -> contorno
    for (x,y) in list(R):
        for dx,dy in((1,0),(-1,0),(0,1),(0,-1),(1,1),(1,-1)):
            q=(x+dx,y+dy)
            if 0<=q[0]<W and 0<=q[1]<H and q not in R and g[q[1]][q[0]] is None: g[q[1]][q[0]]=ramp[0]
    return g
def sanea(g, zona=26, ramp=RAMP):
    """Huecos de fondo encerrados -> pelo; rojos/blancos sueltos fuera de la boca -> pelo o contorno."""
    H=len(g); W=len(g[0])
    out=set(); st=[(x,y) for x in range(W) for y in (0,H-1)]+[(x,y) for y in range(H) for x in (0,W-1)]
    st=[p for p in st if g[p[1]][p[0]] is None]
    out=set(st)
    while st:
        x,y=st.pop()
        for dx,dy in((1,0),(-1,0),(0,1),(0,-1)):
            q=(x+dx,y+dy)
            if 0<=q[0]<W and 0<=q[1]<H and q not in out and g[q[1]][q[0]] is None: out.add(q); st.append(q)
    g=[row[:] for row in g]
    def fur(x,y):
        from collections import Counter
        c=Counter(g[y+dy][x+dx] for dx in(-1,0,1) for dy in(-1,0,1) if 0<=x+dx<W and 0<=y+dy<H and g[y+dy][x+dx] in ramp[1:])
        return c.most_common(1)[0][0] if c else ramp[2]
    for y in range(H):
        for x in range(W):
            if g[y][x] is None and (x,y) not in out: g[y][x]=fur(x,y)
    for y in range(H):
        for x in range(W):
            c=g[y][x]
            if c in SPEC:
                n=sum(1 for dx,dy in((1,0),(-1,0),(0,1),(0,-1)) if 0<=x+dx<W and 0<=y+dy<H and g[y+dy][x+dx] in SPEC)
                if n==0 or x<W-zona:
                    edge=any(not(0<=x+dx<W and 0<=y+dy<H) or g[y+dy][x+dx] is None for dx,dy in((1,0),(-1,0),(0,1),(0,-1)))
                    g[y][x]=ramp[0] if edge else fur(x,y)
    return g
