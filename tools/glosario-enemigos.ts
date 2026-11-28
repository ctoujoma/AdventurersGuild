// Todo enemigo o jefe nuevo va aquí, en su sección (rumbo, guardianes, jefes de encargos, tira o
// reserva), y se regenera la página y el artefacto «Bestiario del Jarro».
// El glosario de enemigos (`docs/glosario-enemigos.html`): todos los enemigos y jefes que hay, con
// sus animaciones sacadas del arte del juego y dónde salen. Se regenera al cambiar un enemigo:
// `node tools/textos/esbuild.mjs tools/glosario-enemigos.ts glosario docs/glosario-enemigos.html`.
import { readFileSync, writeFileSync } from 'node:fs';
import { png } from './visor-png';
import {
  ahogadoGrandeArt,
  cenizaArt,
  deathOf,
  expFoeArt,
  expGuardianArt,
} from '../src/art/expFoes';
import { CALCOS } from '../src/art/expCalcos';
import { bossArtFor } from '../src/art/bossCalco';
import { foeArt, type FoeArt } from '../src/art/foes';
import type { BossArt } from '../src/art/bosses';
import { PixelBuffer, alpha, rgba } from '../src/art/pixel';
import { createHash } from 'node:crypto';
import { foeFrame } from '../src/world/visor/gente';
import { BLOOD, drawFxGlow, drawFxScene, furOf, type Fx } from '../src/world/visor/vfx';
import { luzAt } from '../src/world/visor/luz';
import { fightSprites, generateLook, heroSprites } from '../src/art/heroes/hero';
import { BOSSES, type BossKind } from '../src/data/bosses';
import { CHAINS } from '../src/data/chains';
import { FOE_NAMES, type FoeKind } from '../src/data/journey';
import { HEADING_FOES } from '../src/core/expedition';
import { t, tl, tx } from '../src/textos';
import type { Heading } from '../src/core/model';

// Con `artefacto` detrás, sin la cabecera del documento (la pone quien lo publica).
const [out, bare] = process.argv.slice(2);
const HEADINGS: Heading[] = ['bosque', 'sierra', 'marismas', 'ruinas'];
const rumbo = (h: Heading) => t(`expediciones.rumbos.${h}.nombre`);

/** Los fotogramas, una vez cada uno (los repetidos se comparten). */
const pool: string[] = [];
const seen = new Map<string, number>();
const ids = (bs: readonly PixelBuffer[]) =>
  bs.map((b) => {
    const key = createHash('md5').update(b.data).digest('hex') + b.w;
    let i = seen.get(key);
    if (i === undefined) {
      i = pool.push('data:image/png;base64,' + png(b, 1).toString('base64')) - 1;
      seen.set(key, i);
    }
    return i;
  });

type Anims = {
  quieto: number[];
  ataque: number[];
  herido: number[];
  muerte: number[];
  /** La otra muerte, si tiene dos. */
  muerte2?: number[];
};
interface Entry {
  name: string;
  /** Calcado de una hoja (con sus secuencias) o el dibujo antiguo (poses sueltas). */
  calco: boolean;
  where: string[];
  anims: Anims;
  /** Aún no sale en el juego. */
  unused?: boolean;
}

type Pose = 'idle' | 'windup' | 'strike' | 'hurt' | 'down';
/** Lo que hace falta para pintar a uno en la escena, venga de un enemigo o de un jefe. */
interface Actor {
  frame(pose: Pose, u: number, t: number): { img: PixelBuffer; foot: number };
  all: PixelBuffer[];
  chest: number;
  span: number;
  big: boolean;
  /** Embiste (el jabalí): estelas, se lanza y choque fuerte. */
  ram: boolean;
  /** Araña (las bestias pequeñas). */
  claw: boolean;
  fur: number[];
}

