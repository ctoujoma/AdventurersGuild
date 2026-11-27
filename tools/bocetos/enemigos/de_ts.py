"""Saca los calcos del bosque de `src/art/expCalcos.ts` a `bosque_calco.json` (para regenerar el
archivo con `a_ts.py` sin las referencias originales)."""
import re, json
t = open('../../../src/art/expCalcos.ts').read()
boca = dict(re.findall(r"(\w): '(#\w+)'", t.split('as const')[0].split('BOCA =')[1]))
IDX = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
out = {}
for m in re.finditer(r"  (\w+): \{\n    ramp: \[([^\]]*)\],\n    frames: \[\n(.*?)\n    \],\n  \},", t, re.S):
    if m.group(1) not in ('huargo', 'oso', 'jabali', 'lobo'): continue
    R = re.findall(r"'(#\w+)'", m.group(2))
    out[m.group(1)] = [[[None if ch == '.' else (R[IDX.index(ch)] if ch in IDX else boca[ch]) for ch in r]
                        for r in re.findall(r"'([^']*)'", blk)]
                       for blk in re.findall(r"      \[\n(.*?)\n      \],", m.group(3), re.S)]
out['huargo'] = out['huargo'][:8]  # los de la muerte (8 en adelante) los añade a_ts.py
json.dump(out, open('bosque_calco.json', 'w'))
