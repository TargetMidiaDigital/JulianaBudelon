-- Operacional → Estoque: produtos com categoria e quantidade.
-- As categorias são as seções da planilha de reposição (lib/estoque.ts valida no servidor;
-- aqui fica TEXT livre para uma categoria nova não exigir migration).
create table if not exists produto (
  id          text primary key,
  nome        text not null,
  categoria   text not null,
  quantidade  integer not null default 0 check (quantidade >= 0),
  criada      timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_produto_categoria on produto(categoria);

-- RLS ligada SEM policy (padrão deste projeto): só o servidor acessa, com a service role.
alter table produto enable row level security;

drop trigger if exists trg_produto_updated_at on produto;
create trigger trg_produto_updated_at before update on produto for each row execute function public.set_updated_at();

-- Sinal de realtime: mudou o estoque → os navegadores refazem o bootstrap.
drop trigger if exists trg_realtime_ping on produto;
create trigger trg_realtime_ping after insert or update or delete on produto
  for each statement execute function public.tg_realtime_ping();
