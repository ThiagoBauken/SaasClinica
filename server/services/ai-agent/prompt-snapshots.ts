/**
 * System Prompt Snapshots Service
 *
 * Versioned audit trail of every distinct system prompt the AI agent uses.
 * Required for healthcare compliance: a regulator may ask "what guidance was
 * the AI receiving for clinic X on date Y?" and we must be able to answer.
 *
 * How it works:
 *   1. Each call to `recordPromptSnapshot()` computes SHA256(prompt_text).
 *   2. If a snapshot with the same hash exists for the company, we increment
 *      its use_count and update last_used_at — no duplication.
 *   3. Otherwise we INSERT a new row with the full prompt text.
 *   4. Returns the snapshot ID, which is stored in `ai_usage_logs.prompt_snapshot_id`
 *      so each AI call is traceable to its exact prompt version.
 *
 * Performance:
 *   - In-process LRU cache of (companyId, hash) → snapshotId so the DB upsert
 *     only fires when a NEW prompt variation is seen. After warmup, this is a
 *     map lookup with ~0 cost.
 *   - On cache miss, a single SQL upsert with ON CONFLICT.
 */

import { createHash } from 'crypto';
import { db } from '../../db';
import { sql } from 'drizzle-orm';
import { logger } from '../../logger';

const log = logger.child({ module: 'prompt-snapshots' });

// LRU cache: (companyId:hash) → snapshotId.
// Bounded to 5000 entries — typical SaaS sees <50 prompt variations per
// company, so this comfortably handles ~100 active companies.
const cache = new Map<string, number>();
const MAX_CACHE_SIZE = 5000;

function cacheKey(companyId: number, hash: string): string {
  return `${companyId}:${hash}`;
}

/**
 * Hashes the prompt text. We use SHA256 truncated to 32 hex chars (128 bits)
 * — astronomically low collision probability for any realistic prompt corpus.
 */
export function hashPromptText(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 32);
}

/**
 * Records a prompt snapshot, returning the row ID.
 * Returns null on database failure (caller should treat as non-critical and
 * continue without snapshot tracking — the AI call still proceeds).
 */
export async function recordPromptSnapshot(
  companyId: number,
  promptText: string,
  clinicSettingsSnapshot?: Record<string, any>
): Promise<number | null> {
  if (!promptText) return null;

  const hash = hashPromptText(promptText);
  const key = cacheKey(companyId, hash);

  // Hot path: cache hit
  const cached = cache.get(key);
  if (cached !== undefined) {
    // Bump last_used_at + use_count async (fire-and-forget — non-critical)
    db.execute(sql`
      UPDATE system_prompt_snapshots
         SET last_used_at = NOW(), use_count = use_count + 1
       WHERE id = ${cached}
    `).catch((err: any) => log.debug({ err, snapshotId: cached }, 'Failed to bump snapshot use_count'));
    return cached;
  }

  // Cold path: upsert
  try {
    const result = await db.execute(sql`
      INSERT INTO system_prompt_snapshots (
        company_id, prompt_hash, prompt_text, prompt_length,
        clinic_settings_snapshot, first_used_at, last_used_at, use_count
      ) VALUES (
        ${companyId}, ${hash}, ${promptText}, ${promptText.length},
        ${clinicSettingsSnapshot ? JSON.stringify(clinicSettingsSnapshot) : null}::jsonb,
        NOW(), NOW(), 1
      )
      ON CONFLICT (company_id, prompt_hash) DO UPDATE
        SET last_used_at = NOW(), use_count = system_prompt_snapshots.use_count + 1
      RETURNING id
    `);

    // pg returns rows on .rows; drizzle wraps in similar shape
    const rows = (result as any).rows || result;
    const id = Array.isArray(rows) && rows[0]?.id ? Number(rows[0].id) : null;

    if (id !== null) {
      // Evict oldest entry if cache is full (simple FIFO — Map preserves insertion order)
      if (cache.size >= MAX_CACHE_SIZE) {
        const firstKey = cache.keys().next().value;
        if (firstKey !== undefined) cache.delete(firstKey);
      }
      cache.set(key, id);
    }

    return id;
  } catch (err) {
    log.warn({ err, companyId, hash }, 'Failed to record prompt snapshot');
    return null;
  }
}

/**
 * Clears the in-process snapshot cache. Use in tests or after schema changes.
 */
export function clearPromptSnapshotCache(): void {
  cache.clear();
}
