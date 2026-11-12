# Genera las páginas de los bocetos (docs/bocetos/*.html) con más aire y las opciones explicadas.
# Reutiliza las fuentes y texturas del juego que ya venían incrustadas en las páginas originales.
import re, html

BOC = '/ruta/a/estilos/'  # fuentes y texturas extraídas de las páginas originales (ver git: d32ef36)
OUT = '/home/user/AdventurersGuild/docs/bocetos/'
SIZES = {}  # img -> (w, h)
import struct
def size(name):
    with open(OUT + 'img/' + name, 'rb') as f:
        f.read(16)
        w, h = struct.unpack('>II', f.read(8))
    return w, h

def base_css(page):
    st = open(BOC + page + '.style.css').read()
    # Fuentes y tokens del juego (todo hasta el reset).
    return st[: st.index('*{box-sizing:border-box}')]

CSS = r"""
/* Página de boceto: una columna de móvil; cada opción es un bloque propio con su banda de color. */
:root{--a:#3e8948;--b:#a22633;--hoy:#733e39;--paper:#ead4aa;--shade:rgba(24,20,37,.6)}
*{box-sizing:border-box}
html{background:var(--ink)}
body{margin:0 auto;max-width:460px;padding-block:0 40px;
padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));
background:var(--tex-planks) var(--bark);background-size:64px;color:var(--sand);font-family:var(--body);
font-size:16px;line-height:1.45;font-variant-numeric:lining-nums tabular-nums}
img{display:block;max-width:100%;height:auto;image-rendering:pixelated}
h1,h2,h3{font-family:var(--pixel);font-weight:400;text-wrap:balance;margin:0}
.top{padding:18px 0 10px}
.top small{font-family:var(--pixel);font-size:12px;color:var(--tan);letter-spacing:.06em}
.top h1{font-size:24px;line-height:1.15;color:var(--lemon);text-shadow:2px 2px 0 var(--ink);margin-top:4px}
.paper{border-style:solid;border-width:10px;border-image:var(--frame-parchment) 5 fill / 10px / 0 stretch;
color:var(--plum);padding:4px 6px 6px}
.paper h2{font-size:16px;color:var(--rust);margin-bottom:6px}
.paper p{margin:0 0 8px;font-size:15px}
.paper p:last-child{margin-bottom:0}
.paper ul{margin:0;padding-left:20px;font-size:15px}
.paper li+li{margin-top:4px}
.intro{margin-top:6px}
/* Las dos opciones, lado a lado (una debajo de otra en el móvil). */
.pick{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}
.pick > div{min-width:0;padding:10px 10px 12px;background:var(--shade);box-shadow:0 0 0 2px var(--ink)}
.pick b{display:block;font-family:var(--pixel);font-weight:400;font-size:15px;margin-bottom:4px}
.pick .a b{color:#8fdc7a}
.pick .b b{color:#ff8a92}
.pick p{margin:0;font-size:14px}
.pick .fig{margin-top:6px;font-family:var(--pixel);font-size:12px;color:var(--lemon)}
@media (max-width:380px){.pick{grid-template-columns:1fr}}
/* Cada parte de la página: banda con su nombre y mucho aire antes. */
.part{margin-top:44px}
.band{display:flex;align-items:center;gap:10px;padding:8px 12px;box-shadow:0 0 0 2px var(--ink);
background:var(--hoy);color:#fff}
.band .k{font-family:var(--pixel);font-size:13px;padding:1px 7px;background:var(--ink);color:var(--lemon)}
.band h2{font-size:18px}
.part.a .band{background:var(--a)}
.part.b .band{background:var(--b)}
.part.common .band{background:var(--oak)}
.idea{margin:12px 0 0;font-size:17px;line-height:1.4}
.idea b{color:var(--lemon);font-weight:700}
/* Una captura: primero qué mirar, luego la imagen en su marco, separada de la siguiente. */
.shot{margin:26px 0 0}
.shot h3{font-size:14px;color:var(--lemon);margin-bottom:8px}
.look{margin:0 0 10px;padding:0;list-style:none;display:grid;gap:6px}
.look li{display:grid;grid-template-columns:22px 1fr;gap:8px;font-size:15px;align-items:start}
.look li i{font-style:normal;font-family:var(--pixel);font-size:12px;line-height:20px;text-align:center;
background:var(--lemon);color:var(--ink);box-shadow:0 0 0 2px var(--ink)}
.frame{background:var(--ink);padding:6px;box-shadow:0 0 0 2px var(--oak),0 0 0 4px var(--ink);margin:0 auto;
max-width:100%}
.frame.narrow{width:340px}
.tall{position:relative}
.cut{position:absolute;left:-6px;right:-6px;height:0;border-top:2px dashed var(--red)}
.cut span{position:absolute;right:6px;top:2px;font-family:var(--pixel);font-size:11px;padding:0 4px;
background:var(--red);color:#fff}
.note-under{margin:8px 0 0;font-size:14px;color:var(--tan)}
/* A favor / en contra. */
.pc{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:24px}
.pc > div{min-width:0;padding:10px 12px;background:var(--shade);box-shadow:0 0 0 2px var(--ink)}
.pc h3{font-size:13px;margin-bottom:6px}
.pc .pro h3{color:#8fdc7a}
.pc .con h3{color:#ff8a92}
.pc ul{margin:0;padding-left:18px;font-size:14px}
.pc li+li{margin-top:4px}
@media (max-width:400px){.pc{grid-template-columns:1fr}}
.rec{margin-top:44px}
.rec h2{color:var(--leaf)}
details{margin-top:14px}
summary{cursor:pointer;font-family:var(--pixel);font-size:13px;color:var(--lemon);padding:6px 0}
.legend{display:grid;grid-template-columns:1fr 1fr;gap:6px 10px;margin-top:6px;font-size:14px}
.legend span{display:flex;align-items:center;gap:6px}
.chip{display:inline-block;font-family:var(--pixel);font-size:12px;padding:0 5px;box-shadow:0 0 0 2px var(--ink);margin:2px 4px 2px 0}
footer{margin-top:30px;font-size:12px;color:var(--tan);opacity:.85}
a{color:var(--lemon)}
:focus-visible{outline:2px solid var(--lemon);outline-offset:2px}
"""

