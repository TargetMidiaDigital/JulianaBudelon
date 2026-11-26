-- Marketing → Link na Bio: página pública /bio (perfil, cores, botões), contador de cliques e relatório.
-- Tudo passa pelo servidor do sistema (service role): RLS ligado e sem política = a API pública do
-- Supabase não lê nem grava nada destas tabelas.

create table if not exists public.bio_pagina (
  id         int primary key default 1 check (id = 1),
  dados      jsonb not null default '{}'::jsonb,   -- perfil, cores, tamanhos, pixel (lib/bio.ts → BioPagina)
  atualizada timestamptz not null default now()
);

create table if not exists public.bio_link (
  id          text primary key,
  titulo      text not null,
  subtitulo   text not null default '',
  url         text not null,
  imagem      text,
  ativo       boolean not null default true,
  ordem       integer not null default 0,
  cliques     integer not null default 0,          -- somado a cada clique (/bio/l/<id>)
  evento_meta text not null default 'Contact',
  criada      timestamptz not null default now()
);
create index if not exists bio_link_ordem_idx on public.bio_link (ordem);

-- Uma linha por visita à página e por clique num botão (relatório).
create table if not exists public.bio_evento (
  id       bigserial primary key,
  link_id  text references public.bio_link (id) on delete set null,
  tipo     text not null check (tipo in ('view', 'click')),
  aparelho text not null default '',               -- 'mobile' | 'desktop'
  origem   text not null default '',               -- 'instagram' | 'facebook' | site de origem | 'direto'
  em       timestamptz not null default now()
);
create index if not exists bio_evento_em_idx on public.bio_evento (em desc);
create index if not exists bio_evento_link_idx on public.bio_evento (link_id);

alter table public.bio_pagina enable row level security;
alter table public.bio_link enable row level security;
alter table public.bio_evento enable row level security;

-- Clique: soma 1 e devolve o destino (só botão ativo).
create or replace function public.bio_clique(link text) returns text
language sql security definer set search_path = public as $$
  update public.bio_link set cliques = cliques + 1 where id = link and ativo returning url
$$;
revoke execute on function public.bio_clique(text) from public, anon, authenticated;

-- Página e os 3 botões do início (só se ainda não existem).
insert into public.bio_pagina (id, dados) values (1, '{}'::jsonb) on conflict (id) do nothing;

insert into public.bio_link (id, titulo, subtitulo, url, ordem, evento_meta)
select v.id, v.titulo, v.subtitulo, v.url, v.ordem, v.evento
from (values
  ('bio-instagram',  'Instagram',          '@jubudelon',                         'https://instagram.com/jubudelon',               0, 'Contact'),
  ('bio-ifood',      'Peça pelo iFood',    'Entrega na sua casa',                'https://www.ifood.com.br/busca?q=ju%20budelon', 1, 'InitiateCheckout'),
  ('bio-encomendas', 'Faça sua encomenda', 'Bolos e doces para retirar na loja', '/encomendar',                                   2, 'InitiateCheckout')
) as v(id, titulo, subtitulo, url, ordem, evento)
where not exists (select 1 from public.bio_link);
