-- EDAI · Estado de pago de cada visita (sin cobro / pendiente de pago / pagado). Seguro de repetir.
-- La primera vez marca las visitas que ya tenían fecha de pago como "pagado" y las que tenían monto sin pagar como "pendiente".
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'rt_requests' and column_name = 'pay_status') then
    alter table rt_requests add column pay_status text not null default '';
    update rt_requests set pay_status = 'pagado' where paid_date is not null;
    update rt_requests set pay_status = 'pendiente' where paid_date is null and amount is not null and warranty = false;
  end if;
end $$;
alter table rt_requests drop constraint if exists rt_requests_pay_status_check;
alter table rt_requests add constraint rt_requests_pay_status_check check (pay_status in ('', 'pendiente', 'pagado'));