def esc(t):
    return t  # los textos ya van en HTML a mano

def shot(img, title, look=(), narrow=False, cuts=(), under=''):
    w, h = size(img)
    items = ''.join(f'<li><i>{i+1}</i><span>{t}</span></li>' for i, t in enumerate(look))
    lk = f'<ul class="look">{items}</ul>' if look else ''
    cut = ''.join(
        f'<i class="cut" style="top:{100*y/h:.2f}%"><span>fin de la pantalla {n+1}</span></i>'
        for n, y in enumerate(cuts))
    inner = f'<img src="img/{img}" width="{w}" height="{h}" alt="{html.escape(title)}">'
    if cuts:
        inner = f'<div class="tall">{inner}{cut}</div>'
    u = f'<p class="note-under">{under}</p>' if under else ''
    return (f'<figure class="shot"><h3>{title}</h3>{lk}'
            f'<div class="frame{" narrow" if narrow else ""}">{inner}</div>{u}</figure>')

def part(kind, key, name, idea, body):
    return (f'<section class="part {kind}"><div class="band"><span class="k">{key}</span><h2>{name}</h2></div>'
            f'<p class="idea">{idea}</p>{body}</section>')

def pc(pros, cons):
    li = lambda xs: ''.join(f'<li>{x}</li>' for x in xs)
    return (f'<div class="pc"><div class="pro"><h3>A favor</h3><ul>{li(pros)}</ul></div>'
            f'<div class="con"><h3>En contra</h3><ul>{li(cons)}</ul></div></div>')

def page(fname, title, desc, tag, problem, choose, a, b, parts, rec):
    head = (f'<!doctype html><html lang="es"><head><meta charset="utf-8">'
            f'<meta name="viewport" content="width=device-width, initial-scale=1">'
            f'<title>{title}</title><meta name="description" content="{html.escape(desc)}">'
            f'<style>{base_css(fname)}{CSS}</style></head><body>')
    top = (f'<header class="top"><small>BOCETO · {tag}</small><h1>{title}</h1></header>'
           f'<div class="paper intro"><h2>Qué pasa hoy</h2>{problem}</div>'
           f'<div class="paper intro"><h2>Qué tienes que elegir</h2>{choose}</div>'
           f'<div class="pick"><div class="a"><b>Opción A · {a[0]}</b><p>{a[1]}</p><p class="fig">{a[2]}</p></div>'
           f'<div class="b"><b>Opción B · {b[0]}</b><p>{b[1]}</p><p class="fig">{b[2]}</p></div></div>')
    end = (f'<div class="paper rec"><h2>Mi recomendación</h2>{rec}</div>'
           f'<footer>Boceto para decidir, no es el diseño final. Hecho con capturas del juego '
           f'(partida de prueba, día 64, móvil de 420 px).</footer></body></html>')
    open(OUT + fname + '.html', 'w').write(head + top + ''.join(parts) + end)

