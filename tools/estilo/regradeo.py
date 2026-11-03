"""Propuesta B: la misma escena del juego, cambiando solo la paleta (lo que haría el shader).

Cada color se pasa a OKLab y se le baja el croma, se levantan los negros hacia un azul
violáceo, las sombras tiran a frío y las luces a cálido, y se comprime el contraste.
Uso: python3 regradeo.py <entrada> <salida> <tono: tarde|dia|noche>
"""

import sys
import numpy as np
from PIL import Image


def srgb_to_lin(c):
    c = c / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def lin_to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055) * 255


M1 = np.array([[0.4122214708, 0.5363325363, 0.0514459929], [0.2119034982, 0.6806995451, 0.1073969566], [0.0883024619, 0.2817188376, 0.6299787005]])
M2 = np.array([[0.2104542553, 0.7936177850, -0.0040720468], [1.9779984951, -2.4285922050, 0.4505937099], [0.0259040371, 0.7827717662, -0.8086757660]])


def to_lab(rgb):
    lms = srgb_to_lin(rgb) @ M1.T
    return np.cbrt(lms) @ M2.T


def from_lab(lab):
    lms = (lab @ np.linalg.inv(M2).T) ** 3
    return lin_to_srgb(lms @ np.linalg.inv(M1).T)


GRADES = {
    # croma, negro (L, a, b), sombra fría (a, b), luz cálida (a, b), contraste
    'tarde': dict(chroma=0.8, floor=(0.17, 0.012, -0.04), cold=(0.004, -0.025), warm=(0.012, 0.028), contrast=0.92, lift=0.0),
    'dia': dict(chroma=0.76, floor=(0.19, 0.0, -0.035), cold=(0.0, -0.03), warm=(0.006, 0.02), contrast=0.9, lift=0.01),
    'noche': dict(chroma=0.74, floor=(0.14, 0.01, -0.045), cold=(0.006, -0.035), warm=(0.01, 0.02), contrast=0.95, lift=0.0),
}


def grade(rgb, g):
    lab = to_lab(rgb.astype(float))
    L, a, b = lab[..., 0], lab[..., 1], lab[..., 2]
    a = a * g['chroma']
    b = b * g['chroma']
    # Contraste comprimido alrededor de 0.6 y negros levantados hacia un azul violáceo.
    L2 = 0.6 + (L - 0.6) * g['contrast'] + g['lift']
    fl = g['floor']
    t = np.clip(1 - L2 / 0.55, 0, 1) ** 1.5
    L2 = fl[0] + L2 * (1 - fl[0] * 0.9)
    a = a + fl[1] * t
    b = b + fl[2] * t
    # Sombras frías, luces cálidas (el cambio de tono de las rampas, más suave que en Endesga).
    s = np.clip((0.55 - L2) / 0.35, 0, 1)
    h = np.clip((L2 - 0.65) / 0.3, 0, 1)
    a = a + g['cold'][0] * s + g['warm'][0] * h
    b = b + g['cold'][1] * s + g['warm'][1] * h
    return from_lab(np.stack([L2, a, b], -1))


if __name__ == '__main__':
    src, out, tone = sys.argv[1], sys.argv[2], sys.argv[3]
    im = np.array(Image.open(src).convert('RGB')).astype(float)
    res = im.copy()
    # Solo la escena (la interfaz se queda igual): a la derecha de la barra lateral y bajo la de arriba.
    y0, x0 = 62, 77
    sc = im[y0:, x0:]
    # Se trabaja con los colores únicos: es lo que haría una tabla en el shader.
    flat = sc.reshape(-1, 3)
    uniq, inv = np.unique(flat, axis=0, return_inverse=True)
    mapped = grade(uniq, GRADES[tone])
    res[y0:, x0:] = mapped[inv.reshape(-1)].reshape(sc.shape)
    Image.fromarray(np.clip(res, 0, 255).astype(np.uint8)).save(out)
    print(len(uniq), 'colores')
