-- Encomendas: novo status do pedido "Pronto para retirada", entre "Em produção" e "Entregue".
-- O pedido chega nele sozinho quando a loja marca a encomenda como Recebido (Lojas → Encomendas);
-- e vai para "Entregue" quando a loja marca Entregue. Só amplia a lista; nenhum pedido muda.
alter table public.enc_pedido drop constraint if exists enc_pedido_status_check;
alter table public.enc_pedido add constraint enc_pedido_status_check
  check (status in ('Verificar pagamento', 'Confirmado com o cliente', 'Em produção', 'Pronto para retirada', 'Entregue'));
