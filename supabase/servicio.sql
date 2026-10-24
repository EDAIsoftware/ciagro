-- EDAI · Copiar a Inspecciones las camionetas del área de Servicio
-- (las que ya están registradas en el control de combustible).
-- Se puede ejecutar más de una vez: las placas que ya existen no se duplican.
insert into insp_vehicles (name, plate, area, driver, odometer)
select name, plate, 'Servicio', driver, odometer from vehicles
on conflict (plate) do nothing;
