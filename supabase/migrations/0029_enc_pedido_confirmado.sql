-- Encomendas: novo status do pedido "Confirmado com o cliente", entre "Em fila" e "Em produção".
-- Só amplia a lista permitida; nenhum pedido existente muda.
alter table public.enc_pedido drop constraint if exists enc_pedido_status_check;
alter table public.enc_pedido add constraint enc_pedido_status_check
  check (status in ('Verificar pagamento', 'Em fila', 'Confirmado com o cliente', 'Em produção', 'Entregue'));
