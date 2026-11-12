-- Cargos editáveis (Configurações → Acessos → Cargos): criar, renomear, mudar a cor e excluir.
-- Até aqui o cargo era um enum fixo (cargo_usuario); agora é uma tabela e as colunas viram texto
-- com chave estrangeira "on update cascade": renomear o cargo atualiza usuários, acessos e escopo.
--  * acesso_total: vê tudo e pode validar tarefas (era fixo para Administrador e Gerente).
--  * sistema:      Administrador — não pode ser renomeado nem excluído (o código depende do nome).

create table if not exists cargo (
  nome          text primary key,
  cor           text not null default '#5B6472',
  ordem         int not null default 0,
  acesso_total  boolean not null default false,
  sistema       boolean not null default false,
  created_at    timestamptz not null default now()
);
alter table cargo enable row level security;  -- só a service role (rotas /api) mexe

insert into cargo (nome, cor, ordem, acesso_total, sistema) values
  ('Administrador',    '#8B3FB0', 0, true,  true),
  ('Gerente',          '#1B7F4D', 1, true,  false),
  ('Produção',         '#A4466A', 2, false, false),
  ('Expedição',        '#0E8FB0', 3, false, false),
  ('Líder (Loja)',     '#B07800', 4, false, false),
  ('Recursos Humanos', '#C2410C', 5, false, false)
on conflict (nome) do nothing;

-- Enum → texto ligado à tabela de cargos.
alter table usuarios        alter column cargo type text using cargo::text;
alter table cargo_acesso    alter column cargo type text using cargo::text;
alter table cargo_permissao alter column cargo type text using cargo::text;
drop type if exists cargo_usuario;

alter table usuarios drop constraint if exists usuarios_cargo_fk;
alter table usuarios add constraint usuarios_cargo_fk
  foreign key (cargo) references cargo(nome) on update cascade on delete restrict;
alter table cargo_acesso drop constraint if exists cargo_acesso_cargo_fk;
alter table cargo_acesso add constraint cargo_acesso_cargo_fk
  foreign key (cargo) references cargo(nome) on update cascade on delete cascade;
alter table cargo_permissao drop constraint if exists cargo_permissao_cargo_fk;
alter table cargo_permissao add constraint cargo_permissao_cargo_fk
  foreign key (cargo) references cargo(nome) on update cascade on delete cascade;

-- Renomear: a cascata cuida de usuários/acessos/escopo; os grupos internos guardam o nome em jsonb.
create or replace function public.renomear_cargo(antigo text, novo text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update cargo set nome = novo where nome = antigo and not sistema;
  if not found then raise exception 'Cargo não encontrado ou protegido.'; end if;
  update grupo_interno set visivel_cargos = (
    select coalesce(jsonb_agg(case when c = antigo then novo else c end), '[]'::jsonb)
    from jsonb_array_elements_text(visivel_cargos) as c
  ) where visivel_cargos ? antigo;
end $$;
revoke all on function public.renomear_cargo(text, text) from public, anon, authenticated;
grant execute on function public.renomear_cargo(text, text) to service_role;

-- Excluir: tira o cargo dos grupos internos (usuários bloqueiam a exclusão pela FK).
create or replace function public.excluir_cargo(alvo text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from usuarios where cargo = alvo) then raise exception 'Há pessoas com esse cargo.'; end if;
  delete from cargo where nome = alvo and not sistema;
  if not found then raise exception 'Cargo não encontrado ou protegido.'; end if;
  update grupo_interno set visivel_cargos = visivel_cargos - alvo where visivel_cargos ? alvo;
end $$;
revoke all on function public.excluir_cargo(text) from public, anon, authenticated;
grant execute on function public.excluir_cargo(text) to service_role;

-- O painel recarrega quando os cargos mudam.
drop trigger if exists trg_realtime_ping on public.cargo;
create trigger trg_realtime_ping after insert or update or delete on public.cargo
  for each statement execute function public.tg_realtime_ping();
