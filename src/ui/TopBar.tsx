export function TopBar() {
  return (
    <header class="topbar">
      <div class="topbar-row">
        <div class="day">
          Día 4<small>/30</small>
        </div>
        <div class="guild">
          <b>El Jarro Partido</b>
          <span>Gremio de cobre</span>
        </div>
      </div>
      <div class="stats">
        <div class="stat">
          <span class="k">Oro</span>
          <span class="v">
            <i class="coin" />
            312
          </span>
        </div>
        <div class="stat">
          <span class="k">Reputación</span>
          <span class="v">
            18<small>/50</small>
          </span>
        </div>
        <div class="stat">
          <span class="k">Pago · día 7</span>
          <span class="v warn">216</span>
        </div>
      </div>
    </header>
  );
}
