import { describe, expect, it } from 'vitest';
import { PixelBuffer } from '../../art/pixel';
import { forget, memo, memoOf } from './memo';

describe('caché de dibujos', () => {
  it('con la misma clave da el mismo dibujo sin volver a hacerlo', () => {
    forget();
    let made = 0;
    const make = () => {
      made++;
      return new PixelBuffer(4, 4);
    };
    const a = memo('a', make);
    expect(memo('a', make)).toBe(a);
    expect(made).toBe(1);
    expect(memo('b', make)).not.toBe(a);
  });

  it('se olvida de lo menos usado al pasarse de tamaño', () => {
    forget();
    const big = () => new PixelBuffer(2000, 2000);
    const first = memo('1', big);
    memo('2', big);
    memo('1', big); // el 1, usado hace poco: se queda
    memo('3', big);
    expect(memo('1', big)).toBe(first);
    let again = false;
    memo('2', () => ((again = true), big()));
    expect(again).toBe(true);
  });

  it('lo hecho a partir de otro dibujo se guarda con él', () => {
    const src = new PixelBuffer(2, 2);
    let made = 0;
    const a = memoOf(src, 'x', () => ++made);
    expect(memoOf(src, 'x', () => ++made)).toBe(a);
    expect(memoOf(new PixelBuffer(2, 2), 'x', () => ++made)).toBe(2);
  });
});
