# Textos del juego: convención y estado

Todos los textos del juego salen de ficheros, para poder revisarlos y cambiar frases a mano y
para traducirlos (inglés primero). **Si escribes textos nuevos, escríbelos ya así** (todos los
agentes). Lo decidido con el usuario el 22 de noviembre está resumido al final («Decisiones»).

## Dónde están

- `src/textos/<idioma>/<zona>.yaml`: un fichero por zona (encargos, objetos, salas, relatos,
  etiquetas…) y una carpeta por idioma. **`es` es el origen**; los demás se rellenan desde él.
- `src/textos/index.ts`: lo que usa el código (`t`, `tr`, `tl`, `msg`, `tx`, `list`).
- `src/textos/formato.ts`: el intérprete de los mensajes (huecos, plurales, género).
- `tools/textos/`: el cargador (plugin de Vite y de esbuild: los YAML pasan a datos al compilar,
  el juego no lleva ningún lector de YAML) y la tabla para revisar o traducir.

## Cómo se escribe un fichero

```yaml
# Nota para quien revise o traduzca (contexto, dónde sale, qué es cada hueco).
informe:
  # Chapita del informe: un héroe codicioso se queda parte del oro.
  codicioso: "{heroe} se queda {oro} monedas"
  amenazas:
    - "un huargo tuerto"
    - "un oso con mal genio"
```

- Claves en español, en minúscula, con `_` o `-` (sin espacios ni tildes). La clave completa es
  `zona.ruta`: `etiquetas.estado.herido`. Los ids del juego que ya están en español
  (`Cazar`, `Combate`, `guerrero`) se usan tal cual como clave.
- Texto siempre **entre comillas dobles** (Prettier lo deja así). Dentro, las comillas del
  texto son «» o “”.
- Las notas son comentarios `#` encima de la clave; salen en la tabla como columna «nota».
- **Listas de variantes** (títulos, amenazas, frases de relleno): el mismo número de entradas en
  todos los idiomas. El generador elige por posición, así una partida con la misma semilla
  sale igual en cualquier idioma (un test lo vigila).

## Huecos, plurales y género (ICU, lo que conocen los traductores)

| Escribe | Sale |
| --- | --- |
| `{nombre}` | el valor; un número tal cual; una lista, «a, b y c»; un mensaje, escrito |
| `{n, plural, one {# jarra} other {# jarras}}` | «1 jarra», «3 jarras» (`=0 {…}` para el 0) |
| `{sexo, select, f {pálida} other {pálido}}` | según el valor (`f`/`m`) |
| `{lujo, select, si {; +2 de moral} other {}}` | sí/no: los `true`/`false` llegan como `si`/`no` |
| `{banda, mayus}` | el hueco con mayúscula inicial |

- **Frases enteras, nunca a trozos.** Nada de `'pálid' + (f ? 'a' : 'o')` ni de cifra + palabra
  pegadas en el código: la frase completa va en el fichero con sus huecos, y lo que cambia
  (cuántos, chico o chica, si tiene algo o no) va con `plural` o `select`. Lo que es opcional
  dentro de una frase, con un `select` sobre un sí/no.
- Los huecos se llaman en español y dicen lo que son: `{heroe}`, `{oro}`, `{dias}`, `{sala}`.
- Porcentajes: la cifra en el hueco y el signo en el texto (`{n} %`), porque cada idioma lo
  escribe a su manera.
- Nombres de héroes y de gente: no se traducen; van en un hueco.
- Para listas en una frase, `list(['a', 'b'])` («a y b») o `list(xs, 'o')` («a o b»).

## En el código

```ts
import { t, tl, msg, tx } from '../textos';

t('etiquetas.estado.herido', { sexo: h.sex, dias: h.days }); // «Herida · 3 d»
tl('encargos.giros'); // la lista de variantes
msg('informe.codicioso', { heroe: h.name, oro: 30 }); // para guardar en la partida
tx(report.body[0]); // escribir lo guardado (mensaje o frase vieja)
```

