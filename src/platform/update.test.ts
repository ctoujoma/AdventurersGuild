import { describe, expect, it } from 'vitest';
import { onWaiting } from './update';

describe('versión nueva del service worker', () => {
  it('si la página ya es la nueva, se activa sin avisar', () => {
    expect(onWaiting('2026-11-25 · abc', '2026-11-25 · abc')).toBe('activar');
  });
  it('si es otra (o no contesta), se avisa para recargar', () => {
    expect(onWaiting('2026-11-25 · abc', '2026-11-26 · def')).toBe('avisar');
    expect(onWaiting('2026-11-25 · abc', null)).toBe('avisar');
  });
});
