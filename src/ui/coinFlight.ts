/**
 * Monedas que vuelan de la escena al oro de la barra de arriba (`[data-gold]`): salen en arco,
 * una detrás de otra, y cada una que llega hace saltar el contador y suena (`onLand`). Va por
 * fuera de Preact (elementos sueltos que se borran al llegar): no hay estado que guardar.
 */
const reduced = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** El contador da un saltito (vuelve a empezar la animación si ya estaba saltando). */
function bump(el: Element): void {
  el.classList.remove('is-bump');
  void (el as HTMLElement).offsetWidth;
  el.classList.add('is-bump');
}

export function flyCoins(from: { x: number; y: number }, n: number, onLand: () => void): void {
  const target = document.querySelector('[data-gold]');
  if (!target) return;
  if (reduced() || typeof Element.prototype.animate !== 'function') {
    bump(target);
    return;
  }
  const r = target.getBoundingClientRect();
  // El icono de la moneda del contador, a la izquierda del número.
  const to = { x: r.left + 12, y: r.top + r.height / 2 };
  // Si la caja no se ve (la cámara mira a otro sitio), salen del borde de la pantalla.
  const x0 = Math.max(8, Math.min(innerWidth - 8, from.x));
  const y0 = Math.max(8, Math.min(innerHeight - 8, from.y));
  for (let i = 0; i < n; i++) {
    const el = document.createElement('span');
    el.className = 'coin-fly';
    const sx = x0 + (Math.random() - 0.5) * 24;
    const sy = y0 + (Math.random() - 0.5) * 10;
    el.style.left = `${sx}px`;
    el.style.top = `${sy}px`;
    document.body.appendChild(el);
    const dx = to.x - sx;
    const dy = to.y - sy;
    // Primero un saltito hacia arriba (sale de la caja) y luego, en arco, al contador.
    const anim = el.animate(
      [
        { transform: 'translate(-50%, -50%) scale(0.6)', opacity: 0 },
        {
          transform: `translate(calc(-50% + ${(Math.random() - 0.5) * 30}px), calc(-50% - 26px)) scale(1.15)`,
          opacity: 1,
          offset: 0.22,
        },
        {
          transform: `translate(calc(-50% + ${dx * 0.55}px), calc(-50% + ${dy * 0.55 - 40}px)) scale(1)`,
          offset: 0.62,
        },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.7)` },
      ],
      {
        duration: 900 + Math.random() * 160,
        delay: i * 90,
        easing: 'cubic-bezier(0.45, 0, 0.7, 1)',
        fill: 'backwards',
      },
    );
    anim.onfinish = () => {
      el.remove();
      bump(target);
      onLand();
    };
    anim.oncancel = () => el.remove();
  }
}
