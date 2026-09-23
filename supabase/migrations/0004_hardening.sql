-- Ajustes apontados pelos advisors do Supabase após o 0001–0003.

-- tg_realtime_ping é SECURITY DEFINER e só deve rodar via trigger: fecha o RPC
-- (/rest/v1/rpc/tg_realtime_ping) para anon e authenticated.
revoke execute on function public.tg_realtime_ping() from public, anon, authenticated;

-- Índices cobrindo as FKs sem índice (performance advisor).
create index if not exists idx_talento_vaga on talento(vaga_id);
create index if not exists idx_tarefas_parent on tarefas(parent_id);
