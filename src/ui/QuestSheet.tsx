import { useState } from 'preact/hooks';
import { audio } from '../audio/audio';
import { canSend } from '../core/game';
import type { GameState, Quest } from '../core/model';
import { chainDef } from '../core/chains';
import { PERKS, partyClasses, tripDays } from '../core/classes';
import { RISK_LABELS, moraleMod, skill } from '../core/party';
import { questEstimate } from '../core/resolve';
import { CLASS_NAMES, dangerClass, dangerLabel, statusLabel } from '../data/labels';
import { help } from './HoldHelp';
import { Icon } from './icons';
import { Portrait } from './Portrait';
import { listNames, plural } from './text';
import { lookOf, marksOf, memberOf } from './view';
import { span } from './when';

interface Props {
  game: GameState;
  quest: Quest;
  onClose: () => void;
  onSend: (ids: string[]) => void;
}

/**
 * Ficha de un encargo, como hoja desde abajo: cifras en chapas, la historia plegada, el riesgo con
 * sus barras y quién va en una rejilla de retratos.
 */
export function QuestSheet({ game, quest: q, onClose, onSend }: Props) {
  const [sel, setSel] = useState<string[]>([]);
  const [warn, setWarn] = useState<string | null>(null);
  /** La historia del encargo, plegada a dos líneas hasta que se toca. */
  const [story, setStory] = useState(false);
  const heroes = game.heroes.filter((h) => h.status !== 'muerto');
  // Los disponibles primero y, entre ellos, quien más destaca en lo que pide el encargo
  // (su mejor habilidad de las pedidas y, a igualdad, la suma de todas).
  const fit = (h: (typeof heroes)[number]) => {
    const vals = q.challenges.map((c) => skill(memberOf(h, game.fac), c.skill));
    return Math.max(0, ...vals) * 100 + vals.reduce((a, b) => a + b, 0);
  };
  const busyOf = (h: (typeof heroes)[number]) => h.status !== 'ok' || !!h.guard;
  const ranked = [...heroes].sort(
    (a, b) => Number(busyOf(a)) - Number(busyOf(b)) || fit(b) - fit(a),
  );
  const party = sel.map((id) => heroes.find((h) => h.id === id)!).filter(Boolean);
  const members = party.map((h) => memberOf(h, game.fac));
  const est = questEstimate(q, members, game.fac);
  const scale = Math.max(1, ...est.rows.map((r) => Math.max(r.diff, r.power))) * 1.15;
  const blocked = party.length ? canSend(game, q.id, sel) : null;
  const mage = party.find((h) => h.cls === 'mago');
  const days = tripDays(q, members, game.fac.establo);
  const hideDanger = q.dangerHidden && !mage && game.fac.mapas < 2;

  const toggle = (id: string) => {
    setWarn(null);
    if (sel.includes(id)) {
      audio.play('deselect');
      setSel(sel.filter((x) => x !== id));
    } else if (sel.length < q.slots) {
      audio.play('select');
      setSel([...sel, id]);
    } else
      setWarn(`Este encargo admite ${q.slots} ${plural(q.slots, 'héroe', 'héroes')} como máximo.`);
  };

  return (
    <div class="card-backdrop as-sheet" onClick={onClose}>
      <article
        class="herocard questsheet"
        onClick={(e) => e.stopPropagation()}
        aria-label={`Encargo: ${q.title}`}
      >
        <button class="btn-icon herocard-x" aria-label="Cerrar" onClick={onClose}>
          <Icon name="close" size={14} />
        </button>
        <div class="qs-scroll">
          <header class="qs-head">
            <span class="eyebrow">
              {q.chain
                ? `${chainDef(q.chain.id).name} · paso ${q.chain.step + 1} de ${chainDef(q.chain.id).steps.length}`
                : `${q.type} · ${q.client}`}
            </span>
            <h3>{q.title}</h3>
          </header>
          <div class="chips qs-facts">
            <span class="fact" {...help('Paga si sale bien.')}>
              <Icon name="coin" size={12} />
              {q.reward}
            </span>
            <span class="fact" {...help('Lo que dura el viaje con este grupo.')}>
              <Icon name="pasos" size={12} />
              {span(days)}
            </span>
            <span class="fact" {...help('Héroes elegidos y cuántos caben.')}>
              <Icon name="heroe" size={12} />
              {party.length}/{q.slots}
            </span>
            <span class={`danger danger-${dangerClass(q.danger, hideDanger)}`}>
              Peligro {dangerLabel(q.danger, hideDanger)}
            </span>
            {q.item && <span class="chal chal-item">+ objeto</span>}
          </div>
          <button
            class={`qs-story ${story ? 'open' : ''}`}
            aria-expanded={story}
            onClick={() => setStory(!story)}
          >
            {q.text}
          </button>

          <div class={`estimate est-${party.length ? est.level : 'none'}`}>
            <div class="est-head">
              <b>{party.length ? RISK_LABELS[est.level] : 'Elige quién va'}</b>
              {partyClasses(members).map((c) => (
                <span key={c} class="perk-chip" {...help(`${PERKS[c].name}: ${PERKS[c].desc}`)}>
                  {PERKS[c].name}
                </span>
              ))}
            </div>
            <div class="cbars">
              {est.rows.map((r) => {
                const k = r.power >= r.diff ? 'ok' : r.power >= r.diff - 3 ? 'close' : 'low';
                return (
                  <div key={r.skill} class="cbar">
                    <span>{r.skill}</span>
                    <span class="track" title={`Dificultad ${r.diff}`}>
                      <i class={k} style={{ width: `${(r.power / scale) * 100}%` }} />
                      <b style={{ left: `${(r.diff / scale) * 100}%` }} />
                    </span>
                    <span class="v">
                      {r.power}/{r.diff}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          {est.reveal && mage && (
            <div class="twist" role="status">
              <b>{mage.name} nota algo raro.</b> {q.twist} El primer desafío será más duro.
            </div>
          )}
          {mage && q.dangerHidden && game.fac.mapas < 2 && (
            <div class="twist" role="status">
              <b>{mage.name} no se fía del cliente.</b> El peligro real es mayor de lo que dice.
            </div>
          )}

          <h4 class="qs-sub">Quién va</h4>
          <div class="picks">
            {ranked.map((h) => {
              const on = sel.includes(h.id);
              const busy = busyOf(h);
              const mood = moraleMod(h);
              const skills = q.challenges.map(
                (c) => `${c.skill.slice(0, 3)} ${skill(memberOf(h, game.fac), c.skill)}`,
              );
              const state = busy ? (h.guard ? 'De guardia' : statusLabel(h)) : null;
              return (
                <button
                  key={h.id}
                  class="pick"
                  aria-pressed={on}
                  disabled={busy}
                  aria-label={[
                    h.name,
                    `${CLASS_NAMES[h.cls][h.sex]} de nivel ${h.lvl}`,
                    mood > 0 ? (h.sex === 'f' ? 'animada' : 'animado') : '',
                    mood < 0 ? (h.sex === 'f' ? 'desanimada' : 'desanimado') : '',
                    state ?? skills.join(', '),
                  ]
                    .filter(Boolean)
                    .join('. ')}
                  onClick={() => toggle(h.id)}
                >
                  <Portrait look={lookOf(h)} marks={marksOf(h)} scale={1} alive={false} />
                  <span class="pick-name" aria-hidden="true">
                    {h.name.split(' ')[0]}
                    {mood > 0 && <span class="mood up"> +</span>}
                    {mood < 0 && <span class="mood down"> −</span>}
                  </span>
                  <span class="pick-skills" aria-hidden="true">
                    {state ?? skills.map((x) => <span key={x}>{x}</span>)}
                  </span>
                  {on && (
                    <span class="check" aria-hidden="true">
                      <Icon name="check" size={12} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
        {(warn || blocked) && (
          <p class="qs-warn" role="status">
            {warn ?? blocked}
          </p>
        )}
        <button
          class="btn btn-gold qs-send"
          disabled={!party.length || !!blocked}
          aria-label={
            party.length
              ? `Enviar a ${listNames(party.map((h) => h.name))}`
              : 'Elige al menos un héroe'
          }
          onClick={() => onSend(sel)}
        >
          <Icon name="espadas" size={16} />
          {party.length ? `Enviar · ${party.length}` : 'Elige quién va'}
        </button>
      </article>
    </div>
  );
}
