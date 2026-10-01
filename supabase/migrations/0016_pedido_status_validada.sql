-- Ordem de serviço: sai "cancelada", entra "validada" (conferida pela gestão; some da visão padrão,
-- como a tarefa validada). O status automático (lib/pedido-server.ts) não mexe em ordem validada.
update pedido set status = 'aberta' where status = 'cancelada';
alter table pedido drop constraint if exists pedido_status_check;
alter table pedido add constraint pedido_status_check check (status in ('aberta', 'em producao', 'concluida', 'validada'));
