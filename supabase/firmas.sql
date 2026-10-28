-- EDAI · Firmas de entrega y corrección de inspecciones ya guardadas. Seguro de repetir.
-- Cualquier usuario con el módulo puede agregar las firmas UNA vez (mientras no tenga firmas).
-- Solo el administrador puede corregir el contenido (puntos, kilometraje, nombres, etc.).
revoke update on inspections from authenticated;
grant update (date, place, driver, km, fuel_level, items, notes, signatures, extra) on inspections to authenticated;

drop policy if exists "firmar entrega" on inspections;
create policy "firmar entrega" on inspections for update to authenticated
  using (has_module('inspecciones') and signatures = '{}'::jsonb)
  with check (has_module('inspecciones'));

drop policy if exists "admin edita inspecciones" on inspections;
create policy "admin edita inspecciones" on inspections for update to authenticated
  using (is_admin()) with check (is_admin());

-- Un usuario que no es administrador solo puede cambiar las firmas y los datos de la entrega
create or replace function guard_inspection_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not public.is_admin() and (
       new.date is distinct from old.date or new.place is distinct from old.place or new.driver is distinct from old.driver
    or new.km is distinct from old.km or new.fuel_level is distinct from old.fuel_level
    or new.items is distinct from old.items or new.notes is distinct from old.notes) then
    raise exception 'Solo el administrador puede editar el contenido de una inspección';
  end if;
  return new;
end $$;
drop trigger if exists inspections_guard on inspections;
create trigger inspections_guard before update on inspections for each row execute function guard_inspection_update();
