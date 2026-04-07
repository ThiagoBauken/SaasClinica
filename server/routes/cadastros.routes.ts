/**
 * Cadastros Routes — /api/cadastros/*
 *
 * Manages reference data: financial categories, cash boxes, and dental
 * chairs. These are global (non-tenant-isolated) configuration tables.
 */
import { Router } from 'express';
import { db } from '../db';
import { authCheck, asyncHandler } from '../middleware/auth';

const router = Router();

// =====================================================
// FINANCIAL CATEGORIES
// =====================================================

/**
 * GET /api/cadastros/categories
 * Returns all financial categories ordered by name.
 */
router.get(
  '/categories',
  authCheck,
  asyncHandler(async (req, res) => {
    const result = await db.$client.query(`SELECT * FROM financial_categories ORDER BY name`);
    res.json(result.rows);
  })
);

/**
 * POST /api/cadastros/categories
 * Creates a new financial category.
 */
router.post(
  '/categories',
  authCheck,
  asyncHandler(async (req, res) => {
    const { name, type } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });

    const result = await db.$client.query(
      `INSERT INTO financial_categories (name, type) VALUES ($1, $2) RETURNING *`,
      [name, type || 'expense']
    );
    res.json(result.rows[0]);
  })
);

/**
 * PATCH /api/cadastros/categories/:id
 * Updates a financial category.
 */
router.patch(
  '/categories/:id',
  authCheck,
  asyncHandler(async (req, res) => {
    const { name, type } = req.body;
    const result = await db.$client.query(
      `UPDATE financial_categories
       SET name = COALESCE($1, name), type = COALESCE($2, type)
       WHERE id = $3
       RETURNING *`,
      [name, type, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Categoria não encontrada' });
    res.json(result.rows[0]);
  })
);

/**
 * DELETE /api/cadastros/categories/:id
 * Removes a financial category.
 */
router.delete(
  '/categories/:id',
  authCheck,
  asyncHandler(async (req, res) => {
    await db.$client.query(`DELETE FROM financial_categories WHERE id = $1`, [req.params.id]);
    res.status(204).send();
  })
);

// =====================================================
// BOXES (Caixas)
// =====================================================

/**
 * GET /api/cadastros/boxes
 * Returns all cash box records ordered by name.
 */
router.get(
  '/boxes',
  authCheck,
  asyncHandler(async (req, res) => {
    const result = await db.$client.query(`SELECT * FROM boxes ORDER BY name`);
    res.json(result.rows);
  })
);

/**
 * POST /api/cadastros/boxes
 * Creates a new cash box.
 */
router.post(
  '/boxes',
  authCheck,
  asyncHandler(async (req, res) => {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });

    const result = await db.$client.query(
      `INSERT INTO boxes (name, description) VALUES ($1, $2) RETURNING *`,
      [name, description || null]
    );
    res.json(result.rows[0]);
  })
);

/**
 * PATCH /api/cadastros/boxes/:id
 * Updates a cash box.
 */
router.patch(
  '/boxes/:id',
  authCheck,
  asyncHandler(async (req, res) => {
    const { name, description } = req.body;
    const result = await db.$client.query(
      `UPDATE boxes
       SET name = COALESCE($1, name), description = COALESCE($2, description)
       WHERE id = $3
       RETURNING *`,
      [name, description, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Caixa não encontrada' });
    res.json(result.rows[0]);
  })
);

/**
 * DELETE /api/cadastros/boxes/:id
 * Removes a cash box.
 */
router.delete(
  '/boxes/:id',
  authCheck,
  asyncHandler(async (req, res) => {
    await db.$client.query(`DELETE FROM boxes WHERE id = $1`, [req.params.id]);
    res.status(204).send();
  })
);

// =====================================================
// CHAIRS (Cadeiras)
// =====================================================

/**
 * GET /api/cadastros/chairs
 * Returns all dental chair records ordered by name.
 */
router.get(
  '/chairs',
  authCheck,
  asyncHandler(async (req, res) => {
    const result = await db.$client.query(`SELECT * FROM chairs ORDER BY name`);
    res.json(result.rows);
  })
);

/**
 * POST /api/cadastros/chairs
 * Creates a new dental chair record.
 */
router.post(
  '/chairs',
  authCheck,
  asyncHandler(async (req, res) => {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });

    const result = await db.$client.query(
      `INSERT INTO chairs (name, description) VALUES ($1, $2) RETURNING *`,
      [name, description || null]
    );
    res.json(result.rows[0]);
  })
);

/**
 * PATCH /api/cadastros/chairs/:id
 * Updates a dental chair record.
 */
router.patch(
  '/chairs/:id',
  authCheck,
  asyncHandler(async (req, res) => {
    const { name, description } = req.body;
    const result = await db.$client.query(
      `UPDATE chairs
       SET name = COALESCE($1, name), description = COALESCE($2, description)
       WHERE id = $3
       RETURNING *`,
      [name, description, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Cadeira não encontrada' });
    res.json(result.rows[0]);
  })
);

/**
 * DELETE /api/cadastros/chairs/:id
 * Removes a dental chair record.
 */
router.delete(
  '/chairs/:id',
  authCheck,
  asyncHandler(async (req, res) => {
    await db.$client.query(`DELETE FROM chairs WHERE id = $1`, [req.params.id]);
    res.status(204).send();
  })
);

export default router;
