"""Prueba de estilo «Cast n Chill» para el fondo del Jarro: paisaje procedural a 480x270.

Capas de atrás adelante: cielo en bandas, nubes con luz de volumen, montes con nieve, bruma,
bosques lejanos y cercanos (coníferas por pisos y árboles de otoño), la taberna en la orilla,
el lago con el reflejo roto en franjas y el primer plano oscuro que enmarca.
Uso: python3 paisaje.py <salida> <hora> [semilla]
"""

import sys
import numpy as np
from PIL import Image

W, H = 560, 270  # se pinta más ancho que la vista para el paralaje
VIEW, PAN = 480, 80
WATER = 196  # fila de la orilla


def hexc(s):
    s = s.lstrip('#')
    return np.array([int(s[i : i + 2], 16) for i in (0, 2, 4)], dtype=float)


def mix(a, b, t):
    t = np.asarray(t, dtype=float)
    return a + (b - a) * t[..., None] if t.ndim else a + (b - a) * t


# ---------------------------------------------------------------- ruido
class Noise:
    def __init__(self, seed):
        self.rng = np.random.default_rng(seed)

    def value(self, w, h, sx, sy, seed_off=0):
        gw, gh = int(w / sx) + 3, int(h / sy) + 3
        g = self.rng.random((gh, gw))
        ys = np.arange(h) / sy
        xs = np.arange(w) / sx
        y0 = ys.astype(int)
        x0 = xs.astype(int)
        fy = ys - y0
        fx = xs - x0
        fy = fy * fy * (3 - 2 * fy)
        fx = fx * fx * (3 - 2 * fx)
        a = g[y0][:, x0]
        b = g[y0][:, x0 + 1]
        c = g[y0 + 1][:, x0]
        d = g[y0 + 1][:, x0 + 1]
        top = a + (b - a) * fx[None]
        bot = c + (d - c) * fx[None]
        return top + (bot - top) * fy[:, None]

    def fbm(self, w, h, sx, sy, oct=4, gain=0.5):
        tot, amp, norm = np.zeros((h, w)), 1.0, 0.0
        for _ in range(oct):
            tot += amp * self.value(w, h, sx, sy)
            norm += amp
            amp *= gain
            sx, sy = max(sx / 2, 1), max(sy / 2, 1)
        return tot / norm

    def line(self, w, s, oct=5, gain=0.5):
        return self.fbm(w, 1, s, 1, oct, gain)[0]


