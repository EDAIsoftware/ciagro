-- EDAI · Forma de pago de las visitas: efectivo/transferencia o saldo a favor. Seguro de repetir.
alter table rt_requests add column if not exists pay_method text not null default '';
alter table rt_requests drop constraint if exists rt_requests_pay_method_check;
alter table rt_requests add constraint rt_requests_pay_method_check check (pay_method in ('', 'efectivo', 'transferencia', 'saldo', 'otro'));