function foeActor(f: FoeArt): Actor {
  const ram = f.what === 'jabali' || f.what === 'ceniza' || f.what === 'viejo_jabali';
  return {
    frame: (pose, u, t) => ({ img: foeFrame(f, pose, u, t), foot: f.foot }),
    all: [...Object.values(f.poses), ...Object.values(f.seq ?? {}).flat()],
    chest: f.chest,
    span: f.span,
    big: f.big,
    ram,
    claw: (f.kind === 'bestia' || f.kind === 'alimana') && !f.big && !ram,
    fur: furOf(f.poses.idle),
  };
}

const BOSS_POSE = {
  idle: 'ready',
  windup: 'windup',
  strike: 'strike',
  hurt: 'up',
  down: 'down',
} as const;
function bossActor(b: BossArt, kind: BossKind): Actor {
  return {
    frame: (pose, u, t) => {
      const bp = BOSS_POSE[pose];
      const s = b.seq?.[bp];
      const img = !s?.length
        ? b.poses[bp]
        : pose === 'idle'
          ? s[Math.floor(t * 5) % s.length]!
          : s[Math.max(0, Math.min(s.length - 1, Math.floor(u * s.length)))]!;
      return { img, foot: pose === 'down' ? b.downFoot.x : b.foot.x };
    },
    all: [...Object.values(b.poses), ...Object.values(b.seq ?? {}).flat()],
    chest: b.chest,
    span: b.poses.ready.w,
    big: true,
    ram: kind === 'jabali',
    claw: false,
    fur: furOf(b.poses.ready),
  };
}

const STAGE = rgba('#e2dac5');
const WHITE = rgba('#ffffff');
const LUZ = luzAt(12, { rain: 0, fog: 0, cloud: 0 });
const LOOK = generateLook('glosario-heroe', 'guerrero', 'f');
const HERO = fightSprites(LOOK);
const CHEER = heroSprites(LOOK).cheer;
const FPS = 10;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Pega `img` con los pies (`fx`, fila de abajo) en (`x`, `y`); `flip`, mirando a la izquierda. */
function put(
  b: PixelBuffer,
  img: PixelBuffer,
  x: number,
  y: number,
  fx: number,
  flip = false,
  as?: number,
) {
  let fy = img.h - 1;
  while (fy > 0 && ![...Array(img.w).keys()].some((i) => alpha(img.get(i, fy)))) fy--;
  for (let j = 0; j < img.h; j++)
    for (let i = 0; i < img.w; i++) {
      const c = img.get(i, j);
      if (!alpha(c)) continue;
      const dx = flip ? fx - i : i - fx;
      b.set(Math.round(x + dx), y - fy + j, as ?? c);
    }
}

/**
 * Las cuatro animaciones en una escena pequeña, con los efectos de la pelea del visor (`vfx.ts`,
 * con las mismas reglas que `visor/gente.ts`): el enemigo a la izquierda y una heroína delante.
 * Ataque: carga y golpe (zarpazo, choque o embestida) sobre ella; herido: ella le da un tajo y
 * saltan sangre y pelo; muerte: el golpe final, cae con polvo (y temblor si es grande) y ella lo
 * celebra.
 */
