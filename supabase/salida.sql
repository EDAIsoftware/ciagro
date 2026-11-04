-- EDAI · Número de salida en las extracciones de combustible (como el número de factura en las cargas). Seguro de repetir.
alter table transfers add column if not exists exit_no text not null default '';
