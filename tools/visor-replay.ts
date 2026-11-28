// La repetición exacta de una pelea de expedición en el visor (`world/visor/replay.ts`), en
// fotogramas: `node tools/textos/esbuild.mjs tools/visor-replay.ts replay <carpeta> <rumbo> <n> [lejanía] [guardián]`.
import { mkdirSync, writeFileSync } from 'node:fs';
import { png } from './visor-png';
import { MOVIL } from '../src/world/visor/encuadre';
import { Visor } from '../src/world/visor/escena';
import type { MarchNow } from '../src/world/visor/marcha';
import { WIN_AFTER, fightSpan } from '../src/world/visor/gente';
import { scriptOf } from '../src/world/visor/replay';
import { newGame } from '../src/core/game';
import { battleSetup } from '../src/core/expedition';
import type { Expedition, Heading } from '../src/core/model';
const [dir, rumbo = 'sierra', idxS = '3', distS = '3', guard = ''] = process.argv.slice(2);
const heading = rumbo as Heading;
const idx = Number(idxS);
const terrain = (
  { bosque: 'bosque', sierra: 'monte', marismas: 'pantano', ruinas: 'ruina' } as const
)[heading];
mkdirSync(dir, { recursive: true });
const s = newGame('replay');
for (const h of s.heroes) h.lvl = 8;
const party = s.heroes.slice(0, 3);
const e = { heading, heroIds: party.map((h) => h.id), seed: 'replay', hours: 30 } as Expedition;
const setup = battleSetup(s, e, Number(distS), idx, 1, !!guard, 0.5);
const crew: MarchNow['crew'] = party.map((h) => ({
  id: h.id,
  name: h.name,
  seed: h.seed,
  cls: h.cls,
  sex: h.sex,
  fate: 'ok',
}));
const m: MarchNow = {
  seed: 'replay',
  terrain,
  crew,
  mode: 'fight',
  night: false,
  home: false,
  foe: 'bestia',
  wild: 0.5,
  hour: 11,
  weather: 'claro',
  day: 2,
  rival: { heading, idx, guardian: !!guard },
  sim: setup,
  pace: 1,
};
const span = fightSpan(m);
const sc = scriptOf(
  setup,
  crew.map((c) => c.id),
  1,
);
console.log(
  `pelea ${sc.T.toFixed(1)} s, ${sc.won ? 'ganan' : 'pierden'}, escena ${span.toFixed(1)} s`,
);
const v = new Visor(MOVIL);
const fps = 10;
const total = span + (sc.won ? WIN_AFTER : 0.6);
for (let k = 0; k * (1 / fps) < total; k++) {
  const t = k / fps;
  const now = t < span || !sc.won ? m : { ...m, mode: 'walk' as const, won: true };
  writeFileSync(`${dir}/${String(k).padStart(4, '0')}.png`, png(v.frame(now, t), 2));
}
