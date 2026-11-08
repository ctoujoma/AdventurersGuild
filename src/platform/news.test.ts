import { describe, expect, it } from 'vitest';
import { parseNews, unseenNews } from './news';

const rec = (d: string, s: string, b: string) => `${d}\x1f${s}\x1f${b}\x1e\n`;

describe('novedades', () => {
  it('saca número y título de las fusiones de PR', () => {
    const log =
      rec('2026-11-08', 'Merge pull request #174 from x/y', 'Arte de los materiales\n\nmás') +
      rec('2026-11-08', 'Fusiona main', 'nada') +
      rec('2026-11-07', 'Merge pull request #173 from x/z', '');
    expect(parseNews(log)).toEqual([
      { pr: 174, date: '2026-11-08', title: 'Arte de los materiales' },
      { pr: 173, date: '2026-11-07', title: 'PR 173' },
    ]);
  });

  it('enseña solo lo no visto', () => {
    const news = [174, 173, 172].map((pr) => ({ pr, date: '', title: '' }));
    expect(unseenNews(news, 172).map((n) => n.pr)).toEqual([174, 173]);
    expect(unseenNews(news, 174)).toEqual([]);
    expect(unseenNews(news, null).map((n) => n.pr)).toEqual([174]);
  });
});
