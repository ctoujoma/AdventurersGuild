import { describe, expect, it } from 'vitest';
import { HAND, fightSprites, generateLook } from '../art/heroes/hero';
import { bossArt } from '../art/bosses';
import { BOSSES, type BossKind } from '../data/bosses';
import { Battle, MOVES } from './battle';
import { WEAPONS } from './weapons';

describe('combate con estilo', () => {
  it('cada clase y cada tipo de bandido tiene al menos tres ataques distintos', () => {
    for (const [style, moves] of Object.entries(MOVES)) {
      expect(moves.length, style).toBeGreaterThanOrEqual(3);
      for (const m of moves) {
        expect(m.hits.length).toBeGreaterThan(0);
        expect(m.hits.every((h) => h > 0 && h <= 1)).toBe(true);
        // Todas las fases del ataque dan una pose válida.
        for (const p of [0, 0.25, 0.5, 0.75, 1])
          expect(HAND[m.frame(p, {} as never).pose]).toBeDefined();
      }
    }
  });

  it('hay poses de combate para todas las clases y las armas tienen su agarre dentro', () => {
    for (const cls of ['guerrero', 'picaro', 'mago', 'clerigo', 'explorador'] as const) {
      const poses = fightSprites(generateLook(cls, cls, 'f'));
      expect(Object.keys(poses)).toEqual(['ready', 'windup', 'strike', 'up', 'thrust']);
    }
    for (const w of Object.values(WEAPONS)) {
      expect(w.px).toBeLessThan(w.img.w);
      expect(w.py).toBeLessThan(w.img.h);
    }
  });

  it('la pelea contra un jefe acaba como dice el núcleo', () => {
    const hooks = { feetAt: () => 108, burst: () => {}, coin: () => {}, sound: () => {} };
    const defenders = (['guerrero', 'mago', 'explorador'] as const).map((c, i) => ({
      id: `h${i}`,
      look: generateLook(c, c, 'm'),
      marks: {},
      hurt: i === 1,
    }));
    for (const boss of Object.keys(BOSSES) as BossKind[])
      for (const won of [true, false]) {
        const b = new Battle(
          {
            won,
            bandits: 0,
            defenders,
            arena: { boss, minions: BOSSES[boss].minions, width: 224 },
          },
          hooks,
        );
        expect(b.bossHp).toBe(1);
        let hp = 1;
        while (!b.done) {
          b.update(1 / 30);
          if (b.t < b.outcomeAt) hp = b.bossHp!;
        }
        expect(hp, `${boss} antes del final`).toBeLessThan(1);
        if (won) expect(b.bossHp).toBe(0);
        else expect(b.bossHp!).toBeGreaterThanOrEqual(0.45);
        expect(b.t).toBeGreaterThanOrEqual(b.duration);
      }
  });

  it('los jefes nuevos pelean como su base, con sus efectos', () => {
    // Una pelea de mentira que apunta qué efectos y partículas pide cada golpe.
    const effects = (boss: BossKind) => {
      const calls: string[] = [];
      const b = new Proxy(
        {},
        {
          get:
            (_, name: string) =>
            (...args: unknown[]) => {
              if (name === 'fx' || name === 'burstAt') calls.push(`${name}:${String(args[0])}`);
              return name === 'feet' ? 108 : name === 'allies' ? [{}, {}] : undefined;
            },
        },
      ) as never;
      const f = { x: 150, face: -1, art: bossArt(boss), foe: { x: 110 } } as never;
      for (const m of MOVES[boss]) m.hits.forEach((_, i) => m.hit(b, f, i));
      return calls;
    };
    expect(MOVES.dragona.length).toBe(MOVES.sierpe.length);
    expect(effects('sierpe')).toContain('fx:flames');
    expect(effects('dragona')).toContain('fx:frost');
    expect(effects('dragona')).not.toContain('fx:flames');
    expect(effects('ahogado')).toContain('burstAt:splash');
    expect(effects('reina')).toContain('burstAt:puff');
    expect(effects('reina')).not.toContain('burstAt:splash');
    expect(effects('jabali')).toContain('burstAt:ember');
    expect(effects('bestia')).not.toContain('burstAt:ember');
  });
});
