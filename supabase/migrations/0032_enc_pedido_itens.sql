-- Encomendas: o pedido vira um carrinho (um ou mais produtos).
-- itens = [{ produtoId, produtoNome, quantidade, preco, mensagem? }] — retrato do nome e do preço na hora do pedido.
-- Pedidos antigos ficam com itens = null e continuam valendo pelo produto_id/quantidade/mensagem.
-- produto_id/produto_nome passam a guardar o PRIMEIRO produto e quantidade o total de unidades.
alter table enc_pedido add column if not exists itens jsonb;

-- Busca "pedidos com o produto X" (ao excluir um produto do catálogo).
create index if not exists enc_pedido_itens_gin on enc_pedido using gin (itens jsonb_path_ops);
