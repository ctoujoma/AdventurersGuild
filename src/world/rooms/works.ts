/**
 * Sitios donde se puede hacer una obra: cada hueco libre donde cabe una sala nueva, cada sitio
 * al que se puede mover una sala, cada hueco que se puede excavar y cada sitio para otra
 * escalera, con su rectángulo en el corte del edificio. Lógica pura: la escena los marca y la
 * interfaz decide qué hacer con el que se toque.
 */
import { MAX_COLS, MAX_DOWN, MAX_UP } from '../../core/balance';
import type { Action } from '../../core/game';
import type { GameState, Room } from '../../core/model';
import {
  planBuild,
  planDig,
  planExtend,
  planMove,
  planPlot,
  planStair,
  planWing,
  LOCKED,
  planUnstair,
  isShaft,
  roomAt,
  spanOf,
  type ExtendDir,
  type Plan,
} from '../../core/rooms';
import { ROOMS, type RoomType } from '../../data/rooms';
import {
  CELL_W,
  PITCH,
  ROOM_H,
  STAIR_W,
  colX,
  stairX,
  floorTop,
  roomRect,
  roomsLayout,
  type Rect,
} from './layout';

/** Qué se está eligiendo en la escena. */
export type Pick =
  | { kind: 'build'; type: RoomType }
  | { kind: 'move'; id: string }
  | { kind: 'dig' }
  | { kind: 'stair' }
  /** Ganar sitio tocando la escena: los huecos que se pueden excavar y el solar de al lado. */
  | { kind: 'expand' }
  /** Ampliar una sala elegida: casillas a los lados y encima (si crece en alto). */
  | { kind: 'grow'; id: string };

export interface Target {
  id: string;
  rect: Rect;
  /** Lo que se hace y lo que cuesta, para enseñarlo antes de pagar. */
  label: string;
  cost: number;
  action: Action;
  /** Casilla que se enseña tachada: por qué no se puede (y no hace nada al tocarla). */
  blocked?: string;
}

const cell = (s: GameState, c: number, f: number): Rect => ({
  x: colX(s.building, c),
  y: floorTop(f),
  w: CELL_W,
  h: ROOM_H,
});

/** La sala que ocupa el hueco al que crecería `r` hacia `dir` (si hay alguna). */
function roomAtRect(b: GameState['building'], r: Room, dir: ExtendDir): Room | undefined {
  if (dir === 'up') {
    for (let c = r.col; c < r.col + r.w; c++) {
      const o = roomAt(b, c, r.floor + r.h);
      if (o) return o;
    }
    return undefined;
  }
  const c = dir === 'left' ? r.col - 1 : r.col + r.w;
  for (let f = r.floor; f < r.floor + r.h; f++) {
    const o = roomAt(b, c, f);
    if (o) return o;
  }
  return undefined;
}

/** Una frase corta de lo que se va a hacer, para el aviso de abajo. */
export function pickTitle(s: GameState, pick: Pick): string {
  switch (pick.kind) {
    case 'build':
      return ROOMS[pick.type].unique && s.building.rooms.some((r) => r.type === pick.type)
        ? `Elige por dónde ampliar: ${ROOMS[pick.type].name.toLowerCase()}`
        : `Elige dónde construir: ${ROOMS[pick.type].name.toLowerCase()}`;
    case 'move': {
      const r = s.building.rooms.find((x) => x.id === pick.id);
      return r ? `Elige a dónde mover: ${ROOMS[r.type].name.toLowerCase()}` : 'Elige sitio';
    }
    case 'dig':
      return 'Elige qué hueco excavar';
    case 'stair':
      return 'Toca para poner o quitar tramos de escalera';
    case 'expand':
      return 'Toca un hueco para excavarlo o el solar para comprarlo';
    case 'grow':
      return 'Toca un «+» para ampliar la sala';
  }
}

/**
 * Por qué no sale ningún sitio para construir `type`: el motivo que más se repite entre los
 * huecos (el rango, si es eso, va primero).
 */
export function whyNoSpot(s: GameState, type: RoomType): string {
  const b = s.building;
  const seen = new Map<string, number>();
  const note = (p: Plan) => {
    if ('error' in p) seen.set(p.error, (seen.get(p.error) ?? 0) + 1);
  };
  const own = ROOMS[type].unique ? b.rooms.find((r) => r.type === type) : undefined;
  if (own) for (const d of ['left', 'right', 'up'] as const) note(planExtend(s, own.id, d));
  else {
    const hi = type === 'torre' ? MAX_UP + 1 : MAX_UP;
    for (let f = -MAX_DOWN; f <= hi; f++)
      for (let c = 0; c < spanOf(b); c++) if (!roomAt(b, c, f)) note(planBuild(s, type, c, f));
  }
  const all = [...seen].sort((x, y) => y[1] - x[1]).map(([e]) => e);
  return all.find((e) => /rango/.test(e)) ?? all[0] ?? 'No queda ningún sitio donde hacerlo.';
}

