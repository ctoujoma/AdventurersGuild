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
- `tr(clave)`: el texto **sin rellenar**, para las plantillas que el núcleo aún rellena a su
  manera (`{n}`, `{place}`). Es de transición: lo nuevo, con `t(clave, huecos)`.
- `msg(clave, huecos)` y `tx(…)`: lo que se **guarda en la partida** es el mensaje (clave y
  huecos), no la frase; se escribe al enseñarlo, en el idioma que esté puesto. Ver «Partidas».
- Los datos (`src/data`) escriben sus textos al cargar el módulo: el idioma se elige al
  arrancar y cambiarlo recarga la página.
- Una clave que no existe sale como la clave (y avisa en la consola); el test la pilla antes.

## Idioma

- Se guarda en Ajustes (`lang` en `jarro:ajustes`); `src/textos` lo lee al arrancar. Sin él, o
  si no hay textos de ese idioma, español. Lo que falte en un idioma sale en español.
- El selector de Ajustes se pondrá cuando llegue el inglés (y entonces, por defecto, el idioma
  del navegador). Cambiar de idioma recargará la página.

## Partidas guardadas (decidido: partidas limpias con conversor)

- Hoy (versión 5) las partidas guardan frases ya escritas: informes, cartas, encargos del
  tablón, cita e historial de los héroes, nombres de objetos.
- Con el bloque del núcleo: las partidas nuevas guardan **mensajes** (`Msg`: clave y huecos) y
  ids (objetos, lugares, clientes, apodos), y se sube `SAVE_VERSION` a 6 con un **conversor de
  la 5 a la 6** al cargar: lo que sale de un catálogo se pasa a id o a mensaje (objetos, salas,
  resultados, encargos del tablón, apodos); el texto libre que no se puede reconocer (informes
  y cartas viejos, historial) se queda como frase (`Txt` = mensaje o frase) y se sigue leyendo
  en español. Así no se pierden las partidas de los testers.
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
| 1 | Sistema, convención, tabla, tests y `src/data` | Hecho (este PR) |
| 2 | `src/core` (informes, cartas, avisos) con mensajes guardados y conversor v5→v6 | Siguiente |
| 3 | `src/ui`, `src/world`, `src/art`, `src/platform` | Después |
| 4 | Inglés y selector en Ajustes | Cuando el usuario diga |

Bloque 1, comprobado: todo lo que exportan los módulos de `src/data` sale idéntico (volcado
antes y después), y también la salida de sus funciones (etiquetas, efectos de salas y mejoras,
nombres de premios, objetos, glosario). Solo cambian niveles que no existen (salía
«+undefined»). `npm run sim` da la misma salida. Las capturas de la interfaz (`tools/shots/ui.mjs`)
dan las mismas medidas.

## Cabos sueltos (para no olvidar)

Lo que queda por hacer o por decidir para poder traducir de verdad. Al resolver uno, táchalo y
di en qué PR.

1. **El núcleo guarda frases hechas** (`Report.body`, `chips`, `Quest.title/text`, `Hero.quote`,
   `history`, `Item.name`, cartas, avisos, epitafios, objetivos): pasar a `Msg` + conversor
   v5→v6 (bloque 2).
2. **Plantillas que el núcleo rellena a su manera** con `tr()`: `fill` de `core/generate.ts`
   (con `{Threat}` en mayúscula y las contracciones «a el» → «al», «de el» → «del», que son del
   español: deberán ser de cada idioma), `core/incidents.ts`, `core/goals.ts`, `core/journey.ts`,
   `core/rumors.ts` y `ui/panels/LibroPanel.tsx` (`{n}`). Pasarlas a `t(clave, huecos)` y
   `{amenaza, mayus}`. De paso, los huecos que aún van en inglés (`{place}`, `{threat}`, `{who}`,
   `{gold}`, `{band}`, `{foe}`…) pasan a español (`{lugar}`, `{amenaza}`…).
3. **Asaltos con `{viene|vienen}`** (`bandNumber`, en `data/raids.ts`, `ui/Hud.tsx`,
   `ui/panels/MapPanel.tsx`): pasar a `{varios, select, si {vienen} other {viene}}`. El test se
   las salta mientras tanto (`LEGACY`).
4. **Textos que hacen de id**:
   - lugares: `PLACE_INFO` va por el nombre en español y `Quest.place` lo guarda (`data/places.ts`
     está en `ALLOWED` por esto);
   - clientes: `Quest.client` guarda la etiqueta (`clientProse` la busca por la etiqueta del
     idioma de ahora: los ids ya están en `encargos.clientes`);
   - objetos: se identifican por el nombre (los legendarios con dibujo propio en
     `art/legendaries.ts`, y lo guardado);
   - `Outcome` (`'Éxito brillante'`…) se enseña tal cual; `SkillId`, `QuestType` y `AttrId`
     también (p. ej. `+1 Combate` en `itemEffect`, `ATTR_NAMES`): necesitan su etiqueta.
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
11. En `trabajadores.yaml` quedan dos claves en inglés (`role`, `quote`): renombrarlas cuando se
    toque `data/workers.ts`.
12. El selector de idioma en Ajustes y la recarga al cambiarlo (bloque 4).

## Decisiones (22 de noviembre, con el usuario)

- Formato YAML, un fichero por zona y una carpeta por idioma; `es` es el origen.
- Huecos con nombre y la sintaxis ICU para plurales y género; frases enteras.
- Partidas limpias (mensajes e ids) con conversor de las viejas; lo que no se pueda convertir
  se lee en español. Sin perder las partidas de los testers.
- Los nombres de los héroes no se traducen; apodos, citas, historial y epitafios sí.
- Tabla CSV de ida y vuelta, y tests de claves y de textos sueltos.
- El idioma, en Ajustes (el selector, cuando llegue el inglés).
