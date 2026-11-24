-- Lojas: liga todas no cadastro único (completa a 0034 e pode ser rodada mesmo se a 0034 rodou só em parte).
--
-- 1) Centro, Santa Mônica, Coqueiros, Areias, Roçado e Pagani → Operação ligada; retirada/endereço/horário
--    copiados da configuração de Encomendas.
-- 2) Ipiranga → Operação ligada (Vagas continua como está; retirada desligada até a loja fazer retirada).
-- 3) O Centro antigo (desativado, 12 vagas, nenhum candidato) vira "Template": as vagas ficam guardadas
--    como modelo, fora da página pública, da operação e das encomendas.
-- Nenhuma vaga ou candidato muda de loja. Tudo numa transação: se a conferência falhar, nada é gravado.

begin;

create table if not exists public.backup_unidade_20261124 as table public.unidade;
create table if not exists public.backup_enc_config_20261124 as table public.enc_config;
alter table public.backup_unidade_20261124 enable row level security;
alter table public.backup_enc_config_20261124 enable row level security;

alter table public.unidade
  add column if not exists codigo text,
  add column if not exists endereco text,
  add column if not exists horarios jsonb,
  add column if not exists operacao boolean not null default false,
  add column if not exists retirada boolean not null default false,
  add column if not exists ordem integer not null default 0;

create unique index if not exists unidade_codigo_unico on public.unidade (codigo) where codigo is not null;

-- Contagens antes, para conferir no fim.
create temp table _antes on commit drop as
  select (select count(*) from public.unidade) as unid,
         (select count(*) from public.vaga) as vagas,
         (select count(*) from public.talento) as talentos,
         (select string_agg(unidade_id::text || ':' || n, ',' order by unidade_id::text) from (select unidade_id, count(*) n from public.vaga group by 1) x) as vagas_por_loja,
         (select string_agg(coalesce(unidade_id::text, '-') || ':' || n, ',' order by unidade_id::text) from (select unidade_id, count(*) n from public.talento group by 1) x) as talentos_por_loja;

-- 1) Lojas da operação, pelo link público de vagas (slug é único).
update public.unidade u set codigo = coalesce(u.codigo, m.codigo), operacao = true, ordem = m.ordem
from (values
  ('florianopolis-centro-2',       'centro',       1),
  ('florianopolis-santa-monica',   'santa-monica', 2),
  ('florianopolis-coqueiros',      'coqueiros',    3),
  ('sao-jose-areias',              'areias',       4),
  ('sao-jose-kobrasol',            'rocado',       5),
  ('florianopolis-florianopolis',  'pagani',       6),
  ('sao-jose-ipiranga',            'ipiranga',     7)
) as m(slug, codigo, ordem)
where u.slug = m.slug;

-- Retirada de encomendas: copia endereço, horário e ativo da configuração de Encomendas.
update public.unidade u set
  retirada = coalesce((x->>'ativo')::boolean, true),
  endereco = coalesce(nullif(u.endereco, ''), nullif(x->>'endereco', '')),
  horarios = coalesce(u.horarios, case when jsonb_typeof(x->'horarios') = 'object' then x->'horarios' else null end)
from public.enc_config c, jsonb_array_elements(c.dados->'unidades') x
where c.id = 'geral' and u.codigo = replace(x->>'id', 'u-', '');

-- 3) Centro antigo → Template (desligado em tudo; as vagas ficam guardadas nele).
update public.unidade set nome = 'Template', cidade = '', codigo = coalesce(codigo, 'template'),
  slug = case when exists (select 1 from public.unidade where slug = 'template') then slug else 'template' end,
  ativa = false, operacao = false, retirada = false, ordem = 99
where slug in ('florianopolis-centro', 'template') and (codigo is null or codigo = 'template');

-- Conferência.
do $$
declare a record; n_op int; n_ret_sem_par int; n_sem_cod int; vpl text; tpl text;
begin
  select * into a from _antes;
  select count(*) into n_op from public.unidade where operacao and codigo in ('centro','santa-monica','coqueiros','areias','rocado','pagani','ipiranga');
  if n_op <> 7 then raise exception 'Esperava 7 lojas na operação, achei %', n_op; end if;

  select count(*) into n_ret_sem_par
  from public.enc_config c, jsonb_array_elements(c.dados->'unidades') x
  where c.id = 'geral' and not exists (select 1 from public.unidade u where u.codigo = replace(x->>'id', 'u-', ''));
  if n_ret_sem_par > 0 then raise exception '% loja(s) de retirada de Encomendas sem loja correspondente', n_ret_sem_par; end if;

  select count(*) into n_sem_cod from public.unidade where codigo is null;
  if n_sem_cod > 0 then raise exception '% loja(s) ficaram sem código', n_sem_cod; end if;

  if (select count(*) from public.unidade) <> a.unid then raise exception 'Número de lojas mudou'; end if;
  select string_agg(unidade_id::text || ':' || n, ',' order by unidade_id::text) into vpl from (select unidade_id, count(*) n from public.vaga group by 1) x;
  select string_agg(coalesce(unidade_id::text, '-') || ':' || n, ',' order by unidade_id::text) into tpl from (select unidade_id, count(*) n from public.talento group by 1) x;
  if vpl is distinct from a.vagas_por_loja then raise exception 'Vagas mudaram de loja'; end if;
  if tpl is distinct from a.talentos_por_loja then raise exception 'Candidatos mudaram de loja'; end if;
end $$;

commit;

-- Para conferir depois:
-- select ordem, nome, cidade, slug, codigo, operacao, ativa as vagas, retirada,
--   (select count(*) from vaga v where v.unidade_id::text = u.id::text) as qtd_vagas,
--   (select count(*) from talento t where t.unidade_id::text = u.id::text) as candidatos
-- from unidade u order by ordem, nome;
