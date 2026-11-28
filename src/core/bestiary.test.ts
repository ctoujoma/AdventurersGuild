import { describe, expect, it } from 'vitest';
import { bandKey, defeated } from './bestiary';
import { newGame } from './game';
import { msg } from '../textos';

describe('el bestiario', () => {
  it('apunta cada vencido: cuántas veces y el primer día', () => {
    const s = newGame('bestiario');
    s.day = 4;
    defeated(s, 'exp:bosque:0');
    s.day = 9;
    defeated(s, 'exp:bosque:0');
    expect(s.bestiary!['exp:bosque:0']).toEqual({ n: 2, day: 4 });
  });

  it('la banda de un asalto, por su texto; las de partidas viejas (frase escrita), no', () => {
    expect(bandKey(msg('asaltos.bandas.3.nombre'))).toBe('banda:3');
    expect(bandKey('los Hermanos Cuervo')).toBeNull();
  });
});
