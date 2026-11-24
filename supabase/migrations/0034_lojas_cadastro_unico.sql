-- Lojas: cadastro único (Configurações → Lojas).
--
-- A tabela `unidade` (até aqui só de RH → Vagas) passa a ser o cadastro de TODAS as lojas.
-- Nada é apagado nem tem o id/slug trocado: vagas, candidatos e links públicos (/vagas/<slug>)
-- continuam iguais. Só entram colunas novas:
--   codigo    → id da loja na operação (estoque, tarefas, ordem de serviço, retirada "u-<codigo>")
--   operacao  → aparece em Ordem de Serviço, Produção, Expedição, Lojas, Estoque, Indicadores
--   retirada  → aparece na página de encomendas para retirada
--   endereco, horarios → vêm da configuração de Encomendas (retirada na loja)
--   ordem     → ordem das lojas nas telas
--   ativa     → (já existia) aparece na página pública de vagas
--
-- Cópias de segurança: backup_unidade_20261124 e backup_enc_config_20261124 (com RLS ligado e
-- sem política = ninguém acessa pela API; só pelo SQL Editor).
-- Tudo roda numa transação: se a conferência do final falhar, nada é gravado.

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

-- Lojas da operação, ligadas pelo link público de vagas (slug é único e não muda).
update public.unidade u set codigo = m.codigo, operacao = true, ordem = m.ordem
from (values
  ('florianopolis-centro-2',       'centro',       1),
  ('florianopolis-santa-monica',   'santa-monica', 2),
  ('florianopolis-coqueiros',      'coqueiros',    3),
  ('sao-jose-areias',              'areias',       4),
  ('sao-jose-kobrasol',            'rocado',       5),
  ('florianopolis-florianopolis',  'pagani',       6)
) as m(slug, codigo, ordem)
where u.slug = m.slug and u.codigo is null;

-- Ipiranga: entra no cadastro só com Vagas (como hoje); a operação/retirada liga em Configurações → Lojas.
update public.unidade set codigo = 'ipiranga', ordem = 7 where slug = 'sao-jose-ipiranga' and codigo is null;

-- O Centro antigo (desativado, com as vagas antigas) fica como está: sem código, fora da operação.
update public.unidade set ordem = 99 where slug = 'florianopolis-centro' and codigo is null;

-- Retirada de encomendas: copia endereço, horário e ativo da configuração de Encomendas.
update public.unidade u set
  retirada = coalesce((x->>'ativo')::boolean, true),
  endereco = nullif(x->>'endereco', ''),
  horarios = case when jsonb_typeof(x->'horarios') = 'object' then x->'horarios' else null end
from public.enc_config c, jsonb_array_elements(c.dados->'unidades') x
where c.id = 'geral' and u.codigo = replace(x->>'id', 'u-', '');

-- Conferência: as 6 lojas da operação ligadas, nenhuma loja de retirada sem par, contagens intactas.
do $$
declare n_op int; n_ret_sem_par int; n_unid int; n_unid_bkp int;
begin
  select count(*) into n_op from public.unidade where operacao and codigo in ('centro','santa-monica','coqueiros','areias','rocado','pagani');
  if n_op <> 6 then raise exception 'Esperava 6 lojas da operação ligadas, achei %', n_op; end if;

  select count(*) into n_ret_sem_par
  from public.enc_config c, jsonb_array_elements(c.dados->'unidades') x
  where c.id = 'geral' and not exists (select 1 from public.unidade u where u.codigo = replace(x->>'id', 'u-', ''));
  if n_ret_sem_par > 0 then raise exception '% loja(s) de retirada de Encomendas sem loja correspondente', n_ret_sem_par; end if;

  select count(*) into n_unid from public.unidade;
  select count(*) into n_unid_bkp from public.backup_unidade_20261124;
  if n_unid <> n_unid_bkp then raise exception 'Número de lojas mudou (% → %)', n_unid_bkp, n_unid; end if;
end $$;

commit;
