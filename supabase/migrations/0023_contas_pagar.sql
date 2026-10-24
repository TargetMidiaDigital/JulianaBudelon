-- Administrativo → Contas a Pagar.
--  * cp_empresa / cp_plano: listas das empresas (CNPJ) e do plano de contas (selects da tela).
--  * conta_pagar: cada lançamento (uma linha por parcela; `grupo` liga as parcelas de um mesmo lançamento).
--  * bucket privado `contas-pagar`: comprovantes (PDF/JPG/PNG até 20 MB), servidos pela rota
--    /api/contas-pagar/comprovante, que confere o acesso à tela.
-- Acesso só pelas rotas /api (service role): RLS ligada e sem policies.

create table if not exists cp_empresa (
  id      text primary key,
  nome    text not null unique,
  cnpj    text,
  ativo   boolean not null default true,
  ordem   int not null default 0
);

create table if not exists cp_plano (
  id      text primary key,
  nome    text not null unique,
  ativo   boolean not null default true,
  ordem   int not null default 0
);

create table if not exists conta_pagar (
  id              text primary key,
  descricao       text not null,
  plano           text not null,
  empresa         text not null,
  forma           text not null default 'Boleto'
                  check (forma in ('Boleto', 'PIX', 'Débito automático', 'Cartão de crédito', 'Transferência')),
  vencimento      date not null,
  valor           numeric(14,2) not null check (valor > 0),
  situacao        text not null default 'a pagar'
                  check (situacao in ('a pagar', 'pago', 'pago c/ comprovante', 'qr code / pix', 'pago no débito', 'pago no crédito')),
  valor_pago      numeric(14,2),
  data_pagamento  date,
  obs             text,
  codigo_barras   text,
  comprovantes    jsonb not null default '[]'::jsonb,  -- [{ path, nome, mime, tamanho, em, autor }]
  grupo           text,                              -- parcelas do mesmo lançamento
  parcela         int,
  parcelas        int,
  criado_por      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_conta_pagar_venc on conta_pagar(vencimento);
create index if not exists idx_conta_pagar_empresa on conta_pagar(empresa);
create index if not exists idx_conta_pagar_grupo on conta_pagar(grupo);

alter table cp_empresa  enable row level security;
alter table cp_plano    enable row level security;
alter table conta_pagar enable row level security;

drop trigger if exists trg_conta_pagar_updated_at on conta_pagar;
create trigger trg_conta_pagar_updated_at before update on conta_pagar for each row execute function public.set_updated_at();

-- Sinal de realtime (só nome da tabela + horário; nenhum dado financeiro trafega).
do $$
declare t text;
begin
  foreach t in array array['conta_pagar', 'cp_empresa', 'cp_plano'] loop
    execute format('drop trigger if exists trg_realtime_ping on public.%I', t);
    execute format('create trigger trg_realtime_ping after insert or update or delete on public.%I for each statement execute function public.tg_realtime_ping()', t);
  end loop;
end $$;

-- Bucket privado dos comprovantes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('contas-pagar', 'contas-pagar', false, 20971520, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

-- Listas iniciais (as do sistema que o cliente usa hoje).
insert into cp_empresa (id, nome, ordem) values
  ('jb', 'JB', 1), ('cfs', 'CFS', 2), ('jc', 'JC', 3), ('jb-fabrica', 'JB FÁBRICA', 4), ('jb-rocado', 'JB ROÇADO', 5),
  ('junior', 'JUNIOR', 6), ('jb-centro', 'JB CENTRO', 7), ('jb-areias', 'JB AREIAS', 8), ('jb-coqueiros', 'JB COQUEIROS', 9),
  ('jb-pagani', 'JB PAGANI', 10), ('jb-santa-monica', 'JB SANTA MÔNICA', 11), ('jc-coqueiros', 'JC COQUEIROS', 12),
  ('cfs-coqueiros', 'CFS COQUEIROS', 13), ('rf-cafet', 'RF CAFET', 14)
on conflict (id) do nothing;

insert into cp_plano (id, nome, ordem) values
  ('fornecedores', 'FORNECEDORES', 1), ('desp-impostos', 'DESP IMPOSTOS', 2), ('desp-fabrica', 'DESP FÁBRICA', 3),
  ('desp-pagani', 'DESP PAGANI', 4), ('desp-coqueiros', 'DESP COQUEIROS', 5), ('desp-centro', 'DESP CENTRO', 6),
  ('desp-ingleses', 'DESP INGLESES', 7), ('desp-santa-monica', 'DESP SANTA MONICA', 8), ('desp-adm', 'DESP ADM', 9),
  ('desp-areias', 'DESP AREIAS', 10), ('desp-gelato', 'DESP GELATO', 11), ('desp-rocado', 'DESP ROÇADO', 12)
on conflict (id) do nothing;