# ---------------------------------------------------------------- horas
MOODS = {
    'otono': dict(  # tarde de otoño, cielo azul y nubes blancas (ref. 1 y 3)
        sky=['#5d86c9', '#7aa0d8', '#9cbbe3', '#bcd2ea', '#d6e2ee'],
        cloud=['#8794b8', '#a9b6d4', '#cdd8ec', '#eef3fa', '#ffffff'],
        cloud_style='cumulus',
        sun=(1.0, -0.6),
        haze='#b8c9df',
        mount=['#4c5a85', '#6a7aa3', '#8d9cc0', '#b7c3dc'],
        snow=['#9aa9cc', '#c9d4ea', '#f1f5fb'],
        far=['#7f8fae', '#94a2bd', '#aab5c8'],
        mid=['#5f6e5a', '#7d8263', '#a38c5d', '#c79a52'],
        near=['#2a3b2f', '#3c5236', '#5b6a3a', '#7f7a3f'],
        fall=['#5a2a1e', '#8e3a1c', '#c25a1e', '#e08a2a', '#f2b544', '#fbd77a'],
        water=['#8fa8cf', '#c9d8ee', '#ffffff'],
        dark='#1d2422',
        window='#ffd27a',
        wall=['#4a3a35', '#6e5547', '#94735a'],
        roof=['#3a2c33', '#5b3b3a', '#7d4a3d'],
        mist=0.0,
    ),
    'alba': dict(  # amanecer violeta con bruma (ref. 5)
        sky=['#b9a3c9', '#c8a8c6', '#d6b0c0', '#dfb9c0', '#e2c3c8'],
        cloud=['#8f7fae', '#a98bb6', '#d58aa6', '#f2a08f', '#ffc489'],
        cloud_style='streaks',
        sun=(-0.4, -1.0),
        haze='#b4a6cc',
        mount=['#7d79ab', '#918bba', '#a69fc7', '#bdb4d4'],
        snow=['#a59ec6', '#bdb5d7', '#d3cbe3'],
        far=['#7c6f9f', '#8a7ca8', '#9a8db3'],
        mid=['#6f5f8e', '#8a6b8c', '#b0788a', '#c99a86'],
        near=['#4b3e63', '#5e4a6b', '#7d5d6e', '#9b7468'],
        fall=['#5d3550', '#8c4652', '#c0624d', '#de8a4c', '#efb35a', '#f7d38a'],
        water=['#a99cc8', '#d8c2d6', '#f5e2e6'],
        dark='#352a45',
        window='#ffcf7e',
        wall=['#4b3c55', '#665066', '#856677'],
        roof=['#3b2e48', '#523a55', '#6c4a5f'],
        mist=1.0,
    ),
    'ocaso': dict(  # tormenta que se abre al ponerse el sol (ref. 2)
        sky=['#3e4f6f', '#56688a', '#8f8ea0', '#d8b47c', '#f3d48c'],
        cloud=['#2c3854', '#3f4e6e', '#6a6f86', '#c79a72', '#f6d08a'],
        cloud_style='streaks',
        sun=(0.0, 1.0),
        haze='#c9b58a',
        mount=['#3d4560', '#525a70', '#6f7180', '#9a927f'],
        snow=['#6c7189', '#8f8f97', '#c2b393'],
        far=['#4a4b55', '#5c5a5c', '#77705f'],
        mid=['#2f3333', '#3f4238', '#5a5440', '#7b6a45'],
        near=['#1b2224', '#252d2a', '#363a2e', '#4e4632'],
        fall=['#3a2420', '#5c2f22', '#8a4426', '#b5652e', '#d9923f', '#f0c063'],
        water=['#8a8c8f', '#e5c88a', '#fff0b8'],
        dark='#141a1c',
        window='#ffcf6a',
        wall=['#2d2b2f', '#423a38', '#5c4c42'],
        roof=['#24242c', '#3b2f33', '#5b3a33'],
        mist=0.35,
    ),
    'noche': dict(
        sky=['#151a33', '#1c2442', '#243055', '#2f3d66', '#3d4b74'],
        cloud=['#1c2340', '#26304f', '#36446a', '#5a6a92', '#8fa0c4'],
        cloud_style='streaks',
        sun=(-0.8, -0.6),
        haze='#2d3a5e',
        mount=['#1d2440', '#273152', '#344066', '#4a5880'],
        snow=['#3f4d78', '#6577a3', '#9fb0d4'],
        far=['#1f2846', '#253050', '#2c385a'],
        mid=['#18203a', '#1e2843', '#27324e', '#333d58'],
        near=['#10152a', '#151b32', '#1d243c', '#272d44'],
        fall=['#121729', '#1b2138', '#272b47', '#363852', '#4a465e', '#5f5868'],
        water=['#3b4a78', '#7b8fc4', '#c7d4f2'],
        dark='#0b0f1f',
        window='#ffb84a',
        wall=['#1b1e33', '#262a42', '#343852'],
        roof=['#141729', '#1d2034', '#2a2c42'],
        mist=0.4,
    ),
}


# ---------------------------------------------------------------- lienzo
class Canvas:
    def __init__(self):
        self.c = np.full((H, W, 3), -1.0)  # -1 = vacío (capa transparente)
        self.depth = np.zeros((H, W))  # 0 = cielo, 1 = primer plano

    def put(self, mask, col, depth=None):
        if col.ndim == 1:
            self.c[mask] = col
        else:
            self.c[mask] = col[mask]
        if depth is not None:
            self.depth[mask] = depth


def ramp(cols, t):
    """Color de una rampa por tramos, sin degradado dentro de cada tramo."""
    cols = [hexc(c) for c in cols]
    t = np.clip(t, 0, 0.9999)
    i = (t * len(cols)).astype(int)
    return np.stack(cols)[i]


def smooth_ramp(cols, t):
    cols = np.stack([hexc(c) for c in cols])
    t = np.clip(t, 0, 1) * (len(cols) - 1)
    i = np.minimum(t.astype(int), len(cols) - 2)
    f = t - i
    return cols[i] + (cols[i + 1] - cols[i]) * f[..., None]


def sky(cv, m, nz):
    yy = np.arange(H)[:, None] / WATER
    jag = nz.fbm(W, H, 40, 3, 3) - 0.5
    t = yy * 1.05 + jag * 0.09 + (nz.fbm(W, H, 120, 6, 2) - 0.5) * 0.12
    # Bandas de color con borde mellado: así se pinta un degradado en pixel art sin trama.
    cv.c[:] = ramp(m['sky'], t)


