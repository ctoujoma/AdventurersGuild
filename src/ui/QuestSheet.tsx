import { useMemo, useState } from 'preact/hooks';
import { LifeBar } from './LifeBar';
import { hurtNote } from './hurtNote';
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
import {
  CLASS_NAMES,
  dangerClass,
  dangerLabel,
  questTypeName,
  skillName,
  statusLabel,
} from '../data/labels';
import { clientLabel } from '../data/quests';
import { MATERIALS, QUEST_MATERIAL } from '../core/materials';
import { help } from './HoldHelp';
import { MatIcon } from './mats';
import { Icon } from './icons';
import { Portrait } from './Portrait';
import { gearHintText, upgradesFor } from './gearHint';
import { listNames } from './text';
import { lookOf, marksOf, memberOf, heroFrame } from './view';
import { span } from './when';
import { t, tx } from '../textos';

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
          return t('paneles.questsheet.la_guardia_se_queda', {
            quienes: listNames(off.map((h) => h.name.split(' ')[0]!)),
            n: off.length,
            puesto: post,
            quedan: left,
          });
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
      ? t('paneles.questsheet.a_les_estan_cosiendo', { sew_names: sewNames })
      : t('paneles.questsheet.a_le_estan_cosiendo', { sew_names: sewNames });
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
    if (!repeat.ids.length) return setWarn(why ?? t('paneles.questsheet.nadie_de_aquel_grupo'));
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
    } else setWarn(t('paneles.questsheet.este_encargo_admite_como', { n: q.slots }));
  };

  return (
    <div class="card-backdrop as-sheet" onClick={onClose}>
      <article
        class="herocard questsheet"
        onClick={(e) => e.stopPropagation()}
        aria-label={t('paneles.questsheet.encargo', { titulo: tx(q.title) })}
      >
        <button
          class="btn-icon herocard-x"
          data-tut="cerrar"
          aria-label={t('paneles.questsheet.cerrar')}
          onClick={onClose}
        >
          <Icon name="close" size={14} />
        </button>
        <div class="qs-scroll">
          <header class="qs-head">
            <span class="eyebrow">
              {q.chain
                ? t('paneles.questsheet.paso_de', {
                    nombre: tx(chainDef(q.chain.id).name),
                    paso: q.chain.step + 1,
                    pasos: chainDef(q.chain.id).steps.length,
                  })
                : t('paneles.questsheet.tipo_y_cliente', {
                    tipo: questTypeName(q.type),
                    cliente: clientLabel(q.client),
                  })}
            </span>
            <h3>{tx(q.title)}</h3>
          </header>
          <div class="chips qs-facts">
            <span class="fact" {...help(t('paneles.questsheet.paga_si_sale_bien'))}>
              <Icon name="coin" size={12} />
              {q.reward}
            </span>
            <span
              class="fact"
              {...help(
                t('paneles.questsheet.trae_mas_cuanto_mejor', {
                  material: MATERIALS[QUEST_MATERIAL[q.type]].name.toLowerCase(),
                }),
              )}
            >
              <MatIcon m={QUEST_MATERIAL[q.type]} size={12} />
              {MATERIALS[QUEST_MATERIAL[q.type]].name}
            </span>
            <span class="fact" {...help(t('paneles.questsheet.lo_que_dura_el'))}>
              <Icon name="pasos" size={12} />
              {span(days)}
            </span>
            <span class="fact" {...help(t('paneles.questsheet.heroes_elegidos_y_cuantos'))}>
              <Icon name="heroe" size={12} />
              {party.length}/{q.slots}
            </span>
            <span class={`danger danger-${dangerClass(q.danger, hideDanger)}`}>
              {t('paneles.questsheet.peligro', { danger_label: dangerLabel(q.danger, hideDanger) })}
            </span>
            {q.item && <span class="chal chal-item">{t('paneles.questsheet.objeto')}</span>}
          </div>
          <button
            class={`qs-story ${story ? 'open' : ''}`}
            aria-expanded={story}
            onClick={() => setStory(!story)}
          >
            {tx(q.text)}
          </button>

          <div class={`estimate est-${party.length ? est.level : 'none'}`}>
            <div class="est-head">
              <b>
                {party.length ? RISK_LABELS[est.level] : t('paneles.questsheet.elige_quien_va')}
              </b>
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
                    <span>{skillName(r.skill)}</span>
                    <span
                      class="track"
                      title={t('paneles.questsheet.dificultad', { diff: r.diff })}
                    >
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
              <b>{t('paneles.questsheet.nota_algo_raro', { nombre: mage.name })}</b>{' '}
              {t('paneles.questsheet.el_primer_desafio_sera', { twist: tx(q.twist) })}
            </div>
          )}
          {mage && q.dangerHidden && game.fac.mapas < 2 && (
            <div class="twist" role="status">
              <b>{t('paneles.questsheet.no_se_fia_del', { nombre: mage.name })}</b>{' '}
              {t('paneles.questsheet.el_peligro_real_es')}
            </div>
          )}

          <div class="qs-who">
            <h4 class="qs-sub">{t('paneles.questsheet.quien_va')}</h4>
            <button
              data-tut="sugerir"
              class={`btn btn-wood qs-suggest ${'why' in suggestion ? 'is-off' : ''}`}
              aria-disabled={'why' in suggestion}
              {...help(
                'why' in suggestion ? suggestion.why : t('paneles.questsheet.elige_el_grupo_que'),
              )}
              onClick={suggest}
            >
              <Icon name="star" size={12} /> {t('paneles.questsheet.sugerir')}
            </button>
          </div>
          {repeat && (
            <button
              class={`btn btn-wood qs-repeat ${repeat.ids.length ? '' : 'is-off'}`}
              aria-disabled={!repeat.ids.length}
              {...help(
                repeat.from === 'paso'
                  ? t('paneles.questsheet.el_grupo_que_hizo')
                  : t('paneles.questsheet.el_ultimo_grupo_que'),
              )}
              onClick={again}
            >
              <Icon name="pasos" size={12} />
              <span>
                {repeat.from === 'paso'
                  ? t('paneles.questsheet.como_en_el_paso')
                  : t('paneles.questsheet.como_la_ultima_vez')}
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
              const skills = q.challenges.map((c) =>
                t('paneles.questsheet.habilidad', {
                  habilidad: skillName(c.skill),
                  n: skill(memberOf(h, game.fac), c.skill),
                }),
              );
              const state = busy ? statusLabel(h, false, game) : null;
              return (
                <button
                  key={h.id}
                  class={`pick ${guard ? 'is-guard' : ''}`}
                  aria-pressed={on}
                  disabled={busy}
                  {...(guard ? help(t('paneles.questsheet.de_guardia_tocalo_para')) : {})}
                  aria-label={[
                    h.name,
                    t('paneles.questsheet.de_nivel', {
                      clase: CLASS_NAMES[h.cls][h.sex],
                      nivel: h.lvl,
                    }),
                    mood
                      ? t('paneles.questsheet.animo', {
                          animo: mood > 0 ? 'si' : 'no',
                          sexo: h.sex,
                        })
                      : '',
                    state ?? skills.join(', '),
                    guard
                      ? on
                        ? t('paneles.questsheet.deja_la_guardia_para')
                        : t('paneles.questsheet.de_guardia_quitar_de')
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
                  {/* Su nivel, en la esquina (usuario, 28 de noviembre). */}
                  <span class="pick-lvl" aria-hidden="true">
                    {t('paneles.questsheet.nv', { nivel: h.lvl })}
                  </span>
                  {/* La vida que le queda (los heridos leves pueden ir; los de la cama, para ver
                      cuánto les falta). */}
                  {(!busy || h.status === 'herido') && <LifeBar hero={h} />}
                  <span class="pick-skills" aria-hidden="true">
                    {state ?? skills.map((x) => <span key={x}>{x}</span>)}
                  </span>
                  {guard && (
                    <span class="pick-guard" aria-hidden="true">
                      <Icon name="escudo" size={10} />
                      {t('paneles.questsheet.de_guardia')}
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
                {...help(t('paneles.questsheet.deja_la_guardia_para_2'))}
                onClick={() => toggle(h.id)}
              >
                <Icon name="escudo" size={12} />
                <span>
                  {t('paneles.questsheet.quitar_de_guardia_y', { nombre: h.name.split(' ')[0] })}
                </span>
              </button>
            ))}
        </div>
        {(warn || blocked || guardNote || sewNote) && (
          <p class="qs-warn" role="status">
            {warn ?? blocked ?? guardNote ?? sewNote}
          </p>
        )}
        {hurtNote(game, sel) && (
          <p class="qs-warn" role="status">
            {hurtNote(game, sel)}
          </p>
        )}
        <button
          class="btn btn-gold qs-send"
          data-tut="enviar"
          disabled={!party.length || !!blocked}
          aria-label={
            party.length
              ? t('paneles.questsheet.enviar_a', {
                  list_names: listNames(party.map((h) => h.name)),
                })
              : t('paneles.questsheet.elige_al_menos_un')
          }
          onClick={() => onSend(sel, unguard)}
        >
          <Icon name="espadas" size={16} />
          {party.length
            ? t('paneles.questsheet.enviar', { length: party.length })
            : t('paneles.questsheet.elige_quien_va')}
        </button>
      </article>
    </div>
  );
}