- `t(clave, huecos)`: el texto escrito en el idioma elegido.
- `tl(clave)`: una lista. `tl<readonly [string, string][]>(…)` para listas de pares.
- `tr(clave)`: el texto **sin rellenar** (para mirar qué huecos tiene una plantilla).
- `msg(clave, huecos)` y `tx(…)`: lo que se **guarda en la partida** es el mensaje (clave y
  huecos), no la frase; se escribe al enseñarlo, en el idioma que esté puesto. Ver «Partidas».
- `idText(…)`: un texto guardado escrito **siempre en español**. Solo para lo que hace de id
  (el dibujo de un legendario va por su nombre, comparar títulos) o para reconocer frases de
  partidas viejas. Nunca para enseñar.

### Qué usar en el núcleo (`src/core`)

- **Lo que se guarda en la partida** (informes y sus chapitas, avisos del amanecer, cartas,
  historial y cita de los héroes, títulos y textos de encargos, objetos, objetivos, el suceso
  pendiente…): `msg(clave, huecos)`. Los tipos ya lo piden: esos campos son `Txt`.
- **Lo que se devuelve para enseñarlo ya** (por qué no se puede hacer algo, la ficha de una
  sala, el estado de la sastrería): `t(clave, huecos)`.
- Los huecos pueden llevar otros mensajes: un lugar (`placeMsg(id)`), un cliente
  (`clientMsg(id)`, `clientLabelMsg(id)`), un objeto (su `name`), una sala
  (`msg('salas.salas.<tipo>.nombre')`), una banda (`bandParams(band)` da `{banda}` y
  `{varios}`), un rango (`rankMsg(i)`), un material (`matMsg(m)`). Se escriben en el idioma
  de quien lee.
- Las listas de variantes se eligen por posición (`rng.int(0, lista.length - 1)` gasta el mismo
  azar que `rng.pick`) y se guarda la clave con su número: ``msg(`relatos.ambiente.${i}`)``.
- En la interfaz, todo campo `Txt` se enseña con `tx(…)`. Ojo: TypeScript no avisa si un
  mensaje se pinta tal cual en JSX o en una plantilla (`` `${…}` ``): para buscarlos,
  `npm run textos:sin-tx` (ver «Herramientas»).
- Los datos (`src/data`) escriben sus textos al cargar el módulo: el idioma se elige al
  arrancar y cambiarlo recarga la página.
- Una clave que no existe sale como la clave (y avisa en la consola); el test la pilla antes.

### En la interfaz (`src/ui`, `src/world`, `src/audio`)

- Zonas: `pantallas` (App, portada, amanecer, ajustes, partidas…), `barra` (barra de arriba,
  campana, avisos, plazos, obras, marcas de la escena), `ficha` (ficha del héroe, gente de la
  casa, objetos), `paneles` (tablón, mapa, héroes, gremio, salas, talleres, peleas…) y `escena`
  (lo que se pinta en la taberna y la música). Dentro, **una sección por componente**, con el
  nombre del fichero en minúscula (`paneles.tablon.…` sale de `TablonPanel.tsx`): así quien
  revise sabe dónde sale cada frase.
- Todo lo que se lee es texto: también `aria-label`, `title`, `data-help`, `placeholder` y los
  toasts. En JSX, ninguna palabra suelta (`<b>{n}</b> monedas` → `{t('…monedas', { n })}`).
- **Frases enteras**: nada de `{n} {n === 1 ? 'día' : 'días'}`, `plural(…)` ni `'Ampliar ' +
  sala`. El plural, el género y lo opcional van en el texto (`plural`, `select`, sí/no). El
  `plural()` de español del núcleo ya no existe; `listNames` usa el formato de listas del idioma.
