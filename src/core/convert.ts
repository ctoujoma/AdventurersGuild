/**
 * Conversor de partidas de la versión 5 a la 6 (textos limpios, ver `docs/textos.md`).
 *
 * En la 5 las partidas guardaban frases ya escritas en español; en la 6 guardan mensajes (clave
 * y huecos) e ids, y se escriben al enseñarlas en el idioma que toque. Aquí se pasa a mensaje
 * todo lo que sale de un catálogo y se puede reconocer comparando con el texto en español:
 * objetos, trofeos, encargos del tablón (y los de los grupos que están fuera), clientes, giros,
 * apodos, citas, rumores, bandas, objetivos en curso, el suceso pendiente y la frase del día.
 *
 * Lo que es texto libre ya escrito (informes y cartas, historial de los héroes, avisos del
 * amanecer, el Libro, epitafios de los caídos) se queda como frase: `Txt` admite las dos cosas y
 * se sigue leyendo en español. Lo que no se reconoce, también se queda como estaba.
 */
import { BANDS } from '../data/raids';
import { CHAINS } from '../data/chains';
import { GEAR, TREASURES, TROPHIES } from '../data/items';
import { GOALS } from '../data/goals';
import { QUOTES } from '../data/names';
import { RECIPES } from '../data/recipes';
import { clientIdOf, TEMPLATES, TWISTS } from '../data/quests';
import { placeMsg } from '../data/places';
import { RUMORS } from '../data/rumors';
import { FLAVOR, SCARS } from '../data/stories';
import { VILLAGE, WORKER_QUOTES } from '../data/workers';
import { has, idText, msg, tl, type Msg, type Txt } from '../textos';
import { SLOTS } from './gear';
import { goalMsg } from './goals';
import type { GameState, Hero, Item, Quest, Trophy, Worker } from './model';

/** Un texto escrito en español → su mensaje, si está en la lista. */
function catalog(msgs: readonly Msg[]): Map<string, Msg> {
  return new Map(msgs.map((m) => [idText(m), m]));
}
const keys = (base: string, list: readonly unknown[]) => list.map((_, i) => msg(`${base}.${i}`));

/** Convierte un texto si es una frase que está en el catálogo. */
const pick = (x: Txt | undefined, cat: Map<string, Msg>): Txt | undefined =>
  typeof x === 'string' ? (cat.get(x) ?? x) : x;

// ---------- Objetos ----------

let itemCat: Map<string, { name: Txt; desc: Txt }> | undefined;
function items() {
  if (!itemCat) {
    itemCat = new Map();
    const all = [
      ...GEAR,
      ...TREASURES,
      ...Object.values(RECIPES).flatMap((r) => [r.common, r.good]),
    ];
    for (const g of all) itemCat.set(idText(g.name), { name: g.name, desc: g.desc });
  }
  return itemCat;
}

function item(it: Item | undefined): void {
  if (!it || typeof it.name !== 'string') return;
  const c = items().get(it.name);
  if (!c) return;
  it.name = c.name;
  it.desc = c.desc;
}

function trophy(t: Trophy): void {
  if (typeof t.name !== 'string') return;
  const all = [
    ...Object.values(TROPHIES).flat(),
    ...CHAINS.flatMap((c) => (c.reward.trophy ? [c.reward.trophy] : [])),
  ];
  const c = all.find((x) => idText(x.name) === t.name);
  if (!c) return;
  t.name = c.name;
  t.desc = c.desc;
}

// ---------- Encargos ----------

/** Las claves de títulos y textos de un tipo de encargo (los genéricos y las historias). */
function questKeys(type: Quest['type']): { titles: string[]; texts: string[] } {
  const tpl = TEMPLATES[type];
  const base = `encargos.plantillas.${type}`;
  return {
    titles: [
      ...tpl.titles.map((_, i) => `${base}.titulos.${i}`),
      ...(tpl.stories ?? []).map((_, i) => `${base}.historias.${i}.0`),
    ],
    texts: [
      ...tpl.texts.map((_, i) => `${base}.textos.${i}`),
      ...(tpl.stories ?? []).map((_, i) => `${base}.historias.${i}.1`),
    ],
  };
}

/** Busca la plantilla y la amenaza que dan esta frase en este lugar (si sale de una). */
function matchQuest(text: string, keys: string[], q: Quest): Msg | undefined {
  const lugar = placeMsg(q.place);
  const threats = TEMPLATES[q.type].threats.map((_, i) =>
    msg(`encargos.plantillas.${q.type}.amenazas.${i}`),
  );
  for (const k of keys)
    for (const amenaza of threats) {
      const m = msg(k, { lugar, amenaza });
      if (idText(m) === text) return m;
    }
  return undefined;
}

/** El texto de un encargo con algo delante (rumor o recado del mensajero). */
function prefixed(text: string, q: Quest, texts: string[]): Msg | undefined {
  for (let i = 0; i < RUMORS.length; i++) {
    const rumor = msg(`rumores.rumores.${i}`, { lugar: placeMsg(q.place) });
    const head = idText(rumor);
    if (text.startsWith(`${head} `)) {
      const rest = matchQuest(text.slice(head.length + 1), texts, q);
      if (rest) return msg('rumores.encargo', { rumor, texto: rest });
    }
  }
  for (const recado of keys('mensajero.recados', tl('mensajero.recados'))) {
    const head = idText(recado);
    if (text.startsWith(`${head} `)) {
      const rest = matchQuest(text.slice(head.length + 1), texts, q);
      if (rest) return msg('mensajero.encargo', { recado, texto: rest });
    }
  }
  return undefined;
}

