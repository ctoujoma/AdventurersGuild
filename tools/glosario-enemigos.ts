// El glosario de enemigos (`docs/glosario-enemigos.html`): todos los enemigos y jefes que hay, con
// sus animaciones sacadas del arte del juego y dónde salen. Se regenera al cambiar un enemigo:
// `node tools/textos/esbuild.mjs tools/glosario-enemigos.ts glosario docs/glosario-enemigos.html`.
import { readFileSync, writeFileSync } from 'node:fs';
import { png } from './visor-png';
import { expFoeArt, expGuardianArt } from '../src/art/expFoes';
import { CALCOS } from '../src/art/expCalcos';
import { bossArtFor } from '../src/art/bossCalco';
import { foeArt, type FoeArt } from '../src/art/foes';
import type { BossArt } from '../src/art/bosses';
import type { PixelBuffer } from '../src/art/pixel';
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
const seen = new Map<PixelBuffer, number>();
const ids = (bs: readonly PixelBuffer[]) =>
  bs.map((b) => {
    let i = seen.get(b);
    if (i === undefined) {
      i = pool.push('data:image/png;base64,' + png(b, 1, true).toString('base64')) - 1;
      seen.set(b, i);
    }
    return i;
  });

type Anims = { quieto: number[]; ataque: number[]; herido: number[]; muerte: number[] };
interface Entry {
  name: string;
  /** Calcado de una hoja (con sus secuencias) o el dibujo antiguo (poses sueltas). */
  calco: boolean;
  where: string[];
  anims: Anims;
}

function foeAnims(f: FoeArt): Anims {
  const s = f.seq ?? {};
  return {
    quieto: ids(s.idle ?? [f.poses.idle, f.poses.idle2]),
    ataque: ids([...(s.windup ?? [f.poses.windup]), ...(s.strike ?? [f.poses.strike])]),
    herido: ids(s.hurt ?? [f.poses.hurt]),
    muerte: ids(s.down ?? [f.poses.hurt, f.poses.down]),
  };
}
function bossAnims(b: BossArt): Anims {
  const s = b.seq ?? {};
  return {
    quieto: ids(s.ready ?? [b.poses.ready]),
    ataque: ids([...(s.windup ?? [b.poses.windup]), ...(s.strike ?? [b.poses.strike])]),
    herido: ids(s.up ?? [b.poses.up]),
    muerte: ids(s.down ?? [b.poses.up, b.poses.down]),
  };
}

/** Dónde más sale un dibujo de las expediciones (fuera de su rumbo). */
const MORE: Record<string, string[]> = {
  'bosque:0': ['Encargos: las bestias de la tira del viaje'],
  'bosque:2': ['Expediciones: el oso que se ve delante (suceso «oso»)'],
  'bosque:3': [
    'Expediciones: guardián de bosque, marismas y ruinas (de momento)',
    'Encargos: la bestia de Hondogrís (jefe de «La sombra de Hondogrís»)',
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
  return { heading: rumbo(h), foes };
});

const bosses: Entry[] = (Object.keys(BOSSES) as BossKind[]).map((k) => {
  const b = bossArtFor(k);
  const chain = CHAINS.find((c) => c.steps.some((s) => s.boss === k));
  const step = chain?.steps.find((s) => s.boss === k);
  return {
    name: BOSSES[k].name,
    calco: !!b.seq,
    where: [
      chain
        ? `Encargos: historia «${tx(chain.name)}»${step?.place ? `, en ${tx(step.place)}` : ''}`
        : 'Encargos: sin historia',
    ],
    anims: bossAnims(b),
  };
});

const KINDS: FoeKind[] = ['bandido', 'trasgo', 'bestia', 'alimana', 'muerto', 'grande'];
const strip: Entry[] = KINDS.map((k) => {
  const calco = k === 'bestia';
  const art = calco ? expFoeArt('bosque', 0).art : foeArt(k, 'glosario');
  const rumbos = HEADINGS.filter((h) => HEADING_FOES[h]?.includes(k)).map(rumbo);
  return {
    name: FOE_NAMES[k].replace(/^./, (c) => c.toUpperCase()),
    calco,
    where: [
      `Encargos: enemigos de la tira del viaje${calco ? ' (los lobos del bosque)' : ''}`,
      ...(rumbos.length ? [`Familia de: ${rumbos.join(', ')}`] : []),
    ],
    anims: foeAnims(art),
  };
});

const data = {
  pool,
  groups: [
    ...exp.map((e) => ({ title: `Expediciones · ${e.heading}`, items: e.foes })),
    { title: 'Encargos · jefes de las historias', items: bosses },
    { title: 'Encargos · enemigos de la tira', items: strip },
  ],
};
const tpl = readFileSync('tools/glosario-enemigos.html', 'utf8');
const head =
  '<!doctype html>\n<html lang="es">\n<meta charset="utf-8">\n' +
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n';
const page = tpl.replace('/*DATOS*/ null', JSON.stringify(data));
writeFileSync(out!, bare === 'artefacto' ? page : head + page);
console.log(`${pool.length} fotogramas`);