- **Nunca se compara con un texto traducido** (`task !== 'Descansa'`, `name === 'Gremio'`):
  se compara con un id, una clave o con `t('…')` de la misma clave. Para reconocer un texto del
  núcleo, su clave (`c.t.k === 'materiales.no_cabe'`) o el principio de su plantilla (`NO_GOLD`
  en `ui/works.ts`).
- Lo que tiene id se enseña con su nombre: lugares con `placeName(id)` (o `placeMsg` en un
  hueco), clientes con `clientLabel(id)`, tipos de encargo con `questTypeName`, resultados con
  `outcomeLabel`, habilidades con `skillName`, salas con artículo con `salas.con_articulo.<tipo>`.
- Un literal que parece texto y no lo es (la semilla de una textura, un nombre interno) se marca
  con el comentario `/* no es texto */` delante, y el test lo deja.

## Idioma

- Idiomas: `es` (origen) e `en` (bloque 4).
- Se guarda en Ajustes (`lang` en `jarro:ajustes`); `src/textos` lo lee al arrancar. Sin él, el
  del navegador si hay textos para él (`browserLang`); si no, español. Lo que falte en un
  idioma sale en español.
- El selector está en Ajustes («Idioma», con el nombre de cada idioma en su lengua). Al cambiar,
  guarda los ajustes y recarga la página (la partida se guarda sola al salir). `<html lang>` se
  pone al arrancar.
- Fuera del navegador (tests, `npm run sim`) no se mira el idioma del navegador: siempre `es`.
  Las capturas de `tools/shots` abren el navegador con `locale: 'es-ES'` para salir en español.
- Inglés, retoques propios: `Lang.post` de `en` pone «an» delante de vocal cuando el artículo
  va fuera del hueco («a {objeto}» → «an iron sword»). Los nombres de los héroes y de los pueblos
  con nombre propio (Hondovado, Valdeloro…) no se traducen; los lugares descriptivos sí
  («the mill», «Greyhollow»).
- La taberna tiene nombre de serie en cada idioma (`personalizar.nombre_inicial`: «El Jarro
  Partido», «The Broken Jug»). Una taberna sin bautizar lo enseña en el idioma de ahora aunque
  la partida se empezara en otro (`isDefaultName` mira el de todos los idiomas; `customOf` lo
  cambia al leer), y el de serie no cuenta como bautizo. El que pone el jugador no se toca.
- El nombre del juego: `pantallas.title.app` en la pestaña del navegador («Adventurer's Guild»
  en inglés) y la portada (`title.el_gremio_de` + `title.aventureros`).

## Partidas guardadas (decidido: partidas limpias con conversor)

- **Versión 6** (bloque 2): las partidas guardan **mensajes** (`Msg`: clave y huecos) e ids.
  `Txt` = mensaje o frase: las frases solo vienen de partidas viejas.
- **Conversor de la 5 a la 6** (`core/convert.ts`, al cargar en `platform/storage.ts`): pasa a
  mensaje lo que sale de un catálogo y se reconoce comparando con el español: objetos (arcón,
  equipo puesto, talleres, botín de los encargos), trofeos, encargos del tablón y de los
  grupos fuera (con su plantilla y su amenaza; también los de rumor, mensajero, historia y
  rescate), clientes (a su id), giros, apodos, citas de héroes y trabajadores, el rumor, la
  banda del asalto, la frase del día, los objetivos en curso, el suceso pendiente y los caídos
  del tío. El texto libre ya escrito (informes y cartas, historial, avisos del amanecer, Libro,
  epitafios) se queda como frase y se sigue leyendo en español. Lo que no reconoce, también.
- Lo prueba `core/convert.test.ts` con una partida v5 de verdad (`core/fixtures/partida-v5.json`,
  jugada un mes con el código de antes): todo lo de catálogo pasa a mensaje y se lee igual.
- Los lugares van por su id, que es su nombre en español («el molino»): no hay que convertir
  nada; el nombre que se enseña sale de `lugares.sitios.<clave>` (`placeName`, `placeMsg`).
- Los nombres de los héroes se quedan como nacieron en cualquier idioma.

