// Vuelca a PNG todo el arte de los héroes (clases, variaciones, equipo y animaciones) y un
// índice con cómo van en hojas: `node tools/textos/esbuild.mjs tools/hoja-heroes.ts hoja <carpeta>`
// y luego `python3 tools/hoja-heroes.py <carpeta>` monta las hojas con sus rótulos.
import { mkdirSync, writeFileSync } from 'node:fs';
import { png } from './visor-png';
import type { ItemIcon, Rarity } from '../src/core/model';
import { GARMENTS, TINT_IDS, type GarmentId } from '../src/data/custom';
import { GEAR, RARITY_NAMES } from '../src/data/items';
import { idText } from '../src/textos';
import { itemIcon } from '../src/art/items';
import { HAIR, SKIN, EYES } from '../src/art/palette';
import { PixelBuffer, alpha } from '../src/art/pixel';
import { renderPortrait } from '../src/art/portraits/portrait';
import type { GearMark } from '../src/art/heroes/gear';
import {
  FEET_Y,
  HAND,
  fightSprites,
  generateLook,
  heroSprites,
  type FightPose,
  type HeroLook,
  type HeroMarks,
  type OutfitId,
  type Sex,
} from '../src/art/heroes/hero';
import { UNCLE } from '../src/art/heroes/uncle';
import { WEAPONS, type WeaponId } from '../src/world/weapons';

const [dir] = process.argv.slice(2);
if (!dir) throw new Error('falta la carpeta de salida');

interface Cell {
  file: string;
  label?: string;
}
interface Row {
  label?: string;
  cells: Cell[];
}
interface Section {
  title: string;
  note?: string;
  rows: Row[];
}
interface Sheet {
  name: string;
  title: string;
  /** Aumento de los píxeles en la hoja. */
  scale: number;
  sections: Section[];
}
const sheets: Sheet[] = [];

let n = 0;
/** Guarda un dibujo (a tamaño real, con transparencia) y devuelve su celda. */
function save(group: string, name: string, b: PixelBuffer, label?: string): Cell {
  const sub = `sueltos/${group}`;
  mkdirSync(`${dir}/${sub}`, { recursive: true });
  const file = `${sub}/${String(n++).padStart(4, '0')}_${name.replace(/[^a-z0-9_-]+/gi, '-')}.png`;
  writeFileSync(`${dir}/${file}`, png(b, 1, true));
  return { file, label };
}

const HEROES: OutfitId[] = ['guerrero', 'picaro', 'mago', 'clerigo', 'explorador'];
const OTHERS: [OutfitId, string][] = [
  ['tabernero', 'tabernero (personal del salón)'],
  ['herrero', 'herrero (forja)'],
  ['sastre', 'sastre (sastrería)'],
  ['alquimista', 'alquimista'],
  ['pintor', 'pintor'],
  ['campesino', 'campesino (visitante)'],
  ['mercader', 'mercader (visitante)'],
  ['noble', 'noble (visitante)'],
  ['forastero', 'forastero / mensajero'],
  ['velado', 'velado (forastero de la tormenta)'],
];
const SEXES: [Sex, string][] = [
  ['m', 'hombre'],
  ['f', 'mujer'],
];
const look = (outfit: OutfitId, sex: Sex, k: number) =>
  generateLook(`hoja-${outfit}-${sex}-${k}`, outfit, sex);

