import { useMemo, useState } from 'preact/hooks';
import { audio } from '../audio/audio';
import { canSend } from '../core/game';
import type { GameState, Quest } from '../core/model';
import { chainDef } from '../core/chains';
import { PERKS, partyClasses, tripDays } from '../core/classes';
import { RISK_LABELS, moraleMod, skill } from '../core/party';
import { questEstimate } from '../core/resolve';
import { dressingOf } from '../core/crafting';
import { guardsAt, postOf } from '../core/guards';
import { questFit, repeatParty, suggestParty } from '../core/suggest';
import { CLASS_NAMES, dangerClass, dangerLabel, statusLabel } from '../data/labels';
import { MATERIALS, QUEST_MATERIAL } from '../core/materials';
import { help } from './HoldHelp';
import { MatIcon } from './mats';
import { Icon } from './icons';
import { Portrait } from './Portrait';
import { gearHintText, upgradesFor } from './gearHint';
import { listNames, plural } from './text';
import { lookOf, marksOf, memberOf, heroFrame } from './view';
import { span } from './when';

interface Props {
  game: GameState;
  quest: Quest;
  onClose: () => void;
  /** `unguard`: alguno del grupo está de guardia y la deja para ir. */
  onSend: (ids: string[], unguard: boolean) => void;
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
  // Primero los libres, luego los de guardia (se les puede llevar) y al final quien no está;
  // en cada grupo, quien más aporta a este encargo (`questFit`, con su equipo puesto).
  const fit = useMemo(
    () => new Map(heroes.map((h) => [h.id, questFit(q, memberOf(h, game.fac))])),
    [game, q],
  );
  const rank = (h: (typeof heroes)[number]) => (h.status !== 'ok' ? 2 : h.guard ? 1 : 0);
  const ranked = [...heroes].sort((a, b) => rank(a) - rank(b) || fit.get(b.id)! - fit.get(a.id)!);
  const party = sel.map((id) => heroes.find((h) => h.id === id)!).filter(Boolean);
  const members = party.map((h) => memberOf(h, game.fac));
  const est = questEstimate(q, members, game.fac);
  const scale = Math.max(1, ...est.rows.map((r) => Math.max(r.diff, r.power))) * 1.15;
  // Los de guardia que van: dejan su puesto (y lo retoman al volver).
  const guards = party.filter((h) => h.guard);
  const unguard = guards.length > 0;
  const blocked = party.length ? canSend(game, q.id, sel, unguard) : null;
  const guardNote = guards.length
    ? (['puerta', 'tesoro'] as const)
        .map((post) => {
          const off = guards.filter((h) => postOf(h) === post);
          if (!off.length) return null;
          const left = guardsAt(game, post).length - off.length;
          const where = post === 'puerta' ? 'la puerta' : 'la cámara';
          return `${listNames(off.map((h) => h.name.split(' ')[0]!))} ${plural(off.length, 'deja', 'dejan')} la guardia: ${where} se queda ${left ? `con ${left}` : 'sin nadie'} hasta que ${plural(off.length, 'vuelva', 'vuelvan')}.`;
        })
        .filter(Boolean)
        .join(' ')
    : null;
  // Equipo olvidado: lo mejor del arcón para los que van.
  const gearNotes = party.flatMap((h) => {
    const ups = upgradesFor(game, h);
    return ups.length ? [gearHintText(h.name.split(' ')[0]!, ups)] : [];
  });
  // Si a alguno le están cosiendo, la sastrería le espera (se puede cancelar desde allí).
  const sewing = party.filter((h) => dressingOf(game, h.id));
  const sewNames = listNames(sewing.map((h) => h.name.split(' ')[0]!));
  const sewNote = !sewing.length
    ? null
    : sewing.length > 1
      ? `A ${sewNames} les están cosiendo: la sastrería esperará a que vuelvan.`
      : `A ${sewNames} le están cosiendo: la sastrería esperará a que vuelva.`;
  const mage = party.find((h) => h.cls === 'mago');
  const days = tripDays(q, members, game.fac.establo);
  const hideDanger = q.dangerHidden && !mage && game.fac.mapas < 2;

  // El mejor grupo que se puede mandar ahora (se cuenta una vez, no al tocar cada héroe).
  const suggestion = useMemo(() => suggestParty(game, q.id), [game, q.id]);
  const suggest = () => {
    if ('why' in suggestion) return setWarn(suggestion.why);
    setWarn(null);
    audio.play('select');
    setSel(suggestion.ids);
  };

  // El grupo de antes (el del paso anterior de la historia, o el último que salió).
  const repeat = repeatParty(game, q.id);
  const repeatNames = listNames(
    (repeat?.ids ?? []).map((id) => heroes.find((h) => h.id === id)?.name.split(' ')[0] ?? ''),
  );
  const again = () => {
    if (!repeat) return;
    const why = repeat.skipped.length ? `${repeat.skipped.join('. ')}.` : null;
    if (!repeat.ids.length) return setWarn(why ?? 'Nadie de aquel grupo puede ir ahora.');
    audio.play('select');
    setSel(repeat.ids);
    setWarn(why);
  };

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
        <button class="btn-icon herocard-x" data-tut="cerrar" aria-label="Cerrar" onClick={onClose}>
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
            <span
              class="fact"
              {...help(
                `Trae ${MATERIALS[QUEST_MATERIAL[q.type]].name.toLowerCase()}: más cuanto mejor salga.`,
              )}
            >
              <MatIcon m={QUEST_MATERIAL[q.type]} size={12} />
              {MATERIALS[QUEST_MATERIAL[q.type]].name}
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

