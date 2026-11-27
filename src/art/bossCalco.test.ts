import { describe, expect, it } from 'vitest';
import { bossArtFor } from './bossCalco';
import { bossArt } from './bosses';

describe('jefes calcados', () => {
  it('la bestia sale del calco del huargo, con sus fotogramas; los demás, como siempre', () => {
    const a = bossArtFor('bestia');
    expect(a.seq?.ready?.length).toBeGreaterThan(0);
    expect(a.seq?.down?.length).toBeGreaterThan(1);
    expect(a.reach).toBeGreaterThan(4);
    expect(a.foot.y).toBeGreaterThan(0);
    expect(bossArtFor('reina')).toBe(bossArt('reina'));
  });
});
