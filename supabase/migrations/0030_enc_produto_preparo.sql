-- Encomendas: tempo mínimo de preparo por produto, em dias (0 = vale só a antecedência geral da configuração).
-- Ex.: 2 → pedido feito hoje só pode ser para depois de amanhã em diante. O calendário do autoatendimento
-- e o servidor (validarNovoPedido) respeitam esse prazo.
alter table public.enc_produto
  add column if not exists preparo_dias integer not null default 0
  check (preparo_dias between 0 and 60);
