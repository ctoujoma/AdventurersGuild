export type TabId = 'taberna' | 'tablon' | 'heroes' | 'gremio';

const TABS: { id: TabId; label: string; icon: string[] }[] = [
  // Iconos de 9×9 en pixel art: '#' relleno, '+' brillo.
  {
    id: 'taberna',
    label: 'Taberna',
    icon: [
      '.#.#.....',
      '#######..',
      '#+####.#.',
      '#+####..#',
      '#+####..#',
      '#+####.#.',
      '######...',
      '######...',
      '.####....',
    ],
  },
  {
    id: 'tablon',
    label: 'Tablón',
    icon: [
      '#########',
      '#+++++++#',
      '#+#+++#+#',
      '#+++++++#',
      '#++#+#++#',
      '#+++++++#',
      '#########',
      '.#.....#.',
      '#.......#',
    ],
  },
  {
    id: 'heroes',
    label: 'Héroes',
    icon: [
      '...###...',
      '..#####..',
      '.##+#+##.',
      '.#######.',
      '..#####..',
      '.#######.',
      '##+###+##',
      '#.#####.#',
      '..##.##..',
    ],
  },
  {
    id: 'gremio',
    label: 'Gremio',
    icon: [
      '#.#.#.#.#',
      '#########',
      '.#######.',
      '.##+#+##.',
      '.#######.',
      '.#######.',
      '.###.###.',
      '.##...##.',
      '.##...##.',
    ],
  },
];

function PixelIcon({ rows }: { rows: string[] }) {
  return (
    <svg viewBox="0 0 9 9" class="pixel-icon" aria-hidden="true" shape-rendering="crispEdges">
      {rows.flatMap((row, y) =>
        [...row].map((ch, x) =>
          ch === '.' ? null : (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width="1"
              height="1"
              class={ch === '+' ? 'hi' : ''}
            />
          ),
        ),
      )}
    </svg>
  );
}

export function TabBar({ tab, onTab }: { tab: TabId; onTab: (t: TabId) => void }) {
  return (
    <nav class="tabs" aria-label="Secciones">
      {TABS.map((t) => (
        <button
          key={t.id}
          class="tab"
          aria-current={tab === t.id ? 'page' : undefined}
          onClick={() => onTab(t.id)}
        >
          <PixelIcon rows={t.icon} />
          {t.label}
        </button>
      ))}
    </nav>
  );
}
