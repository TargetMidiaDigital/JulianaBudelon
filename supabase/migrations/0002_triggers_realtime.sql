-- Triggers e "realtime" — portados da Target (migrations 0068, 0077 e 0078).

-- 1) tarefas.atualizada_em: carimbado a cada UPDATE (status, responsável, comentário…).
create or replace function public.set_tarefas_atualizada_em() returns trigger
  language plpgsql set search_path = public as $$
begin
  new.atualizada_em := now();
  return new;
end $$;
drop trigger if exists trg_tarefas_atualizada_em on tarefas;
create trigger trg_tarefas_atualizada_em before update on tarefas
  for each row execute function public.set_tarefas_atualizada_em();

-- 2) updated_at em vaga e talento (mesmo desenho).
create or replace function public.set_updated_at() returns trigger
  language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists trg_vaga_updated_at on vaga;
create trigger trg_vaga_updated_at before update on vaga for each row execute function public.set_updated_at();
drop trigger if exists trg_talento_updated_at on talento;
create trigger trg_talento_updated_at before update on talento for each row execute function public.set_updated_at();
drop trigger if exists trg_workspace_updated_at on workspace;
create trigger trg_workspace_updated_at before update on workspace for each row execute function public.set_updated_at();

-- 3) realtime_ping: tabela-sinal inócua (só nome da tabela + timestamp). O navegador
--    assina postgres_changes DESTA tabela e re-busca o /api/bootstrap (recortado por
--    cargo). Nenhum dado real trafega pelo Realtime.
create table if not exists realtime_ping (
  dominio text primary key,
  at      timestamptz not null default now(),
  n       bigint not null default 0
);
alter table realtime_ping enable row level security;
drop policy if exists realtime_ping_sel on realtime_ping;
-- Leitura liberada (anon + authenticated): a conexão realtime conecta como anon antes
-- do setAuth, e o dado é inócuo.
create policy realtime_ping_sel on realtime_ping for select using (true);

create or replace function public.tg_realtime_ping() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  insert into public.realtime_ping (dominio, at, n) values (tg_table_name, now(), 1)
  on conflict (dominio) do update set at = now(), n = public.realtime_ping.n + 1;
  return null;
end $$;

do $$
declare t text;
  tabelas text[] := array['workspace', 'usuarios', 'cargo_acesso', 'cargo_permissao', 'grupo_interno', 'tarefas', 'unidade', 'vaga', 'talento'];
begin
  foreach t in array tabelas loop
    execute format('drop trigger if exists trg_realtime_ping on public.%I', t);
    execute format('create trigger trg_realtime_ping after insert or update or delete on public.%I for each statement execute function public.tg_realtime_ping()', t);
  end loop;
end $$;

alter table realtime_ping replica identity full;
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'realtime_ping'
  ) then
    alter publication supabase_realtime add table public.realtime_ping;
  end if;
end $$;
