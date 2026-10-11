import { describe, expect, it } from 'vitest';
import { fill } from './generate';

describe('plantillas de texto', () => {
  it('rellena huecos, capitaliza y contrae «a el» y «de el»', () => {
    expect(fill('{Threat} bajó a {place}', { threat: 'un oso', place: 'el molino' })).toBe(
      'Un oso bajó al molino',
    );
    expect(fill('Lejos de {place}', { place: 'el vado' })).toBe('Lejos del vado');
    expect(fill('Rafael y {x}', {})).toBe('Rafael y {x}');
  });
});