function scene(a: Actor): Anims {
  const maxW = Math.max(...a.all.map((b) => b.w));
  const maxH = Math.max(...a.all.map((b) => b.h));
  const foot0 = a.frame('idle', 0, 0).foot;
  const W = 8 + maxW + (a.ram ? 10 : 2) + 26;
  const H = maxH + 20;
  const feet = H - 5;
  const fx = 4 + foot0;
  const heroX = fx + (maxW - foot0) + (a.ram ? 14 : 10);
  const dir = -1; // de la heroína al enemigo
  const near = fx + Math.round(a.span / 2);
  const draw = (k: 'quieto' | 'ataque' | 'herido' | 'muerte', t: number): PixelBuffer => {
    const b = new PixelBuffer(W, H);
    b.rect(0, 0, W, H, STAGE);
    const fxs: Fx[] = [];
    let pose: Pose = 'idle';
    let u = 0;
    let dx = 0;
    let shake = 0;
    let flash = false;
    let hero = HERO.ready;
    let heroDx = 0;
    let heroFlash = false;
    let cheer = false;
    const p = t / 1.6;
    if (k === 'ataque' && p < 1) {
      if (p < 0.3) [pose, u] = ['windup', p / 0.3];
      else if (p < 0.58) [pose, u] = ['strike', (p - 0.3) / 0.28];
      if (a.ram) {
        dx = Math.round(
          8 *
            (p < 0.24
              ? 0
              : p < 0.34
                ? (p - 0.24) / 0.1
                : p < 0.5
                  ? 1
                  : Math.max(0, 1 - (p - 0.5) / 0.3)),
        );
        if (p > 0.22 && p < 0.66) {
          const img = a.frame(pose, u, t).img;
          const cols: number[] = [];
          for (let y = Math.round(img.h * 0.4); y < Math.round(img.h * 0.8); y++) {
            let c0 = 0;
            while (c0 < img.w && !alpha(img.get(c0, y))) c0++;
            if (c0 < img.w) cols.push(c0);
          }
          cols.sort((x0, x1) => x0 - x1);
          const col = cols[Math.floor(cols.length / 2)] ?? 0;
          const top = feet - a.frame('idle', 0, 0).img.h + 4;
          fxs.push({
            k: 'rush',
            x: fx + dx + dir * (foot0 - col),
            top,
            bottom: feet - 3,
            back: dir,
            a: (p - 0.22) / 0.44,
            seed: 3,
          });
          fxs.push({ k: 'dust', x: fx + dx + dir * 6, y: feet, a: (p - 0.26) / 0.4, w: 7 });
        }
      }
      if (a.big && p > 0.32 && p < 0.7) {
        if (p < 0.42) shake = Math.floor(t * 40) % 2 ? 1 : -1;
        fxs.push({
          k: 'dust',
          x: fx + dx - dir * Math.round(a.span * 0.45),
          y: feet,
          a: (p - 0.32) / 0.38,
          w: 12,
        });
      }
      if (p >= 0.32 && p < 0.62) {
        heroFlash = p < 0.44 && Math.floor(t * 20) % 2 === 0;
        heroDx = -dir * 2;
        hero = HERO.up;
        if (a.ram && p < 0.4) shake = Math.floor(t * 40) % 2 ? 1 : -1;
        if (a.claw)
          fxs.push({ k: 'claw', x: heroX + dir * 2, y: feet - 14, dir, a: (p - 0.32) / 0.4 });
        else
          fxs.push({
            k: 'impact',
            x: heroX + dir * 4,
            y: feet - 14,
            a: (p - 0.32) / (a.ram ? 0.18 : 0.14),
            big: a.ram,
          });
        fxs.push({ k: 'dust', x: heroX - dir * 2, y: feet, a: (p - 0.32) / 0.4, w: a.ram ? 9 : 5 });
      }
    }
    // La heroína golpea (herido y el golpe final de la muerte).
    if ((k === 'herido' || k === 'muerte') && p < 1) {
      hero = p < 0.3 ? HERO.windup : p < 0.58 ? HERO.strike : HERO.ready;
      if (p < 0.58) heroDx = dir * Math.round(4 * Math.sin(Math.PI * clamp01(p / 0.58)));
      fxs.push({
        k: 'slash',
        x: near - dir * 7,
        y: feet - a.chest,
        dir,
        a: (p - 0.27) / 0.13,
        big: false,
      });
      if (p > 0.32) {
        flash = p < 0.44 && Math.floor(t * 20) % 2 === 0;
        fxs.push({
          k: 'impact',
          x: fx - dir * 4,
          y: feet - a.chest,
          a: (p - 0.32) / 0.16,
          big: a.big,
        });
        fxs.push({
          k: 'bits',
          x: fx - dir * 3,
          y: feet - a.chest,
          floor: feet + 1,
          dir,
          a: (p - 0.32) / 0.62,
          seed: 11,
          cols: [...BLOOD, ...a.fur],
          n: a.big ? 11 : 7,
        });
      }
      if (k === 'herido' && p > 0.32 && p < 0.82) [pose, u] = ['hurt', (p - 0.32) / 0.5];
    }
    if (k === 'muerte' && p > 0.32) {
      const du = (t - 0.52) / 1.6;
      [pose, u] = ['down', clamp01(du)];
      const fall = (du - 0.55) / 0.5;
      if (fall >= 0 && fall < 1) {
        fxs.push({ k: 'dust', x: fx, y: feet, a: fall, w: Math.max(8, a.span * 0.4) });
        if (a.big && fall < 0.12) shake = Math.floor(t * 40) % 2 ? 1 : -1;
      }
      cheer = t > 2.4;
    }
    const { img, foot } = a.frame(pose, u, t);
    put(
      b,
      img,
      fx + dx,
      feet + shake + (pose === 'down' ? 1 : 0),
      foot,
      false,
      flash ? WHITE : undefined,
    );
    if (cheer) {
      const hop = Math.round(Math.abs(Math.sin(t * 7)) * 3);
      put(b, CHEER, heroX, feet - hop + shake, 9);
    } else put(b, hero, heroX + heroDx, feet + shake, 9, true, heroFlash ? WHITE : undefined);
    drawFxScene(b, fxs, LUZ);
    drawFxGlow(b, fxs, LUZ);
    return b;
  };
  const run = (k: Exclude<keyof Anims, 'muerte2'>, secs: number) =>
    ids(Array.from({ length: Math.round(secs * FPS) }, (_, i) => draw(k, i / FPS)));
  return {
    quieto: run('quieto', 3.2),
    ataque: run('ataque', 2.2),
    herido: run('herido', 2.0),
    muerte: run('muerte', 4.2),
  };
}

