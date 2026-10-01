-- Tarefas de expedição e de recebimento sabem a QUAL unidade se referem (id de LOCAIS_ESTOQUE).
-- Concluir o recebimento move o estoque: sai da Fábrica, entra na unidade (lib/tarefas-server.ts).
alter table tarefas add column if not exists local text;
update tarefas set local = case split_part(nome, ' - ', 2)
    when 'Fábrica' then 'fabrica' when 'Centro' then 'centro' when 'Santa Mônica' then 'santa-monica'
    when 'Coqueiros' then 'coqueiros' when 'Areias' then 'areias' when 'Roçado' then 'rocado' when 'Pagani' then 'pagani' end
  where local is null and categoria in ('expedicao', 'unidade');
