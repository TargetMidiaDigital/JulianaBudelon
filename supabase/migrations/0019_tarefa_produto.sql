-- Tarefa de produção sabe QUAL produto e QUANTAS unidades produz. Ao concluir, a quantidade
-- soma no estoque da Fábrica (lib/tarefas-server.ts); ao reabrir, estorna.
alter table tarefas add column if not exists produto_id text references produto(id) on delete set null;
alter table tarefas add column if not exists quantidade integer check (quantidade >= 0);
create index if not exists idx_tarefas_produto on tarefas(produto_id);

-- Tarefas de produção já geradas por ordens ("Nome do produto: N") ganham o vínculo.
update tarefas t set produto_id = p.id, quantidade = (regexp_match(t.nome, ':\s*(\d+)\s*$'))[1]::int
  from produto p
 where t.produto_id is null and coalesce(t.categoria, 'operacional') <> 'expedicao'
   and t.nome ~ ':\s*\d+\s*$' and p.nome = regexp_replace(t.nome, ':\s*\d+\s*$', '');
