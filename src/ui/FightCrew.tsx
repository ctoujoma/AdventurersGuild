/**
 * La barra de los nuestros en cualquier pelea (el jefe y el asalto): una tarjeta por cada uno,
 * con su retrato, su vida, a por quién va y, debajo, su habilidad con la recarga del motor
 * (`skillCharge`). Si se le abre la ocasión de crítico (`critReady`), la tarjeta late y tocarla
 * lo coge; si no, hace lo que diga cada pelea (`onPick`). Hasta seis en una fila en el móvil.
 */
import type { HeroLook, HeroMarks } from '../art/heroes/look';
import { ABILITIES, alive, critReady, skillCharge, type AbilityId } from '../core/fight';
import type { FightUnit } from '../core/fight';
import { Portrait } from './Portrait';
import { t } from '../textos';

/** Lo que la barra enseña de cada uno. */
export interface CrewCard {
  id: string;
  name: string;
  /** Vida (0–1). */
  hp: number;
  down: boolean;
  skill?: AbilityId;
  /** Carga de la habilidad (0–1; 1, lista). */
  charge: number;
  /** Ocasión de crítico abierta y sin coger: ¡ahora! */
  chance: boolean;
  look?: HeroLook;
  marks?: HeroMarks;
  frame?: string;
  /** Lo que está haciendo (a por quién va, corriendo…). */
  note?: string;
  /** De camino a otra sala. */
  moving?: boolean;
}

/** La tarjeta de una unidad del motor (lo demás, retrato y nota, lo pone cada pelea). */
export function crewCard(
  u: FightUnit,
  extra: Omit<CrewCard, 'id' | 'hp' | 'down' | 'skill' | 'charge' | 'chance'>,
): CrewCard {
  return {
    id: u.id,
    hp: u.hp / u.max,
    down: !alive(u),
    skill: u.ability,
    charge: skillCharge(u),
    chance: critReady(u),
    ...extra,
  };
}

interface Props {
  crew: CrewCard[];
  label: string;
  /** El jugador da órdenes (si no, solo se mira). */
  playing: boolean;
  /** El elegido para mandarle a por alguien. */
  chosen?: string | null;
  onCrit: (id: string) => void;
  onSkill: (id: string) => void;
  /** Tocar la tarjeta sin crítico abierto. */
  onPick?: (id: string) => void;
  /** Empezar a arrastrarla (a un enemigo o a una sala). */
  onPress?: (id: string) => void;
  /** El jefe o el cabecilla avisa de su golpe fuerte: el botón «¡Cubríos!». */
  warn?: boolean;
  onCover?: () => void;
}

export function FightCrew({
  crew,
  label,
  playing,
  chosen,
  onCrit,
  onSkill,
  onPick,
  onPress,
  warn,
  onCover,
}: Props) {
  return (
    <div class="fc">
      {playing && warn && onCover && (
        <button class="btn btn-gold fc-cover" onClick={onCover}>
          {t('paneles.fightcrew.cubrios')}
        </button>
      )}
      <ul class="rc-list" aria-label={label} style={{ '--cols': Math.min(crew.length, 6) }}>
        {crew.map((h) => {
          const ready = h.charge >= 1 && !h.down;
          const chance = playing && h.chance && !h.down;
          const skill = h.skill ? ABILITIES[h.skill] : null;
          const state = h.down
            ? t('paneles.fightcrew.en_el_suelo')
            : h.moving
              ? t('paneles.fightcrew.corriendo')
              : (h.note ?? '');
          const label = [
            h.name,
            `vida ${Math.round(h.hp * 100)} %`,
            chance ? t('paneles.fightcrew.critico') : '',
            state,
          ]
            .filter(Boolean)
            .join(', ');
          return (
            <li
              key={h.id}
              class={`rc-card ${h.down ? 'is-down' : ''} ${chance ? 'is-chance' : ''} ${ready ? 'is-ready' : ''} ${chosen === h.id ? 'is-chosen' : ''}`}
            >
              <button
                class="rc-hit"
                disabled={!playing || h.down}
                aria-label={label}
                title={h.name}
                onPointerDown={() => {
                  if (playing && !h.down) onPress?.(h.id);
                }}
                onClick={() => (chance ? onCrit(h.id) : onPick?.(h.id))}
              >
                <span class="rc-face">
                  {h.look && (
                    <Portrait
                      look={h.look}
                      marks={h.marks}
                      scale={1}
                      alive={!h.down}
                      frame={h.frame}
                    />
                  )}
                  {chance && <b class="rc-now" aria-hidden="true" />}
                  {h.moving && !h.down && (
                    <i class="rc-run" aria-hidden="true">
                      »
                    </i>
                  )}
                </span>
                <span class={`rc-hp ${h.hp < 0.35 ? 'is-low' : ''}`} aria-hidden="true">
                  <i style={{ width: `${Math.round(h.hp * 100)}%` }} />
                </span>
                <span class="rc-name" aria-hidden="true">
                  {h.down
                    ? t('paneles.fightcrew.en_el_suelo')
                    : chance
                      ? t('paneles.fightcrew.ahora')
                      : h.name}
                </span>
                {h.note && !h.down && (
                  <span class="rc-note" aria-hidden="true">
                    {h.note}
                  </span>
                )}
              </button>
              {skill && (
                <button
                  class="rc-skill"
                  disabled={!playing || !ready}
                  title={`${skill.name}: ${skill.text}`}
                  aria-label={
                    ready
                      ? `${h.name}: ${skill.name}`
                      : t('paneles.fightcrew.cargando', { nombre: skill.name })
                  }
                  onClick={() => onSkill(h.id)}
                >
                  <i style={{ width: `${Math.round(Math.min(1, h.charge) * 100)}%` }} />
                  <span>{skill.name}</span>
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
