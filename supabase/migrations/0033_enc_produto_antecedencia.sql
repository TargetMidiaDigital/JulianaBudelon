-- Encomendas: antecedência mínima por produto, em horas (null = vale a geral de Configurações, hoje 48 h).
-- Pode ser menor ou maior que a geral. Num pedido com vários produtos vale a maior. O antigo preparo_dias
-- continua respeitado; ao salvar o produto pela tela ele é convertido para horas.
alter table public.enc_produto
  add column if not exists antecedencia_horas integer
  check (antecedencia_horas is null or antecedencia_horas between 0 and 720);
