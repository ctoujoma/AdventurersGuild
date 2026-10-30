import { afterEach, describe, expect, it } from 'vitest';
import { DAY_SECONDS } from '../core/balance';
import { countdown, left, minutes, setRealTime, shortLeft, span } from './when';

describe('plazos', () => {
  afterEach(() => setRealTime(false));

  it('normalmente, en días o noches', () => {
    expect(span(3)).toBe('3 días');
    expect(left(1, 100)).toBe('1 día');
    expect(left(2, 100, 'noche', 'noches')).toBe('2 noches');
    expect(shortLeft(4, 0)).toBe('4d');
  });

  it('con el tiempo que corre solo, en minutos de taberna abierta', () => {
    setRealTime(true);
    const min = DAY_SECONDS / 60;
    expect(span(3)).toBe(`${3 * min} min`);
    // Vuelve al amanecer: lo que queda de hoy más los días enteros que faltan.
    expect(left(1, DAY_SECONDS / 2)).toBe(minutes(DAY_SECONDS / 2));
    expect(left(2, 0)).toBe(`${2 * min} min`);
    expect(shortLeft(2, 0)).toBe(`${2 * min}m`);
  });

  it('formatea minutos, horas y la cuenta atrás de la barra', () => {
    expect(minutes(20)).toBe('un minuto');
    expect(minutes(600)).toBe('10 min');
    expect(minutes(3900)).toBe('1 h 5 min');
    expect(minutes(7200)).toBe('2 h');
    expect(countdown(65)).toBe('1:05');
    expect(countdown(-3)).toBe('0:00');
  });
});
