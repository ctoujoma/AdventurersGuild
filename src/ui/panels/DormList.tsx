import { useState } from 'preact/hooks';
import { dormIssue, isVet, sleepPlan, staffBedsOf } from '../../core/beds';
import type { Action } from '../../core/game';
import type { GameState, Hero, Room, Worker } from '../../core/model';
import { roomBeds } from '../../core/rooms';
import { CLASS_NAMES } from '../../data/labels';
import { TRADES } from '../../data/workers';
import { jobRoomName } from '../roomName';
import { Face } from './CrewList';

const isHero = (p: Hero | Worker): p is Hero => 'cls' in p;

/** Las salas en las que podría dormir alguien de esta (las del mismo uso). */
function dormRooms(game: GameState, room: Room): Room[] {
  const staff = room.type === 'servicio';
  return game.building.rooms.filter((r) =>
    staff ? staffBedsOf(r) > 0 : roomBeds(r) > 0 && r.type !== 'servicio',
  );
}

/**
 * Quién duerme en un dormitorio (o en el ala de veteranos, o en un cuarto del servicio) y las
 * camas libres. Tocar a alguien deja mandarlo a dormir a otra sala; en una cama libre se elige a
 * quién traer. Los veteranos que duermen fuera del ala lo dicen (no les gusta).
 */
export function DormList({
  game,
  room,
  onAct,
  onOpen,
}: {
  game: GameState;
  room: Room;
  onAct: (a: Action) => void;
  onOpen?: (id: string) => void;
}) {
  const [sel, setSel] = useState<string | null>(null);
  const plan = sleepPlan(game);
  const all: (Hero | Worker)[] = [...game.heroes, ...game.workers];
  const here = all.filter((p) => plan.get(p.id) === room.id);
  const total = room.type === 'servicio' ? staffBedsOf(room) : roomBeds(room);
  const free = Math.max(0, total - here.length);
  const roomOf = (id: string) => game.building.rooms.find((r) => r.id === plan.get(id));
  const sub = (p: Hero | Worker) =>
    isHero(p)
      ? `${CLASS_NAMES[p.cls][p.sex]} nv ${p.lvl}${p.status === 'herido' ? ' · herido' : ''}`
      : TRADES[p.trade].name[p.sex];
  // A quién se puede traer a una cama libre: de otras salas del mismo uso.
  const movers = all.filter(
    (p) => plan.has(p.id) && plan.get(p.id) !== room.id && !dormIssue(game, p.id, room.id),
  );
  const chosen = here.find((p) => p.id === sel);
  const others = dormRooms(game, room).filter((r) => r.id !== room.id);
  return (
    <section class="crew-group" aria-label="Duermen aquí">
      <h3 class="crew-h">
        <span>Duermen aquí</span>
        <span class="row-sub">
          {here.length} de {total}
        </span>
      </h3>
      <div class="crew-slots">
        {here.map((p) => {
          const snub = isHero(p) && isVet(p) && room.type !== 'veteranos';
          return (
            <button
              key={p.id}
              class={`crew-slot ${isHero(p) ? 'is-hero' : ''} ${sel === p.id ? 'is-sel' : ''}`}
              aria-expanded={sel === p.id}
              onClick={() => setSel(sel === p.id ? null : p.id)}
            >
              <Face game={game} id={p.id} />
              <span class="crew-who">
                <b>{p.name}</b>
                <small>{sub(p)}</small>
                {snub && <small class="crew-off">Quiere el ala de veteranos</small>}
              </span>
            </button>
          );
        })}
        {Array.from({ length: free }, (_, i) =>
          movers.length ? (
            <select
              key={i}
              class="crew-slot crew-free"
              value=""
              aria-label="Cama libre: traer a alguien"
              onChange={(e) => {
                const v = (e.target as HTMLSelectElement).value;
                if (v) onAct({ type: 'dorm', who: v, room: room.id });
              }}
            >
              <option value="">+ Cama libre</option>
              {movers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (en {jobRoomName(game, roomOf(p.id)!).toLowerCase()})
                </option>
              ))}
            </select>
          ) : (
            <span key={i} class="crew-slot crew-free" aria-label="Cama libre">
              Libre
            </span>
          ),
        )}
      </div>
      {chosen && (
        <div class="crew-detail">
          {others.length > 0 && (
            <select
              class="job-select"
              aria-label={`Dónde duerme ${chosen.name}`}
              value=""
              onChange={(e) => {
                const v = (e.target as HTMLSelectElement).value;
                if (v) onAct({ type: 'dorm', who: chosen.id, room: v });
                setSel(null);
              }}
            >
              <option value="">Mandar a dormir a…</option>
              {others.map((r) => {
                const why = dormIssue(game, chosen.id, r.id);
                return (
                  <option key={r.id} value={r.id} disabled={!!why} title={why ?? undefined}>
                    {jobRoomName(game, r)}
                    {why ? ` · ${why.replace(/\.$/, '').toLowerCase()}` : ''}
                  </option>
                );
              })}
            </select>
          )}
          {isHero(chosen) && onOpen && (
            <button class="btn btn-wood" onClick={() => onOpen(chosen.id)}>
              Ficha
            </button>
          )}
        </div>
      )}
    </section>
  );
}
