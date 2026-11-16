/**
 * El ladrón nocturno (suceso de la noche, ver `night.ts`): una sombra con un farol tapado entra por
 * el patio y va a la cámara del tesoro (si hay) o a la caja del recibidor. Es un incidente de noche
 * (`nocturno` en `data/incidents.ts`) con poco rato para mandar a alguien; si no se toca, el de
 * guardia le sale al paso si no está cabeceando. Las reglas, en `core/incidents.ts`.
 */
import { INCIDENTS } from '../data/incidents';
import {
  DAY_SECONDS,
  NIGHT_ROLL,
  NIGHT_THIEF_EVERY,
  NIGHT_THIEF_FROM,
  NIGHT_THIEF_MIN,
} from './balance';
import type { GameState, Incident } from './model';
import type { NightEvent } from './night';
import { active } from './rooms';

/** A dónde va: la cámara del tesoro, si hay en uso; si no, la caja del recibidor. */
export function thiefRoom(s: GameState): string | null {
  const ok = (t: string) =>
    s.building.rooms.find((r) => r.type === t && active(r).level > 0)?.id ?? null;
  return ok('tesoro') ?? ok('recibidor');
}

/** Entra ahora (o, si aún no es de noche, a la hora del suceso). Muta `s` (ya copiado). */
export function startThief(s: GameState): Incident | null {
  const room = thiefRoom(s);
  if (!room) return null;
  const from = Math.max(s.clock ?? 0, NIGHT_ROLL * DAY_SECONDS);
  const inc: Incident = {
    id: `inc${s.uid++}`,
    kind: 'nocturno',
    room,
    from,
    until: from + INCIDENTS.nocturno.secs,
  };
  s.incidents = [...(s.incidents ?? []), inc];
  return inc;
}

export const THIEF_EVENT: NightEvent = {
  id: 'ladron',
  when: (s) =>
    s.day >= NIGHT_THIEF_FROM &&
    s.gold >= NIGHT_THIEF_MIN &&
    !s.incidents?.length &&
    !!thiefRoom(s),
  every: NIGHT_THIEF_EVERY,
  // Sin aviso: se ve la sombra y el aviso sobre la sala; lo que pase, al amanecer.
  start: (s) => {
    startThief(s);
    return null;
  },
};
