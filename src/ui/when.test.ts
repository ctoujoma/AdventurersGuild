import { describe, expect, it } from 'vitest';
import { countdown, dawnIn, nightIn, shortDawn, shortSpan, span } from './when';

describe('plazos', () => {
  it('lo que dura, en días', () => {
    expect(span(1)).toBe('1 día');
    expect(span(3)).toBe('3 días');
    expect(span(2, 'noche', 'noches')).toBe('2 noches');
    expect(shortSpan(4)).toBe('4d');
  });

  it('lo que llega al amanecer: hoy, mañana, pasado mañana o en n días', () => {
    expect(dawnIn(0)).toBe('hoy');
    expect(dawnIn(1)).toBe('mañana');
    expect(dawnIn(2)).toBe('pasado mañana');
    expect(dawnIn(5)).toBe('en 5 días');
    expect(shortDawn(0)).toBe('hoy');
    expect(shortDawn(1)).toBe('1d');
    expect(shortDawn(3)).toBe('3d');
  });

  it('el asalto, en noches (con 1 de margen se resuelve esta noche)', () => {
    expect(nightIn(0)).toBe('esta noche');
    expect(nightIn(1)).toBe('esta noche');
    expect(nightIn(2)).toBe('mañana por la noche');
    expect(nightIn(3)).toBe('pasado mañana por la noche');
    expect(nightIn(4)).toBe('en 4 noches');
  });

  it('la cuenta atrás de la barra', () => {
    expect(countdown(65)).toBe('1:05');
    expect(countdown(-3)).toBe('0:00');
  });
});
