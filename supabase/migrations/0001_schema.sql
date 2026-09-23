-- Ju Budelon — schema inicial (fase 2: Supabase)
-- Derivado do sistema da Target Mídia Digital, só com as tabelas que as telas usam:
-- Login/Pessoas/Acessos/Grupos (Configurações), Operacional → Tarefas e
-- Recrutamento → Banco de Talentos + Vagas (unidades + vagas + página pública).
--
-- Convenções (iguais às da Target):
--  - IDs como slugs TEXT, para casar com os ids já usados no app.
--  - Status/prioridade como TEXT + check, com os MESMOS literais do app (lib/types.ts),
--    para não precisar traduzir na leitura (a Target usa enums com nomes diferentes).
--  - RLS ligado em todas as tabelas, sem policies: só o service role (servidor) acessa.

-- ───────────────────────── Cargos ─────────────────────────
create type cargo_usuario as enum ('Administrador', 'Head Operacional', 'Operacional', 'Recrutamento');

-- ───────────────────────── Espaço de trabalho (linha única) ─────────────────────────
create table workspace (
  id            int primary key default 1 check (id = 1),
  nome          text not null default 'Ju Budelon',
  logo          text,                       -- URL ou data-URL; vazio → /logo-2.png
  vagas_pagina  jsonb,                      -- { titulo, subtitulo, tagline, instagram, pixelId }
  updated_at    timestamptz not null default now()
);

-- ───────────────────────── Usuários (equipe) ─────────────────────────
-- `email` é o vínculo com auth.users (Supabase Auth). Ter linha aqui = ser da equipe.
create table usuarios (
  id                text primary key,        -- slug (ex.: "ju", "marina")
  nome              text not null,
  email             text unique,
  cargo             cargo_usuario not null,
  ini               text,
  cor               text,
  foto              text,                    -- URL (bucket avatars)
  whatsapp          text,
  whatsapp_interno  text,
  ativo             boolean not null default true,
  created_at        timestamptz not null default now()
);

-- ───────────────────────── Acessos por cargo (Configurações → Acessos) ─────────────────────────
-- Ausência de linha = "editar" (default aberto, mesmo padrão da Target).
create table cargo_acesso (
  cargo        cargo_usuario not null,
  page         text not null,               -- ScreenPage: listaview | recrutamento-talentos | recrutamento-vagas
  permitido    boolean not null default true,
  pode_editar  boolean not null default true,
  primary key (cargo, page)
);
create table cargo_permissao (
  cargo           cargo_usuario primary key,
  escopo_proprio  boolean not null default false   -- só vê as tarefas sob sua responsabilidade
);

-- ───────────────────────── Grupos internos (Configurações → Grupos) ─────────────────────────
create table grupo_interno (
  id              text primary key,
  nome            text not null,
  descricao       text,
  setores         jsonb not null default '[]'::jsonb,   -- ["Operacional","Recrutamento"]
  visivel_cargos  jsonb not null default '[]'::jsonb,   -- cargos que veem (Administrador implícito)
  logo            text,
  created_at      timestamptz not null default now()
);

-- ───────────────────────── Tarefas (Operacional) ─────────────────────────
create table tarefas (
  id                  text primary key,
  nome                text not null,
  status              text not null check (status in ('verificar', 'em andamento', 'atrasada', 'concluida', 'validada')),
  urgencia            text not null check (urgencia in ('urgente', 'alta', 'normal', 'baixa')),
  responsavel         text references usuarios(id),
  tipo                text,
  categoria           text not null default 'operacional',
  parent_id           text references tarefas(id) on delete cascade,   -- subtarefa (reservado)
  descricao           text,                                           -- HTML rico
  ultimos_comentarios jsonb not null default '[]'::jsonb,             -- Comentario[]
  criada_em           timestamptz,
  vence_em            timestamptz,
  atualizada_em       timestamptz,                                    -- trigger (0002)
  -- Recorrência (estilo ClickUp): a tarefa é a âncora; um job diário gera a próxima.
  rec_ativa           boolean not null default false,
  rec_freq            text check (rec_freq is null or rec_freq in ('diaria', 'semanal', 'mensal')),
  rec_dia_semana      smallint,                                       -- 0..6 (dom..sáb)
  rec_dia_mes         smallint,                                       -- 1..31
  rec_prazo_dias      smallint not null default 0,
  rec_modo            text not null default 'novo' check (rec_modo in ('novo', 'reagendar')),
  rec_proxima         date,
  created_at          timestamptz not null default now()
);
create index idx_tarefas_responsavel on tarefas(responsavel);
create index idx_tarefas_status on tarefas(status);
create index idx_tarefas_rec on tarefas(rec_ativa, rec_proxima);

-- ───────────────────────── Recrutamento: unidades e vagas ─────────────────────────
create table unidade (
  id      text primary key,
  slug    text not null unique,             -- URL pública: /vagas/<slug>
  cidade  text,
  nome    text not null,
  ativa   boolean not null default true,    -- pausada some do hub (a URL segue abrindo com aviso)
  criada  timestamptz not null default now()
);

create table vaga (
  id          text primary key,
  unidade_id  text not null references unidade(id) on delete cascade,
  titulo      text not null,
  turno       text not null default '' check (turno in ('', 'Diurno', 'Noturno')),
  descricao   text,                         -- uso interno
  ativa       boolean not null default true,
  criada      timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index idx_vaga_unidade on vaga(unidade_id);

-- ───────────────────────── Recrutamento: candidatos ─────────────────────────
create table talento (
  id                  text primary key,
  nome                text not null,
  status              text,                 -- novo / banco de talentos / qualificado / reunião agendada / desqualificado / contratado / antigos
  vaga                text,                 -- título (exibição/filtro)
  vaga_id             text references vaga(id) on delete set null,
  unidade_id          text references unidade(id) on delete set null,
  turno               text,
  origem              text,                 -- 'linkbio' (página pública) | 'manual'
  fone                text,                 -- canônico 55+DDD+9
  qualidade           text,                 -- Aguardando Análise / Ruim / Bom / Ótimo
  criada              timestamptz,
  ultimos_comentarios jsonb not null default '[]'::jsonb,
  anexos              jsonb not null default '[]'::jsonb,   -- [{ id, nome, url, mime, tamanho, criadoEm, autor }]
  updated_at          timestamptz not null default now()
);
create index idx_talento_status on talento(status);
create index idx_talento_unidade on talento(unidade_id);
create index idx_talento_fone_criada on talento(fone, criada);   -- limite anti-abuso da candidatura pública

-- ───────────────────────── RLS ─────────────────────────
alter table workspace       enable row level security;
alter table usuarios        enable row level security;
alter table cargo_acesso    enable row level security;
alter table cargo_permissao enable row level security;
alter table grupo_interno   enable row level security;
alter table tarefas         enable row level security;
alter table unidade         enable row level security;
alter table vaga            enable row level security;
alter table talento         enable row level security;
