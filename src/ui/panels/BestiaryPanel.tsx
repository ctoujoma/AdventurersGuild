import { useState } from 'preact/hooks';
import { bossArtFor } from '../../art/bossCalco';
import { bandit, type FoeArt } from '../../art/foes';
import { expFoeArt, expGuardianArt } from '../../art/expFoes';
import type { PixelBuffer } from '../../art/pixel';
import { HEADINGS } from '../../core/expedition';
import type { GameState, Heading } from '../../core/model';
import { Rng } from '../../core/rng';
import { BOSSES, type BossKind } from '../../data/bosses';
import { CHAINS } from '../../data/chains';
import { placeMsg } from '../../data/places';
import { BufferImage } from '../BufferImage';
import { msg, t, tl, tx, type Txt } from '../../textos';

/** Una entrada del bestiario: su clave (`core/bestiary.ts`), el nombre, la pista y el dibujo. */
interface Entry {
  key: string;
  name: Txt;
  hint: Txt;
  art: () => PixelBuffer;
}

type Section = { id: string; entries: Entry[] };

/** El primer fotograma en guardia (los calcados respiran: el primero de su bucle). */
const still = (a: FoeArt) => a.seq?.idle?.[0] ?? a.poses.idle;

const FOES_PER_HEADING = 4;

/** Todo lo que se puede vencer, por secciones (los jefes, cada rumbo y las bandas). */
function sections(): Section[] {
  const bosses = (Object.keys(BOSSES) as BossKind[]).map((k): Entry => {
    const chain = CHAINS.find((c) => c.steps.some((st) => st.boss === k));
    const step = chain?.steps.find((st) => st.boss === k);
    return {
      key: `jefe:${k}`,
      name: BOSSES[k].name,
      hint: msg('bestiario.pista.jefe', {
        historia: chain?.name ?? '',
        lugar: step ? placeMsg(step.place) : '',
      }),
      art: () => {
        // El de la pelea: los que ya tienen calco, con él (`bossCalco.ts`).
        const a = bossArtFor(k);
        return a.seq?.ready?.[0] ?? a.poses.ready;
      },
    };
  });
  const rumbo = (h: Heading) => msg(`expediciones.rumbos.${h}.nombre`);
  const byHeading = HEADINGS.map((h): Section => {
    const foes = Array.from({ length: FOES_PER_HEADING }, (_, i): Entry => ({
      key: `exp:${h}:${i}`,
      name: msg(`expediciones.enemigos.${h}.${i}`),
      hint: msg('bestiario.pista.exp', { rumbo: rumbo(h) }),
      art: () => still(expFoeArt(h, i).art),
    }));
    const guardian: Entry = {
      key: `guardian:${h}`,
      name: msg(`expediciones.guardianes.${h}`),
      hint: msg('bestiario.pista.guardian', { rumbo: rumbo(h) }),
      art: () => still(expGuardianArt(h)),
    };
    const second: Entry[] =
      h === 'bosque'
        ? [
            {
              key: 'guardian:bosque_2',
              name: msg('expediciones.guardianes.bosque_2'),
              hint: msg('bestiario.pista.guardian', { rumbo: rumbo(h) }),
              art: () => still(expGuardianArt('bosque', 1)),
            },
          ]
        : [];
    return { id: h, entries: [...foes, guardian, ...second] };
  });
  const bands: Entry[] = tl<readonly unknown[]>('asaltos.bandas').map((_, i) => ({
    key: `banda:${i}`,
    name: msg(`asaltos.bandas.${i}.nombre`),
    hint: msg('bestiario.pista.banda'),
    art: () => still(bandit(new Rng(`bestiario-banda-${i}`))),
  }));
  return [{ id: 'jefes', entries: bosses }, ...byHeading, { id: 'bandas', entries: bands }];
}

/** Cada dibujo, una vez (son caros de hacer). */
const drawn = new Map<string, PixelBuffer>();
const artOf = (e: Entry) => {
  let b = drawn.get(e.key);
  if (!b) drawn.set(e.key, (b = e.art()));
  return b;
};

/** Escala para que quepa en su hueco (sin pasar de ×2: los pequeños no se emborronan). */
const fit = (b: PixelBuffer, w: number, h: number) => Math.min(2, w / b.w, h / b.h);

/** Primera letra en mayúscula (los nombres van en minúscula para ir dentro de una frase). */
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * El bestiario (usuario, 27 de noviembre), como un cuaderno de cazador: cada enemigo vencido con su
 * dibujo y las veces; lo que aún no, en sombra con una pista. Al tocar uno, su ficha arriba.
 */
export function BestiaryPanel({ game }: { game: GameState }) {
  const all = sections();
  const seen = game.bestiary ?? {};
  const total = all.reduce((a, s) => a + s.entries.length, 0);
  const got = all.reduce((a, s) => a + s.entries.filter((e) => seen[e.key]).length, 0);
  const [pick, setPick] = useState<string | null>(null);
  const chosen = all.flatMap((s) => s.entries).find((e) => e.key === pick);
  return (
    <div class="bestiary">
      <p class="row-sub">{t('bestiario.intro', { n: got, total })}</p>
      {chosen && <Card entry={chosen} seen={seen[chosen.key]} />}
      {all.map((sec) => (
        <section key={sec.id}>
          <h3 class="sec-title">{t(`bestiario.seccion.${sec.id}`)}</h3>
          <div class="bestiary-grid">
            {sec.entries.map((e) => {
              const s = seen[e.key];
              const b = artOf(e);
              return (
                <button
                  key={e.key}
                  class={`bestiary-cell ${s ? '' : 'is-unknown'} ${pick === e.key ? 'is-on' : ''}`}
                  aria-label={s ? cap(tx(e.name)) : t('bestiario.desconocido')}
                  aria-pressed={pick === e.key}
                  onClick={() => setPick(pick === e.key ? null : e.key)}
                >
                  <span class="bestiary-art">
                    <BufferImage buf={b} scale={fit(b, 64, 52)} />
                  </span>
                  <span class="bestiary-name">
                    {s ? cap(tx(e.name)) : t('bestiario.desconocido')}
                  </span>
                  {s && <span class="bestiary-count">{t('bestiario.veces', { n: s.n })}</span>}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

/** La ficha de uno: grande, con su nombre y cuántas veces (o, si no, la pista). */
function Card({ entry, seen }: { entry: Entry; seen?: { n: number; day: number } }) {
  const b = artOf(entry);
  return (
    <article class={`bestiary-card ${seen ? '' : 'is-unknown'}`}>
      <span class="bestiary-art is-big">
        <BufferImage buf={b} scale={Math.min(3, 150 / b.w, 110 / b.h)} />
      </span>
      <div>
        <b>{seen ? cap(tx(entry.name)) : t('bestiario.desconocido')}</b>
        {seen && (
          <span class="row-sub">{t('bestiario.vencido', { n: seen.n, dia: seen.day })}</span>
        )}
        <span class="row-sub">{tx(entry.hint)}</span>
      </div>
    </article>
  );
}
