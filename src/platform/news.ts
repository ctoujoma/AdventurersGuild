/** Una novedad: un PR fusionado en `main` (número, fecha y título). */
export interface NewsItem {
  pr: number;
  date: string;
  title: string;
}

/** Lo pone Vite al compilar, sacado de los «Merge pull request» de git. */
declare const __NEWS__: NewsItem[] | undefined;

export const NEWS: NewsItem[] = typeof __NEWS__ !== 'undefined' ? __NEWS__ : [];

const KEY = 'jarro:novedades';

/**
 * Convierte la salida de `git log --merges --format=%cs%x1f%s%x1f%b%x1e` en novedades:
 * de cada fusión de PR, el número y la primera línea del cuerpo (el título del PR).
 */
export function parseNews(log: string, max = 8): NewsItem[] {
  const out: NewsItem[] = [];
  for (const rec of log.split('\x1e')) {
    const [date, subject, body] = rec.trim().split('\x1f');
    const m = /^Merge pull request #(\d+)/.exec(subject ?? '');
    if (!m) continue;
    const title = (body ?? '').split('\n')[0].trim() || `PR ${m[1]}`;
    out.push({ pr: Number(m[1]), date: date ?? '', title });
    if (out.length >= max) break;
  }
  return out;
}

/** Las novedades que este jugador aún no ha visto (más nuevas que la última que cerró). */
export function unseenNews(news: NewsItem[], seen: number | null): NewsItem[] {
  // La primera vez se enseña solo la última, para no soltarle la lista entera.
  if (seen === null) return news.slice(0, 1);
  return news.filter((n) => n.pr > seen);
}

export function loadSeenNews(): number | null {
  try {
    const v = Number(localStorage.getItem(KEY));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

export function saveSeenNews(pr: number) {
  try {
    localStorage.setItem(KEY, String(pr));
  } catch {
    // Sin almacenamiento: se vuelve a enseñar la próxima vez.
  }
}
