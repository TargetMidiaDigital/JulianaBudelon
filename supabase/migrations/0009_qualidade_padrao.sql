-- Qualidade do candidato nunca fica vazia: sem análise da IA = "Aguardando Análise".
-- A IA grava Ruim / Bom / Ótimo ao analisar; a equipe pode trocar depois.
update talento set qualidade = 'Aguardando Análise' where coalesce(qualidade, '') = '';
alter table talento alter column qualidade set default 'Aguardando Análise';
