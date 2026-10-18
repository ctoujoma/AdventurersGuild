/**
 * Sitios donde se puede hacer una obra: cada hueco libre donde cabe una sala nueva, cada sitio
 * al que se puede mover una sala, cada hueco que se puede excavar y cada sitio para otra
 * escalera, con su rectángulo en el corte del edificio. Lógica pura: la escena los marca y la
 * interfaz decide qué hacer con el que se toque.
 */
import { MAX_DOWN, MAX_UP } from '../../core/balance';
import type { Action } from '../../core/game';
import type { GameState } from '../../core/model';
import { planBuild, planDig, planMove, planStair, roomAt, type Plan } from '../../core/rooms';
import { ROOMS, type RoomType } from '../../data/rooms';
import {
  CELL_W,
  ROOM_H,
  STAIR_W,
  colX,
  floorTop,
  floorY,
  roomRect,
  roomsLayout,
  type Rect,
} from './layout';

/** Qué se está eligiendo en la escena. */
export type Pick =
  | { kind: 'build'; type: RoomType }
  | { kind: 'move'; id: string }
  | { kind: 'dig' }
  | { kind: 'stair' };

export interface Target {
  id: string;
  rect: Rect;
  /** Lo que se hace y lo que cuesta, para enseñarlo antes de pagar. */
  label: string;
  cost: number;
  action: Action;
}

const cell = (s: GameState, c: number, f: number): Rect => ({
  x: colX(s.building, c),
  y: floorTop(f),
  w: CELL_W,
  h: ROOM_H,
});

/** Una frase corta de lo que se va a hacer, para el aviso de abajo. */
export function pickTitle(s: GameState, pick: Pick): string {
  switch (pick.kind) {
    case 'build':
      return `Elige dónde construir: ${ROOMS[pick.type].name.toLowerCase()}`;
    case 'move': {
      const r = s.building.rooms.find((x) => x.id === pick.id);
      return r ? `Elige a dónde mover: ${ROOMS[r.type].name.toLowerCase()}` : 'Elige sitio';
    }
    case 'dig':
      return 'Elige qué hueco excavar';
    case 'stair':
      return 'Elige dónde poner la escalera';
  }
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
      const hi = pick.type === 'torre' ? MAX_UP + 1 : MAX_UP;
      for (const f of floors(-MAX_DOWN, hi))
        for (let c = 0; c < b.cols; c++) {
          if (roomAt(b, c, f)) continue;
          const plan = planBuild(s, pick.type, c, f);
          add(plan, cell(s, c, f), name, { type: 'build', room: pick.type, col: c, floor: f });
        }
      break;
    }
    case 'move': {
      const r = b.rooms.find((x) => x.id === pick.id);
      if (!r) break;
      const name = ROOMS[r.type].name;
      const hi = r.type === 'torre' ? MAX_UP + 1 : MAX_UP;
      for (const f of floors(-MAX_DOWN, hi))
        for (let c = 0; c + r.w <= b.cols; c++) {
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
    case 'dig':
      for (const f of floors(-MAX_DOWN, -1))
        for (let c = 0; c < b.cols; c++)
          add(planDig(s, c, f), cell(s, c, f), 'Excavar', { type: 'dig', col: c, floor: f });
      break;
    case 'stair': {
      const L = roomsLayout(b);
      const y = floorTop(L.top);
      const h = floorY(L.deepest) - y;
      for (let at = 1; at <= b.cols; at++)
        add(planStair(s, at), { x: colX(b, at) - STAIR_W / 2, y, w: STAIR_W, h }, 'Escalera', {
          type: 'addStair',
          at,
        });
      break;
    }
  }
  return out;
}