# ---------------------------------------------------------------- C7
SCREEN = 563  # alto de una pantalla en las capturas (las rayas del boceto original)
page(
    'c7-talleres', 'Talleres en pestañas',
    'Boceto C7: la ficha de los talleres con pestañas Crear, Mejorar y Vestir, explicado por opciones.',
    'C7',
    '<p>La ficha de un taller (forja, sastrería, alquimia) lo pone todo seguido: las recetas, los objetos '
    'para mejorar y los objetos para desmontar. En el móvil, la de la forja ocupa <b>más de 3 pantallas</b> '
    'y el botón para subir de nivel la sala queda al final.</p>',
    '<p>En las dos opciones la parte de arriba es la misma: el nivel con <b>«Mejorar · precio»</b> de la '
    'sala, quién trabaja y lo que está en marcha. Debajo, unas <b>pestañas</b>: <b>Crear</b> y '
    '<b>Mejorar</b> (y <b>Vestir</b> en la sastrería), así solo se ve una lista a la vez.</p>'
    '<p>Lo que eliges es <b>cómo se ven las recetas</b> en la pestaña Crear.</p>',
    ('Lista', 'Cada receta en una fila, con lo que da y su botón «Crear · precio». Como hoy, pero más corta.', 'La forja: 2 pantallas'),
    ('Casillas', 'Las recetas como casillas del arcón, con su precio. Tocas una y abajo sale qué da y «Crear».', 'La forja: 1,7 pantallas'),
    [
        part('', 'HOY', 'La ficha de la forja', 'Todo seguido: hay que bajar más de tres pantallas.',
             shot('c7-antes-forja.png', 'La forja hoy, entera', [
                 'Cada raya roja es el final de una pantalla del móvil.',
                 'En medio, las nueve recetas y luego dos rejillas del arcón (mejorar y desmontar).',
                 '«Mejorar · 640» (subir la sala) está al final, en la cuarta pantalla.'],
                 narrow=True, cuts=(613, 1176, 1739))
             + shot('c7-largos.png', 'Lo largo que queda cada opción, a la misma escala', [
                 'De izquierda a derecha: hoy (3,3 pantallas), A · Crear (2), A · Mejorar (1,6) y B · Crear (1,7).'])),
        part('common', 'A y B', 'Lo que comparten',
             'La parte de arriba y las pestañas Mejorar y Vestir son iguales en las dos opciones.',
             shot('c7-a-forja-mejorar.png', 'Pestaña «Mejorar» de la forja', [
                 'Arriba del todo, «Mejorar · 640» para subir la sala: ya no hay que bajar a buscarlo.',
                 'Las pestañas: Crear 8 (recetas) y Mejorar 6 (objetos del arcón que se trabajan aquí).',
                 'Una sola rejilla del arcón. Tocas un objeto y salen sus dos botones: Mejorar (+1) o Desmontar (para aprender la receta).'],
                 narrow=True)
             + shot('c7-a-sastreria-vestir.png', 'Pestaña «Vestir» de la sastrería', [
                 'A quién vestir, el tinte y la prenda, con el retrato de cómo queda.',
                 'Lo que se está cosiendo sigue arriba, en «En marcha».'], narrow=True)),
        part('a', 'A', 'Lista', 'Cada receta es <b>una fila</b>: se lee todo sin tocar nada.',
             shot('c7-a-forja-crear.png', 'Pestaña «Crear» en lista', [
                 'Cada fila: la receta, lo que da, las horas y, en azul, lo que da si sale rara.',
                 'Los materiales que pide, debajo (por ejemplo, 2 de hierro).',
                 'El botón «Crear · precio» a la derecha de cada una.',
                 'Al final, las que aún no sabes, en una sola línea.'], narrow=True)
             + pc(['Se ve lo que da cada receta sin tocar.', 'Se parece a lo de hoy: no hay que aprender nada.'],
                  ['Sigue siendo larga: 2 pantallas en la forja.'])),
        part('b', 'B', 'Casillas', 'Las recetas son <b>casillas como las del arcón</b>: todas a la vista, sin bajar.',
             shot('c7-b-forja-crear.png', 'Pestaña «Crear» en casillas', [
                 'Cada casilla: el dibujo, el nombre y el precio.',
                 'La del candado es una receta que aún no sabes.',
                 'La del borde dorado (Espada larga) es la que has tocado: abajo sale lo que da y «Crear · 35».'],
                 narrow=True)
             + pc(['Todas las recetas caben a la vista.', 'Se maneja igual que el arcón.'],
                  ['Para saber qué da una receta hay que tocarla.', 'Crear cuesta un toque más.'])),
        '<div class="paper part"><h2>Un detalle</h2><p>Con el botón «Mejorar» de la sala arriba, la palabra '
        '«Mejorar» sale dos veces en la misma ficha (la sala y la pestaña de objetos). Propongo llamar a la '
        'pestaña <b>«Templar»</b>.</p></div>',
    ],
    '<p><b>La A (lista).</b> En un taller lo importante es comparar qué da cada receta antes de gastar, y '
    'en la lista se ve sin tocar nada. Con las pestañas ya baja de 3,3 a 2 pantallas. La B queda más '
    'bonita, pero obliga a tocar receta a receta.</p>')