/** Los sitios donde se puede hacer la obra elegida, con lo que cuesta cada uno. */
export function targetsFor(s: GameState, pick: Pick): Target[] {
  const b = s.building;
  const out: Target[] = [];
  const add = (plan: Plan, rect: Rect, label: string, action: Action) => {
    if ('error' in plan) return;
    out.push({ id: `obra:${out.length}`, rect, label, cost: plan.cost, action });
  };
  const floors = (lo: number, hi: number) => {
    const list: number[] = [];
    for (let f = lo; f <= hi; f++) list.push(f);
    return list;
  };
  switch (pick.kind) {
    case 'build': {
      const name = ROOMS[pick.type].name;
      // Las salas que solo puede haber una (salón, cámara…) crecen desde la que ya hay: a los
      // lados y, el salón, hacia arriba.
      const own = ROOMS[pick.type].unique ? b.rooms.find((r) => r.type === pick.type) : undefined;
      if (own) {
        const grow: [ExtendDir, Rect][] = [
          ['left', roomRect(b, { ...own, col: own.col - 1, w: 1 })],
          ['right', roomRect(b, { ...own, col: own.col + own.w, w: 1 })],
          ['up', roomRect(b, { ...own, floor: own.floor + own.h, h: 1 })],
        ];
        for (const [dir, rect] of grow)
          add(planExtend(s, own.id, dir), rect, `Ampliar ${name.toLowerCase()}`, {
            type: 'extend',
            id: own.id,
            dir,
          });
        break;
      }
      const hi = pick.type === 'torre' ? MAX_UP + 1 : MAX_UP;
      for (const f of floors(-MAX_DOWN, hi))
        for (let c = 0; c < spanOf(b); c++) {
          if (roomAt(b, c, f)) continue;
          const plan = planBuild(s, pick.type, c, f);
          // Junto a una igual y del mismo nivel no sale otra sala: se amplía la de al lado.
          const grows = !('error' in plan) && plan.b.rooms.length === b.rooms.length;
          add(plan, cell(s, c, f), grows ? `Ampliar ${name.toLowerCase()}` : name, {
            type: 'build',
            room: pick.type,
            col: c,
            floor: f,
          });
        }
      break;
    }
    case 'move': {
      const r = b.rooms.find((x) => x.id === pick.id);
      if (!r) break;
      const name = ROOMS[r.type].name;
      const hi = r.type === 'torre' ? MAX_UP + 1 : MAX_UP;
      for (const f of floors(-MAX_DOWN, hi))
        for (let c = 0; c + r.w <= spanOf(b); c++) {
          if (c === r.col && f === r.floor) continue;
          const plan = planMove(s, r.id, c, f);
          add(plan, roomRect(b, { ...r, col: c, floor: f }), `Mover ${name.toLowerCase()}`, {
            type: 'move',
            id: r.id,
            col: c,
            floor: f,
          });
        }
      break;
    }
    case 'grow': {
      const r = b.rooms.find((x) => x.id === pick.id);
      if (!r || r.type === 'torre') break;
      const def = ROOMS[r.type];
      const name = def.name.toLowerCase();
      const sides: [ExtendDir, Rect, boolean][] = [
        ['left', roomRect(b, { ...r, col: r.col - 1, w: 1 }), r.col > 0 && r.w < def.maxW],
        [
          'right',
          roomRect(b, { ...r, col: r.col + r.w, w: 1 }),
          r.col + r.w < spanOf(b) && r.w < def.maxW,
        ],
        [
          'up',
          roomRect(b, { ...r, floor: r.floor + r.h, h: 1 }),
          r.h < def.maxH && r.floor + r.h <= MAX_UP,
        ],
      ];
      for (const [dir, rect, fits] of sides) {
        if (!fits) continue;
        const action: Action = { type: 'extend', id: r.id, dir };
        const plan = planExtend(s, r.id, dir);
        if ('error' in plan) {
          const why = roomAtRect(b, r, dir)
            ? `Ahí está ${ROOMS[roomAtRect(b, r, dir)!.type].name.toLowerCase()}.`
            : plan.error;
          out.push({ id: `obra:${out.length}`, rect, label: why, cost: 0, action, blocked: why });
        } else add(plan, rect, `Ampliar ${name}`, action);
      }
      break;
    }
    case 'expand': {
      const dig = targetsFor(s, { kind: 'dig' });
      out.push(...dig);
      // El solar de al lado: el hueco de la planta baja a la derecha del edificio (o del anexo).
      // Con el edificio a todo lo ancho, en ese hueco se compra el patio trasero.
      const plot = { x: roomsLayout(b).right + 4, y: floorTop(0), w: CELL_W - 8, h: ROOM_H };
      add(planPlot(s), plot, 'Comprar solar', { type: 'buyPlot' });
      const wing = planWing(s);
      add(wing, plot, 'Comprar el patio trasero', { type: 'buyWing' });
      // Si aún no se puede, se enseña con candado y el porqué (más allá del solar, si lo hay).
      if ('error' in wing && !b.wing && wing.error !== LOCKED) {
        const at = b.cols < MAX_COLS ? { ...plot, x: plot.x + CELL_W } : plot;
        const why = wing.error;
        out.push({
          id: `obra:${out.length}`,
          rect: at,
          label: why,
          cost: 0,
          action: { type: 'buyWing' },
          blocked: why,
        });
      }
      break;
    }
    case 'dig':
      for (const f of floors(-MAX_DOWN, -1))
        for (let c = 0; c < b.cols; c++)
          add(planDig(s, c, f), cell(s, c, f), 'Excavar', { type: 'dig', col: c, floor: f });
      break;
    case 'stair': {
      // Cada tramo, de la mitad de su rellano de abajo a la del de arriba (no se pisan).
      for (let at = 1; at <= spanOf(b); at++) {
        const x = isShaft(b, at) ? stairX(b, at) : colX(b, at) - STAIR_W / 2;
        for (const f of floors(-MAX_DOWN, MAX_UP - 1)) {
          const y = floorTop(f + 1) + ROOM_H / 2;
          const rect = { x, y, w: STAIR_W, h: PITCH };
          add(planStair(s, at, f), rect, 'Tramo de escalera', { type: 'addStair', at, floor: f });
          // Los que ya hay se pueden quitar (devuelven algo), si no dejan otro en el aire.
          add(planUnstair(s, at, f), rect, 'Quitar tramo', { type: 'removeStair', at, floor: f });
        }
      }
      break;
    }
  }
  return out;
}
