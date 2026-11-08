import { describe, expect, it } from 'vitest';
import { newGame } from '../core/game';
import { reportOf } from './telemetry';

describe('envío de la partida', () => {
  it('resume día, oro, minutos y lleva la partida entera', () => {
    const s = newGame('semilla');
    const r = reportOf(s, 12, 'id');
    expect(r).toMatchObject({ p_id: 'id', p_dia: s.day, p_oro: s.gold, p_minutos: 12 });
    expect(r.p_stats.heroes).toBe(s.heroes.length);
    expect(r.p_partida).toBe(s);
  });
});
