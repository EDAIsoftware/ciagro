-- EDAI · Cada usuario puede cambiar su propio nombre (no su rol). Ejecutar una vez.
drop policy if exists "editar mi nombre" on profiles;
create policy "editar mi nombre" on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Solo la columna del nombre se puede modificar desde la plataforma
revoke update on profiles from authenticated;
grant update (full_name) on profiles to authenticated;
