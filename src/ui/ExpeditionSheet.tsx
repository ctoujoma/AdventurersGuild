import { useState } from 'preact/hooks';
import { audio } from '../audio/audio';
import {
  HEADINGS,
  HEADING_MATS,
  OPEN_HEADINGS,
  canExpedition,
  expSlots,
  minRations,
  partyCap,
  potionsMax,
} from '../core/expedition';
import { EXP_POTION_HERBS } from '../core/balance';
import type { GameState, Heading } from '../core/model';
import { CLASS_NAMES, statusLabel } from '../data/labels';
import { MATERIALS } from '../core/materials';
import { help } from './HoldHelp';
import { MatIcon } from './mats';
import { Icon, type IconName } from './icons';
import { Portrait } from './Portrait';
import { daysOut } from './expedition';
import { listNames } from './text';
import { lookOf, marksOf, heroFrame } from './view';
import { t } from '../textos';

interface Props {
  game: GameState;
  onClose: () => void;
  onSend: (
    heading: Heading,
    ids: string[],
    rations: number,
    unguard: boolean,
    potions: number,
  ) => void;
}

const HEADING_ICON: Record<Heading, IconName> = {
  bosque: 'bosque',
  sierra: 'monte',
  marismas: 'pantano',
  ruinas: 'ruina',
};

/**
 * La hoja de preparar una expedición: el rumbo (los que faltan, «En obras»), quién va (tope por
 * la sala de mapas) y cuántas raciones llevan (de la despensa), con los días de ida que dan.
 */
