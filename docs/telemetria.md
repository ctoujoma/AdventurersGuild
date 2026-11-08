# Datos de los jugadores (Supabase)

El juego manda a Supabase (proyecto `rirxrphghvvmycpbpmlw`) un resumen y la partida entera al
entrar en la partida y cada 2 minutos jugados (`src/platform/telemetry.ts`). Se apaga en
Ajustes («Enviar mi partida…»). En local (`npm run dev`) no se manda nada.

La clave del código es la pública: solo deja llamar a la función `reportar`. Los datos se ven
en el panel de Supabase: **Table Editor → jugadores**, o con estas consultas en **SQL Editor**.

## Quién juega ahora (últimos 5 minutos)

```sql
select nombre, dia, oro, minutos, ultima_vez from jugadores
where ultima_vez > now() - interval '5 minutes' order by ultima_vez desc;
```

## Ranking de horas jugadas

```sql
select nombre, round(minutos / 60.0, 1) as horas, dia, oro, version, ultima_vez
from jugadores order by minutos desc;
```

## Hasta qué día llega la gente

```sql
select dia, count(*) from jugadores group by dia order by dia;
```

## Stats de un jugador

```sql
select nombre, stats from jugadores where nombre ilike '%oca%';
```

## Descargar su partida

```sql
select partida from jugadores where id = '…';
```

Copia el JSON a un fichero `.json` y cárgalo en el juego con «Guardar y cargar → Importar».

## Tabla y función (ya creadas; por si hay que rehacerlas)

```sql
create table jugadores (
  id uuid primary key, nombre text, dia int, oro int, minutos int default 0,
  stats jsonb, partida jsonb, version text,
  primera_vez timestamptz default now(), ultima_vez timestamptz default now()
);
alter table jugadores enable row level security;
create or replace function reportar(
  p_id uuid, p_nombre text, p_dia int, p_oro int, p_minutos int,
  p_stats jsonb, p_partida jsonb, p_version text
) returns void language sql security definer set search_path = public as $$
  insert into jugadores (id, nombre, dia, oro, minutos, stats, partida, version)
  values (p_id, p_nombre, p_dia, p_oro, p_minutos, p_stats, p_partida, p_version)
  on conflict (id) do update set
    nombre = excluded.nombre, dia = excluded.dia, oro = excluded.oro,
    minutos = excluded.minutos, stats = excluded.stats,
    partida = excluded.partida, version = excluded.version, ultima_vez = now();
$$;
revoke all on function reportar from public;
grant execute on function reportar to anon;
```
