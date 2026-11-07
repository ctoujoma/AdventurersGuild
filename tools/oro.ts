/**
 * La economía del modo libre, rango a rango: lo que paga un encargo de media frente a lo que
 * cuesta una semana de sueldos y las mejoras de sala. `npm run oro`.
 */
import { ROOM_COST, RANKS, levelRaise } from '../src/core/balance';
import { generateQuest } from '../src/core/generate';
import { Rng } from '../src/core/rng';

const N = 4000;
/** Sueldo semanal de un héroe de nivel `lvl` contratado a nivel 1 (sin calidad). */
const wage = (lvl: number) => {
  let w = 6 + 4;
  for (let l = 2; l <= lvl; l++) w += levelRaise(l);
  return w;
};
/** Nivel típico de los héroes en cada rango y cuántos hay en casa. */
const LVL = [2, 3, 5, 7, 9];
const HEROES = [4, 5, 6, 7, 8];
/** Encargos que se cierran a la semana: unos dos por héroe (salen de dos en dos o tres). */
const PER_WEEK = (n: number) => Math.round(n * 0.9);
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const rooms = Object.values(ROOM_COST);
const upgrade = (lvl: number) => mean(rooms.map((c) => c[lvl] ?? c[c.length - 1]!));

console.log('rango    paga/encargo  encargos/sem  ingresos/sem  sueldos/sem  neto  mejora tipica');
RANKS.forEach((r, k) => {
  const rng = new Rng(`oro-${k}`);
  const pays: number[] = [];
  for (let i = 0; i < N; i++) pays.push(generateQuest(rng, `q${i}`, k, `i${i}`, true).reward);
  const pay = mean(pays);
  const n = PER_WEEK(HEROES[k]!);
  const wages = HEROES[k]! * wage(LVL[k]!);
  const up = upgrade(Math.min(4, k + 2));
  console.log(
    [
      r.name.padEnd(8),
      pay.toFixed(0).padStart(12),
      String(n).padStart(13),
      (pay * n).toFixed(0).padStart(13),
      String(wages).padStart(12),
      (pay * n - wages).toFixed(0).padStart(5),
      up.toFixed(0).padStart(14),
    ].join(' '),
  );
});
