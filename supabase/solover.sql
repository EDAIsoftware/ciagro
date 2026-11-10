-- EDAI · Permiso "Inspecciones (solo ver)": una persona que ve las inspecciones y sus informes, sin editar nada y sin ver el taller. Seguro de repetir.
alter table user_modules drop constraint if exists user_modules_module_check;
alter table user_modules add constraint user_modules_module_check
  check (module in ('combustible','inspecciones','inspecciones_ver','rutas','tractores','implementos'));

drop policy if exists "ver insp_vehicles" on insp_vehicles;
create policy "ver insp_vehicles" on insp_vehicles for select to authenticated using (has_module('inspecciones') or has_module('rutas') or has_module('inspecciones_ver'));
drop policy if exists "ver inspecciones" on inspections;
create policy "ver inspecciones" on inspections for select to authenticated using (has_module('inspecciones') or has_module('inspecciones_ver'));
drop policy if exists "ver observaciones" on insp_observations;
create policy "ver observaciones" on insp_observations for select to authenticated using (has_module('inspecciones') or has_module('rutas') or has_module('inspecciones_ver'));
drop policy if exists "ver dueños" on insp_owner_log;
create policy "ver dueños" on insp_owner_log for select to authenticated using (has_module('inspecciones') or has_module('inspecciones_ver'));
drop policy if exists "ver pedidos" on insp_requests;
create policy "ver pedidos" on insp_requests for select to authenticated using (has_module('inspecciones') or has_module('inspecciones_ver'));
-- fotos de los informes
drop policy if exists "inspecciones ver" on storage.objects;
create policy "inspecciones ver" on storage.objects for select to authenticated using (bucket_id = 'inspecciones' and (public.has_module('inspecciones') or public.has_module('inspecciones_ver')));
