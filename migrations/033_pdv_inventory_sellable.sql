-- Migration 033: PDV interno — marcar itens do estoque como vendáveis ao paciente
-- Adiciona campos para diferenciar:
--   inventory_items.price       → custo do item (já existia, semântica preservada)
--   inventory_items.sale_price  → preço de venda ao paciente (novo, em centavos)
--   inventory_items.is_sellable → flag indicando se o item aparece no PDV (novo)
--
-- Vendas usam:
--   inventory_transactions  → type='saída', registra o decremento de estoque
--   box_transactions        → type='deposit', referenceType='product_sale', registra a entrada de caixa
-- Não há tabela nova de pedidos: 1 venda = 1 box_transaction (cabeçalho) + N inventory_transactions (itens).
-- O vínculo entre as duas se faz via box_transactions.reference_id apontando para o lote de transactions
-- (registramos o reference_id da box_transaction nas inventory_transactions de cada item).

BEGIN;

ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS sale_price INTEGER,
  ADD COLUMN IF NOT EXISTS is_sellable BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN inventory_items.sale_price IS
  'Preço de venda ao paciente em centavos. Distinto de price (custo de aquisição).';
COMMENT ON COLUMN inventory_items.is_sellable IS
  'Quando TRUE o item aparece no PDV interno (POS) do caixa.';

-- Index parcial para acelerar a busca de produtos vendáveis no PDV.
CREATE INDEX IF NOT EXISTS idx_inventory_items_sellable
  ON inventory_items (company_id, name)
  WHERE is_sellable = TRUE AND active = TRUE AND deleted_at IS NULL;

COMMIT;