def clouds(cv, m, nz):
    yy, xx = np.mgrid[0:H, 0:W].astype(float)
    rng = np.random.default_rng(5)
    sx, sy = m['sun']
    if m['cloud_style'] == 'cumulus':
        # Cúmulos: bultos redondos con la base plana; densidad suma de esferas.
        perturb = nz.fbm(W, H, 4, 3, 2)
        dens = np.zeros((H, W))
        normal = np.zeros((H, W, 3))
        groups = [(60, 80, 1.0), (200, 60, 1.3), (380, 50, 1.1), (470, 95, 0.8), (290, 120, 0.7), (110, 135, 0.6)]
        if m is MOODS['ocaso']:
            groups = [(40, 60, 1.8), (150, 40, 1.6), (330, 50, 1.9), (450, 70, 1.6), (90, 150, 1.0), (420, 150, 1.0)]
        for gx, gy, sc in groups:
            n = int(30 * sc)
            for _ in range(n):
                bx = gx + rng.normal(0, 34 * sc)
                by = gy - abs(rng.normal(0, 10 * sc)) * (1 - abs(bx - gx) / (90 * sc))
                br = rng.uniform(4, 13) * sc * (1.2 - abs(bx - gx) / (110 * sc))
                if br < 2.5:
                    continue
                d = ((xx - bx) ** 2 + ((yy - by) * 1.15) ** 2) / br ** 2 + (perturb - 0.5) * 0.9
                a = np.clip(1 - d, 0, 1)
                base_cut = yy < gy + 6 * sc + (perturb - 0.5) * 5
                a = a * base_cut
                take = a > dens
                dens = np.where(take, a, dens)
                nzz = np.sqrt(a)
                nrm = np.stack([(xx - bx) / br, (yy - by) / br, nzz], -1)
                normal = np.where(take[..., None], nrm, normal)
        mask = dens > 0.02
        sl = np.array([sx, sy, 0.7])
        sl /= np.linalg.norm(sl)
        lam = normal @ sl
        cl = clump()
        v = 0.28 + lam * 0.62 + (cl - 0.5) * 0.22
        # Más oscuro abajo de cada grupo
        v -= np.clip((yy - 40) / 160, 0, 1) * 0.15
    else:
        d = nz.fbm(W, H, 120, 9, 5, 0.55)
        sh = nz.fbm(W, H, 160, 14, 4)
        env = np.exp(-(((yy - 40 - (xx - 240) * 0.08) / 45.0) ** 2))
        dens = (d * 0.6 + sh * 0.6) * env
        mask = dens > 0.42
        big = nz_blur(dens, 5)
        off = shift(big, int(sx * 6), int(sy * 6))
        light = np.clip((big - off) * 9 + 0.5, 0, 1)
        top = np.clip((dens - 0.42) * 6, 0, 1)
        v = light * 0.75 + (1 - top) * 0.25 + (nz.fbm(W, H, 6, 2, 2) - 0.5) * 0.15
    col = ramp(m['cloud'], v)
    cv.put(mask, col)


def nz_blur(a, r):
    out = a.copy()
    for _ in range(3):
        acc = np.zeros_like(out)
        for d in range(-r, r + 1):
            acc += np.roll(out, d, axis=1)
        out = acc / (2 * r + 1)
        acc = np.zeros_like(out)
        for d in range(-r, r + 1):
            acc += np.roll(out, d, axis=0)
        out = acc / (2 * r + 1)
    return out


def shift(a, dx, dy):
    return np.roll(np.roll(a, dy, axis=0), dx, axis=1)


def haze(cv, mask, m, amount):
    hz = hexc(m['haze'])
    cv.c[mask] = cv.c[mask] + (hz - cv.c[mask]) * amount[mask][..., None]


