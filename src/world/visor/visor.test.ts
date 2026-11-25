import { describe, expect, it } from 'vitest';
import { buildCapas, stripLen } from './capas';
import { ESCRITORIO, MOVIL, encuadre } from './encuadre';
import { Visor } from './escena';
import type { MarchNow } from './marcha';
import { biomaOf } from './bioma';

const crew: MarchNow['crew'] = [
  { id: 'a', name: 'A', seed: 'a-1', cls: 'guerrero', sex: 'f', fate: 'ok' },
  { id: 'b', name: 'B', seed: 'b-2', cls: 'explorador', sex: 'm', fate: 'herido' },
];
const base: MarchNow = {
  seed: 'prueba',
  terrain: 'bosque',
  crew,
  mode: 'walk',
  night: false,
  home: false,
  foe: 'bestia',
  wild: 0.4,
  hour: 12,
  weather: 'claro',
  day: 1,
};

describe('visor de las expediciones', () => {
  it('pinta todo el cuadro, sin huecos, en cada momento y encuadre', () => {
    const cases: Partial<MarchNow>[] = [
      { mode: 'walk', wild: 0 },
      { mode: 'walk', wild: 1, hour: 18.5, home: true },
      { mode: 'fight', foe: 'bandido' },
      { mode: 'camp', hour: 23, wild: 0.9 },
      { mode: 'camp', hour: 6, weather: 'niebla' },
      { mode: 'walk', weather: 'lluvia' },
    ];
    for (const enc of [MOVIL, ESCRITORIO, encuadre(200, 120, 0.5, 0.66)])
      for (const c of cases) {
        const v = new Visor(enc);
        const m = { ...base, ...c };
        v.frame(m, 0);
        const b = v.frame(m, 1.3);
        expect(b.w).toBe(enc.w);
        expect(b.data.every((px) => px >>> 24 === 255)).toBe(true);
      }
  });

  it('cada rumbo tiene su paisaje y su tiempo, sin huecos', () => {
    const rumbos: [MarchNow['terrain'], MarchNow['weather'][]][] = [
      ['monte', ['nieve', 'viento']],
      ['pantano', ['niebla', 'lluvia']],
      ['ruina', ['polvo', 'tormenta']],
    ];
    const bosque = new Visor(MOVIL).frame(base, 2, { travel: 120 }).data.slice();
    for (const [terrain, ws] of rumbos)
      for (const weather of ['claro', ...ws] as MarchNow['weather'][])
        for (const wild of [0, 0.6, 1]) {
          const m = { ...base, terrain, weather, wild };
          const v = new Visor(MOVIL);
          v.frame(m, 0);
          const b = v.frame(m, 2, { travel: 120 });
          expect(b.data.every((px) => px >>> 24 === 255)).toBe(true);
          if (weather === 'claro' && wild === 0.6)
            expect(Buffer.from(b.data.buffer).equals(Buffer.from(bosque.buffer))).toBe(false);
        }
    // Las capas empalman también en los rumbos nuevos.
    for (const t of ['monte', 'pantano', 'ruina'] as const)
      for (const c of buildCapas(MOVIL, 0.5, 3, biomaOf(t).paisaje))
        expect(c.t.w).toBe(stripLen(MOVIL.w));
  });

  it('es determinista: lo mismo al mismo tiempo', () => {
    const a = new Visor(MOVIL).frame(base, 2, { travel: 120 }).data.slice();
    const b = new Visor(MOVIL).frame(base, 2, { travel: 120 }).data;
    expect(Buffer.from(a.buffer).equals(Buffer.from(b.buffer))).toBe(true);
  });

  it('las tiras empalman y lo salvaje cambia el paisaje poco a poco', () => {
    const L = stripLen(MOVIL.w);
    const capas = buildCapas(MOVIL, 0.5, 3);
    for (const c of capas) expect(c.t.w).toBe(L);
    // Un poco más de lejanía cambia poco; mucha, mucho.
    const diff = (w1: number, w2: number) => {
      const a = buildCapas(MOVIL, w1, 3).find((c) => c.id === 'cerca')!.t.d;
      const b = buildCapas(MOVIL, w2, 3).find((c) => c.id === 'cerca')!.t.d;
      let n = 0;
      for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++;
      return n / a.length;
    };
    expect(diff(0.5, 0.54)).toBeLessThan(diff(0, 1));
  });

  it('pinta deprisa (precalcula las capas)', () => {
    const v = new Visor(ESCRITORIO);
    v.frame(base, 0);
    const t0 = performance.now();
    for (let k = 1; k <= 24; k++) v.frame(base, k / 12);
    // Holgado: en un móvil va unas veces más lento que aquí.
    expect((performance.now() - t0) / 24).toBeLessThan(40);
  });
});