// ---------- 1. Héroes ----------
{
  const PER = 6;
  const sprites: Section = {
    title: 'Las 5 clases de héroe (sprite de frente, 18×28)',
    note: 'El aspecto sale de una semilla: piel, pelo, barba, tocado, cara, cejas, boca, pecas y cicatriz.',
    rows: [],
  };
  const portraits: Section = { title: 'Los mismos, en retrato (ficha)', rows: [] };
  for (const cls of HEROES)
    for (const [sex, sn] of SEXES) {
      const ls = Array.from({ length: PER }, (_, k) => look(cls, sex, k));
      sprites.rows.push({
        label: `${cls} · ${sn}`,
        cells: ls.map((l, k) => save('heroes', `${cls}-${sex}-${k}`, heroSprites(l).idle[0])),
      });
      portraits.rows.push({
        label: `${cls} · ${sn}`,
        cells: ls.map((l, k) => save('retratos', `${cls}-${sex}-${k}`, renderPortrait(l))),
      });
    }
  sheets.push({ name: '1-heroes', title: 'Héroes: las clases', scale: 5, sections: [sprites] });
  sheets.push({
    name: '2-retratos',
    title: 'Héroes: retratos',
    scale: 3,
    sections: [portraits],
  });
}

// ---------- 2. Variaciones del aspecto ----------
{
  const base = (sex: Sex, outfit: OutfitId = 'explorador'): HeroLook => ({
    ...look(outfit, sex, 0),
    headgear: null,
    beard: false,
    freckles: false,
    scar: false,
  });
  const both = (g: string, mk: (sex: Sex) => [HeroLook, HeroMarks?][], labels: string[]) =>
    SEXES.map(([sex, sn]) => ({
      label: sn,
      cells: mk(sex).flatMap(([l, m], i) => [
        save(g, `${sex}-${i}-f`, heroSprites(l, m).idle[0], labels[i]),
      ]),
    }));
  const withPortrait = (g: string, items: [string, HeroLook, HeroMarks?][]): Row[] => [
    {
      label: 'sprite',
      cells: items.map(([lb, l, m]) => save(g, lb, heroSprites(l, m).idle[0], lb)),
    },
    {
      label: 'perfil',
      cells: items.map(([lb, l, m]) => save(g, lb, heroSprites(l, m).walk[0], lb)),
    },
    { label: 'retrato', cells: items.map(([lb, l, m]) => save(g, lb, renderPortrait(l, m), lb)) },
  ];
  const STYLES = ['corto', 'largo', 'coleta', 'punta', 'mono', 'calvo'] as const;
  const HAIRS = ['negro', 'castaño', 'pelirrojo', 'rubio', 'canoso', 'blanco'];
  const sections: Section[] = [
    {
      title: 'Peinados',
      rows: both('pelo', (s) => STYLES.map((h) => [{ ...base(s), hairStyle: h }]), [...STYLES]),
    },
    {
      title: 'Color de pelo',
      rows: both(
        'color-pelo',
        (s) => HAIR.map((_, i) => [{ ...base(s), hairColor: i }]),
        HAIRS.slice(0, HAIR.length),
      ),
    },
    {
      title: 'Piel y ojos (en retrato)',
      rows: [
        {
          label: 'piel',
          cells: SKIN.map((_, i) =>
            save('piel', `piel-${i}`, renderPortrait({ ...base('f'), skin: i }), `piel ${i}`),
          ),
        },
        {
          label: 'ojos',
          cells: EYES.map((_, i) =>
            save('ojos', `ojos-${i}`, renderPortrait({ ...base('m'), eyes: i }), `ojos ${i}`),
          ),
        },
      ],
    },
    {
      title: 'Cara, cejas y boca (en retrato)',
      rows: [
        {
          label: 'cara',
          cells: (['redonda', 'cuadrada', 'alargada'] as const).map((f) =>
            save('cara', f, renderPortrait({ ...base('m'), face: f }), f),
          ),
        },
        {
          label: 'cejas',
          cells: (['recta', 'arqueada', 'fruncida'] as const).map((f) =>
            save('cejas', f, renderPortrait({ ...base('m'), brow: f }), f),
          ),
        },
        {
          label: 'boca',
          cells: (['neutra', 'sonrisa', 'mueca', 'seria'] as const).map((f) =>
            save('boca', f, renderPortrait({ ...base('m'), mouth: f }), f),
          ),
        },
      ],
    },
    {
      title: 'Tocados (cada clase tiene el suyo; el resto, de la gente de fuera)',
      rows: withPortrait('tocados', [
        ['casco (guerrero)', { ...base('m', 'guerrero'), headgear: 'casco' }],
        ['capucha (pícaro)', { ...base('m', 'picaro'), headgear: 'capucha' }],
        ['sombrero (mago)', { ...base('m', 'mago'), headgear: 'sombrero' }],
        ['gorra (explorador)', { ...base('m', 'explorador'), headgear: 'gorra' }],
        ['paja (campesino)', { ...base('m', 'campesino'), headgear: 'paja' }],
        ['boina (mercader)', { ...base('m', 'mercader'), headgear: 'boina' }],
        ['pluma (noble)', { ...base('m', 'noble'), headgear: 'pluma' }],
        ['velo (velado)', { ...base('m', 'velado'), headgear: 'velo' }],
      ]),
    },
    {
      title: 'Marcas: barba, pecas, cicatriz, parche (rasgo «tuerto»), herido',
      rows: withPortrait('marcas', [
        ['nada', base('m', 'guerrero')],
        ['barba', { ...base('m', 'guerrero'), beard: true }],
        ['pecas', { ...base('m', 'guerrero'), freckles: true }],
        ['cicatriz', { ...base('m', 'guerrero'), scar: true }],
        ['parche', base('m', 'guerrero'), { eyepatch: true }],
        ['herido', base('m', 'guerrero'), { injured: true }],
      ]),
    },
  ];
  sheets.push({
    name: '3-variaciones',
    title: 'Héroes: variaciones del aspecto',
    scale: 4,
    sections,
  });

  // Tintes y prendas de la sastrería.
  const dyes: Section = {
    title: 'Tintes de la sastrería (sobre cada clase)',
    rows: HEROES.map((cls) => ({
      label: cls,
      cells: [undefined, ...TINT_IDS].map((d) =>
        save(
          'tintes',
          `${cls}-${d ?? 'sin'}`,
          heroSprites({ ...look(cls, 'm', 1), dye: d }).idle[0],
          d ?? 'sin tinte',
        ),
      ),
    })),
  };
  const gs = Object.keys(GARMENTS) as GarmentId[];
  const garments: Section = {
    title: 'Prendas de la sastrería (con su tinte de serie)',
    rows: HEROES.map((cls) => ({
      label: cls,
      cells: gs.flatMap((g) => {
        const l = { ...look(cls, 'f', 2), garment: g, dye: GARMENTS[g].tint };
        return [
          save('prendas', `${cls}-${g}`, heroSprites(l).idle[0], g),
          save('prendas', `${cls}-${g}-perfil`, heroSprites(l).walk[0], `${g} perfil`),
          save('prendas', `${cls}-${g}-retrato`, renderPortrait(l), `${g} retrato`),
        ];
      }),
    })),
  };
  sheets.push({
    name: '4-sastreria',
    title: 'Héroes: tintes y prendas',
    scale: 4,
    sections: [dyes, garments],
  });

  // La gente que no es héroe (comparten el mismo esqueleto).
  sheets.push({
    name: '5-otros-personajes',
    title: 'Otros personajes (mismo cuerpo que los héroes)',
    scale: 4,
    sections: [
      {
        title: 'Trabajadores y visitantes',
        rows: OTHERS.map(([o, name]) => ({
          label: name,
          cells: SEXES.flatMap(([sex]) => [0, 1].map((k) => look(o, sex, k))).flatMap((l, i) => [
            save('otros', `${o}-${i}`, heroSprites(l).idle[0]),
            save('otros', `${o}-${i}-r`, renderPortrait(l)),
          ]),
        })),
      },
      {
        title: 'El tío Anselmo (retrato de la pared)',
        rows: [
          {
            cells: [
              save('otros', 'tio', heroSprites(UNCLE).idle[0]),
              save('otros', 'tio-r', renderPortrait(UNCLE)),
            ],
          },
        ],
      },
    ],
  });
}

