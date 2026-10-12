/**
 * La comarca se mueve: la amenaza regional (crece si se ignoran o se fallan las historias)
 * y los sucesos de la taberna en los que hay que elegir.
 */
import { GEAR } from '../data/items';
import { activeChain } from './chains';
import type { DawnEvent, GameState, Hero, PendingEvent } from './model';
import type { Rng } from './rng';

// ---------- Amenaza regional ----------

export const THREAT_CARAVAN = 40;
export const THREAT_SCARED = 60;
export const THREAT_RAIDS = 80;

export const threatOf = (s: GameState) => s.threat ?? 0;

export function addThreat(s: GameState, d: number): void {
  s.threat = Math.max(0, Math.min(100, threatOf(s) + d));
}

/**
 * Cada noche: si hay una historia en marcha y su paso espera en el tablón sin que nadie
 * vaya, la amenaza crece; si no hay ninguna, se calma. Devuelve los ingresos perdidos.
 */
export function stepThreat(s: GameState, rng: Rng, events: DawnEvent[], income: number): number {
  const cs = activeChain(s);
  const waiting = cs && s.quests.some((q) => q.chain?.id === cs.id);
  addThreat(s, waiting ? 2 : -1);
  const t = threatOf(s);
  if (t >= THREAT_CARAVAN && income > 0 && rng.chance(0.2)) {
    events.push({
      t: 'Han asaltado la caravana que traía el vino: hoy la taberna no deja nada. La comarca está revuelta.',
      k: 'bad',
    });
    return income;
  }
  if (t >= THREAT_SCARED && rng.chance(0.15))
    events.push({ t: 'Corre el miedo por los caminos: hoy llegan menos encargos.', k: 'warn' });
  return 0;
}

/** Encargos de menos en el tablón cuando la amenaza asusta a los clientes. */
export const scaredClients = (s: GameState) => (threatOf(s) >= THREAT_SCARED ? 1 : 0);

// ---------- Sucesos con elección ----------

interface Option {
  label: string;
  hint: string;
  /** Aplica la elección; devuelve lo que pasó. */
  apply: (s: GameState, rng: Rng, who: Hero[]) => string;
}

interface EventDef {
  id: string;
  /** Héroes en casa que hacen falta (los primeros, por orden). */
  needs?: number;
  when?: (s: GameState) => boolean;
  text: (who: Hero[]) => string;
  options: Option[];
}

const home = (s: GameState) => s.heroes.filter((h) => h.status === 'ok');
const gearOf = (rarity: 0 | 1 | 2) => GEAR.filter((g) => g.rarity === rarity);

