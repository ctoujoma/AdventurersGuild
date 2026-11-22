/**
 * Guías de Ajustes › «Repetir tutoriales»: tarjetas con una captura fija del juego, el marco de
 * lo que hay que tocar y su texto (`src/textos/<idioma>/guias.yaml`). Las capturas y los marcos
 * los saca `tools/shots/guia.mjs` jugando el tutorial; si cambia la escena, se vuelven a sacar.
 * Para una guía nueva (expediciones), sus capturas, sus marcos y una entrada en `GUIDES`.
 */
import marcos from '../assets/guia/marcos.json';
import o1 from '../assets/guia/obras-1.jpg';
import o2 from '../assets/guia/obras-2.jpg';
import o3 from '../assets/guia/obras-3.jpg';
import o4 from '../assets/guia/obras-4.jpg';
import o5 from '../assets/guia/obras-5.jpg';
import o6 from '../assets/guia/obras-6.jpg';
import o7 from '../assets/guia/obras-7.jpg';
import o8 from '../assets/guia/obras-8.jpg';
import o9 from '../assets/guia/obras-9.jpg';
import o10 from '../assets/guia/obras-10.jpg';

export interface GuideCard {
  /** La captura (recorte de 420 × 360 del móvil). */
  img: string;
  /** Lo que hay que tocar, en % de la captura: x, y, ancho y alto. */
  box: readonly [number, number, number, number];
  /** Clave del paso en `guias.<guía>` (con `titulo` y `texto`). */
  key: string;
}

const BOXES = marcos as unknown as Record<string, [number, number, number, number]>;
const card = (img: string, shot: string, key: string): GuideCard => ({
  img,
  box: BOXES[shot] ?? [0, 0, 0, 0],
  key,
});

export const GUIDES = {
  obras: [
    card(o1, 'obras-1', 'abrir'),
    card(o2, 'obras-2', 'solar'),
    card(o3, 'obras-3', 'mover'),
    card(o4, 'obras-4', 'ampliar'),
    card(o5, 'obras-5', 'excavar'),
    card(o6, 'obras-6', 'construir'),
    card(o7, 'obras-7', 'pagar'),
    card(o8, 'obras-8', 'falta'),
    card(o9, 'obras-9', 'guardar'),
    card(o10, 'obras-10', 'seguir'),
  ],
} satisfies Record<string, readonly GuideCard[]>;

export type GuideId = keyof typeof GUIDES;
export const GUIDE_IDS = Object.keys(GUIDES) as GuideId[];
