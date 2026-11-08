import { describe, expect, it } from 'vitest';
import { itemEffect, itemName } from '../data/items';
import { chipMat } from './mats';

describe('materiales en la interfaz', () => {
  it('reconoce el chip del informe («+2 cuero») y nada más', () => {
    expect(chipMat('+2 cuero')).toEqual({ m: 'cuero', n: 2 });
    expect(chipMat('+1 madera buena')).toEqual({ m: 'madera', n: 1 });
    expect(chipMat('+40 monedas')).toBeNull();
    expect(chipMat('+3 reputación')).toBeNull();
  });

  it('el objeto mejorado enseña su +N en el nombre y en lo suyo', () => {
    const it = { id: 'i', name: 'Espada larga', kind: 'arma' as const, value: 10, desc: '' };
    expect(itemName(it)).toBe('Espada larga');
    expect(itemName({ ...it, plus: 2 })).toBe('Espada larga +2');
    const b = { ...it, bonus: { Combate: 2, Supervivencia: 1 }, plus: 1 };
    expect(itemEffect(b)).toBe('+3 Combate · +1 Supervivencia');
  });
});
