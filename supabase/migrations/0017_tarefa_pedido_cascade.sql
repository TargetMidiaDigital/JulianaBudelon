-- Excluir a ordem de serviço apaga as tarefas de produção que ela gerou (antes só perdiam o vínculo).
alter table tarefas drop constraint if exists tarefas_pedido_id_fkey;
alter table tarefas add constraint tarefas_pedido_id_fkey foreign key (pedido_id) references pedido(id) on delete cascade;
