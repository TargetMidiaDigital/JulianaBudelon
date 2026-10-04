-- Conferência por linha nas tarefas da ordem de serviço: [{ produtoId, pedido, feito }].
-- "feito" é o produzido / separado / recebido que a pessoa registra antes de concluir; o
-- estoque e o relatório da ordem usam esse valor (lib/conferencia.ts, lib/tarefas-server.ts).
alter table tarefas add column if not exists conferencia jsonb not null default '[]'::jsonb;
