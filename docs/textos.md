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

## Idioma

- Se guarda en Ajustes (`lang` en `jarro:ajustes`); `src/textos` lo lee al arrancar. Sin él, o
  si no hay textos de ese idioma, español. Lo que falte en un idioma sale en español.
- El selector de Ajustes se pondrá cuando llegue el inglés (y entonces, por defecto, el idioma
  del navegador). Cambiar de idioma recargará la página.

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
- Cada otro idioma tiene las mismas claves, los mismos huecos y listas del mismo largo.
- Las claves que usa el código (`t('…')`, `tl`, `tr`, `has`, `msg`; con `${…}`, el principio)
  existen.
- **No hay textos sueltos** en el código, salvo en las carpetas de `PENDING` (lo que falta por
  sacar) y en `ALLOWED` (a propósito, con el porqué). Al acabar una carpeta, se quita de
  `PENDING`. Detecta frases (dos palabras seguidas) y palabras con tilde, ñ, ¿ o ¡.

## Estado (por bloques, un PR cada uno)

| Bloque | Qué | Estado |
| --- | --- | --- |
| 1 | Sistema, convención, tabla, tests y `src/data` | Hecho (#201) |
| 2 | `src/core` (informes, cartas, avisos) con mensajes guardados y conversor v5→v6 | Hecho (este PR) |
| 3 | `src/ui`, `src/world`, `src/art`, `src/platform` | Después |
| 4 | Inglés y selector en Ajustes | Cuando el usuario diga |

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

## Herramientas

- `npm run textos:sacar` / `textos:meter`: la tabla (arriba).
- `npm run textos:sin-tx`: busca con el comprobador de tipos de TypeScript cada `{expr}` de JSX,
  cada `` `${expr}` `` y cada `+`, `===` y `!==` cuyo tipo sea `Msg`/`Txt` (un mensaje que se
  pintaría como objeto o se compararía mal). Pasarlo tras tocar la interfaz; lo que salga, con
  `tx()` (o `idText()` si es para comparar).

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
   - en la interfaz quedan sitios que enseñan `Outcome`, `QuestType` o `SkillId` tal cual (el
     núcleo ya usa `outcomeLabel`, `skillName`, `attrName`): bloque 3.
   - `ui/mats.ts` (`chipMat`) busca el material leyendo la chapita en español: bloque 3.
5. `FOE_WORDS` (`data/journey.ts`) busca palabras en español en el texto del encargo: en otro
   idioma no casaría. Mejor sacar el enemigo de la plantilla o la amenaza.
6. `sealInitial` (`data/custom.ts`) se salta artículos en español.
7. Cifras: salen tal cual (sin separador de miles), como antes. Si un idioma lo quiere, se puede
   formatear con `Intl.NumberFormat` en `formato.ts`.
8. Algunos textos se pasan a minúscula en el código (`unlockName`, `rarityList`, `dangerLabel`):
   vale para inglés; para un idioma con mayúsculas en los nombres (alemán) habría que cambiarlo.
9. Nombres de héroes (`data/names.ts`): se quedan en el código y no se traducen. Si un idioma
   quiere su propia lista para los héroes nuevos, se saca a `nombres.yaml`.
10. Los colores de las rarezas (`art/tiers.ts`, `TIER_COLOR_NAMES`) y el resto de `src/art`.
11. ~~Claves en inglés en `trabajadores.yaml`~~: ahora `papel` y `cita` (bloque 2).
13. Las peleas contra jefes guardan los nombres de los luchadores ya escritos
    (`BossFight.sim.setup`: «Esbirro», el nombre del jefe): una pelea guardada se ve en el idioma
    en que se jugó. Para traducirlas, guardar ids y escribir al pintar.
14. El test de textos sueltos no ve **palabras sueltas sin tilde** (`'Arma'`, `'nadie'`): se
    buscaron a mano en `data` y `core` en el bloque 2; en la interfaz habrá que mirar igual.
15. `RANKS[i].name`, `ATTR_NAMES`, `SLOT_NAMES`, `PERKS`, `MATERIALS` y similares se escriben al
    cargar (en el idioma de la partida); para guardar, usar su mensaje (`rankMsg`, `matMsg`…).
12. El selector de idioma en Ajustes y la recarga al cambiarlo (bloque 4).

## Decisiones (22 de noviembre, con el usuario)

- Formato YAML, un fichero por zona y una carpeta por idioma; `es` es el origen.
- Huecos con nombre y la sintaxis ICU para plurales y género; frases enteras.
- Partidas limpias (mensajes e ids) con conversor de las viejas; lo que no se pueda convertir
  se lee en español. Sin perder las partidas de los testers.
- Los nombres de los héroes no se traducen; apodos, citas, historial y epitafios sí.
- Tabla CSV de ida y vuelta, y tests de claves y de textos sueltos.
- El idioma, en Ajustes (el selector, cuando llegue el inglés).