## La tabla (revisar o traducir)

- `npm run textos:sacar [textos.csv]`: una fila por texto con `clave`, `nota`, `es` y una
  columna por cada otro idioma. Se abre con Google Sheets, LibreOffice o Excel.
- Para revisar: cambiar la columna `es` (o la nota). Para traducir: añadir una columna con el
  código del idioma (`en`) y rellenarla.
- `npm run textos:meter textos.csv`: mete los cambios en los YAML. En `es` cambia solo lo
  tocado (y conserva notas y orden); los otros idiomas se rehacen con la forma de `es` y solo lo
  traducido. Una lista a medias se deja fuera entera (sale en español) y lo avisa. Acepta la
  tabla separada por comas o por punto y coma.
- `textos.csv` está en `.gitignore`: la tabla es de ida y vuelta, lo que manda son los YAML.

## Los tests (`src/textos/textos.test.ts`)

- Todos los textos de `es` se pueden leer (huecos bien cerrados, `other` en cada caso).
- Cada otro idioma tiene las mismas claves y listas del mismo largo, y no usa huecos que no
  estén en `es` (puede no usar alguno: el género en inglés, `{sexo, select, …}`, sobra).
- Las claves que usa el código (`t('…')`, `tl`, `tr`, `has`, `msg`; con `${…}`, el principio)
  existen.
- **No hay textos sueltos** en el código (`PENDING` ya está vacío), salvo en `ALLOWED` (a
  propósito, con el porqué: nombres de héroes, lugares, el conversor, el dibujo de los
  legendarios, avisos de dibujos mal hechos y los shaders). Detecta frases (dos palabras
  seguidas), palabras con tilde, ñ, ¿ o ¡, y **cualquier palabra en el texto de JSX**. No mira
  los atributos que nunca son texto (`class`, `style`, `key`…) ni lo marcado `/* no es texto */`.
- Lo que no ve (una palabra suelta sin tilde en el código, `'nadie'`), lo pilla el idioma falso
  (ver «Herramientas»).

## Estado (por bloques, un PR cada uno)