function quest(q: Quest | undefined): void {
  if (!q) return;
  if (!has(`encargos.clientes.${q.client}.etiqueta`)) q.client = clientIdOf(q.client) ?? q.client;
  item(q.item);
  q.twist = pick(q.twist, catalog(keys('encargos.giros', TWISTS)));
  // Paso de una historia: sus textos están en la historia.
  if (q.chain) {
    const st = CHAINS.find((c) => c.id === q.chain!.id)?.steps[q.chain.step];
    if (st) {
      if (typeof q.title === 'string' && idText(st.title) === q.title) q.title = st.title;
      if (typeof q.text === 'string' && idText(st.text) === q.text) q.text = st.text;
    }
    return;
  }
  // Rescate de un desaparecido.
  if (q.rescue && typeof q.title === 'string') {
    const name = q.title.replace(/^Rescate de /, '');
    const m = msg('informes.rescate_titulo', { heroe: name });
    if (idText(m) === q.title) q.title = m;
    const text = msg('informes.rescate_texto', { lugar: placeMsg(q.place) });
    if (idText(text) === q.text) q.text = text;
    return;
  }
  const k = questKeys(q.type);
  if (typeof q.title === 'string') q.title = matchQuest(q.title, k.titles, q) ?? q.title;
  if (typeof q.text === 'string')
    q.text = matchQuest(q.text, k.texts, q) ?? prefixed(q.text, q, k.texts) ?? q.text;
}

// ---------- Gente ----------

function hero(h: Hero): void {
  h.quote = pick(h.quote, catalog(keys(`nombres.citas.${h.cls}`, QUOTES[h.cls]))) ?? h.quote;
  if (typeof h.nick === 'string') {
    const nicks = SCARS.flatMap((_, i) =>
      (['m', 'f'] as const).map((sex) => msg(`relatos.cicatrices.${i}.nick.${sex}`)),
    );
    h.nick = pick(h.nick, catalog(nicks));
  }
  for (const slot of SLOTS) item(h.worn?.[slot]);
}

function worker(w: Worker): void {
  const all = [
    ...keys('trabajadores.citas_trabajadores', WORKER_QUOTES),
    ...Object.keys(VILLAGE).map((k) => msg(`trabajadores.pueblo.${k}.cita`)),
  ];
  w.quote = pick(w.quote, catalog(all)) ?? w.quote;
}

// ---------- La partida ----------

/** Pasa una partida de la versión 5 a la 6. Muta `s`. */
export function cleanTexts(s: GameState): void {
  for (const h of [...s.heroes, ...s.candidates]) hero(h);
  for (const w of [...s.workers, ...s.seekers]) worker(w);
  for (const it of s.inventory) item(it);
  for (const t of s.trophies) trophy(t);
  for (const q of s.quests) quest(q);
  for (const m of s.missions) quest(m.quest);
  for (const c of s.crafts ?? []) item(c.item);
  if (s.messenger) quest(s.messenger.quest);
  // Los caídos de serie (los del tío).
  const start: [string, string, string][] = [
    ['Aldric «Medio Pan»', 'partida.inicio.aldric', 'partida.inicio.aldric_epitafio'],
    ['Fausto, tu tío', 'partida.inicio.fausto', 'partida.inicio.fausto_epitafio'],
  ];
  for (const f of s.fallen)
    for (const [name, k, e] of start)
      if (f.name === name) {
        f.name = msg(k);
        if (f.epitaph === idText(msg(e))) f.epitaph = msg(e);
      }
  if (s.rumor) s.rumor.text = pick(s.rumor.text, catalog(keys('rumores.rumores', RUMORS)))!;
  const bands = catalog(BANDS);
  if (s.raid) s.raid.band = pick(s.raid.band, bands)!;
  if (s.lastRaid) s.lastRaid.band = pick(s.lastRaid.band, bands)!;
  s.flavor = pick(s.flavor, catalog(keys('relatos.ambiente', FLAVOR)))!;
  // Objetivos en curso: se rehacen con su definición (la cifra es la que piden).
  for (const g of s.goals?.active ?? []) {
    if (typeof g.text !== 'string') continue;
    const d = GOALS.find((x) => x.id === g.id);
    if (!d) continue;
    const m = 'room' in d ? goalMsg(d) : msg(d.text, { n: g.target });
    if (idText(m) === g.text) g.text = m;
  }
  // El suceso pendiente: su texto y opciones salen de su id.
  const ev = s.event;
  if (ev && typeof ev.text === 'string') {
    const names = ev.who.map((id) => s.heroes.find((h) => h.id === id)?.name ?? '');
    const text = msg(`sucesos.${ev.id}.texto`, { a: names[0], b: names[1] });
    if (idText(text) === ev.text) {
      ev.text = text;
      ev.options = ev.options.map((_, i) => ({
        label: msg(`sucesos.${ev.id}.opciones.${i}.etiqueta`),
        hint: msg(`sucesos.${ev.id}.opciones.${i}.pista`),
      }));
    }
  }
}
