import { useState } from 'preact/hooks';
import { awayPlan, dormIssue, isVet, sleepPlan, staffBedsOf } from '../../core/beds';
import type { Action } from '../../core/game';
import type { GameState, Hero, Room, Worker } from '../../core/model';
import { roomBeds } from '../../core/rooms';
import { CLASS_NAMES } from '../../data/labels';
import { TRADES } from '../../data/workers';
import { jobRoomName } from '../roomName';
import { Face } from './CrewList';
import { dawnIn } from '../when';
import { t } from '../../textos';

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
  // Los que están fuera (de encargo o desaparecidos) siguen teniendo aquí su cama, hecha.
  // Y los de guardia (en la puerta o en la cámara: esta noche no se acuestan).
  const away = awayPlan(game, true);
  const gone = game.heroes.filter((h) => away.get(h.id) === room.id);
  const total = room.type === 'servicio' ? staffBedsOf(room) : roomBeds(room);
  const free = Math.max(0, total - here.length - gone.length);
  const roomOf = (id: string) => game.building.rooms.find((r) => r.id === plan.get(id));
  const sub = (p: Hero | Worker) =>
    isHero(p)
      ? t('paneles.dormlist.clase_nivel', {
          clase: CLASS_NAMES[p.cls][p.sex],
          nivel: p.lvl,
          herido: p.status === 'herido',
          sexo: p.sex,
        })
      : TRADES[p.trade].name[p.sex];
  // A quién se puede traer a una cama libre: de otras salas del mismo uso.
  const movers = all.filter(
    (p) => plan.has(p.id) && plan.get(p.id) !== room.id && !dormIssue(game, p.id, room.id),
  );
  const chosen = here.find((p) => p.id === sel);
  const others = dormRooms(game, room).filter((r) => r.id !== room.id);
  return (
    <section class="crew-group" aria-label={t('paneles.dormlist.duermen_aqui')}>
      <h3 class="crew-h">
        <span>{t('paneles.dormlist.duermen_aqui')}</span>
        <span class="row-sub">
          {t('paneles.dormlist.de', { n: here.length + gone.length, total, fuera: gone.length })}
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
                {snub && <small class="crew-off">{t('paneles.dormlist.quiere_el_ala_de')}</small>}
              </span>
            </button>
          );
        })}
        {gone.map((h) => (
          <button
            key={h.id}
            class={`crew-slot is-hero ${h.guard ? 'is-guard' : 'is-away'}`}
            aria-label={t('paneles.dormlist.su_cama_le_espera', {
              nombre: h.name,
              guardia: !!h.guard,
            })}
            onClick={() => onOpen?.(h.id)}
          >
            <Face game={game} id={h.id} />
            <span class="crew-who">
              <b>{h.name}</b>
              <small>{sub(h)}</small>
              <small>
                {h.guard
                  ? t('paneles.dormlist.de_guardia_esta_noche')
                  : t('paneles.dormlist.fuera_esta_noche_2', {
                      mision: h.status === 'mision',
                      cuando: dawnIn(h.days),
                      sexo: h.sex,
                    })}
              </small>
            </span>
          </button>
        ))}
        {Array.from({ length: free }, (_, i) =>
          movers.length ? (
            <select
              key={i}
              class="crew-slot crew-free"
              value=""
              aria-label={t('paneles.dormlist.cama_libre_traer_a')}
              onChange={(e) => {
                const v = (e.target as HTMLSelectElement).value;
                if (v) onAct({ type: 'dorm', who: v, room: room.id });
              }}
            >
              <option value="">{t('paneles.dormlist.cama_libre_2')}</option>
              {movers.map((p) => (
                <option key={p.id} value={p.id}>
                  {t('paneles.dormlist.en', {
                    nombre: p.name,
                    sala: jobRoomName(game, roomOf(p.id)!).toLowerCase(),
                  })}
                </option>
              ))}
            </select>
          ) : (
            <span key={i} class="crew-slot crew-free" aria-label={t('paneles.dormlist.cama_libre')}>
              {t('paneles.dormlist.libre')}
            </span>
          ),
        )}
      </div>
      {chosen && (
        <div class="crew-detail">
          {others.length > 0 && (
            <select
              class="job-select"
              aria-label={t('paneles.dormlist.donde_duerme', { nombre: chosen.name })}
              value=""
              onChange={(e) => {
                const v = (e.target as HTMLSelectElement).value;
                if (v) onAct({ type: 'dorm', who: chosen.id, room: v });
                setSel(null);
              }}
            >
              <option value="">{t('paneles.dormlist.mandar_a_dormir_a')}</option>
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
              {t('paneles.dormlist.ficha')}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
