/**
 * La cámara del tesoro: guarda todo el oro del gremio y cuanto más grande y mejor, más cabe. Lo
 * que no cabe se pierde (y el juego avisa antes). Su nivel es también la cerradura que tienen
 * que abrir los bandidos, y el del recibidor, la puerta que tienen que romper.
 */
import { DOOR_TIME, LOCK_TIME, VAULT_STORE, VAULT_WARN } from './balance';
import type { DawnEvent, GameState, Room } from './model';

export const vaultOf = (s: GameState): Room | undefined =>
  s.building.rooms.find((r) => r.type === 'tesoro');

/** Oro que cabe: lo de la cámara (por hueco y nivel) o, sin ella, lo que se esconde bajo el colchón. */
export function goldCap(s: GameState): number {
  const r = vaultOf(s);
  if (!r) return VAULT_STORE[0];
  // Mientras se amplía (o se muda) sigue guardando lo del tamaño de antes.
  const size = r.works?.from ?? r;
  return Math.max(VAULT_STORE[0], (VAULT_STORE[r.level] ?? 0) * size.w * size.h);
}

/** La cámara está casi llena: hay que gastar o hacerla más grande. */
export const vaultFull = (s: GameState) => s.gold >= goldCap(s) * VAULT_WARN;

/** Segundos que aguanta la cerradura de la cámara. */
export function lockTime(s: GameState): number {
  const r = vaultOf(s);
  return LOCK_TIME[r?.level ?? 0] ?? LOCK_TIME[0];
}

/** Segundos que aguanta la puerta del recibidor. */
export function doorTime(s: GameState): number {
  const r = s.building.rooms.find((x) => x.type === 'recibidor');
  return DOOR_TIME[r?.level ?? 0] ?? DOOR_TIME[0];
}

/** Entra oro: lo que no cabe en la cámara se pierde y se apunta para contarlo al amanecer. */
export function earn(s: GameState, n: number): void {
  const add = Math.max(0, Math.min(n, goldCap(s) - s.gold));
  s.gold += add;
  if (n > add) s.spilt = (s.spilt ?? 0) + n - add;
}

/** Lo mismo al final de la noche, con todo lo que ha entrado de golpe. */
export function spill(s: GameState): GameState {
  const cap = goldCap(s);
  if (s.gold <= cap) return s;
  return { ...s, gold: cap, spilt: (s.spilt ?? 0) + s.gold - cap };
}

/** Al amanecer: lo que se perdió por no caber y el aviso de que está casi llena. */
export function vaultNews(s: GameState, events: DawnEvent[]): void {
  const lost = s.spilt ?? 0;
  if (lost > 0)
    events.push({
      t: `La cámara del tesoro está llena: ${lost} monedas no cabían y se han perdido. Gasta, mejórala o hazla más grande.`,
      k: 'bad',
    });
  else if (vaultFull(s))
    events.push({
      t: `La cámara del tesoro está casi llena (${s.gold} de ${goldCap(s)}). Lo que no quepa se perderá.`,
      k: 'warn',
    });
  delete s.spilt;
}
