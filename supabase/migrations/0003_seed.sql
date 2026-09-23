-- Seed mínimo de produção: workspace, permissões por cargo, unidades e o catálogo
-- de vagas. Pessoas entram pela tela Configurações → Pessoas (cria login no Auth).

insert into workspace (id, nome, logo, vagas_pagina) values (
  1, 'Ju Budelon', null,
  '{"titulo":"Trabalhe na Ju Budelon","subtitulo":"Estamos contratando AGORA!","tagline":"Junte-se ao time da Ju Budelon e cresça com a cozinha criativa mais querida da cidade","instagram":"jubudelon","pixelId":""}'::jsonb
) on conflict (id) do nothing;

-- Escopo próprio: Operacional só vê as próprias tarefas (mesmo default do app).
insert into cargo_permissao (cargo, escopo_proprio) values
  ('Head Operacional', false), ('Operacional', true), ('Recrutamento', false)
on conflict (cargo) do nothing;

-- Acessos padrão (mesmos de lib/acesso.ts): Head/Operacional → Tarefas; Recrutamento → Talentos e Vagas.
insert into cargo_acesso (cargo, page, permitido, pode_editar) values
  ('Head Operacional', 'listaview', true, true),
  ('Head Operacional', 'recrutamento-talentos', false, false),
  ('Head Operacional', 'recrutamento-vagas', false, false),
  ('Operacional', 'listaview', true, true),
  ('Operacional', 'recrutamento-talentos', false, false),
  ('Operacional', 'recrutamento-vagas', false, false),
  ('Recrutamento', 'listaview', false, false),
  ('Recrutamento', 'recrutamento-talentos', true, true),
  ('Recrutamento', 'recrutamento-vagas', true, true)
on conflict (cargo, page) do nothing;

-- Grupos internos
insert into grupo_interno (id, nome, descricao, setores, visivel_cargos) values
  ('g-operacional', 'Time Operacional', 'Gestores e operação do dia a dia', '["Operacional"]', '["Head Operacional","Operacional"]'),
  ('g-recrutamento', 'Recrutamento', 'Seleção e banco de talentos', '["Recrutamento"]', '["Recrutamento"]')
on conflict (id) do nothing;

-- Unidades
insert into unidade (id, slug, cidade, nome, ativa) values
  ('u-centro', 'florianopolis-centro', 'Florianópolis', 'Centro', true),
  ('u-kobrasol', 'sao-jose-kobrasol', 'São José', 'Kobrasol', true)
on conflict (id) do nothing;

-- Catálogo de vagas (os 11 cargos) na unidade principal, todas abertas.
insert into vaga (id, unidade_id, titulo, turno, ativa) values
  ('v-1',  'u-centro', 'Auxiliar de Cozinha/Confeitaria', '', true),
  ('v-2',  'u-centro', 'Auxiliar de Serviços Gerais (Limpeza)', '', true),
  ('v-3',  'u-centro', 'Auxiliar de Expedição', '', true),
  ('v-4',  'u-centro', 'Assistente Administrativo/Financeiro', '', true),
  ('v-5',  'u-centro', 'Estagiário Administrativo – 4h', '', true),
  ('v-6',  'u-centro', 'Analista de Marketing', '', true),
  ('v-7',  'u-centro', 'Analista de Recursos Humanos', '', true),
  ('v-8',  'u-centro', 'Assistente de Recursos Humanos', '', true),
  ('v-9',  'u-centro', 'Atendente de Cafeteria', '', true),
  ('v-10', 'u-centro', 'Líder de Produção', '', true),
  ('v-11', 'u-centro', 'Supervisora de Loja', '', true),
  ('v-12', 'u-kobrasol', 'Atendente de Cafeteria', 'Diurno', true),
  ('v-13', 'u-kobrasol', 'Auxiliar de Cozinha/Confeitaria', '', true)
on conflict (id) do nothing;
