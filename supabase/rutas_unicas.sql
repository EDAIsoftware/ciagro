-- EDAI · Evita que se cree la misma ruta dos veces con el mismo número. Seguro de repetir.
-- Si ya existen dos rutas con el mismo número, no crea el índice (avisa) para no romper nada: revisa y elimina la que sobra.
do $$ begin
  if exists (select 1 from rt_routes group by number having count(*) > 1) then
    raise notice 'Hay rutas con el mismo número: elimina las repetidas y vuelve a ejecutar este archivo.';
  else
    create unique index if not exists rt_routes_number_uq on rt_routes (number);
  end if;
end $$;
