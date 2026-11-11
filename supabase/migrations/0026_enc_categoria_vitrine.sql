-- Vitrine do autoatendimento: cada categoria vira um card na primeira tela da página do cliente.
--  * descricao: frase curta no card (ex.: "Servem de 15 a 20 fatias")
--  * foto:      capa do card (vazio = foto do primeiro produto da categoria)
--  * ativa:     false = categoria escondida da página (com os produtos dela)
--  * destaque:  card largo (ocupa a largura de dois) na vitrine
-- Os textos e a faixa de destaque da vitrine ficam em enc_config.dados.vitrine (JSON, sem coluna).

alter table enc_categoria add column if not exists descricao text;
alter table enc_categoria add column if not exists foto      text;
alter table enc_categoria add column if not exists ativa     boolean not null default true;
alter table enc_categoria add column if not exists destaque  boolean not null default false;