          <div class="qs-who">
            <h4 class="qs-sub">Quién va</h4>
            <button
              data-tut="sugerir"
              class={`btn btn-wood qs-suggest ${'why' in suggestion ? 'is-off' : ''}`}
              aria-disabled={'why' in suggestion}
              {...help(
                'why' in suggestion
                  ? suggestion.why
                  : 'Elige el grupo que mejor sale con los que están en casa. Puedes cambiarlo antes de enviar.',
              )}
              onClick={suggest}
            >
              <Icon name="star" size={12} /> Sugerir
            </button>
          </div>
          {repeat && (
            <button
              class={`btn btn-wood qs-repeat ${repeat.ids.length ? '' : 'is-off'}`}
              aria-disabled={!repeat.ids.length}
              {...help(
                repeat.from === 'paso'
                  ? 'El grupo que hizo el paso anterior de esta historia. Quien no pueda ir se queda.'
                  : 'El último grupo que salió de misión. Quien no pueda ir se queda.',
              )}
              onClick={again}
            >
              <Icon name="pasos" size={12} />
              <span>
                {repeat.from === 'paso' ? 'Como en el paso anterior' : 'Como la última vez'}
                {repeatNames ? `: ${repeatNames}` : ''}
              </span>
            </button>
          )}
          {gearNotes.map((t) => (
            <p key={t} class="qs-gear" role="status">
              <Icon name="cofre" size={12} /> {t}
            </p>
          ))}
          <div class="picks">
            {ranked.map((h) => {
              const on = sel.includes(h.id);
              const busy = h.status !== 'ok';
              const guard = !busy && !!h.guard;
              const mood = moraleMod(h);
              const skills = q.challenges.map(
                (c) => `${c.skill.slice(0, 3)} ${skill(memberOf(h, game.fac), c.skill)}`,
              );
              const state = busy ? statusLabel(h) : null;
              return (
                <button
                  key={h.id}
                  class={`pick ${guard ? 'is-guard' : ''}`}
                  aria-pressed={on}
                  disabled={busy}
                  {...(guard
                    ? help(
                        'De guardia: tócalo para quitarle de guardia y llevarlo. Retoma la guardia al volver.',
                      )
                    : {})}
                  aria-label={[
                    h.name,
                    `${CLASS_NAMES[h.cls][h.sex]} de nivel ${h.lvl}`,
                    mood > 0 ? (h.sex === 'f' ? 'animada' : 'animado') : '',
                    mood < 0 ? (h.sex === 'f' ? 'desanimada' : 'desanimado') : '',
                    state ?? skills.join(', '),
                    guard
                      ? on
                        ? 'deja la guardia para ir'
                        : 'de guardia: quitar de guardia y llevar'
                      : '',
                  ]
                    .filter(Boolean)
                    .join('. ')}
                  onClick={() => toggle(h.id)}
                >
                  <Portrait
                    look={lookOf(h)}
                    marks={marksOf(h)}
                    frame={heroFrame(h)}
                    scale={1}
                    alive={false}
                  />
                  <span class="pick-name" aria-hidden="true">
                    {h.name.split(' ')[0]}
                    {mood > 0 && <span class="mood up"> +</span>}
                    {mood < 0 && <span class="mood down"> −</span>}
                  </span>
                  <span class="pick-skills" aria-hidden="true">
                    {state ?? skills.map((x) => <span key={x}>{x}</span>)}
                  </span>
                  {guard && (
                    <span class="pick-guard" aria-hidden="true">
                      <Icon name="escudo" size={10} />
                      De guardia
                    </span>
                  )}
                  {on && (
                    <span class="check" aria-hidden="true">
                      <Icon name="check" size={12} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {ranked
            .filter((h) => h.status === 'ok' && h.guard && !sel.includes(h.id))
            .map((h) => (
              <button
                key={h.id}
                class="btn btn-wood qs-unguard"
                {...help('Deja la guardia para ir con el grupo y la retoma al volver.')}
                onClick={() => toggle(h.id)}
              >
                <Icon name="escudo" size={12} />
                <span>Quitar de guardia y llevar a {h.name.split(' ')[0]}</span>
              </button>
            ))}
        </div>
        {(warn || blocked || guardNote || sewNote) && (
          <p class="qs-warn" role="status">
            {warn ?? blocked ?? guardNote ?? sewNote}
          </p>
        )}
        <button
          class="btn btn-gold qs-send"
          data-tut="enviar"
          disabled={!party.length || !!blocked}
          aria-label={
            party.length
              ? `Enviar a ${listNames(party.map((h) => h.name))}`
              : 'Elige al menos un héroe'
          }
          onClick={() => onSend(sel, unguard)}
        >
          <Icon name="espadas" size={16} />
          {party.length ? `Enviar · ${party.length}` : 'Elige quién va'}
        </button>
      </article>
    </div>
  );
}