const foeAnims = (f: FoeArt): Anims => {
  const a = scene(foeActor(f));
  if (f.downAlt?.length) a.muerte2 = scene(foeActor(deathOf(f, 1))).muerte;
  return a;
};
const bossAnims = (b: BossArt, k: BossKind) => scene(bossActor(b, k));

/** Dónde más sale un dibujo de las expediciones (fuera de su rumbo). */
const MORE: Record<string, string[]> = {
  'bosque:0': ['Encargos: las bestias de la tira del viaje'],
  'sierra:1': ['Encargos: los trasgos de la tira del viaje'],
  'bosque:2': ['Expediciones: el oso que se ve delante (suceso «oso»)'],
  'bosque:3': [
    'Expediciones: guardián de bosque, marismas y ruinas (de momento)',
    'Encargos: la bestia de Hondogrís (jefe de «La sombra de Hondogrís»)',
  ],
};

/**
 * Otros guardianes de un rumbo (los que no da `expGuardianArt(h)`). El Jabalí Quemado: segundo
 * guardián del bosque, más adelante (agente de expediciones, `expGuardianArt('bosque', 1)`).
 */
const MORE_GUARDIANS: Partial<
  Record<Heading, { name: string; art: () => FoeArt; where: string[] }[]>
> = {
  bosque: [
    {
      name: 'El Jabalí Quemado',
      art: cenizaArt,
      where: [
        'Expediciones: segundo guardián del bosque, más adelante (el dibujo del jabalí de ceniza)',
        'Encargos: el jabalí de ceniza (jefe de la historia «Ceniza»)',
      ],
    },
  ],
};

const exp: { heading: string; foes: Entry[] }[] = HEADINGS.map((h) => {
  const names = tl<string[]>(`expediciones.enemigos.${h}`);
  const foes: Entry[] = names.map((n, i) => {
    const { art, count } = expFoeArt(h, i);
    return {
      name: n.charAt(0).toUpperCase() + n.slice(1),
      calco: art.what in CALCOS,
      where: [
        `Expediciones: ${rumbo(h)}${count > 1 ? ` (en grupo de ${count})` : ''}`,
        ...(MORE[`${h}:${i}`] ?? []),
      ],
      anims: foeAnims(art),
    };
  });
  const g = expGuardianArt(h);
  if (g !== expFoeArt('bosque', 3).art)
    foes.push({
      name: t(`expediciones.guardianes.${h}`).replace(/^./, (c) => c.toUpperCase()),
      calco: g.what in CALCOS,
      where: [`Expediciones: guardián de ${rumbo(h)} (raro, espera a la vista)`],
      anims: foeAnims(g),
    });
  for (const x of MORE_GUARDIANS[h] ?? [])
    foes.push({ name: x.name, calco: true, where: x.where, anims: foeAnims(x.art()) });
  return { heading: rumbo(h), foes };
});