// ---------- 3. Equipo ----------
const CLASS_FOR: Record<ItemIcon, OutfitId> = {
  espada: 'guerrero',
  hacha: 'guerrero',
  escudo: 'guerrero',
  coraza: 'guerrero',
  amuleto: 'clerigo',
  ganzua: 'picaro',
  botas: 'explorador',
  capa: 'explorador',
  varita: 'mago',
};
const markOf = (icon: ItemIcon, rarity: Rarity, unique?: string): GearMark => ({
  icon,
  rarity,
  unique: rarity === 4 ? unique : undefined,
});
{
  const ICONS: ItemIcon[] = [
    'espada',
    'hacha',
    'escudo',
    'varita',
    'coraza',
    'capa',
    'botas',
    'amuleto',
    'ganzua',
  ];
  const rn = RARITY_NAMES as unknown as string[];
  const catalog: Section = {
    title: 'Todos los objetos del juego (icono 32×32), por tipo y rareza',
    note: 'Rarezas: 0 común, 1 bueno, 2 raro, 3 épico, 4 legendario (los legendarios tienen dibujo propio).',
    rows: ICONS.map((icon) => ({
      label: icon,
      cells: GEAR.filter((g) => g.icon === icon).map((g) =>
        save(
          'iconos',
          `${icon}-${g.rarity}`,
          itemIcon(icon, g.rarity ?? 0, 0, g.rarity === 4 ? idText(g.name) : undefined, 32),
          `${idText(g.name)} (${rn[g.rarity ?? 0] ?? g.rarity})`,
        ),
      ),
    })),
  };
  const tiers: Section = {
    title: 'Cada tipo en cada rareza (genérico, 16×16); con mejoras del taller (+1, +2, +3)',
    rows: ICONS.map((icon) => ({
      label: icon,
      cells: [
        ...([0, 1, 2, 3, 4] as Rarity[]).map((r) =>
          save('iconos-nivel', `${icon}-${r}`, itemIcon(icon, r, 0, undefined, 32), rn[r]),
        ),
        ...[1, 2, 3].map((p) =>
          save('iconos-nivel', `${icon}-plus${p}`, itemIcon(icon, 1, p, undefined, 32), `+${p}`),
        ),
      ],
    })),
  };
  sheets.push({
    name: '6-equipo-iconos',
    title: 'Equipo: iconos',
    scale: 3,
    sections: [catalog, tiers],
  });

  // Puesto en el héroe: cada objeto del catálogo en el sprite de frente, de perfil y el retrato.
  const worn: Section[] = ICONS.map((icon) => {
    const items = GEAR.filter((g) => g.icon === icon);
    const l = { ...look(CLASS_FOR[icon], 'm', 3), headgear: null };
    const cell = (f: (m: HeroMarks) => PixelBuffer, k: string) =>
      items.map((g) => {
        const m = { gear: [markOf(icon, g.rarity ?? 0, idText(g.name))] };
        return save('puesto', `${icon}-${g.rarity}-${k}`, f(m), idText(g.name));
      });
    return {
      title: `${icon} puesto (sobre un ${CLASS_FOR[icon]})`,
      rows: [
        { label: 'sin nada', cells: [save('puesto', `${icon}-nada`, heroSprites(l).idle[0])] },
        { label: 'frente', cells: cell((m) => heroSprites(l, m).idle[0], 'f') },
        { label: 'perfil', cells: cell((m) => heroSprites(l, m).walk[0], 'p') },
        { label: 'espalda', cells: cell((m) => heroSprites(l, m).back[0], 'e') },
        { label: 'retrato', cells: cell((m) => renderPortrait(l, m), 'r') },
      ],
    };
  });
  sheets.push({
    name: '7-equipo-puesto-a',
    title: 'Equipo puesto (1/2)',
    scale: 4,
    sections: worn.slice(0, 5),
  });
  sheets.push({
    name: '8-equipo-puesto-b',
    title: 'Equipo puesto (2/2)',
    scale: 4,
    sections: worn.slice(5),
  });

  // Equipos completos (arma + cuerpo + complemento) por clase y rareza.
  const KITS: Record<string, [ItemIcon, ItemIcon, ItemIcon]> = {
    guerrero: ['espada', 'coraza', 'amuleto'],
    picaro: ['espada', 'capa', 'ganzua'],
    mago: ['varita', 'capa', 'amuleto'],
    clerigo: ['hacha', 'coraza', 'amuleto'],
    explorador: ['escudo', 'capa', 'botas'],
  };
  const full: Section[] = HEROES.map((cls) => {
    const l = look(cls, 'f', 4);
    const kit = KITS[cls]!;
    return {
      title: `${cls}: ${kit.join(' + ')}`,
      rows: ([0, 1, 2, 3, 4] as Rarity[]).map((r) => {
        const m: HeroMarks = {
          gear: kit.map((ic) =>
            markOf(ic, r, idText(GEAR.find((g) => g.icon === ic && g.rarity === 4)?.name)),
          ),
        };
        return {
          label: rn[r],
          cells: [
            save('kit', `${cls}-${r}`, heroSprites(l, m).idle[0], 'frente'),
            save('kit', `${cls}-${r}-p`, heroSprites(l, m).walk[2], 'perfil'),
            save('kit', `${cls}-${r}-e`, heroSprites(l, m).back[0], 'espalda'),
            save('kit', `${cls}-${r}-r`, renderPortrait(l, m), 'retrato'),
          ],
        };
      }),
    };
  });
  sheets.push({
    name: '9-equipo-completo',
    title: 'Equipo completo por clase (arma + cuerpo + complemento)',
    scale: 4,
    sections: full,
  });

  // Las armas de la pelea (se pintan aparte, en la mano).
  const ids = Object.keys(WEAPONS) as WeaponId[];
  sheets.push({
    name: '10-armas-pelea',
    title: 'Armas de la pelea y herramientas (se pintan en la mano)',
    scale: 6,
    sections: [
      {
        title:
          'Héroes: espada (guerrero), daga (pícaro), bastón (mago), maza (clérigo), arco (explorador), escudo',
        note: 'El punto de agarre es (px, py) de cada dibujo; se giran según la pose.',
        rows: [
          {
            cells: ids.map((id) => save('armas', id, WEAPONS[id].img, id)),
          },
        ],
      },
    ],
  });
}

