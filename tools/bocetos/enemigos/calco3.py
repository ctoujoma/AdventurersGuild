"""Calco a color para referencias con su propia paleta (sanguijuela, gigante, dragón): cada celda
de la rejilla del tamaño de juego toma la mediana de sus píxeles que no son fondo; luego la
criatura entera se reduce a pocos colores (k-medias) y el borde de la silueta se oscurece."""
import colorsys
import numpy as np
from PIL import Image

def celdas(a, box, k, bg, thr=40, drop=None, acc=None):
    x0, y0, x1, y1 = box
    W = int((x1 - x0) / k); H = int((y1 - y0) / k)
    g = [[None] * W for _ in range(H)]
    for j in range(H):
        for i in range(W):
            sx = x0 + i * k; sy = y0 + j * k
            c = a[int(sy):int(sy + k), int(sx):int(sx + k)].reshape(-1, 3)
            fg = c[np.abs(c - bg).sum(1) > thr]
            if drop is not None and len(fg):
                fg = np.array([p for p in fg if not drop(p)]).reshape(-1, 3)
            if len(fg) < 0.45 * len(c): continue
            g[j][i] = np.median(fg, axis=0)
            # detalles pequeños (los ojos rojos): bastan unos pocos píxeles muy marcados
            if acc and sum(1 for p in fg if acc[0](p)) >= acc[2]: g[j][i] = ('acc', acc[1])
    # solo los trozos grandes (fuera los pedazos de los vecinos en hojas apretadas)
    seen = set(); comps = []
    for j in range(H):
        for i in range(W):
            if g[j][i] is None or (i, j) in seen: continue
            st = [(i, j)]; seen.add((i, j)); comp = []
            while st:
                x, y = st.pop(); comp.append((x, y))
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        q = (x + dx, y + dy)
                        if 0 <= q[0] < W and 0 <= q[1] < H and q not in seen and g[q[1]][q[0]] is not None:
                            seen.add(q); st.append(q)
            comps.append(comp)
    big = max(len(c) for c in comps)
    for c in comps:
        if len(c) < 0.12 * big:
            for x, y in c: g[y][x] = None
    # sueltos fuera
    for j in range(H):
        for i in range(W):
            if g[j][i] is not None and sum(1 for dx, dy in ((1,0),(-1,0),(0,1),(0,-1))
                    if 0 <= i+dx < W and 0 <= j+dy < H and g[j+dy][i+dx] is not None) <= 1:
                g[j][i] = None
    return g

def kmedias(px, n, it=30, seed=1):
    rng = np.random.default_rng(seed)
    px = np.array(px, float)
    # semillas repartidas por luminancia
    lum = px @ [0.3, 0.59, 0.11]; order = np.argsort(lum)
    cen = px[order[np.linspace(0, len(px) - 1, n).astype(int)]].copy()
    for _ in range(it):
        d = ((px[:, None, :] - cen[None]) ** 2).sum(2); lab = d.argmin(1)
        for c in range(n):
            if (lab == c).any(): cen[c] = px[lab == c].mean(0)
    return cen

def hexc(c): return '#%02x%02x%02x' % tuple(int(round(max(0, min(255, v)))) for v in c)

def criatura(src, boxes, k, n, bg, thr=40, drop=None, edge=0.55, keep=(), acc=None, lift=1.0, split=False):
    """keep: colores fijos (hex) que se respetan si una celda se parece (ojos, fuego)."""
    imgs = {}
    def img(p):
        if p not in imgs: imgs[p] = np.array(Image.open(p).convert('RGB')).astype(int)
        return imgs[p]
    bg = np.array(bg)
    # una caja es (x0, y0, x1, y1) de `src`, o (otra imagen, x0, y0, x1, y1, su k): así los
    # fotogramas de varias hojas comparten paleta
    grids = [celdas(img(src), b, k, bg, thr, drop, acc) if len(b) == 4
             else celdas(img(b[0]), b[1:5], b[5], bg, thr, drop, acc) for b in boxes]
    px = [c for g in grids for r in g for c in r if c is not None and not isinstance(c, tuple)]
    if split:  # dos familias de color (la sanguijuela verde y roja): sin medias entre ellas
        rd = [c for c in px if c[0] > c[1] + 12]; gr = [c for c in px if not c[0] > c[1] + 12]
        cen = np.vstack([kmedias(rd, max(2, n * len(rd) // len(px))), kmedias(gr, n - max(2, n * len(rd) // len(px)))])
    else:
        cen = kmedias(px, n)
    # borde: versión oscura del más oscuro de la paleta
    # lift > 1 aclara y separa los tonos medios (las criaturas oscuras se empastan al reducir)
    cen = 255 * (cen / 255) ** (1 / lift)
    pal = sorted(cen.tolist(), key=lambda c: c[0]*0.3 + c[1]*0.59 + c[2]*0.11)
    fixed = [np.array([int(h[i:i+2], 16) for i in (1, 3, 5)]) for h in keep]
    out = []
    for g in grids:
        H, W = len(g), len(g[0])
        o = [[None] * W for _ in range(H)]
        for j in range(H):
            for i in range(W):
                c = g[j][i]
                if c is None: continue
                if isinstance(c, tuple): o[j][i] = c[1]; continue
                e = any(not (0 <= i+dx < W and 0 <= j+dy < H) or g[j+dy][i+dx] is None
                        for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)))
                best = min(range(len(pal)), key=lambda q: ((np.array(pal[q]) - c) ** 2).sum())
                for f in fixed:
                    if ((f - c) ** 2).sum() < ((np.array(pal[best]) - c) ** 2).sum() * 0.6:
                        o[j][i] = hexc(f); break
                else:
                    o[j][i] = hexc(np.array(pal[best]) * edge) if e else hexc(pal[best])
        ys = [y for y, r in enumerate(o) if any(r)]
        xs = [x for x in range(W) if any(r[x] for r in o)]
        out.append([r[xs[0]:xs[-1] + 1] for r in o[ys[0]:ys[-1] + 1]])
    return out

def hoja(frames_by, path, esc=4, fondo=(233, 226, 210)):
    rows = []
    for fr in frames_by.values():
        H = max(len(g) for g in fr); Wt = sum(len(g[0]) + 4 for g in fr)
        im = Image.new('RGB', (Wt, H + 4), fondo); x0 = 2
        for g in fr:
            for y, r in enumerate(g):
                for x, c in enumerate(r):
                    if c: im.putpixel((x0 + x, 2 + H - len(g) + y), tuple(int(c[j:j+2], 16) for j in (1, 3, 5)))
            x0 += len(g[0]) + 4
        rows.append(im)
    sh = Image.new('RGB', (max(r.width for r in rows), sum(r.height for r in rows)), fondo); y = 0
    for r in rows: sh.paste(r, (0, y)); y += r.height
    sh.save(path.replace('.png', '1.png'))
    sh.resize((sh.width * esc, sh.height * esc), Image.NEAREST).save(path)
