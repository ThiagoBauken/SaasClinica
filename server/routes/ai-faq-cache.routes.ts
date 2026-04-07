/**
 * AI FAQ Cache Routes (admin-only)
 *
 * CRUD for `ai_faq_cache` entries. Hits served by `lookupFaqCache()` in
 * server/services/ai-agent/faq-cache.ts BEFORE calling the LLM — each
 * match saves a Claude call (0 tokens, ~5ms latency).
 *
 * Endpoints:
 *   GET    /api/v1/ai-faq-cache          - List entries for the tenant
 *   GET    /api/v1/ai-faq-cache/stats    - Summary: total, hits, top 10
 *   POST   /api/v1/ai-faq-cache          - Create/upsert entry
 *   PATCH  /api/v1/ai-faq-cache/:id      - Update text / toggle enabled
 *   DELETE /api/v1/ai-faq-cache/:id      - Hard delete
 *   POST   /api/v1/ai-faq-cache/test     - Dry-run lookup (admin tool)
 *
 * Auth: requires `tenantAwareAuth` + admin role (curator responsibility).
 * Rows are tenant-isolated by `company_id = req.user.companyId`.
 */

import { Router } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { tenantAwareAuth, adminOnly, asyncHandler } from '../middleware/auth';
import { logger } from '../logger';
import {
  lookupFaqCache,
  upsertFaqEntry,
  clearFaqCache,
  normalizeQuery,
  hashQuery,
} from '../services/ai-agent/faq-cache';

const router = Router();
const log = logger.child({ module: 'ai-faq-cache-routes' });

// All routes require authentication + admin role
router.use(tenantAwareAuth, adminOnly);

// ============================================================
// GET /api/v1/ai-faq-cache
// List entries for the current tenant. Pagination + filter by source/enabled.
// ============================================================
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const companyId: number = (req.user as any).companyId;
    const limit = Math.min(parseInt((req.query.limit as string) || '50', 10) || 50, 500);
    const offset = Math.max(parseInt((req.query.offset as string) || '0', 10) || 0, 0);
    const source = req.query.source as string | undefined;
    const enabledFilter = req.query.enabled as string | undefined;

    const conditions: any[] = [sql`company_id = ${companyId}`];
    if (source && ['manual', 'auto', 'system'].includes(source)) {
      conditions.push(sql`source = ${source}`);
    }
    if (enabledFilter === 'true') conditions.push(sql`enabled = TRUE`);
    if (enabledFilter === 'false') conditions.push(sql`enabled = FALSE`);

    const whereClause = conditions.reduce(
      (acc, cond, idx) => (idx === 0 ? cond : sql`${acc} AND ${cond}`),
      sql``,
    );

    const result = await db.execute(sql`
      SELECT id, query_sample, response_text, source, enabled, hit_count,
             last_hit_at, created_at, updated_at
        FROM ai_faq_cache
       WHERE ${whereClause}
       ORDER BY hit_count DESC, updated_at DESC
       LIMIT ${limit} OFFSET ${offset}
    `);

    const countResult = await db.execute(sql`
      SELECT COUNT(*)::int AS total FROM ai_faq_cache WHERE ${whereClause}
    `);

    const rows = (result as any).rows || result;
    const total = ((countResult as any).rows || countResult)[0]?.total || 0;

    res.json({ entries: rows, total, limit, offset });
  }),
);

// ============================================================
// GET /api/v1/ai-faq-cache/stats
// Summary for the admin dashboard.
// ============================================================
router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const companyId: number = (req.user as any).companyId;

    const overview = await db.execute(sql`
      SELECT
        COUNT(*)::int                                    AS total_entries,
        COUNT(*) FILTER (WHERE enabled = TRUE)::int      AS enabled_entries,
        COALESCE(SUM(hit_count), 0)::bigint              AS total_hits,
        COUNT(*) FILTER (WHERE source = 'manual')::int   AS manual_count,
        COUNT(*) FILTER (WHERE source = 'auto')::int     AS auto_count
        FROM ai_faq_cache
       WHERE company_id = ${companyId}
    `);

    const topEntries = await db.execute(sql`
      SELECT id, query_sample, hit_count, last_hit_at, enabled
        FROM ai_faq_cache
       WHERE company_id = ${companyId}
       ORDER BY hit_count DESC
       LIMIT 10
    `);

    const overviewRow = ((overview as any).rows || overview)[0] || {};
    const topRows = (topEntries as any).rows || topEntries;

    res.json({
      overview: {
        totalEntries: overviewRow.total_entries || 0,
        enabledEntries: overviewRow.enabled_entries || 0,
        totalHits: Number(overviewRow.total_hits || 0),
        manualCount: overviewRow.manual_count || 0,
        autoCount: overviewRow.auto_count || 0,
      },
      topEntries: topRows,
    });
  }),
);