| Bloque | Qué | Estado |
| --- | --- | --- |
| 1 | Sistema, convención, tabla, tests y `src/data` | Hecho (#201) |
| 2 | `src/core` (informes, cartas, avisos) con mensajes guardados y conversor v5→v6 | Hecho (#203) |
| 3 | `src/ui`, `src/world`, `src/audio` (la interfaz y la escena) | Hecho (#204) |
| 4 | Inglés y selector en Ajustes | Hecho (este PR) |

Bloque 1, comprobado: todo lo que exportan los módulos de `src/data` sale idéntico (volcado
antes y después), y también la salida de sus funciones (etiquetas, efectos de salas y mejoras,
nombres de premios, objetos, glosario). Solo cambian niveles que no existen (salía
«+undefined»). `npm run sim` da la misma salida. Las capturas de la interfaz (`tools/shots/ui.mjs`)
dan las mismas medidas.

Bloque 2, comprobado: `npm run sim` da la misma salida (el azar no cambia); la interfaz da las
mismas medidas en todas las pantallas; los 897 tests pasan. Cambios de texto a propósito (mejor
español, misma idea): la contracción «a el»/«de el» ya no se come la «í» («Amplía el» salía
«Amplíal»; «decía el», «decíal»), y se aplica en todas las frases con huecos («cerca del
molino»); «calidad buena/rara» (decía «calidad bueno»); «veterana» en femenino; las listas
llevan «y» al final («3 campesinos y 1 noble»).

Bloque 3: unos 1.250 textos de la interfaz y la escena a `pantallas`, `barra`, `ficha`,
`paneles` y `escena`, rehechos como frases enteras (unas 200 estaban a trozos). Comprobado:
`npm run sim` da la misma salida; los 897 tests pasan; el volcado de los textos de todas las
pantallas (`tools/shots/textos.mjs`, con reloj falso y partida fija) sale igual antes y después
salvo los cambios a propósito; con el idioma falso no queda texto de la interfaz sin sacar
(solo lo ya escrito de las partidas viejas, como se decidió). Cambios a propósito: plurales y
género donde antes no los había («1 héroe», «herida», «desaparecida»), «En el taller de
alquimia» (salía «En la taller…»), listas con «y» en los avisos. Arreglados de paso cuatro
fallos del bloque 2: el id del cliente («molinero») en la hoja del encargo, el mapa y el Libro;
«[object Object]» en el aviso de incidentes, en la ronda de la barra y en la etiqueta de las
notas del tablón; y la chapita de materiales del informe, que guardaba el nombre ya escrito.

Bloque 4: los 52 ficheros traducidos al inglés (`src/textos/en`, sin notas: las notas viven en
`es`). Comprobado: el test de claves pasa (mismas claves y listas, sin huecos de más); los 897
tests, lint, formato y build pasan; `npm run sim` no cambia (sigue en español); recorrido de las
pantallas con `XLANG=en` (ver «Cabos sueltos» para lo que queda en español).

## Herramientas

- `npm run textos:sacar` / `textos:meter`: la tabla (arriba).
- `npm run textos:sin-tx`: busca con el comprobador de tipos de TypeScript cada `{expr}` de JSX,
  cada `` `${expr}` ``, cada `+`, `===` y `!==` y cada `.join()` de una lista cuyo tipo sea
  `Msg`/`Txt` (un mensaje que se pintaría como «[object Object]» o se compararía mal). Pasarlo
  tras tocar la interfaz; lo que salga, con `tx()` (o `idText()` si es para comparar).
- `node tools/shots/textos.mjs <carpeta> <guion.json>`: vuelca el texto de cada pantalla
  (`innerText` y los `aria-label`, `title`…) con reloj falso, azar con semilla y la partida de
  `PARTIDA`, así que dos pasadas salen iguales y se pueden comparar antes y después de un
  cambio. Con `XLANG=xx` usa otro idioma.
- **El idioma falso**: `npm run textos:falso` crea `src/textos/xx/` con cada texto entre ‹ ›;
  compilar y volcar con `XLANG=xx` (o ponerlo en Ajustes a mano): todo lo que se lea sin ‹ › es
  texto escrito en el código. `src/textos/xx/` no se sube (`.gitignore`); se borra con
  `npm run textos:falso -- --quitar`.

## Cabos sueltos (para no olvidar)

Lo que queda por hacer o por decidir para poder traducir de verdad. Al resolver uno, táchalo y
di en qué PR.

1. ~~El núcleo guarda frases hechas~~: hecho en el bloque 2 (mensajes y conversor).
2. ~~Plantillas que el núcleo rellenaba a su manera~~ (`fill`, `{Threat}`, huecos en inglés):
   hecho en el bloque 2. Las contracciones del español son ahora `Lang.post` (`textos/index.ts`).
3. ~~Asaltos con `{viene|vienen}`~~: hecho en el bloque 2 (`bandParams`, `varios` en cada banda).
4. **Textos que hacen de id** (lo que queda):
   - ~~clientes~~ (bloque 2: `Quest.client` es un id) y ~~lugares~~ (su id es su nombre en
     español, con su nombre traducible en `lugares.sitios`);
   - objetos: el dibujo propio de los legendarios (`art/legendaries.ts`) va por el nombre en
     español (`idText`); valdría un id en el catálogo;
   - ~~en la interfaz, `Outcome`, `QuestType` o `SkillId` tal cual~~ y ~~`chipMat` leyendo la
     chapita en español~~: hecho en el bloque 3 (`outcomeLabel`, `questTypeName`, `skillName`;
     la chapita se reconoce por su clave).
   - el buzón (`MailPanel`) distingue las cartas con `idText(heading).startsWith('Carta')`:
     funciona en cualquier idioma (compara en español), pero valdría un campo en el informe.
5. `FOE_WORDS` (`data/journey.ts`) busca palabras en español en el texto del encargo: en otro
   idioma no casaría. Mejor sacar el enemigo de la plantilla o la amenaza.
6. `sealInitial` (`data/custom.ts`) se salta artículos en español.
7. Cifras: salen tal cual (sin separador de miles), como antes. Si un idioma lo quiere, se puede
   formatear con `Intl.NumberFormat` en `formato.ts`.
8. Algunos textos se pasan a minúscula en el código (`unlockName`, `rarityList`, `dangerLabel`):
   vale para inglés; para un idioma con mayúsculas en los nombres (alemán) habría que cambiarlo.
9. Nombres de héroes (`data/names.ts`): se quedan en el código y no se traducen. Si un idioma
   quiere su propia lista para los héroes nuevos, se saca a `nombres.yaml`.
10. ~~Los colores de las rarezas en el código~~: ahora `objetos.colores` (bloque 4).
11. ~~Claves en inglés en `trabajadores.yaml`~~: ahora `papel` y `cita` (bloque 2).
13. Las peleas contra jefes guardan los nombres de los luchadores ya escritos
    (`BossFight.sim.setup`: «Esbirro», el nombre del jefe): una pelea guardada se ve en el idioma
    en que se jugó. Para traducirlas, guardar ids y escribir al pintar.
14. El test de textos sueltos no ve **palabras sueltas sin tilde** en el código (`'nadie'`):
    en la interfaz se buscaron con el idioma falso (bloque 3); en `data` y `core`, a mano. Pasar
    el idioma falso de vez en cuando (ver «Herramientas»).
15. `RANKS[i].name`, `ATTR_NAMES`, `SLOT_NAMES`, `PERKS`, `MATERIALS` y similares se escriben al
    cargar (en el idioma de la partida); para guardar, usar su mensaje (`rankMsg`, `matMsg`…).
12. ~~El selector de idioma en Ajustes y la recarga al cambiarlo~~: hecho en el bloque 4.
16. Abreviaturas sacadas cortando el nombre (`skillName(k).slice(0, 3)` en el arcón): en otro
    idioma pueden salir raras; si molesta, una lista de cortas como `etiquetas.habilidades_corto`.
17. ~~Comillas «» puestas en el código alrededor de un hueco~~: en la interfaz ya van en el
    texto (bloque 3), para que cada idioma ponga las suyas (“” en inglés).
18. Los avisos que miran el informe por su clave (almacén lleno: `materiales.no_cabe`) no
    reconocen los informes de las partidas v5 (frases): solo se pierde ese aviso una vez.
19. Muchos nombres se pasan a minúscula para meterlos en una frase (`ROOMS[…].name.toLowerCase()`,
    materiales, ranuras): ver el 8. Lo limpio sería un texto «en frase» por cada nombre, como
    `salas.con_articulo`.
20. Algunas cuentas sin plural siguen como estaban («{n} raciones» en el coste del forastero,
    «{n} huecos»): con el inglés se verá si hace falta `plural`.
21. Siguen en español, fijos: `index.html` (título y descripción antes de arrancar) y
    `public/manifest.webmanifest` (nombre de la app instalada), que no saben de idiomas; y las
    «Novedades» de la portada, que salen de los mensajes de git.

## Decisiones (22 de noviembre, con el usuario)

- Formato YAML, un fichero por zona y una carpeta por idioma; `es` es el origen.
- Huecos con nombre y la sintaxis ICU para plurales y género; frases enteras.
- Partidas limpias (mensajes e ids) con conversor de las viejas; lo que no se pueda convertir
  se lee en español. Sin perder las partidas de los testers.
- Los nombres de los héroes no se traducen; apodos, citas, historial y epitafios sí.
- Tabla CSV de ida y vuelta, y tests de claves y de textos sueltos.
- El idioma, en Ajustes (el selector, cuando llegue el inglés).
