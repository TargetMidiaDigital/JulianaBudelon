-- Ordem de serviço: "em producao" vira "em andamento" — agora a ordem acompanha as tarefas de
-- PRODUÇÃO e de EXPEDIÇÃO (alguma iniciada → Em andamento; todas concluídas → Concluída).
alter table pedido drop constraint if exists pedido_status_check;
update pedido set status = 'em andamento' where status = 'em producao';
alter table pedido add constraint pedido_status_check check (status in ('aberta', 'em andamento', 'concluida', 'validada'));
