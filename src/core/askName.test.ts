import { describe, expect, it } from 'vitest';
import { DEFAULT_NAME } from '../data/custom';
import { parseSave } from '../platform/storage';
import { customOf, newGame, reduce } from './game';

describe('pedir nombre a la taberna', () => {
  it('no se pide al empezar; sí al pagar la deuda', () => {
    const s = newGame('n');
    expect(s.askName).toBe(false);
    const opening = { seen: false } as NonNullable<typeof s.opening>;
    const paid = reduce({ ...s, opening }, { type: 'ackOpening' });
    expect(paid.askName).toBe(true);
  });

  it('las partidas de antes del aviso lo piden una vez', () => {
    const old: Partial<ReturnType<typeof newGame>> = newGame('vieja');
    delete old.askName;
    expect(parseSave(JSON.stringify(old))?.askName).toBe(true);
  });

  it('poner nombre o dejar el de siempre lo cierra', () => {
    const s = { ...newGame('x'), askName: true };
    const named = reduce(s, { type: 'custom', patch: { name: 'La Oca' } });
    expect(named.askName).toBe(false);
    expect(customOf(named).name).toBe('La Oca');
    expect(reduce(s, { type: 'custom', patch: { name: '  ' } }).askName).toBe(true);
    expect(customOf(reduce(s, { type: 'nameAsked' })).name).toBe(DEFAULT_NAME);
    expect(reduce(s, { type: 'nameAsked' }).askName).toBe(false);
  });
});