def mountains(cv, m, nz, rng, peaks, layer, hz_amt):
    """Picos uno a uno: cresta mellada, espinazo que separa la cara de luz de la de sombra,
    nieve por encima de una línea irregular y surcos a lo largo de cada ladera."""
    yy, xx = np.mgrid[0:H, 0:W].astype(float)
    sxs = m['sun'][0]
    for (px, py, wl, wr, base) in peaks:
        jag_l = (nz.line(W, 7, 3) - 0.5) * 6 + (nz.line(W, 30, 3) - 0.5) * 10
        jag_r = (nz.line(W, 7, 3) - 0.5) * 6 + (nz.line(W, 30, 3) - 0.5) * 10
        # Cresta: dos laderas con hombros.
        dl = np.clip((px - xx) / wl, 0, None)
        dr = np.clip((xx - px) / wr, 0, None)
        prof_l = py + (base - py) * (dl ** 0.8) + jag_l[None] * np.clip(dl * 3, 0, 1)
        prof_r = py + (base - py) * (dr ** 0.8) + jag_r[None] * np.clip(dr * 3, 0, 1)
        ridge = np.where(xx < px, prof_l, prof_r)
        mask = (yy >= ridge) & (yy < WATER)
        # Espinazo: baja del pico serpenteando; a su lado bajan otros espinazos menores.
        drift = (nz.line(H, 18, 3) - 0.5) * 30
        spine = px + drift[:, None] * np.clip((yy - py) / 40, 0, 1)
        left = xx < spine
        lit = ~left if sxs >= 0 else left
        # Surcos a lo largo de la ladera (coordenada girada).
        ang_l, ang_r = np.arctan2(base - py, wl), np.arctan2(base - py, wr)
        u_l = (xx - px) * np.sin(ang_l) + (yy - py) * np.cos(ang_l)
        u_r = -(xx - px) * np.sin(ang_r) + (yy - py) * np.cos(ang_r)
        u = np.where(left, u_l, u_r)
        g = streak_noise(u, nz) 
        sub = (nz.fbm(W, H, 14, 14, 3) - 0.5)
        tone = np.where(lit, 0.66, 0.3) + (g - 0.5) * 0.55 + sub * 0.25
        col = ramp(m['mount'], tone)
        snowline = py + (base - py) * (0.42 + (nz.line(W, 12, 3)[None] - 0.5) * 0.35) + (g - 0.5) * 22
        snowy = yy < snowline
        stone_in_snow = (g < 0.3) & (yy > py + 6)
        scol = ramp(m['snow'], np.where(lit, 0.8, 0.35) + (g - 0.5) * 0.35)
        col = np.where((snowy & ~stone_in_snow)[..., None], scol, col)
        cv.put(mask, col, 0.12 + layer * 0.04)
        amt = np.clip((yy - (py + (base - py) * 0.45)) / (base - py) * 1.2, 0, 1) * 0.7 + hz_amt
        amt = amt + (nz.fbm(W, H, 50, 6, 3) - 0.5) * 0.25
        haze(cv, mask, m, np.clip(amt, 0, 0.92))


def streak_noise(u, nz):
    """Ruido que corre a lo largo de la ladera: bandas finas de 2-3 px."""
    v = nz.fbm(512, 1, 5, 1, 3)[0]
    idx = np.clip((u * 0.9).astype(int) % 512, 0, 511)
    base = v[idx]
    return base * 0.7 + nz.fbm(W, H, 3, 12, 2) * 0.3


CLUMP = None


def clump():
    """Textura de grumos de 2 px para el follaje (se reutiliza en todos los árboles)."""
    global CLUMP
    if CLUMP is None:
        nz = Noise(99)
        CLUMP = nz.fbm(W, H, 2.2, 2.2, 2) * 0.6 + nz.fbm(W, H, 5, 4, 2) * 0.4
    return CLUMP


def paint(cv, ys, xs, vals, cs, depth):
    ok = (ys >= 0) & (ys < H) & (xs >= 0) & (xs < W)
    ys, xs, vals = ys[ok], xs[ok], vals[ok]
    i = np.clip((vals * len(cs)).astype(int), 0, len(cs) - 1)
    cv.c[ys, xs] = np.stack(cs)[i]
    cv.depth[ys, xs] = depth


def tones(cols, m, hz):
    hz_c = hexc(m['haze'])
    cs = [hexc(c) if isinstance(c, str) else c for c in cols]
    return [c + (hz_c - c) * hz for c in cs]


