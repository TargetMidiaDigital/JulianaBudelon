-- Operacional → Ordem de Pedido: o que produzir para cada unidade.
-- `itens` = { produtoId: { localId: quantidade } } (ids de LOCAIS_ESTOQUE em lib/estoque.ts;
-- produto apagado continua no pedido como "Produto removido"). `historico` = log de alterações,
-- no mesmo formato dos comentários de tarefa.
create table if not exists pedido (
  id          text primary key,
  titulo      text not null,
  status      text not null default 'aberta' check (status in ('aberta', 'em producao', 'concluida', 'cancelada')),
  criado_por  text references usuarios(id) on delete set null,
  entrega     date,
  itens       jsonb not null default '{}'::jsonb,
  historico   jsonb not null default '[]'::jsonb,
  criada      timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_pedido_status on pedido(status);
create index if not exists idx_pedido_criado_por on pedido(criado_por);

-- RLS ligada SEM policy (padrão deste projeto): só o servidor acessa, com a service role.
alter table pedido enable row level security;

drop trigger if exists trg_pedido_updated_at on pedido;
create trigger trg_pedido_updated_at before update on pedido for each row execute function public.set_updated_at();

drop trigger if exists trg_realtime_ping on pedido;
create trigger trg_realtime_ping after insert or update or delete on pedido
  for each statement execute function public.tg_realtime_ping();
