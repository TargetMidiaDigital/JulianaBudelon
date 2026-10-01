-- Estoque por local: a quantidade única vira um jsonb { fabrica, centro, santa-monica,
-- coqueiros, areias, rocado, pagani } (ids de LOCAIS_ESTOQUE em lib/estoque.ts).
-- O estoque é zerado de propósito (pedido da Ju em 30/09/2026): a contagem começa do zero.
alter table produto add column if not exists estoque jsonb not null default '{}'::jsonb;
alter table produto drop column if exists quantidade;
