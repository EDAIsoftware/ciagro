-- EDAI · Frecuencia de inspección por camioneta (quincenal, mensual o sin recordatorio)
-- Seguro de repetir. Las camionetas del área "Total Agro" se marcan mensual solo la primera vez.
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'insp_vehicles' and column_name = 'insp_freq') then
    alter table insp_vehicles add column insp_freq text not null default 'quincenal';
    update insp_vehicles set insp_freq = 'mensual' where lower(replace(area, ' ', '')) = 'totalagro';
  end if;
end $$;
alter table insp_vehicles drop constraint if exists insp_vehicles_insp_freq_check;
alter table insp_vehicles add constraint insp_vehicles_insp_freq_check check (insp_freq in ('quincenal','mensual','manual'));
