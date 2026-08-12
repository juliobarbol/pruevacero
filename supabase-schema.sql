-- ════════════════════════════════════════════════════════════════════
-- PruevaCero — sincronización entre dispositivos (Supabase)
-- ════════════════════════════════════════════════════════════════════
-- Una sola tabla para TODO: cada fila es un registro de la app (un equipo,
-- un jugador, una jornada, un partido, un ejercicio…). Así no hay que
-- rehacer el modelo de datos cada vez que la app suma una funcionalidad.
--
--   tabla  = a qué colección pertenece ('teams', 'players', 'matches'…)
--   id     = el mismo id que ya usa la app en el teléfono
--   data   = el registro completo en JSON
--
-- Cada usuario solo ve sus propias filas (RLS por auth.uid()).
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.registros (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  tabla      text        not null,
  id         text        not null,
  data       jsonb,
  borrado    boolean     not null default false,
  -- hora del DISPOSITIVO que hizo el cambio: decide quién gana un conflicto
  client_ts  timestamptz not null default now(),
  -- hora del SERVIDOR: es el marcador que usa la app para pedir novedades
  updated_at timestamptz not null default now(),
  primary key (user_id, tabla, id)
);

-- Para pedir "todo lo que cambió desde la última vez" sin leer todo.
create index if not exists registros_sync_idx
  on public.registros (user_id, updated_at);

-- ── Gana el último cambio ───────────────────────────────────────────
-- El servidor pone SIEMPRE su propia hora en updated_at (así el marcador
-- de sincronización no depende del reloj de cada aparato), y si llega un
-- cambio más viejo que el que ya está guardado, se descarta.
create or replace function public.registros_lww()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'UPDATE' and new.client_ts < old.client_ts) then
    return old;                      -- llegó tarde y trae datos viejos: se ignora
  end if;
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists registros_lww_trg on public.registros;
create trigger registros_lww_trg
  before insert or update on public.registros
  for each row execute function public.registros_lww();

-- ── Seguridad: cada uno ve SOLO lo suyo ─────────────────────────────
alter table public.registros enable row level security;

drop policy if exists "solo mis registros" on public.registros;
create policy "solo mis registros" on public.registros
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Permisos explícitos (el proyecto está configurado para NO exponer tablas
-- nuevas de forma automática, que es lo correcto).
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.registros to authenticated;
-- Supabase deja igual unos permisos residuales para el rol anónimo (TRUNCATE,
-- REFERENCES, TRIGGER). No hacen falta para nada: se los sacamos.
revoke all on public.registros from anon;

-- ── Fotos y escudos (Supabase Storage) ──────────────────────────────
insert into storage.buckets (id, name, public)
values ('fotos', 'fotos', false)
on conflict (id) do nothing;

-- Cada usuario solo entra a su propia carpeta: fotos/<su-id>/<archivo>
drop policy if exists "solo mis fotos" on storage.objects;
create policy "solo mis fotos" on storage.objects
  for all
  to authenticated
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);

-- Que la API tome los cambios enseguida.
notify pgrst, 'reload schema';