# ---------------------------------------------------------------- D1
LEG = open(BOC + 'legend.html').read()
page(
    'd1-tarjeta', 'La nota dice si se puede',
    'Boceto D1: la nota del tablón con lo que pide el encargo y cómo saldría con tu mejor grupo, explicado por opciones.',
    'D1',
    '<p>La nota del tablón dice el peligro, los días de viaje, las plazas y la paga, pero <b>no qué pide</b> '
    '(Combate, Trampas…) <b>ni si tienes grupo</b> para hacerlo: hay que abrirla y tocar «Sugerir».</p>'
    '<p>Además, el reloj de arriba («1d», lo que falta para que se quite del tablón) se confunde con los '
    'días de viaje de abajo.</p>',
    '<p>En las dos opciones la nota enseña <b>lo que pide</b> con iconos y <b>cómo saldría</b> con el '
    'mejor grupo que tienes en casa (el que da «Sugerir»). La caducidad va con palabras.</p>'
    '<p>Lo que eliges es <b>cómo se enseña</b>: una chapa con palabra y porcentaje, o un sello solo con el '
    'porcentaje.</p>',
    ('Chapa', 'Una fila nueva: los iconos de lo que pide y una chapa tipo «Pan comido 90 %».', 'La nota crece una fila'),
    ('Sello', 'Un sello redondo en la esquina con el %, y la caducidad en una cinta colgando.', 'La nota casi no crece'),
    [
        part('', 'HOY', 'La nota de hoy', 'No dice qué pide ni si sale.',
             shot('d1-antes-nota.png', 'Una nota de hoy, de cerca', [
                 'Arriba a la derecha, «1d»: quiere decir que se va del tablón mañana.',
                 'Abajo, la bota con «2»: son los días de viaje. Se confunde con lo de arriba.',
                 'Nada dice qué habilidades pide ni si tus héroes llegan.'], narrow=True)
             + '<details><summary>Ver el tablón entero de hoy</summary>'
             + shot('d1-antes.png', 'El tablón de hoy', narrow=True) + '</details>'),
        part('a', 'A', 'Chapa', 'Una <b>fila nueva</b> con lo que pide y una <b>chapa</b> con palabra y porcentaje.',
             shot('d1-a-nota.png', 'La nota con chapa, de cerca', [
                 'Arriba, «Último día» en rojo en vez de «1d».',
                 'Fila nueva: un icono por cada cosa que pide. Verde: tu mejor grupo llega; rojo: se queda corto.',
                 'La chapa «Pan comido 90 %»: cómo saldría con ese grupo.',
                 'Abajo, como hoy; el viaje ahora dice «2 d».'], narrow=True)
             + shot('d1-a.png', 'El tablón entero con chapas', [
                 'De un vistazo: verdes las que puedes hacer hoy, rojas las que no (por ejemplo, «Suicida 0 %»).'],
                 narrow=True)
             + pc(['Palabra y porcentaje juntos: se entiende sin pensar.', 'Los iconos dicen qué falta (el rojo).'],
                  ['Cada nota crece una fila: el tablón se alarga.'])),
        part('b', 'B', 'Sello', 'Un <b>sello de lacre</b> en la esquina con el porcentaje; la nota casi no crece.',
             shot('d1-b-nota.png', 'La nota con sello, de cerca', [
                 'El sello verde con «90 %» en la esquina; su color dice cómo saldría.',
                 'Los iconos de lo que pide, debajo del título.',
                 'La caducidad en una cinta roja colgando abajo: «se va mañana».'], narrow=True)
             + shot('d1-b.png', 'El tablón entero con sellos', narrow=True)
             + pc(['La nota casi no crece.', 'Más de juego de mesa.'],
                  ['Solo el número: la palabra («Arriesgado»…) sale al tocar.',
                   'La cinta cuelga sobre la nota de abajo.'])),
        f'<div class="paper part"><h2>Qué es cada cosa</h2>{LEG}'
        '<p style="margin-top:6px">El color es el de la hoja del encargo. La cifra es la probabilidad de que '
        'salga bien con ese grupo. Al tocar la nota se abre la hoja como hoy, con ese grupo ya puesto.</p></div>',
    ],
    '<p><b>La A (chapa).</b> La palabra con el porcentaje se entiende de un vistazo, y es lo que más se '
    'consulta en el tablón. Que la nota crezca una fila es poco a cambio.</p>')