// ============================================================
// POST /api/v1/ai-faq-cache
// Create or upsert an entry (idempotent via unique constraint)
// Body: { query: string, response: string, source?: 'manual' | 'system' }
// ============================================================
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const companyId: number = (req.user as any).companyId;
    const { query, response, source } = req.body ?? {};

    if (typeof query !== 'string' || query.trim().length < 2) {
      return res.status(400).json({ error: 'query must be a non-empty string (>= 2 chars)' });
    }
    if (typeof response !== 'string' || response.trim().length < 1) {
      return res.status(400).json({ error: 'response must be a non-empty string' });
    }
    if (query.length > 500) {
      return res.status(400).json({ error: 'query too long (max 500 chars)' });
    }
    if (response.length > 4000) {
      return res.status(400).json({ error: 'response too long (max 4000 chars)' });
    }
    const resolvedSource: 'manual' | 'system' =
      source === 'system' ? 'system' : 'manual';

    const id = await upsertFaqEntry(companyId, query, response, resolvedSource);
    if (!id) {
      return res.status(500).json({ error: 'Failed to upsert FAQ entry' });
    }

    log.info({ companyId, id, source: resolvedSource }, 'FAQ entry upserted by admin');
    res.status(201).json({ id, query, response, source: resolvedSource, enabled: true });
  }),
);

// ============================================================
// PATCH /api/v1/ai-faq-cache/:id
// Update response text or toggle enabled flag.
// Body: { response?: string, enabled?: boolean }
// ============================================================
router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const companyId: number = (req.user as any).companyId;
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const { response, enabled } = req.body ?? {};
    const sets: any[] = [];

    if (typeof response === 'string') {
      if (response.length < 1 || response.length > 4000) {
        return res.status(400).json({ error: 'response must be 1..4000 chars' });
      }
      sets.push(sql`response_text = ${response}`);
    }
    if (typeof enabled === 'boolean') {
      sets.push(sql`enabled = ${enabled}`);
    }

    if (sets.length === 0) {
      return res.status(400).json({ error: 'Nothing to update. Provide `response` and/or `enabled`.' });
    }

    const setClause = sets.reduce(
      (acc, s, idx) => (idx === 0 ? s : sql`${acc}, ${s}`),
      sql``,
    );

    const result = await db.execute(sql`
      UPDATE ai_faq_cache
         SET ${setClause}, updated_at = NOW()
       WHERE id = ${id} AND company_id = ${companyId}
       RETURNING id, query_sample, response_text, enabled, source, hit_count
    `);

    const rows = (result as any).rows || result;
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) {
      return res.status(404).json({ error: 'Entry not found or access denied' });
    }

    // In-process cache can now be stale for this entry — clear all.
    // For a large deployment, targeted invalidation by hash would be better;
    // here we trade a brief recompute for admin UX simplicity.
    clearFaqCache();

    log.info({ companyId, id }, 'FAQ entry updated by admin');
    res.json(row);
  }),
);

// ============================================================
// DELETE /api/v1/ai-faq-cache/:id
// Hard delete. Admin confirmed action.
// ============================================================
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const companyId: number = (req.user as any).companyId;
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const result = await db.execute(sql`
      DELETE FROM ai_faq_cache
       WHERE id = ${id} AND company_id = ${companyId}
       RETURNING id
    `);

    const rows = (result as any).rows || result;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(404).json({ error: 'Entry not found or access denied' });
    }

    clearFaqCache();
    log.info({ companyId, id }, 'FAQ entry deleted by admin');
    res.status(204).send();
  }),
);

// ============================================================
// POST /api/v1/ai-faq-cache/test
// Dry-run: given a query, tell the admin if it would hit the cache and
// what the normalized form looks like. Does NOT bump hit_count.
// Body: { query: string }
// ============================================================
router.post(
  '/test',
  asyncHandler(async (req, res) => {
    const companyId: number = (req.user as any).companyId;
    const { query } = req.body ?? {};
    if (typeof query !== 'string' || query.trim().length < 2) {
      return res.status(400).json({ error: 'query must be a non-empty string' });
    }

    const normalized = normalizeQuery(query);
    const hash = hashQuery(query);
    const hit = await lookupFaqCache(companyId, query);

    res.json({
      query,
      normalized,
      hash,
      hit: !!hit,
      response: hit?.response || null,
      matchedId: hit?.id || null,
    });
  }),
);

export default router;
