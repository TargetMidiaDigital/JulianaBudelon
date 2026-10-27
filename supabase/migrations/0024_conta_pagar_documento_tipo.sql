-- Contas a Pagar: número do documento (NF, boleto, contrato…) e tipo de despesa (Variável / Fixa).
-- Só adiciona colunas; contas já lançadas ficam com os dois campos vazios.
alter table conta_pagar add column if not exists numero_documento text;
alter table conta_pagar add column if not exists tipo_despesa text;
alter table conta_pagar drop constraint if exists conta_pagar_tipo_despesa_check;
alter table conta_pagar add constraint conta_pagar_tipo_despesa_check check (tipo_despesa is null or tipo_despesa in ('variavel', 'fixa'));
