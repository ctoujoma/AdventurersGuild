import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseSave } from '../platform/storage';
import { tx, type Txt } from '../textos';
import type { GameState } from './model';
import { SAVE_VERSION } from './model';

/** Una partida de la versión 5 jugada un mes con el código de entonces (textos ya escritos). */
const RAW = readFileSync(join(__dirname, 'fixtures', 'partida-v5.json'), 'utf8');
const old = JSON.parse(RAW) as GameState;
const isMsg = (x: Txt | undefined) => typeof x === 'object' && x !== null && 'k' in x;

describe('conversor de partidas 5 → 6', () => {
  const s = parseSave(RAW)!;

  it('carga la partida vieja y la deja en la versión de ahora', () => {
    expect(old.version).toBe(5);
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.day).toBe(old.day);
    expect(s.gold).toBe(old.gold);
  });

  it('lo que sale de un catálogo pasa a mensaje y se lee igual que antes', () => {
    const pairs: [Txt | undefined, Txt | undefined][] = [
      ...s.inventory.flatMap((it, i) => [
        [it.name, old.inventory[i]!.name] as [Txt, Txt],
        [it.desc, old.inventory[i]!.desc] as [Txt, Txt],
      ]),
      ...s.trophies.map((t, i) => [t.name, old.trophies[i]!.name] as [Txt, Txt]),
      ...s.quests.flatMap((q, i) => [
        [q.title, old.quests[i]!.title] as [Txt, Txt],
        [q.text, old.quests[i]!.text] as [Txt, Txt],
      ]),
      ...s.missions.map((m, i) => [m.quest.title, old.missions[i]!.quest.title] as [Txt, Txt]),
      ...s.heroes.map((h, i) => [h.quote, old.heroes[i]!.quote] as [Txt, Txt]),
      ...s.workers.map((w, i) => [w.quote, old.workers[i]!.quote] as [Txt, Txt]),
      [s.flavor, old.flavor],
    ];
    expect(pairs.length).toBeGreaterThan(20);
    const missed = pairs.filter(([now]) => !isMsg(now)).map(([, was]) => was);
    expect(missed).toEqual([]);
    for (const [now, was] of pairs) expect(tx(now)).toBe(was);
  });

  it('los clientes pasan a su id y los caídos del tío, a mensaje', () => {
    for (const q of s.quests) expect(q.client).toMatch(/^[a-z_]+$/);
    const uncle = s.fallen.filter((f) => isMsg(f.name));
    expect(uncle.length).toBe(2);
    expect(uncle.map((f) => tx(f.name))).toEqual(['Aldric «Medio Pan»', 'Fausto, tu tío']);
  });

  it('el texto libre (informes, historial) se queda como frase y se sigue leyendo', () => {
    expect(s.reports.length).toBeGreaterThan(0);
    expect(s.reports.every((r) => r.body.every((p) => typeof p === 'string'))).toBe(true);
    expect(tx(s.reports[0]!.title)).toBe(old.reports[0]!.title);
  });

  it('una partida de la 6 no se toca al cargarla', () => {
    const again = parseSave(JSON.stringify(s))!;
    expect(again).toEqual(s);
  });
});
