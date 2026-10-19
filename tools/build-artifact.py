# Empaqueta dist/ en un solo HTML para el artefacto: CSS y JS en línea, fuentes woff2 como data URI.
import base64, glob, os, re, sys
dist = sys.argv[1]; out = sys.argv[2]
assets = os.path.join(dist, 'assets')
css = open(glob.glob(os.path.join(assets, 'index-*.css'))[0]).read()
js = open(glob.glob(os.path.join(assets, 'index-*.js'))[0]).read()
def font(m):
    data = base64.b64encode(open(os.path.join(assets, m.group(1)), 'rb').read()).decode()
    return f'url(data:font/woff2;base64,{data}) format("woff2")'
css = re.sub(r'url\(\./([^)]+\.woff2)\) format\("woff2"\),url\(\./[^)]+\.woff\) format\("woff"\)', font, css)
# Fuentes propias con un solo woff2 (las cifras).
css = re.sub(r'url\(\./([^)]+\.woff2)\) format\("woff2"\)', font, css)
assert '.woff)' not in css and '.woff2)' not in css
# Imágenes (splash): data URI en el propio JS.
def img(m):
    path = os.path.join(assets, m.group(1))
    ext = m.group(1).rsplit('.', 1)[1]
    return 'data:image/' + ext + ';base64,' + base64.b64encode(open(path, 'rb').read()).decode()
js = re.sub(r'new URL\("([\w.-]+\.(?:webp|gif|png))",import\.meta\.url\)\.href', lambda m: '"' + img(m) + '"', js)
assert 'import.meta.url' not in js
js = js.replace('</script', '<\\/script')
html = ('<title>El Jarro Partido</title>\n<meta name="theme-color" content="#181425">\n'
        f'<style>{css}</style>\n<div id="app"></div>\n<script type="module">{js}</script>\n')
open(out, 'w').write(html)
print(len(html))