/** Jefes ya calcados que aún no se han enganchado en `BOSS_CALCO`: se enseña el calco. */
const PENDING: Partial<Record<BossKind, () => FoeArt>> = {};

const bosses: Entry[] = (Object.keys(BOSSES) as BossKind[]).map((k) => {
  const b = bossArtFor(k);
  const pend = !b.seq ? PENDING[k] : undefined;
  const chain = CHAINS.find((c) => c.steps.some((s) => s.boss === k));
  const step = chain?.steps.find((s) => s.boss === k);
  return {
    name: BOSSES[k].name,
    calco: !!b.seq || !!pend,
    where: [
      chain
        ? `Encargos: historia «${tx(chain.name)}»${step?.place ? `, en ${tx(step.place)}` : ''}`
        : 'Encargos: sin historia',
      ...(pend
        ? ['Calcado, pendiente de enganchar en la pelea (en el juego sale aún el antiguo)']
        : []),
    ],
    anims: pend ? foeAnims(pend()) : bossAnims(b, k),
  };
});

/** Las familias de la tira que salen calcadas (como `STRIP_CALCO` de `world/tripStrip.ts`). */
const STRIP_FROM: Partial<Record<FoeKind, { art: () => FoeArt; as: string }>> = {
  bestia: { art: () => expFoeArt('bosque', 0).art, as: 'los lobos del bosque' },
  trasgo: { art: () => expFoeArt('sierra', 1).art, as: 'los trasgos de la sierra' },
};
const KINDS: FoeKind[] = ['bandido', 'trasgo', 'bestia', 'alimana', 'muerto', 'grande'];
const strip: Entry[] = KINDS.map((k) => {
  const from = STRIP_FROM[k];
  const calco = !!from;
  const art = from ? from.art() : foeArt(k, 'glosario');
  const rumbos = HEADINGS.filter((h) => HEADING_FOES[h]?.includes(k)).map(rumbo);
  return {
    name: FOE_NAMES[k].replace(/^./, (c) => c.toUpperCase()),
    calco,
    where: [
      `Encargos: enemigos de la tira del viaje${from ? ` (${from.as})` : ''}`,
      ...(rumbos.length ? [`Familia de: ${rumbos.join(', ')}`] : []),
    ],
    anims: foeAnims(art),
  };
});

/** Calcados que aún no salen en el juego (para más adelante). */
const reserva: Entry[] = [
  {
    name: 'Ahogado grande',
    calco: true,
    unused: true,
    where: [
      'Sin usar todavía: el ahogado de las marismas a la escala de su hoja, para un jefe más adelante',
    ],
    anims: foeAnims(ahogadoGrandeArt()),
  },
];

const data = {
  pool,
  groups: [
    ...exp.map((e) => ({ title: `Expediciones · ${e.heading}`, items: e.foes })),
    { title: 'Encargos · jefes de las historias', items: bosses },
    { title: 'Encargos · enemigos de la tira', items: strip },
    { title: 'Reserva · calcados sin usar todavía', items: reserva },
  ],
};
const tpl = readFileSync('tools/glosario-enemigos.html', 'utf8');
const head =
  '<!doctype html>\n<html lang="es">\n<meta charset="utf-8">\n' +
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n';
const page = tpl.replace('/*DATOS*/ null', JSON.stringify(data));
writeFileSync(out!, bare === 'artefacto' ? page : head + page);
console.log(`${pool.length} fotogramas`);