# ---------------------------------------------------------------- E1
page(
    'e1-altillo', 'El altillo del salón',
    'Boceto E1: el salón de doble altura con un altillo de mesas, explicado por opciones.',
    'E1',
    '<p>Un salón de <b>dos plantas de alto</b> (3 × 2) da las <b>mismas mesas</b> que uno de una planta: '
    'las mesas salen solo del ancho y la mitad de arriba es pared. Solo suma +2 de Atractivo, y mejorarlo '
    'cuesta el doble.</p>',
    '<p>Cómo aprovechar la planta de arriba con <b>un altillo con mesas</b> (más plazas, más clientes, más '
    'oro). En las dos opciones se sube por la escalera de la casa y la ficha diría las plazas de más.</p>'
    '<p>Lo que eliges es <b>cuánto altillo</b>: toda la planta de arriba, o solo una galería al fondo.</p>',
    ('Altillo entero', 'Toda la planta de arriba es un suelo de tablas con barandilla, con mesas.', '+4 mesas · +8 plazas'),
    ('Galería al fondo', 'Una galería estrecha pegada a la pared del fondo; delante sigue el hueco alto.', '+3 mesas · +6 plazas'),
    [
        part('', 'HOY', 'El salón de 3 × 2', 'Cinco mesas abajo; arriba, solo pared.',
             shot('e1-antes.png', 'El salón hoy', [
                 'Abajo: la barra, cinco mesas (10 plazas) y la chimenea.',
                 'Arriba: solo pared, estandartes y la lámpara colgando en el hueco.'])),
        part('a', 'A', 'Altillo entero', 'Un <b>suelo de tablas</b> de lado a lado a media altura, con barandilla.',
             shot('e1-a.png', 'El salón con altillo', [
                 'La barandilla torneada cruza todo el salón a media altura, sobre pies derechos.',
                 'Arriba, 4 mesas con gente sentada (8 plazas más).',
                 'Abajo, faroles colgados de las vigas; la lámpara grande sube al altillo.'])
             + shot('e1-a-detalle.png', 'De cerca', ['Los de arriba asoman por encima de la barandilla, con sus velas.'])
             + shot('e1-a-movil.png', 'Cómo se ve en el móvil', narrow=True)
             + pc(['Más plazas: +8.', 'Se entiende enseguida como una segunda planta.'],
                  ['El salón pierde la doble altura.', 'Abajo queda más bajo y algo más oscuro.'])),
        part('b', 'B', 'Galería al fondo', 'Una <b>galería estrecha</b> pegada a la pared del fondo.',
             shot('e1-b.png', 'El salón con galería', [
                 'La galería va pegada a la pared del fondo; sale más pequeña porque está lejos.',
                 'Arriba, 3 mesas (6 plazas más).',
                 'Delante sigue el hueco de doble altura con la lámpara, y la barra queda debajo de la galería.'])
             + shot('e1-b-detalle.png', 'De cerca', ['Más ligera: se siguen viendo la pared del fondo y los estandartes.'])
             + shot('e1-b-movil.png', 'Cómo se ve en el móvil', narrow=True)
             + pc(['Conserva la sensación de salón grande y alto.', 'Usa el fondo de la sala, como sugeriste.'],
                  ['Menos plazas: +6.', 'La galería es estrecha.'])),
    ],
    '<p><b>La B (galería).</b> Conserva lo bonito del salón alto, aprovecha el fondo de la sala y sigue '
    'dando 6 plazas. Si prefieres sacarle todo el partido (8 plazas), la A también queda bien.</p>'
    '<p>En las dos, como elegiste en E1, la altura deja de encarecer las mejoras del salón.</p>')
print('ok')
