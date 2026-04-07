/**
 * FAQ / AI Training Routes
 *
 * Manages the FAQ knowledge base stored in canned_responses.
 * These entries feed the AI chatbot for intent matching and auto-reply.
 *
 * Endpoints:
 *   GET    /api/v1/faq          - List active FAQs for the tenant
 *   POST   /api/v1/faq          - Create a new FAQ entry
 *   PATCH  /api/v1/faq/:id      - Update an existing FAQ entry
 *   DELETE /api/v1/faq/:id      - Soft-delete (set is_active = false)
 */

import { Router } from 'express';
import { db } from '../db';
import { tenantAwareAuth, asyncHandler } from '../middleware/auth';
import { logger } from '../logger';

const router = Router();
const log = logger.child({ module: 'faq-routes' });

// ============================================================
// GET /api/v1/faq
// List all active FAQ entries for the authenticated company
// ============================================================
router.get(
  '/',
  tenantAwareAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId: number = user.companyId;

    // Optional: filter by intent prefix
    const { intent } = req.query;

    const params: any[] = [companyId];
    let intentClause = '';
    if (intent) {
      params.push(`${intent}%`);
      intentClause = ` AND intent LIKE $${params.length}`;
    }

    const result = await db.$client.query(
      `SELECT id, intent, template AS answer, variables, priority, is_active, created_at, updated_at
       FROM canned_responses
       WHERE company_id = $1 AND is_active = true${intentClause}
       ORDER BY priority DESC, id ASC`,
      params,
    );

    res.json({
      success: true,
      data: result.rows.map((row: any) => ({
        id: row.id,
        intent: row.intent,
        // Expose the question stored inside the variables JSON
        question: row.variables?.question ?? null,
        answer: row.answer,
        priority: row.priority,
        isActive: row.is_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    });
  }),
);

// ============================================================
// POST /api/v1/faq
// Create a new FAQ entry
// ============================================================
router.post(
  '/',
  tenantAwareAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId: number = user.companyId;
    const { intent, question, answer, priority } = req.body;

    if (!intent || !answer) {
      return res.status(400).json({
        error: 'Validation failed',
        message: '"intent" e "answer" sao obrigatorios.',
      });
    }

    const result = await db.$client.query(
      `INSERT INTO canned_responses (company_id, intent, template, variables, is_active, priority)
       VALUES ($1, $2, $3, $4, true, $5)
       RETURNING id, intent, template AS answer, variables, priority, is_active, created_at`,
      [companyId, intent, answer, JSON.stringify({ question: question ?? '' }), priority ?? 0],
    );

    const row = result.rows[0];
    log.info({ companyId, intent, id: row.id }, 'FAQ entry created');

    res.status(201).json({
      success: true,
      data: {
        id: row.id,
        intent: row.intent,
        question: row.variables?.question ?? null,
        answer: row.answer,
        priority: row.priority,
        isActive: row.is_active,
        createdAt: row.created_at,
      },
    });
  }),
);

// ============================================================
// PATCH /api/v1/faq/:id
// Update an existing FAQ entry (partial update)
// ============================================================
router.patch(
  '/:id',
  tenantAwareAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId: number = user.companyId;
    const faqId = parseInt(req.params.id, 10);

    if (isNaN(faqId)) {
      return res.status(400).json({ error: 'ID invalido' });
    }

    const { intent, question, answer, priority, isActive } = req.body;

    // Build the variables JSON only when question is explicitly provided
    const variablesValue = question !== undefined ? JSON.stringify({ question }) : null;

    const result = await db.$client.query(
      `UPDATE canned_responses SET
         intent     = COALESCE($3, intent),
         template   = COALESCE($4, template),
         variables  = COALESCE($5::jsonb, variables),
         priority   = COALESCE($6, priority),
         is_active  = COALESCE($7, is_active),
         updated_at = NOW()
       WHERE id = $1 AND company_id = $2
       RETURNING id, intent, template AS answer, variables, priority, is_active, updated_at`,
      [faqId, companyId, intent ?? null, answer ?? null, variablesValue, priority ?? null, isActive ?? null],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'FAQ nao encontrado ou sem permissao' });
    }

    const row = result.rows[0];
    log.info({ companyId, faqId }, 'FAQ entry updated');

    res.json({
      success: true,
      data: {
        id: row.id,
        intent: row.intent,
        question: row.variables?.question ?? null,
        answer: row.answer,
        priority: row.priority,
        isActive: row.is_active,
        updatedAt: row.updated_at,
      },
    });
  }),
);

// ============================================================
// DELETE /api/v1/faq/:id
// Soft-delete: sets is_active = false
// ============================================================
router.delete(
  '/:id',
  tenantAwareAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId: number = user.companyId;
    const faqId = parseInt(req.params.id, 10);

    if (isNaN(faqId)) {
      return res.status(400).json({ error: 'ID invalido' });
    }

    const result = await db.$client.query(
      `UPDATE canned_responses
       SET is_active = false, updated_at = NOW()
       WHERE id = $1 AND company_id = $2
       RETURNING id`,
      [faqId, companyId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'FAQ nao encontrado ou sem permissao' });
    }

    log.info({ companyId, faqId }, 'FAQ entry soft-deleted');
    res.status(204).send();
  }),
);

export default router;
