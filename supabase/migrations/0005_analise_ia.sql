-- Análise de currículo por IA (Recrutamento → Banco de Talentos).
--
-- talento: resultado da análise (resumo + classificação candidato × vaga). `analise` guarda o
-- JSON completo (resumo, experiência, pontos fortes, alertas, lacunas, justificativa, modelo,
-- vaga analisada); `nota_ia` / `qualidade_ia` são colunas próprias para ordenar e filtrar em SQL.
-- A "qualidade" (decisão humana) só é preenchida pela IA enquanto estiver em "Aguardando Análise".
alter table talento
  add column if not exists resumo        text,
  add column if not exists analise       jsonb,
  add column if not exists nota_ia       smallint check (nota_ia is null or (nota_ia between 0 and 100)),
  add column if not exists qualidade_ia  text check (qualidade_ia is null or qualidade_ia in ('Ótimo', 'Bom', 'Ruim')),
  add column if not exists analisado_em  timestamptz,
  add column if not exists analise_erro  text;

create index if not exists idx_talento_nota_ia on talento(nota_ia desc nulls last);

-- vaga: descrição estruturada, base da classificação (o que a IA compara com o currículo).
alter table vaga
  add column if not exists requisitos   text,   -- obrigatórios (um por linha)
  add column if not exists diferenciais text;   -- desejáveis (um por linha)
