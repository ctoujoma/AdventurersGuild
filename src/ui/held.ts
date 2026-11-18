/**
 * Lo que llega solo (el cobro, el aviso de un jefe…) mientras el jugador tiene algo suyo abierto:
 * se guarda y sale, en el orden en que llegó, cuando lo cierra.
 */
export class Held {
  private queue: (() => void)[] = [];

  /** Hace `fn` ya si no hay nada abierto; si no, la guarda para `free`. */
  when(busy: boolean, fn: () => void): void {
    if (busy) this.queue.push(fn);
    else fn();
  }

  /** Ya no hay nada abierto: sale lo guardado. */
  free(): void {
    const q = this.queue;
    this.queue = [];
    for (const fn of q) fn();
  }

  get waiting(): number {
    return this.queue.length;
  }
}
