-- Tarefa de produção ↔ ordem de pedido que a gerou. A ordem acompanha as tarefas:
-- alguma começou → "em producao"; todas concluídas → "concluida" (lib/pedido-server.ts).
-- Apagar a ordem não apaga as tarefas (perdem só o vínculo).
alter table tarefas add column if not exists pedido_id text references pedido(id) on delete set null;
create index if not exists idx_tarefas_pedido on tarefas(pedido_id);