export function ExpeditionSheet({ game, onClose, onSend }: Props) {
  const [heading, setHeading] = useState<Heading>('bosque');
  const [sel, setSel] = useState<string[]>([]);
  const cap = partyCap(game);
  const n = Math.max(1, sel.length);
  const [rations, setRations] = useState(() => Math.min(game.food, 12));
  const party = sel.map((id) => game.heroes.find((h) => h.id === id)!).filter(Boolean);
  const unguard = party.some((h) => h.guard);
  const potMax = potionsMax(game);
  const [potions, setPotions] = useState(0);
  const blocked = canExpedition(game, heading, sel, rations, unguard, potions);
  const days = daysOut(n, rations);
  const heroes = game.heroes
    .filter((h) => h.status !== 'muerto')
    .sort((a, b) => Number(a.status !== 'ok') - Number(b.status !== 'ok') || b.lvl - a.lvl);
  const toggle = (id: string) => {
    if (sel.includes(id)) {
      audio.play('deselect');
      setSel(sel.filter((x) => x !== id));
    } else if (sel.length < cap) {
      audio.play('select');
      const next = [...sel, id];
      setSel(next);
      // Que siempre lleven al menos lo justo.
      if (rations < minRations(next.length))
        setRations(Math.min(game.food, minRations(next.length)));
    }
  };
  const step = (d: number) => {
    const v = Math.max(0, Math.min(game.food, rations + d));
    if (v !== rations) audio.play('select', 0.5);
    setRations(v);
  };
  return (
    <div class="card-backdrop as-sheet" onClick={onClose}>
      <article
        class="herocard questsheet expsheet"
        onClick={(e) => e.stopPropagation()}
        aria-label={t('expediciones.expeditionsheet.titulo')}
      >
        <button
          class="btn-icon herocard-x"
          aria-label={t('expediciones.expeditionsheet.cerrar')}
          onClick={onClose}
        >
          <Icon name="close" size={14} />
        </button>
        <div class="qs-scroll">
          <header class="qs-head">
            <span class="eyebrow">
              {t('expediciones.expeditionsheet.a_la_vez', {
                n: game.expeditions?.length ?? 0,
                max: expSlots(game),
              })}
            </span>
            <h3>{t('expediciones.expeditionsheet.titulo')}</h3>
          </header>
          <h4 class="qs-sub">{t('expediciones.expeditionsheet.rumbo')}</h4>
          <div class="exp-headings" role="radiogroup">
            {HEADINGS.map((h) => {
              const open = OPEN_HEADINGS.includes(h);
              return (
                <button
                  key={h}
                  role="radio"
                  aria-checked={heading === h}
                  class={`exp-heading ${open ? '' : 'is-works'}`}
                  disabled={!open}
                  onClick={() => {
                    audio.play('select');
                    setHeading(h);
                  }}
                >
                  <Icon name={HEADING_ICON[h]} size={20} />
                  <b>{t(`expediciones.rumbos.${h}.titulo`)}</b>
                  <span class="exp-heading-mats">
                    {HEADING_MATS[h].map((m) => (
                      <MatIcon key={m} m={m} size={11} />
                    ))}
                  </span>
                  {!open && (
                    <span class="exp-works">{t('expediciones.expeditionsheet.en_obras')}</span>
                  )}
                </button>
              );
            })}
          </div>
          <p class="tiny exp-heading-desc">
            {t(`expediciones.rumbos.${heading}.desc`, {
              materiales: listNames(
                HEADING_MATS[heading].map((m) => MATERIALS[m].name.toLowerCase()),
              ),
            })}
          </p>

          <h4 class="qs-sub">
            {t('expediciones.expeditionsheet.quien_va', { n: sel.length, max: cap })}
          </h4>
          <div class="picks">
            {heroes.map((h) => {
              const on = sel.includes(h.id);
              const busy = h.status !== 'ok';
              return (
                <button
                  key={h.id}
                  class={`pick ${h.guard && !busy ? 'is-guard' : ''}`}
                  aria-pressed={on}
                  disabled={busy}
                  aria-label={[
                    h.name,
                    t('paneles.questsheet.de_nivel', {
                      clase: CLASS_NAMES[h.cls][h.sex],
                      nivel: h.lvl,
                    }),
                    busy ? statusLabel(h) : '',
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
                  </span>
                  <span class="pick-skills" aria-hidden="true">
                    {busy
                      ? statusLabel(h)
                      : t('expediciones.expeditionsheet.nivel', {
                          nivel: h.lvl,
                          clase: CLASS_NAMES[h.cls][h.sex],
                        })}
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
          {sel.length >= cap && cap < 4 && (
            <p class="tiny">{t('expediciones.expeditionsheet.tope', { n: cap })}</p>
          )}

          <h4 class="qs-sub">{t('expediciones.expeditionsheet.raciones')}</h4>
          <div class="exp-rations">
            <button
              class="btn btn-wood"
              aria-label={t('expediciones.expeditionsheet.menos')}
              onClick={() => step(-n)}
            >
              −
            </button>
            <span class="exp-rations-n" {...help(t('expediciones.expeditionsheet.raciones_ayuda'))}>
              <Icon name="pan" size={14} />
              <b>{rations}</b>
              <span class="row-sub">
                {t('expediciones.expeditionsheet.de_despensa', { n: game.food })}
              </span>
            </span>
            <button
              class="btn btn-wood"
              aria-label={t('expediciones.expeditionsheet.mas')}
              onClick={() => step(n)}
            >
              +
            </button>
          </div>
          {potMax > 0 && (
            <>
              <h4 class="qs-sub">{t('expediciones.expeditionsheet.pociones')}</h4>
              <div class="exp-rations">
                <button
                  class="btn btn-wood"
                  aria-label={t('expediciones.expeditionsheet.menos_pociones')}
                  onClick={() => {
                    audio.play('select', 0.5);
                    setPotions(Math.max(0, potions - 1));
                  }}
                >
                  −
                </button>
                <span class="exp-rations-n">
                  <MatIcon m="hierbas" size={14} />
                  <b>{potions}</b>
                  <span class="row-sub">
                    {t('expediciones.expeditionsheet.pociones_ayuda', {
                      n: EXP_POTION_HERBS,
                      max: potMax,
                    })}
                  </span>
                </span>
                <button
                  class="btn btn-wood"
                  aria-label={t('expediciones.expeditionsheet.mas_pociones')}
                  onClick={() => {
                    audio.play('select', 0.5);
                    setPotions(Math.min(potMax, potions + 1));
                  }}
                >
                  +
                </button>
              </div>
            </>
          )}
          <p class="tiny exp-days" role="status">
            {sel.length
              ? t('expediciones.expeditionsheet.dias', { dias: days, n: sel.length })
              : t('expediciones.expeditionsheet.elige')}
          </p>
        </div>
        {blocked && sel.length > 0 && (
          <p class="qs-warn" role="status">
            {blocked}
          </p>
        )}
        <button
          class="btn btn-gold qs-send"
          disabled={!sel.length || !!blocked}
          onClick={() => onSend(heading, sel, rations, unguard, potions)}
        >
          <Icon name="pasos" size={16} />
          {sel.length
            ? t('expediciones.expeditionsheet.salir', { n: sel.length })
            : t('expediciones.expeditionsheet.elige_quien')}
        </button>
      </article>
    </div>
  );
}