const EVENTS: readonly EventDef[] = [
  {
    id: 'buhonero',
    when: (s) => s.gold >= 60,
    text: () =>
      'Un buhonero con un carro lleno de cachivaches jura que tiene «un objeto de verdad» escondido bajo la lona. Pide 60 monedas, sin enseñarlo antes.',
    options: [
      {
        label: 'Comprar (60)',
        hint: 'Equipo bueno… o no',
        apply: (s, rng) => {
          s.gold -= 60;
          if (rng.chance(0.65)) {
            const g = rng.pick(gearOf(1));
            s.inventory.push({ ...g, id: `i${s.uid++}` });
            return `Era de verdad: ${g.name}. Ya cuelga en el tablero de la bodega.`;
          }
          const g = rng.pick(gearOf(0));
          s.inventory.push({ ...g, id: `i${s.uid++}` });
          return `Era… ${g.name.toLowerCase()}. El buhonero ya va por el segundo cruce.`;
        },
      },
      { label: 'No, gracias', hint: 'Nada cambia', apply: () => 'El buhonero se va silbando.' },
    ],
  },
  {
    id: 'pelea',
    needs: 2,
    text: (w) =>
      `${w[0]!.name} y ${w[1]!.name} se han enzarzado en la barra por una apuesta. Vuelan jarras.`,
    options: [
      {
        label: 'Mediar e invitar a una ronda',
        hint: '−10 monedas, más moral',
        apply: (s, _r, w) => {
          s.gold = Math.max(0, s.gold - 10);
          for (const h of w) h.morale = Math.min(100, h.morale + 6);
          return `Una ronda y un apretón de manos. ${w[0]!.name} y ${w[1]!.name} acaban cantando juntos.`;
        },
      },
      {
        label: 'Que lo arreglen ellos',
        hint: 'Uno gana, otro pierde',
        apply: (_s, rng, w) => {
          const [a, b] = rng.chance(0.5) ? [w[0]!, w[1]!] : [w[1]!, w[0]!];
          a.morale = Math.min(100, a.morale + 5);
          b.morale = Math.max(0, b.morale - 10);
          return `${a.name} gana la discusión y la apuesta. ${b.name} no le habla en días.`;
        },
      },
    ],
  },
  {
    id: 'bardo',
    needs: 1,
    text: () => 'Un bardo de paso pide cantar esta noche a cambio de cena y un rincón para dormir.',
    options: [
      {
        label: 'Que cante',
        hint: '−5 monedas, moral para todos',
        apply: (s) => {
          s.gold = Math.max(0, s.gold - 5);
          for (const h of home(s)) h.morale = Math.min(100, h.morale + 6);
          return 'Canta romances de bandoleros y la sala acaba coreando el estribillo.';
        },
      },
      {
        label: 'Echarlo',
        hint: 'Nada cambia',
        apply: () => 'Se va refunfuñando. Esa noche canta en la posada de enfrente.',
      },
    ],
  },
  {
    id: 'noble',
    when: (s) => s.gold >= 100,
    text: () =>
      'Un noble arruinado ofrece la espada de su familia en prenda por 100 monedas. Jura que volverá a por ella antes del invierno.',
    options: [
      {
        label: 'Aceptar (100)',
        hint: 'Un objeto valioso',
        apply: (s, rng) => {
          s.gold -= 100;
          const g = rng.chance(0.2) ? rng.pick(gearOf(2)) : rng.pick(gearOf(1));
          s.inventory.push({ ...g, id: `i${s.uid++}`, value: Math.max(g.value, 150) });
          return `Te quedas ${g.name.toLowerCase()}. El noble no vuelve, claro.`;
        },
      },
      {
        label: 'Rechazar',
        hint: 'Nada cambia',
        apply: () => 'Se marcha con su espada y su orgullo.',
      },
    ],
  },
  {
    id: 'lobos',
    needs: 1,
    text: () =>
      'Unos aldeanos piden ayuda: los lobos bajan cada noche al redil. No tienen con qué pagar.',
    options: [
      {
        label: 'Ayudar gratis',
        hint: '+6 reputación, algún riesgo',
        apply: (s, rng, w) => {
          s.rep += 6;
          if (rng.chance(0.25)) {
            w[0]!.status = 'herido';
            w[0]!.days = 2;
            return `${w[0]!.name} ahuyenta a los lobos, pero vuelve con un mordisco: dos días en cama. En el pueblo hablan bien del gremio.`;
          }
          return `${w[0]!.name} ahuyenta a los lobos. En el pueblo hablan bien del gremio.`;
        },
      },
      {
        label: 'Negarse',
        hint: '−2 reputación',
        apply: (s) => {
          s.rep = Math.max(0, s.rep - 2);
          return 'Los aldeanos se van cabizbajos. Se correrá la voz.';
        },
      },
    ],
  },
  {
    id: 'apuesta',
    when: (s) => s.gold >= 30,
    text: () =>
      'Un forastero con un dado de hueso reta a la casa: 30 monedas a que saca más que el tabernero.',
    options: [
      {
        label: 'Apostar 30',
        hint: 'Doble o nada',
        apply: (s, rng) => {
          if (rng.chance(0.5)) {
            s.gold += 30;
            return 'El tabernero saca un seis. El forastero paga, y se va sin terminarse la cerveza.';
          }
          s.gold -= 30;
          return 'El forastero saca un seis y el tabernero un dos. Recoge las monedas y pide otra jarra.';
        },
      },
      {
        label: 'Aquí no se juega',
        hint: 'Nada cambia',
        apply: () => 'El forastero se encoge de hombros y busca otra taberna.',
      },
    ],
  },
];

/** A veces, al amanecer, pasa algo en la taberna que pide una decisión. */
export function maybeEvent(s: GameState, rng: Rng): void {
  if (s.event || s.day < 3 || s.over || !rng.chance(0.18)) return;
  const at = home(s);
  const pool = EVENTS.filter((e) => (e.needs ?? 0) <= at.length && (e.when?.(s) ?? true));
  if (!pool.length) return;
  const e = rng.pick(pool);
  const who = at.slice(0, e.needs ?? 0);
  s.event = {
    id: e.id,
    who: who.map((h) => h.id),
    text: e.text(who),
    options: e.options.map((o) => ({ label: o.label, hint: o.hint })),
  };
}

/** Aplica la elección del jugador. */
export function choose(s: GameState, rng: Rng, index: number): void {
  const pe = s.event as PendingEvent | undefined;
  if (!pe) return;
  const def = EVENTS.find((e) => e.id === pe.id);
  const who = pe.who.map((id) => s.heroes.find((h) => h.id === id)).filter((h): h is Hero => !!h);
  const opt = def?.options[index];
  s.event = null;
  s.lastChoice = opt ? opt.apply(s, rng, who) : null;
}
