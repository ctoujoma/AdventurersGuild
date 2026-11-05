"""Propuesta C: el fondo nuevo detrás del juego de hoy (cielo enmascarado en magenta)."""
import sys
sys.path.insert(0, sys.argv[1])
import numpy as np
from PIL import Image
import paisaje as P
from regradeo import grade, GRADES

key, mood, out, scale, hy, tone = sys.argv[2], sys.argv[3], sys.argv[4], int(sys.argv[5]), int(sys.argv[6]), sys.argv[7]
sc = P.build(mood, 11, house=False)
back = np.zeros((P.H, P.W, 3))
for cv, sp in sc['layers'][:4]:
    k = cv.c[..., 0] >= 0
    back[k] = cv.c[k]
# Por debajo del horizonte, el color de la orilla (no se ve: lo tapa el terreno).
im = Image.fromarray(np.clip(back, 0, 255).astype(np.uint8))
im = im.quantize(colors=64, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
big = np.array(im.resize((P.W * scale, P.H * scale), Image.NEAREST)).astype(float)
shot = np.array(Image.open(key).convert('RGB')).astype(float)
res = shot.copy()
if tone != 'no':
    y0, x0 = 62, 77
    s_ = shot[y0:, x0:]
    flat = s_.reshape(-1, 3)
    u, inv = np.unique(flat, axis=0, return_inverse=True)
    res[y0:, x0:] = grade(u, GRADES[tone])[inv.reshape(-1)].reshape(s_.shape)
mask = (shot[..., 0] > 150) & (shot[..., 1] < 110) & (shot[..., 2] > 150)
oy = hy - P.WATER * scale  # la orilla del paisaje, en el horizonte del juego
ox = (shot.shape[1] - big.shape[1]) // 2
ys, xs = np.nonzero(mask)
by, bx = ys - oy, xs - ox
ok = (by >= 0) & (by < big.shape[0]) & (bx >= 0) & (bx < big.shape[1])
res[ys[ok], xs[ok]] = big[by[ok], bx[ok]]
Image.fromarray(np.clip(res, 0, 255).astype(np.uint8)).save(out)