def conifer(cv, x, base, h, cols, m, rng, depth, w_scale=1.0, hz=0.0):
    """Abeto por pisos: ramas que caen y acaban en puntas, núcleo oscuro, grumos de luz
    del lado del sol. Nada de franjas regulares: cada piso tiene su alto y su ancho."""
    cs = tones(cols, m, hz)
    sun = 1 if m['sun'][0] >= 0 else -1
    x0, x1 = int(x - h * 0.45) - 3, int(x + h * 0.45) + 4
    y0, y1 = int(base - h), int(base + 1)
    yy, xx = np.mgrid[y0:y1, x0:x1]
    t = (yy - y0) / h
    # Pisos de alto desigual.
    n_t = max(3, int(h / (7 if h > 40 else 4.5)))
    cuts = np.sort(rng.uniform(0.04, 1.0, n_t))
    cuts = np.concatenate([[0.0], cuts, [1.0001]])
    k = np.searchsorted(cuts, t, side='right') - 1
    k = np.clip(k, 0, len(cuts) - 2)
    tt = (t - cuts[k]) / np.maximum(cuts[k + 1] - cuts[k], 1e-3)
    wob = rng.uniform(0.8, 1.2, len(cuts))[k]
    off = rng.uniform(-0.04, 0.04, len(cuts))[k] * h
    cone = (0.04 + t * 0.36 * w_scale) * h
    half = cone * (0.5 + 0.62 * tt ** 1.3) * wob
    cy_, cx_ = np.clip(yy, 0, H - 1), np.clip(xx, 0, W - 1)
    cl = clump()[cy_, cx_]
    dxr = xx - (x + off * t)
    # Puntas: la parte baja de cada piso se recorta en dientes que caen.
    teeth = (np.sin(dxr * 1.7 + k * 2.1) * 0.5 + 0.5) * (tt > 0.7) * 2.5
    inside = np.abs(dxr) <= half + (cl - 0.5) * 2.4 - teeth * (np.abs(dxr) > half * 0.5)
    inside |= (np.abs(dxr) < 0.7) & (t < 0.1)
    side = np.clip(dxr / (half + 0.5), -1, 1) * sun
    v = 0.36 + side * 0.3 + (cl - 0.5) * 0.55
    v += np.where(tt < 0.55, 0.1, -0.08)  # luz arriba de cada piso, sombra bajo la rama
    v -= np.clip(1 - np.abs(dxr) / (half * 0.35 + 0.6), 0, 1) * 0.22  # núcleo oscuro
    paint(cv, yy[inside], xx[inside], np.clip(v[inside], 0, 0.999), cs, depth)
    tr = int(max(1, h // 9))
    for kk in range(tr):
        if 0 <= base + kk < H and 0 <= int(x) < W:
            cv.c[base + kk, int(x)] = cs[0]


def leafy(cv, x, base, h, cols, m, rng, depth, hz=0.0, sun=(1, -0.6), trunk=None):
    """Árbol de hoja: racimos redondos con la luz de un lado; el grumo de 2 px da la hoja."""
    cs = tones(cols, m, hz)
    tr = hexc(trunk or m['near'][0])
    n_bl = int(4 + h / 5)
    cy = base - h * 0.6
    blobs = []
    for _ in range(n_bl):
        bx = x + rng.normal(0, h * 0.17)
        by = cy + rng.normal(0, h * 0.16)
        br = rng.uniform(h * 0.15, h * 0.24)
        blobs.append((bx, by, br))
    blobs.sort(key=lambda b: b[1] * 0 + (b[0] - x) * -sun[0] * 0 + b[1])
    # Tronco y ramas que asoman
    for row in range(int(h * 0.5)):
        y = base - row
        wdt = 1 if h < 40 else 2 if h < 90 else 3
        for dx in range(wdt):
            xx = int(x + dx - wdt // 2)
            if 0 <= y < H and 0 <= xx < W:
                cv.c[y, xx] = tr * (0.8 if dx == 0 else 1.0)
    sl = np.array(sun, float)
    sl /= np.linalg.norm(sl)
    for bx, by, br in sorted(blobs, key=lambda b: -b[1]):
        ri = int(br) + 3
        yy, xx = np.mgrid[int(by - ri) : int(by + ri) + 1, int(bx - ri) : int(bx + ri) + 1]
        cy_ = np.clip(yy, 0, H - 1)
        cx_ = np.clip(xx, 0, W - 1)
        cl = clump()[cy_, cx_]
        dx, dy = (xx - bx) / br, (yy - by) / br
        d = dx * dx + dy * dy
        inside = d < 1 + (cl - 0.5) * 0.9
        nz_ = np.sqrt(np.clip(1 - d, 0, 1))
        lam = dx * sl[0] + dy * sl[1] + nz_ * 0.35
        v = 0.38 + lam * 0.42 + (cl - 0.5) * 0.55
        # Sombra hacia abajo del racimo y hacia el centro del árbol.
        v -= np.clip(dy, 0, 1) * 0.12
        paint(cv, yy[inside], xx[inside], np.clip(v[inside], 0, 0.999), cs, depth)


def larch(cv, x, base, h, cols, m, rng, depth, hz=0.0):
    """Alerce de otoño: abeto ralo y amarillo (el de las referencias)."""
    conifer(cv, x, base, h, cols, m, rng, depth, w_scale=0.8, hz=hz)


def band(cv, m, nz, y0, amp, cols, depth, hz, s=60):
    r = y0 - nz.line(W, s, 5) * amp
    yy = np.arange(H)[:, None]
    mask = (yy >= r[None]) & (yy < WATER + 1)
    tex = nz.fbm(W, H, 5, 3, 2)
    col = ramp(cols, 0.3 + (tex - 0.5) * 0.9)
    cv.put(mask, col, depth)
    haze(cv, mask, m, np.full((H, W), hz))
    return r


def tavern(cv, m, x0, base, rng):
    """La taberna del Jarro en la orilla: dos plantas, tejado a dos aguas, ventanas encendidas."""
    wall, roof = [hexc(c) for c in m['wall']], [hexc(c) for c in m['roof']]
    win = hexc(m['window'])
    w, h = 34, 16
    sun = m['sun'][0]
    for y in range(base - h, base):
        for x in range(x0, x0 + w):
            plank = ((x - x0) % 3 == 0)
            i = 1 if not plank else 0
            if (x - x0) > w * 0.6 and sun > 0:
                i += 1
            cv.c[y, x] = wall[min(i, 2)]
    # tejado
    peak = base - h - 11
    for y in range(peak, base - h + 1):
        t = (y - peak) / 11
        half = int(4 + t * (w / 2 + 3))
        cx = x0 + w // 2
        for x in range(cx - half, cx + half + 1):
            right = x > cx
            i = 2 if (right == (sun > 0)) else 1
            if (y - peak) % 3 == 2:
                i -= 1
            cv.c[y, x] = roof[max(i, 0)]
    # chimenea
    for y in range(peak - 3, peak + 7):
        for x in range(x0 + 24, x0 + 27):
            cv.c[y, x] = roof[0]
    # ventanas y puerta
    for wx, wy in ((x0 + 4, base - 12), (x0 + 12, base - 12), (x0 + 22, base - 12), (x0 + 28, base - 12)):
        cv.c[wy : wy + 4, wx : wx + 3] = win
        cv.c[wy + 1, wx + 1] = win * 0.85
    cv.c[base - 6 : base, x0 + 16 : x0 + 19] = win * 0.9
    # muelle
    dock = hexc(m['wall'][1])
    for x in range(x0 + 14, x0 + 52):
        cv.c[base + 1, x] = dock
        if (x - x0) % 6 == 0:
            cv.c[base + 2 : base + 4, x] = wall[0]
    # letrero colgante
    cv.c[base - 9 : base - 7, x0 - 3 : x0] = hexc(m['fall'][3])
    return (x0 + 25, peak - 4)


def smoke(img, m, x, y, phase):
    """Humo de la chimenea: bocanadas que suben y se abren; `phase` (0-1) lo anima."""
    col = hexc(m['mount'][1]) * 0.5 + hexc(m['cloud'][3]) * 0.5
    rng = np.random.default_rng(4)
    for j in range(9):
        f = (j + phase) / 9
        px = x + f * 26 + np.sin(f * 5) * 3
        py = y - f * 46
        r = 1.2 + f * 3.4
        for yy in range(int(py - r), int(py + r) + 1):
            for xx in range(int(px - r), int(px + r) + 1):
                if 0 <= yy < H and 0 <= xx < img.shape[1] and (xx - px) ** 2 + (yy - py) ** 2 <= r * r:
                    if rng.random() < 0.95 - f * 0.55:
                        img[yy, xx] = img[yy, xx] * 0.5 + col * 0.5


def water(img, m, wob, streak, frame):
    """Espejo: lo de arriba, volteado, roto en franjas horizontales y oscurecido; las rayas de
    luz se deslizan con `frame` para que el agua tiemble."""
    rows = H - WATER
    vw = img.shape[1]
    src = img.copy()
    tint = hexc(m['water'][0])
    rng = np.random.default_rng(7 + frame)
    for i in range(rows):
        y = WATER + i
        sy = max(WATER - 1 - i, 0)
        ph = (frame * (1 + i % 3)) % 64
        dx = (wob[i, ph : ph + vw] * (2 + i * 0.12)).astype(int)
        idx = np.clip(np.arange(vw) + dx, 0, vw - 1)
        k = 0.22 + 0.25 * (i / rows)
        img[y] = (src[sy][idx] * (1 - k) + tint * k) * 0.93
    for i in range(0, rows, 2):
        y = WATER + i
        ph = (frame * (2 if i % 4 else -1)) % 64
        on = streak[i, ph + 32 : ph + 32 + vw] > 0.66 + i / rows * 0.12
        on &= rng.random(vw) > 0.3
        bright = img[y].sum(axis=1) > 420
        img[y][on & bright] = hexc(m['water'][2])
        img[y][on & ~bright] = hexc(m['water'][1]) * 0.7 + img[y][on & ~bright] * 0.3
    img[WATER] = img[WATER] * 0.6 + hexc(m['water'][1]) * 0.4


def rock(cv, m, nz, cx, cy, rx, ry, depth, hz=0.0):
    yy, xx = np.mgrid[0:H, 0:W].astype(float)
    n = nz.fbm(W, H, 9, 7, 3)
    d = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 + (n - 0.5) * 0.5
    mask = d < 1
    sx = 1 if m['sun'][0] >= 0 else -1
    light = 0.55 - (yy - cy) / ry * 0.45 + (xx - cx) / rx * 0.3 * sx
    cl = clump()
    moss = (nz.fbm(W, H, 6, 4, 2) > 0.55) & ((yy - cy) / ry < 0.1)
    col = ramp(m['rock'], light + (cl - 0.5) * 0.35)
    mcol = ramp(m['moss'], light + (cl - 0.5) * 0.4)
    col = np.where(moss[..., None], mcol, col)
    if hz:
        col = col + (hexc(m['haze']) - col) * hz
    cv.put(mask, col, depth)


def foreground(cv, m, nz, rng):
    near, fall = m['near'], m['fall']
    sun = m['sun']
    dark = m['dark']
    # Rocas de la orilla.
    rock(cv, m, nz, 30, 266, 95, 30, 1.0)
    rock(cv, m, nz, 490, 262, 90, 34, 1.0)
    rock(cv, m, nz, 60, 254, 100, 30, 1.0)
    rock(cv, m, nz, 450, 250, 70, 30, 1.0)
    rock(cv, m, nz, 372, 222, 14, 6, 0.8)
    rock(cv, m, nz, 160, 226, 12, 5, 0.8, 0.1)
    # Izquierda: arbustos de otoño y alerces amarillos, más oscuros cuanto más cerca.
    shade = [dark] + list(fall[:4])
    leafy(cv, 70, 236, 70, fall[1:], m, rng, 0.9, 0.0, sun)
    larch(cv, 34, 240, 150, [dark, fall[2], fall[3], fall[4], fall[5]], m, rng, 0.95)
    larch(cv, 92, 236, 110, [dark, fall[1], fall[3], fall[4], fall[5]], m, rng, 0.95)
    leafy(cv, 8, 262, 130, shade, m, rng, 1.0, 0.0, sun)
    # Derecha: abeto oscuro, alerce y matorral rojo.
    conifer(cv, 448, 234, 150, [dark, near[0], near[1], near[2]], m, rng, 0.95, w_scale=0.9)
    larch(cv, 410, 230, 95, [dark, fall[2], fall[3], fall[4], fall[5]], m, rng, 0.95)
    leafy(cv, 474, 258, 110, [dark, fall[0], fall[1], fall[2], fall[3]], m, rng, 1.0, 0.0, sun)
    leafy(cv, 395, 252, 46, [dark, fall[1], fall[2], fall[3], fall[4]], m, rng, 1.0, 0.0, sun)
    conifer(cv, 540, 250, 190, [dark, near[0], near[1], near[2]], m, rng, 1.0, w_scale=0.9)
    leafy(cv, 520, 262, 90, [dark, fall[0], fall[1], fall[2], fall[3]], m, rng, 1.0, 0.0, sun)
    # Juncos secos en la orilla de delante.
    for i in range(170):
        x = int(rng.uniform(100, 400))
        if 150 < x < 370:
            continue
        b = int(rng.uniform(WATER + 26, WATER + 46))
        hh = int(rng.uniform(4, 14))
        c = hexc(fall[rng.integers(2, 5)]) * 0.75 + hexc(dark) * 0.25
        lean = rng.choice([-1, 1])
        for k in range(hh):
            yy2, xx2 = b - k, x + (k // 5) * lean
            if 0 <= yy2 < H and 0 <= xx2 < W:
                cv.c[yy2, xx2] = c


def build(mood, seed, house=True):
    """Pinta las capas; cada una con su velocidad de paralaje."""
    m = MOODS[mood]
    m.setdefault('rock', [m['dark'], '#3c4046', '#5f6066', '#86847f', '#aaa59a'])
    m.setdefault('moss', [m['dark'], m['near'][1], m['near'][2], m['near'][3]])
    nz = Noise(seed)
    rng = np.random.default_rng(seed + 1)
    yy, xx = np.mgrid[0:H, 0:W]
    L_sky, L_mnt, L_far, L_mid, L_fg = (Canvas() for _ in range(5))
    sky(L_sky, m, nz)
    if mood == 'noche':
        st = np.random.default_rng(3).random((H, W))
        L_sky.c[(st > 0.997) & (yy < 140)] = hexc('#dfe6ff')
        moon = (xx - 360) ** 2 + (yy - 48) ** 2 < 49
        L_sky.c[moon] = hexc('#f2efd8')
        cut = (xx - 363) ** 2 + (yy - 46) ** 2 < 36
        L_sky.c[moon & cut] = hexc('#d9d6c4')
    if mood == 'ocaso':
        d = np.sqrt(((xx - 270) / 2.2) ** 2 + (yy - 150) ** 2)
        g = np.floor(np.clip(1 - d / 70, 0, 1) * 5) / 5
        L_sky.c = L_sky.c + (hexc('#fff1b0') - L_sky.c) * g[..., None] * 0.85
    clouds(L_sky, m, nz)
    mountains(L_mnt, m, nz, rng, [(160, 70, 150, 120, 190), (360, 58, 130, 180, 190)], 0, 0.22)
    mountains(L_mnt, m, nz, rng, [(260, 108, 120, 90, 195), (60, 112, 110, 90, 195), (470, 100, 80, 120, 195)], 1, 0.12)
    mist = 0.6 + 0.4 * m['mist']
    r = band(L_far, m, nz, 176, 8, m['far'], 0.35, 0.5 * mist, 50)
    for x in range(0, W, 2):
        h = int(rng.uniform(6, 13))
        conifer(L_far, x + rng.uniform(-1, 1), int(r[x]) + 4, h, m['far'], m, rng, 0.35, hz=0.4 * mist)
    if m['mist'] > 0:
        n = nz.fbm(W, H, 60, 4, 3)
        mk = (yy > 168) & (yy < WATER) & (n > 0.45) & (L_far.c[..., 0] >= 0)
        haze(L_far, mk, m, np.full((H, W), 0.5 * m['mist']))
    r2 = band(L_mid, m, nz, 190, 6, m['mid'], 0.55, 0.15, 40)
    for x in range(-4, W, 4):
        xx_ = x + rng.uniform(-2, 2)
        base = int(r2[min(max(int(xx_), 0), W - 1)]) + 5
        k = rng.random()
        if house and 318 < xx_ < 362:
            continue
        if k < 0.4:
            conifer(L_mid, xx_, base, int(rng.uniform(12, 24)), m['mid'], m, rng, 0.55, hz=0.12)
        elif k < 0.65:
            larch(L_mid, xx_, base, int(rng.uniform(12, 22)), m['fall'][2:], m, rng, 0.55, hz=0.18)
        else:
            leafy(L_mid, xx_, base, int(rng.uniform(10, 18)), m['fall'][1:], m, rng, 0.55, hz=0.2, sun=m['sun'])
    ch = tavern(L_mid, m, 322, WATER - 1, rng) if house else (0, -99)
    foreground(L_fg, m, nz, rng)
    wn = Noise(seed + 9)
    wob = wn.fbm(VIEW + 64, H - WATER, 30, 1.4, 3) - 0.5
    streak = wn.fbm(VIEW + 128, H - WATER, 26, 1, 3)
    return dict(m=m, layers=[(L_sky, 0.08), (L_mnt, 0.18), (L_far, 0.32), (L_mid, 0.5), (L_fg, 1.0)],
                chimney=ch, wob=wob, streak=streak)


def frame(scene, t, f, phase):
    """Una vista de 480 px: `t` (0-1) es dónde está la cámara en su paneo."""
    img = np.zeros((H, VIEW, 3))
    m = scene['m']
    for i, (cv, sp) in enumerate(scene['layers']):
        off = int(round(t * PAN * sp))
        sub = cv.c[:, off : off + VIEW]
        k = sub[..., 0] >= 0
        img[k] = sub[k]
        if i == 3:
            cx, cy = scene['chimney']
            smoke(img, m, cx - off, cy, phase)
            water(img, m, scene['wob'], scene['streak'], f)
    return img


def render(mood, seed):
    return frame(build(mood, seed), 0.0, 0, 0.0)


def quantize(img, n=64):
    im = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))
    q = im.quantize(colors=n, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    return q.convert('RGB')


if __name__ == '__main__':
    out, mood = sys.argv[1], sys.argv[2]
    seed = int(sys.argv[3]) if len(sys.argv) > 3 else 11
    scene = build(mood, seed)
    still = frame(scene, 0.5, 0, 0.3)
    im = Image.fromarray(np.clip(still, 0, 255).astype(np.uint8))
    pal = im.quantize(colors=64, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    pal.convert('RGB').save(out.replace('.png', '-1x.png'))
    pal.convert('RGB').resize((VIEW * 4, H * 4), Image.NEAREST).save(out)
    if '--gif' in sys.argv:
        frames = []
        n = 48
        for f in range(n):
            t = 0.5 - 0.5 * np.cos(f / n * 2 * np.pi)  # ida y vuelta suave
            fr = Image.fromarray(np.clip(frame(scene, t, f, (f % 12) / 12), 0, 255).astype(np.uint8))
            q = fr.quantize(palette=pal, dither=Image.Dither.NONE)
            frames.append(q.resize((VIEW * 2, H * 2), Image.NEAREST))
        frames[0].save(out.replace('.png', '.gif'), save_all=True, append_images=frames[1:], duration=90, loop=0)