// ---------- 4. Animaciones ----------
const MAIN: Record<string, WeaponId> = {
  guerrero: 'espada',
  picaro: 'daga',
  mago: 'baston',
  clerigo: 'maza',
  explorador: 'arco',
};
const OFF: Record<string, WeaponId | undefined> = { guerrero: 'escudo', picaro: 'daga' };
const SWING: Record<FightPose, number> = { ready: 25, windup: -50, strike: 80, up: 0, thrust: 90 };

/** Pinta un arma girada con su agarre en (hx, hy) (como `stampWeapon` de la escena). */
function stamp(b: PixelBuffer, id: WeaponId, hx: number, hy: number, deg: number, back = false) {
  const w = WEAPONS[id];
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  const R = Math.ceil(Math.hypot(w.img.w, w.img.h));
  for (let y = -R; y <= R; y++)
    for (let x = -R; x <= R; x++) {
      const sx = Math.round(c * x + s * y) + w.px;
      const sy = Math.round(-s * x + c * y) + w.py;
      if (sx < 0 || sy < 0 || sx >= w.img.w || sy >= w.img.h) continue;
      const col = w.img.get(sx, sy);
      const dx = hx + x;
      const dy = hy + y;
      if (!alpha(col) || (back && alpha(b.get(dx, dy)))) continue;
      b.set(dx, dy, col);
    }
}
const PAD = 8;
function fightFrame(cls: string, poses: Record<FightPose, PixelBuffer>, p: FightPose) {
  const img = poses[p];
  const b = new PixelBuffer(img.w + PAD * 2, img.h + PAD * 2);
  b.blit(img, PAD, PAD);
  const off = OFF[cls];
  if (off === 'escudo') stamp(b, 'escudo', PAD + 9 - 4, PAD + FEET_Y - 15, 0, true);
  if (off === 'daga') stamp(b, 'daga', PAD + 9 + 3, PAD + FEET_Y - 9, 120, true);
  const main = MAIN[cls]!;
  stamp(b, main, PAD + HAND[p].x, PAD + HAND[p].y, main === 'arco' ? 0 : SWING[p]);
  return b;
}
{
  const FIGHT: FightPose[] = ['ready', 'windup', 'strike', 'up', 'thrust'];
  for (const [i, cls] of HEROES.entries()) {
    const l = look(cls, i % 2 ? 'f' : 'm', 5);
    const s = heroSprites(l);
    const f = fightSprites(l);
    const fp = fightSprites(l, {}, true);
    const g = `anim-${cls}`;
    const row = (label: string, list: [string, PixelBuffer][]): Row => ({
      label,
      cells: list.map(([k, b]) => save(g, k, b, k)),
    });
    sheets.push({
      name: `${11 + i}-animaciones-${cls}`,
      title: `Animaciones: ${cls}`,
      scale: 5,
      sections: [
        {
          title: 'Todos los fotogramas del sprite (los usa la escena de la taberna)',
          note: 'Andar: ciclo de 8 tiempos, 2 px por tiempo. Respirar: 2 tiempos. Perfil mirando a la derecha (se voltea).',
          rows: [
            row('de frente', [
              ['quieto 1', s.idle[0]],
              ['quieto 2 (respira)', s.idle[1]],
              ['parpadeo', s.blink],
              ['celebra', s.cheer],
              ['se estira', s.stretch],
              ['bosteza', s.yawn],
            ]),
            row(
              'andar',
              s.walk.map((b, k) => [`paso ${k}`, b] as [string, PixelBuffer]),
            ),
            row('escalera', [
              ['espalda', s.back[0]],
              ['espalda pie izq', s.back[1]],
              ['espalda pie der', s.back[2]],
              ['frente pie izq', s.stepFront[0]],
              ['frente pie der', s.stepFront[1]],
              ['3/4 espalda', s.back3[0]],
              ['3/4 espalda paso', s.back3[1]],
              ['3/4 frente', s.front3[0]],
              ['3/4 frente paso', s.front3[1]],
            ]),
            row('mesa y cama', [
              ['sentado', s.sit],
              ['incorporado', s.upright],
              ['bebe 1', s.drink[0]],
              ['bebe 2', s.drink[1]],
              ['bebe 3', s.drink[2]],
              ['herido (almohada)', s.bed],
              ['dormido (almohada)', s.sleep],
            ]),
          ],
        },
        {
          title: 'Pelea (perfil; el arma se pinta aparte en la mano)',
          note: 'Orden de un golpe: en guardia → carga → golpe; «arriba» al encajar; estocada para la daga.',
          rows: [
            row(
              'con arma',
              FIGHT.map((p) => [p, fightFrame(cls, f, p)] as [string, PixelBuffer]),
            ),
            row(
              'sin arma',
              FIGHT.map((p) => [p, f[p]] as [string, PixelBuffer]),
            ),
            row(
              'pies quietos (trabajar)',
              FIGHT.map((p) => [p, fp[p]] as [string, PixelBuffer]),
            ),
          ],
        },
      ],
    });
  }
}

writeFileSync(`${dir}/indice.json`, JSON.stringify(sheets, null, 1));
console.log(`${n} dibujos, ${sheets.length} hojas en ${dir}`);
