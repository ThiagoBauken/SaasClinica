-- Migration 034: remoção da tabela shop_items
--
-- Contexto: shop_items foi criada em 2025-05-22 como esqueleto de uma feature
-- "Loja Online" que nunca chegou a ser implementada (zero rotas, zero serviços,
-- zero UI). Permaneceu no schema arrastada por sweeps de RLS e segurança.
--
-- Em 2026-04-29 foi entregue o PDV interno (commits ffe9d87 + e3a5c27) que
-- implementa o caso de uso "vender produto ao paciente no balcão" diretamente
-- sobre inventory_items (com flags is_sellable + sale_price), tornando a
-- tabela shop_items definitivamente obsoleta.
--
-- Esta migração é DESTRUTIVA — drop de dados. Em produção, qualquer empresa
-- que por acaso tenha cadastrado linhas em shop_items (improvável, dado que
-- nunca houve UI/API para inserir) perderá esses dados. Antes de aplicar em
-- prod, recomendado rodar:
--   SELECT count(*), company_id FROM shop_items GROUP BY company_id;
-- e fazer dump das linhas se houver.
--
-- O CASCADE remove automaticamente:
--   - constraint shop_items_inventory_item_id_inventory_items_id_fk
--   - constraint shop_items_category_id_inventory_categories_id_fk
--   - índice idx_shop_items_company (criado em 017_comprehensive_security_audit.sql)
--   - políticas RLS criadas em 022a/023b
-- sem afetar inventory_items, inventory_categories ou companies.

BEGIN;

DROP TABLE IF EXISTS shop_items CASCADE;

COMMIT;
