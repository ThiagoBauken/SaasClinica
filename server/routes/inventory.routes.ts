/**
 * Inventory Routes — /api/inventory/*
 *
 * Manages inventory categories, items, transactions, and seed data
 * for the dental clinic's supply tracking system.
 */
import { Router } from 'express';
import { storage } from '../storage';
import { authCheck, asyncHandler } from '../middleware/auth';
import { tenantIsolationMiddleware } from '../tenantMiddleware';
import { logger } from '../logger';

const router = Router();

// =====================================================
// INVENTORY CATEGORIES
// =====================================================

/**
 * GET /api/inventory/categories
 * Returns all inventory categories for the current tenant.
 */
router.get(
  '/categories',
  authCheck,
  tenantIsolationMiddleware,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const categories = await storage.getInventoryCategories(user.companyId);
    res.json(categories);
  })
);

/**
 * POST /api/inventory/categories
 * Creates a new inventory category.
 */
router.post(
  '/categories',
  authCheck,
  tenantIsolationMiddleware,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const categoryData = { ...req.body, companyId: user.companyId };
    const category = await storage.createInventoryCategory(categoryData);
    res.status(201).json(category);
  })
);

/**
 * PATCH /api/inventory/categories/:id
 * Updates an inventory category.
 */
router.patch(
  '/categories/:id',
  authCheck,
  tenantIsolationMiddleware,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const categoryId = parseInt(req.params.id);
    const category = await storage.updateInventoryCategory(categoryId, req.body, user.companyId);
    res.json(category);
  })
);

// =====================================================
// INVENTORY ITEMS
// =====================================================

/**
 * GET /api/inventory/items
 * Returns all inventory items for the current tenant.
 */
router.get(
  '/items',
  authCheck,
  tenantIsolationMiddleware,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const items = await storage.getInventoryItems(user.companyId);
    res.json(items);
  })
);

/**
 * POST /api/inventory/items
 * Creates a new inventory item.
 */
router.post(
  '/items',
  authCheck,
  tenantIsolationMiddleware,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const itemData = { ...req.body, companyId: user.companyId };
    const item = await storage.createInventoryItem(itemData);
    res.status(201).json(item);
  })
);

/**
 * PATCH /api/inventory/items/:id
 * Updates an inventory item.
 */
router.patch(
  '/items/:id',
  authCheck,
  tenantIsolationMiddleware,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const itemId = parseInt(req.params.id);
    const item = await storage.updateInventoryItem(itemId, req.body, user.companyId);
    res.json(item);
  })
);

/**
 * DELETE /api/inventory/items/:id
 * Removes an inventory item.
 */
router.delete(
  '/items/:id',
  authCheck,
  tenantIsolationMiddleware,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const itemId = parseInt(req.params.id);
    await storage.deleteInventoryItem(itemId, user.companyId);
    res.status(204).send();
  })
);

// =====================================================
// INVENTORY TRANSACTIONS
// =====================================================

/**
 * GET /api/inventory/transactions
 * Returns inventory movement transactions, optionally filtered by item.
 */
router.get(
  '/transactions',
  authCheck,
  tenantIsolationMiddleware,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const itemId = req.query.itemId ? parseInt(req.query.itemId as string) : undefined;
    const transactions = await storage.getInventoryTransactions(user.companyId, itemId);
    res.json(transactions);
  })
);

/**
 * POST /api/inventory/transactions
 * Creates an inventory transaction (entrada/saída/ajuste) and updates stock level.
 */
router.post(
  '/transactions',
  authCheck,
  tenantIsolationMiddleware,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const transactionData = { ...req.body, userId: user.id };

    const items = await storage.getInventoryItems(user.companyId);
    const item = items.find((i: any) => i.id === transactionData.itemId);

    if (!item) {
      return res.status(404).json({ error: 'Item não encontrado' });
    }

    const previousStock = item.currentStock;
    const quantity = parseInt(transactionData.quantity);
    const type = transactionData.type;

    let newStock = previousStock;
    if (type === 'entrada') {
      newStock = previousStock + quantity;
    } else if (type === 'saida') {
      newStock = previousStock - quantity;
      if (newStock < 0) {
        return res.status(400).json({ error: 'Estoque insuficiente' });
      }
    } else if (type === 'ajuste') {
      newStock = quantity;
    }

    transactionData.previousStock = previousStock;
    transactionData.newStock = newStock;

    const transaction = await storage.createInventoryTransaction(transactionData);
    await storage.updateInventoryItem(transactionData.itemId, { currentStock: newStock }, user.companyId);

    res.status(201).json(transaction);
  })
);

// =====================================================
// STANDARD PRODUCTS & SEED DATA
// =====================================================

/**
 * GET /api/inventory/standard-products
 * Returns the list of standard dental products available for import.
 */
router.get(
  '/standard-products',
  authCheck,
  asyncHandler(async (req, res) => {
    const products = await storage.getStandardDentalProducts();
    res.json(products);
  })
);

/**
 * POST /api/inventory/import-standard
 * Imports selected standard dental products into the tenant's inventory.
 */
router.post(
  '/import-standard',
  authCheck,
  tenantIsolationMiddleware,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { productIds } = req.body;

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ error: 'Lista de produtos inválida' });
    }

    const importedItems = await storage.importStandardProducts(productIds, user.companyId);
    res.status(201).json(importedItems);
  })
);

/**
 * GET /api/inventory/seed-defaults
 * Returns available seed category/item data that can be selectively imported.
 */
router.get(
  '/seed-defaults',
  authCheck,
  asyncHandler(async (req, res) => {
    const seedData = storage.getInventorySeedData();
    res.json(seedData);
  })
);

/**
 * POST /api/inventory/seed-defaults
 * Seeds the tenant's inventory with default dental clinic data.
 */
router.post(
  '/seed-defaults',
  authCheck,
  tenantIsolationMiddleware,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { categoryNames, itemsByCategory } = req.body;

    const selection =
      categoryNames && categoryNames.length > 0 ? { categoryNames, itemsByCategory } : undefined;

    const result = await storage.seedInventoryDefaults(user.companyId, selection);
    res.status(201).json({
      message: 'Estoque populado com dados padrão de clínica odontológica',
      categoriesCreated: result.categories.length,
      itemsCreated: result.items.length,
      categories: result.categories,
      items: result.items,
    });
  })
);

export default router;
