/**
 * AI FAQ Cache Service
 *
 * Lookup BEFORE calling the LLM. For high-frequency questions like
 * "qual o horário?", "vocês aceitam convênio X?", "preço de limpeza"
 * we serve a cached response instead of paying Claude tokens.
 *
 * Strategy:
 *   - Lookup by SHA256(normalized query) — exact-match only
 *     (semantic match would require pgvector — out of scope here).
 *   - Normalization: lowercase, single-space, no punctuation, no leading/trailing whitespace.
 *   - The clinic admin curates entries via UI (source='manual').
 *   - Future: 'auto' source can be populated by a separate job that
 *     identifies high-frequency queries and saves their AI responses.
 *
 * Safety:
 *   - Cache is keyed per company (no cross-tenant leakage).
 *   - Only `enabled=true` entries are returned.
 *   - Hit count incremented async (fire-and-forget).
 *   - In-process LRU (~5 min TTL) to avoid hammering DB on hot queries.
 */

import { createHash } from 'crypto';
import { db } from '../../db';
import { sql } from 'drizzle-orm';
import { logger } from '../../logger';

const log = logger.child({ module: 'faq-cache' });

// In-process cache: (companyId:hash) → { response, id, expiresAt }
// 5-minute TTL — admin updates via UI take up to 5min to propagate.
interface MemEntry {
  id: number;
  response: string;
  expiresAt: number;
}
const memCache = new Map<string, MemEntry>();
const MEM_TTL_MS = 5 * 60 * 1000;
const MEM_MAX = 2000;

// Negative cache: queries that returned NO match. Avoids re-querying the DB
// for every novel question (which would create high read pressure).
const negCache = new Map<string, number>(); // key → expiresAt
const NEG_TTL_MS = 60 * 1000; // 1 min — short, so admin curation propagates fast
const NEG_MAX = 5000;

/**
 * Normalizes a query for hash matching.
 * - lowercase
 * - strips punctuation: . , ! ? ; : ( ) [ ] " '
 * - collapses whitespace to single space
 * - trims
 */
export function normalizeQuery(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,!?;:()[\]"'`´]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function hashQuery(text: string): string {
  return createHash('sha256').update(normalizeQuery(text)).digest('hex');
}

function memKey(companyId: number, hash: string): string {
  return `${companyId}:${hash}`;
}

/**
 * Looks up a cached FAQ response for the given query.
 * Returns null if no match, or response string if a match exists.
 *
 * Performance: hot queries hit the in-process cache (~0.01ms).
 * Cold lookups hit Postgres with an indexed query (<5ms).
 * Negative results are cached for 1 minute.
 */
export async function lookupFaqCache(
  companyId: number,
  query: string
): Promise<{ response: string; id: number } | null> {
  if (!query || query.length < 2 || query.length > 500) return null;

  const hash = hashQuery(query);
  const key = memKey(companyId, hash);
  const now = Date.now();

  // 1) Hot cache hit
  const cached = memCache.get(key);
  if (cached && cached.expiresAt > now) {
    bumpHitCount(cached.id).catch(() => undefined);
    return { response: cached.response, id: cached.id };
  }

  // 2) Negative cache (recent miss)
  const negExp = negCache.get(key);
  if (negExp && negExp > now) {
    return null;
  }

  // 3) DB lookup
  try {
    const result = await db.execute(sql`
      SELECT id, response_text
        FROM ai_faq_cache
       WHERE company_id = ${companyId}
         AND query_hash = ${hash}
         AND enabled = TRUE
       LIMIT 1
    `);
    const rows = (result as any).rows || result;
    const row = Array.isArray(rows) ? rows[0] : null;

    if (!row) {
      // Cache the miss
      if (negCache.size >= NEG_MAX) {
        const firstKey = negCache.keys().next().value;
        if (firstKey !== undefined) negCache.delete(firstKey);
      }
      negCache.set(key, now + NEG_TTL_MS);
      return null;
    }

    const id = Number(row.id);
    const response = String(row.response_text);

    // Promote to hot cache
    if (memCache.size >= MEM_MAX) {
      const firstKey = memCache.keys().next().value;
      if (firstKey !== undefined) memCache.delete(firstKey);
    }
    memCache.set(key, { id, response, expiresAt: now + MEM_TTL_MS });

    bumpHitCount(id).catch(() => undefined);
    return { response, id };
  } catch (err) {
    // Migration may not have run — silently fall through to LLM
    log.debug({ err }, 'FAQ cache lookup failed (table may not exist)');
    return null;
  }
}

/** Increments hit_count + last_hit_at async (fire-and-forget). */
async function bumpHitCount(id: number): Promise<void> {
  try {
    await db.execute(sql`
      UPDATE ai_faq_cache
         SET hit_count = hit_count + 1, last_hit_at = NOW()
       WHERE id = ${id}
    `);
  } catch (err) {
    log.debug({ err, id }, 'bumpHitCount failed');
  }
}

/**
 * Manually upsert a FAQ entry (used by admin UI).
 * source defaults to 'manual'. Returns the row ID.
 */
export async function upsertFaqEntry(
  companyId: number,
  query: string,
  response: string,
  source: 'manual' | 'auto' | 'system' = 'manual'
): Promise<number | null> {
  if (!query || !response) return null;

  const hash = hashQuery(query);
  try {
    const result = await db.execute(sql`
      INSERT INTO ai_faq_cache (company_id, query_hash, query_sample, response_text, source, enabled, created_at, updated_at)
      VALUES (${companyId}, ${hash}, ${query.slice(0, 500)}, ${response}, ${source}, TRUE, NOW(), NOW())
      ON CONFLICT (company_id, query_hash)
      DO UPDATE SET response_text = EXCLUDED.response_text, source = EXCLUDED.source, enabled = TRUE, updated_at = NOW()
      RETURNING id
    `);
    const rows = (result as any).rows || result;
    const id = Array.isArray(rows) && rows[0]?.id ? Number(rows[0].id) : null;
    // Invalidate caches
    const key = memKey(companyId, hash);
    memCache.delete(key);
    negCache.delete(key);
    return id;
  } catch (err) {
    log.warn({ err, companyId }, 'Failed to upsert FAQ entry');
    return null;
  }
}

/** Invalidates all in-process caches (use after bulk admin updates). */
export function clearFaqCache(): void {
  memCache.clear();
  negCache.clear();
}
