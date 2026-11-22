import { useEffect, useState } from 'preact/hooks';
import { audio } from '../audio/audio';
import { DAYS, RANKS } from '../core/balance';
import { customOf, nextPayment, nextRank, rankOf, salaries } from '../core/game';
import { beerCap, dailyYield, foodCap, hungryTonight } from '../core/larder';
import { goldCap, vaultFull } from '../core/vault';
import { listNames } from './text';
import { rankUnlocks } from '../core/ranks';
import { dawnIn, nightIn, shortDawn } from './when';
import type { GameState, Report } from '../core/model';
import { Counter } from './Counter';
import { Icon } from './icons';
import { AlertBell, type BellView } from './AlertBell';
import type { Notice } from './alerts';
import { bandParams } from '../data/raids';
import { t } from '../textos';

type Tip = 'oro' | 'rep' | 'comida' | 'cerveza' | 'pago' | 'asalto';

/**
 * Barra superior: día, nombre y rango del gremio, oro, reputación, comida, cerveza y próximo pago. Al tocar
 * una cifra sale debajo una línea que explica qué es. A la derecha, la campana (avisos e informes),
 * el sonido y el engranaje (partidas, ajustes y menú principal).
 */
export function Hud({
  game,
  onSettings,
  onSaves,
  onTitle,
  alerts,
  onAlert,
  onHush,
  hushedCount,
  onUnhush,
  quiet,
  reports,
  onReport,
  onReadAll,
  onHistory,
  bell,
  onBell,
}: {
  game: GameState;
  onSettings: () => void;
  onSaves: () => void;
  onTitle: () => void;
  alerts: Notice[];
  onAlert: (n: Notice) => void;
  onHush: (ids: string[]) => void;
  hushedCount: number;
  onUnhush: () => void;
  quiet?: boolean;
  reports: Report[];
  onReport: (id: string) => void;
  onReadAll: () => void;
  onHistory: () => void;
  bell: BellView | null;
  onBell: (v: BellView | null) => void;
}) {
  const [gear, setGear] = useState(false);
  useEffect(() => {
    if (!gear) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setGear(false);
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [gear]);
  /** Una entrada del engranaje: cierra el menú y abre lo suyo. */
  const gearItem = (icon: 'pergamino' | 'ajustes' | 'puerta', label: string, go: () => void) => (
    <button
      class="gear-item"
      onClick={() => {
        audio.play('select');
        setGear(false);
        go();
      }}
    >
      <Icon name={icon} size={16} />
      <span>{label}</span>
    </button>
  );
  const [sound, setSound] = useState(audio.on);
  useEffect(() => audio.subscribe(setSound), []);
  const pay = nextPayment(game);
  const due = pay ? pay.amount + salaries(game) : 0;
  const close = pay ? pay.day - game.day <= 2 : false;
  const short = pay ? game.gold < due : false;
  const nr = nextRank(game);
  const [tip, setTip] = useState<Tip | null>(null);
  useEffect(() => {
    if (!tip) return;
    const t = setTimeout(() => setTip(null), 6000);
    return () => clearTimeout(t);
  }, [tip]);
  const toggle = (t: Tip) => setTip((cur) => (cur === t ? null : t));
  const left = pay ? pay.day - game.day : 0;
  const nights = game.raid ? Math.max(0, game.raid.day - game.day) : 0;
  const when = dawnIn(left);
  const made = dailyYield(game);
  const opens = nr ? rankUnlocks(RANKS.indexOf(nr)) : [];
  const hungry = hungryTonight(game);
  const tips: Record<Tip, string> = {
    oro: t('barra.hud.oro_de_que_caben', {
      oro: game.gold,
      cabe: goldCap(game),
      llena: vaultFull(game),
    }),
    rep: nr
      ? t('barra.hud.reputacion_con_el_gremio', {
          fama: game.rep,
          at: nr.at,
          nombre: nr.name,
          hay: opens.length > 0,
          abre: listNames(opens),
        })
      : t('barra.hud.reputacion_ya_sois_el', { fama: game.rep }),
    comida: t('barra.hud.raciones_de_que_caben', {
      raciones: game.food,
      cabe: foodCap(game.building),
      hace: made.food,
      sin_cena: hungry,
    }),
    cerveza: t('barra.hud.jarras_de_que_caben', {
      jarras: game.beer,
      cabe: beerCap(game.building),
      saca: made.beer,
    }),
    pago: !pay
      ? ''
      : pay.amount
        ? t('barra.hud.proximo_pago_el_dia', {
            dia: pay.day,
            when,
            deuda: pay.amount,
            salarios: due - pay.amount,
            total: due,
            no_llega: short,
          })
        : t('barra.hud.salarios_del_dia_monedas', {
            dia: pay.day,
            when,
            total: due,
            no_llega: short,
          }),
    asalto: game.raid
      ? t('asaltos.aviso_barra', bandParams(game.raid.band, { cuando: nightIn(nights) }))
      : '',
  };
  return (
    <header class="hud">
      <div class="hud-day">
        <span class="hud-k">{t('barra.hud.dia')}</span>
        <b>{game.mode === 'libre' ? game.day : Math.min(game.day, DAYS)}</b>
        {game.mode !== 'libre' && <small>/{DAYS}</small>}
      </div>
      <div class="hud-name">
        <b>{customOf(game).name}</b>
        <span>{t('barra.hud.gremio_de', { nombre: rankOf(game).name })}</span>
      </div>
      <div class="hud-stats">
        <button
          data-gold
          class={`hud-stat ${game.gold >= goldCap(game) ? 'danger' : vaultFull(game) ? 'warn' : ''}`}
          aria-label={tips.oro}
          aria-expanded={tip === 'oro'}
          onClick={() => toggle('oro')}
        >
          <Icon name="coin" size={16} />
          <Counter value={game.gold} />
        </button>
        <button
          class="hud-stat"
          aria-label={tips.rep}
          aria-expanded={tip === 'rep'}
          onClick={() => toggle('rep')}
        >
          <Icon name="star" size={16} />
          <Counter value={game.rep} />
        </button>
        <button
          class={`hud-stat ${hungry ? 'warn' : ''}`}
          aria-label={tips.comida}
          aria-expanded={tip === 'comida'}
          onClick={() => toggle('comida')}
        >
          <Icon name="pan" size={16} />
          <Counter value={game.food} />
        </button>
        <button
          class="hud-stat"
          aria-label={tips.cerveza}
          aria-expanded={tip === 'cerveza'}
          onClick={() => toggle('cerveza')}
        >
          <Icon name="jarra" size={16} />
          <Counter value={game.beer} />
        </button>
        {pay && (
          <button
            class={`hud-stat ${close && short ? 'danger' : close || short ? 'warn' : ''}`}
            aria-label={tips.pago}
            aria-expanded={tip === 'pago'}
            onClick={() => toggle('pago')}
          >
            <Icon name="pergamino" size={16} />
            <b>{due}</b>
            <small class="hud-due">{shortDawn(left)}</small>
          </button>
        )}
        {game.raid?.warned && (
          <button
            class="hud-stat danger raid-warn"
            aria-label={tips.asalto}
            aria-expanded={tip === 'asalto'}
            onClick={() => toggle('asalto')}
          >
            <Icon name="flag" size={16} />
            {nights <= 1 ? (
              <b>{t('barra.hud.hoy')}</b>
            ) : (
              <>
                <b>{nights}</b>
                <small class="hud-due">{t('barra.hud.noches', { n: nights })}</small>
              </>
            )}
          </button>
        )}
        <AlertBell
          alerts={alerts}
          onGo={onAlert}
          onHush={onHush}
          hushedCount={hushedCount}
          onUnhush={onUnhush}
          quiet={quiet}
          reports={reports}
          onReport={onReport}
          onReadAll={onReadAll}
          onHistory={onHistory}
          open={bell}
          onOpen={onBell}
        />
        <button
          class="btn-icon hud-sound"
          aria-label={sound ? t('barra.hud.silenciar') : t('barra.hud.activar_sonido')}
          aria-pressed={sound}
          onClick={() => audio.toggle()}
        >
          <Icon name={sound ? 'sound' : 'mute'} size={16} />
        </button>
        <div class="alerts gear">
          <button
            class="btn-icon"
            data-tut="engranaje"
            aria-label={t('barra.hud.partidas_ajustes_y_menu')}
            aria-expanded={gear}
            onClick={() => {
              audio.play(gear ? 'close' : 'open');
              setGear(!gear);
            }}
          >
            <Icon name="ajustes" size={16} />
          </button>
          {gear && (
            <>
              <div class="alerts-scrim" onClick={() => setGear(false)} />
              <div class="alerts-pop gear-pop" role="menu" aria-label={t('barra.hud.sistema')}>
                {gearItem('pergamino', t('barra.hud.partidas'), onSaves)}
                {gearItem('ajustes', t('barra.hud.ajustes'), onSettings)}
                {gearItem('puerta', t('barra.hud.menu_principal'), onTitle)}
              </div>
            </>
          )}
        </div>
      </div>
      {tip && tips[tip] && (
        <p class="hud-tip" role="status" onClick={() => setTip(null)}>
          {tips[tip]}
        </p>
      )}
    </header>
  );
}
