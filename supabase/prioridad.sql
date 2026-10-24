-- EDAI · Permitir cambiar la prioridad de una observación
-- (lo puede hacer quien la registró o el administrador). Ejecutar una vez.
grant update (priority) on insp_observations to authenticated;

create or replace function guard_obs_priority() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.priority is distinct from old.priority and not (public.is_admin() or old.created_by = auth.uid()) then
    raise exception 'Solo quien registró la observación o el administrador puede cambiar la prioridad';
  end if;
  return new;
end $$;

drop trigger if exists obs_priority_guard on insp_observations;
create trigger obs_priority_guard before update on insp_observations
  for each row execute function guard_obs_priority();
