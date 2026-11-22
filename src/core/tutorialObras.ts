/**
 * Tutorial de obras (fase 2b): al pagar la deuda, el cuaderno del tío enseña a abrir sitio
 * para ampliar el salón y luego la cámara del tesoro. El camino: comprar el solar, mudar la
 * cocina a él, ampliar el salón, excavar bajo el solar y ampliar la cámara; y pagar.
 *
 * Todo pasa en el borrador del modo obras: la interfaz lo copia en `tutorial.plan` (acción
 * `tutorialWorks`) y cada paso mira ese edificio. El paso en curso es el primero sin hacer:
 * si se deshace una obra o se sale sin pagar, el cuaderno vuelve atrás.
 */
import { START_COLS } from './balance';
import type { Action } from './game';
import type { Building, GameState, Room } from './model';
import {
  drafting,
  isDug,
  planDig,
  planExtend,
  planMove,
  planPlot,
  roomAt,
  type Plan,
} from './rooms';
import type { TutorialStep } from './tutorial';
import { t } from '../textos';

const find = (b: Building, type: string) => b.rooms.find((r) => r.type === type);
/** El edificio que se enseña: el borrador del modo obras, si está abierto. */
const plan = (s: GameState) => s.tutorial?.plan ?? s.building;
const size = (r: Room | undefined) => (r ? r.w * r.h : 0);
/** El salón ya es más grande que el del tío (de ancho o de alto). */
const salonGrown = (b: Building) => size(find(b, 'salon')) > 2;
const vaultGrown = (b: Building) => (find(b, 'tesoro')?.w ?? 0) > 1;
/** La cocina sigue pegada al salón, a su derecha. */
const kitchenInWay = (b: Building) => {
  const sa = find(b, 'salon');
  return !!sa && roomAt(b, sa.col + sa.w, sa.floor)?.type === 'cocina';
};
/** Hueco excavado a la derecha de la cámara (donde crece). */
const dugBeside = (b: Building) => {
  const t = find(b, 'tesoro');
  return !!t && t.col + t.w < b.cols && isDug(b, t.col + t.w, t.floor);
};
const allDone = (s: GameState) => salonGrown(s.building) && vaultGrown(s.building);

/** El camino de obras del tutorial, desde la taberna como está. */
export function obrasPath(s: GameState): Action[] {
  const b = s.building;
  const cocina = find(b, 'cocina');
  const salon = find(b, 'salon');
  const tesoro = find(b, 'tesoro');
  const out: Action[] = [{ type: 'buyPlot' }];
  if (cocina && kitchenInWay(b)) out.push({ type: 'move', id: cocina.id, col: b.cols, floor: 0 });
  if (salon) out.push({ type: 'extend', id: salon.id, dir: 'right' });
  if (tesoro) {
    out.push({ type: 'dig', col: b.cols, floor: tesoro.floor });
    out.push({ type: 'extend', id: tesoro.id, dir: 'right' });
  }
  return out;
}

/** Lo que cuesta el camino del tutorial (o null si no se puede hacer en esta taberna). */
export function obrasCost(s: GameState): number | null {
  return drafting(s.building, () => {
    let cur = s;
    let cost = 0;
    for (const a of obrasPath(s)) {
      const p: Plan =
        a.type === 'buyPlot'
          ? planPlot(cur)
          : a.type === 'move'
            ? planMove(cur, a.id, a.col, a.floor)
            : a.type === 'extend'
              ? planExtend(cur, a.id, a.dir)
              : a.type === 'dig'
                ? planDig(cur, a.col, a.floor)
                : { error: '' };
      if ('error' in p) return null;
      cost += p.cost;
      cur = { ...cur, building: p.b, gold: cur.gold - p.cost };
    }
    return cost;
  });
}

/** Lo que cada paso deja hacer en el modo obras (la tienda sigue abierta para deshacer). */
const ALLOW: Record<string, (a: Action, b: Building) => boolean> = {
  'o-solar': (a) => a.type === 'buyPlot',
  'o-mudar': (a, b) => a.type === 'move' && a.id === find(b, 'cocina')?.id,
  'o-salon': (a, b) =>
    (a.type === 'extend' && a.id === find(b, 'salon')?.id) ||
    (a.type === 'build' && a.room === 'salon'),
  'o-excavar': (a) => a.type === 'dig',
  'o-camara': (a, b) =>
    (a.type === 'extend' && a.id === find(b, 'tesoro')?.id) ||
    (a.type === 'build' && a.room === 'tesoro'),
};

/** Por qué no se deja apuntar otra obra en cada paso (`tutorial_obras.<paso>.veto`). */
const WHY = ['o-solar', 'o-mudar', 'o-salon', 'o-excavar', 'o-camara', 'o-pagar'];

/** Lo que el tutorial de obras no deja apuntar ahora, y por qué (null = adelante). */
export function obrasVeto(s: GameState, st: TutorialStep, a: Action): string | null {
  const ok = ALLOW[st.id];
  if (ok?.(a, plan(s))) return null;
  return WHY.includes(st.id) ? t(`tutorial_obras.${st.id.replace('-', '_')}.veto`) : null;
}

export const OBRAS: readonly TutorialStep[] = [
  {
    id: 'o-martillo',
    text: () => t('tutorial_obras.o_martillo.texto'),
    pause: 6,
    clock: true,
    done: (s) => !!s.tutorial?.plan || allDone(s),
    enter: (s) => {
      const cost = obrasCost(s);
      if (cost === null || s.gold >= cost) return null;
      const gift = cost - s.gold;
      s.gold += gift;
      return t('tutorial_obras.o_martillo.regalo', { n: gift });
    },
  },
  {
    id: 'o-solar',
    text: () => t('tutorial_obras.o_solar.texto'),
    focus: (s) => find(s.building, 'cocina')?.id ?? null,
    done: (s) => plan(s).cols > START_COLS || allDone(s),
  },
  {
    id: 'o-mudar',
    text: () => t('tutorial_obras.o_mudar.texto'),
    focus: (s) => find(s.building, 'cocina')?.id ?? null,
    done: (s) => !kitchenInWay(plan(s)) || salonGrown(plan(s)),
  },
  {
    id: 'o-salon',
    text: () => t('tutorial_obras.o_salon.texto'),
    focus: (s) => find(s.building, 'salon')?.id ?? null,
    done: (s) => salonGrown(plan(s)),
  },
  {
    id: 'o-excavar',
    text: () => t('tutorial_obras.o_excavar.texto'),
    focus: (s) => find(s.building, 'tesoro')?.id ?? null,
    done: (s) => dugBeside(plan(s)) || vaultGrown(plan(s)),
  },
  {
    id: 'o-camara',
    text: () => t('tutorial_obras.o_camara.texto'),
    focus: (s) => find(s.building, 'tesoro')?.id ?? null,
    done: (s) => vaultGrown(plan(s)),
  },
  {
    id: 'o-pagar',
    text: () => t('tutorial_obras.o_pagar.texto'),
    done: allDone,
  },
  {
    id: 'o-fin',
    text: () => t('tutorial_obras.o_fin.texto'),
    button: 'seguir',
  },
];

/** Las notas sueltas de obras que este tutorial sustituye. */
export const OBRAS_TIPS = ['obras', 'plano', 'excavar', 'servicio'];
