# Plan: el clima

Hoy la escena solo tiene la hora (día, atardecer y noche, en `sky.ts`). La idea es que también
haga tiempo: que un día amanezca nublado, que llueva por la tarde y que alguna noche nieve. Con
todo lo que eso cambia a la vista: el cielo, la luz, el patio, los tejados y la gente. En
`docs/futuro.md` ya estaba apuntado («Estaciones y tiempo»).

## Lo que hay

- **Despejado:** lo de hoy.
- **Nublado:** cielo gris, sin sol directo; la luz, más plana y fría; las sombras, más suaves;
  sin rayos de sol por las ventanas.
- **Niebla:** de mañana, sobre todo. Los planos lejanos (montes, bosques y lago) se pierden en
  la bruma, más que con la bruma de distancia de hoy; los faroles con un halo más grande.
- **Lluvia** (suave o fuerte): gotas en diagonal por capas (delante y detrás del edificio, con
  paralaje), salpicaduras en el suelo del patio y en los tejados, charcos que se forman y
  reflejan, la fachada más oscura (mojada), goteo bajo los aleros y gotas en los cristales de
  las ventanas vistas desde dentro. Con fuerte, de vez en cuando un relámpago, que da un
  destello y se oye el trueno con retraso.
- **Nieve:** copos lentos que se mecen; se va posando en tejados, alféizares y el patio (una
  capa que crece y, al despejar, se funde poco a poco); huellas en el patio; el humo de las
  chimeneas más espeso.
- **Viento** (con cualquiera de los anteriores o solo): árboles y hierba que se mecen más, el
  humo de las chimeneas tumbado, hojas que cruzan, la lluvia y la nieve más inclinadas y el
  rótulo que se balancea.

## Cómo encaja

- **El estado:** un tipo `Weather` (cielo, lluvia, nieve, niebla y viento, cada uno de 0 a 1)
  que **solo usa la escena**, sin tocar el núcleo ni `SAVE_VERSION`. Se calcula del día y la
  hora con una semilla fija por partida (`weatherAt(seed, día, hora)`): así es determinista,
  igual al volver a abrir y sin guardar nada. Los cambios van por transiciones de un rato,
  nunca de golpe.
- **Más adelante, si se quiere, que afecte al juego** (menos clientes con lluvia, más a la
  taberna con frío o misiones más lentas con nieve): eso ya es del núcleo y va en su propio PR,
  con el agente principal.
- **Dónde va cada cosa:**
  - `sky.ts`: el color del cielo y las nubes según el tiempo (más nubes, más bajas y grises),
    y la niebla en las capas lejanas;
  - `Daylight`: un factor de «nublado» que aplana la luz del sol, enfría el ambiente y apaga
    los rayos y el foco de sol de las ventanas;
  - una capa de partículas nueva (lluvia y nieve), en un shader de pantalla: barata, por
    capas con paralaje y en téxeles grandes como el resto (sin líneas finas);
  - la nieve posada y lo mojado: una máscara en el relieve que ya tiene la luz con ambiente
    (lo que mira hacia arriba coge nieve; lo mojado, más oscuro y con brillo);
  - el sonido: lluvia, viento y trueno en la capa de ambiente.
- **Todo detrás de «Luz con ambiente»** al principio (como el resto de este estilo), y con
  «Pocas luces» se quitan las capas caras (charcos con reflejo y salpicaduras).
- **En los ajustes:** «Clima: normal / siempre despejado», para quien no lo quiera, y un
  selector en `#debug` para forzar cada tiempo y hacer las capturas.

## Fases (cada una, un PR con capturas)

1. **El estado y el cielo:** `Weather` determinista, nublado y niebla (cielo, luz y bruma).
   Es la base y ya cambia mucho el ambiente.
2. **Lluvia:** las gotas, las salpicaduras, la fachada mojada, el goteo de los aleros, los
   cristales y el sonido. Después, los charcos.
3. **Nieve:** los copos, la nieve posada en tejados, alféizares y el patio, y el deshielo.
4. **Viento:** árboles, humo, hierba y rótulo; y su efecto en la lluvia y la nieve.
5. **Tormenta:** relámpagos y truenos.
6. **(Opcional, con el núcleo)** Las estaciones (otoño con hojas, invierno con más nieve) y el
   efecto del clima en el juego.

## Riesgos

- **Rendimiento en el móvil:** la lluvia a pantalla completa tiene que ir en un shader con muy
  pocas pasadas. Hay que medirla en un móvil antes de dar por buena la fase 2.
- **Legibilidad:** con lluvia o niebla, la gente y lo que se puede tocar se tienen que seguir
  viendo (en las salas no llueve; la niebla, solo fuera).
- **Que no canse:** pocos días de lluvia fuerte y nunca varios seguidos; casi siempre,
  despejado o algo nublado.
