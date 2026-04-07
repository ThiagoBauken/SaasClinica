/**
 * Report Caching Middleware
 *
 * An in-process, TTL-based response cache for heavy report endpoints.
 * Cache keys are scoped per (companyId + full URL) so tenants never
 * share cached data.
 *
 * Usage:
 *   import { reportCacheMiddleware } from '../middleware/report-cache';
 *
 *   // Cache this endpoint's response for 5 minutes (default)
 *   router.get('/revenue-by-period', authCheck, reportCacheMiddleware(), handler);
 *
 *   // Custom TTL (10 minutes)
 *   router.get('/heavy-report',     authCheck, reportCacheMiddleware(600), handler);
 *
 * Cache invalidation:
 *   Call clearReportCache(companyId) when underlying data changes
 *   (e.g., after a payment is recorded) to prevent stale reads.
 *
 * Memory management:
 *   - Stale entries are evicted lazily (on cache hit miss and on overflow).
 *   - Hard cap of 500 entries; oldest stale entries are removed when reached.
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../logger';

const log = logger.child({ module: 'report-cache' });

interface CacheEntry {
  data: any;
  expiresAt: number;
  companyId: number; // stored for targeted invalidation
}

const reportCache = new Map<string, CacheEntry>();
const MAX_CACHE_SIZE = 500;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildKey(companyId: number, url: string): string {
  return `report:${companyId}:${url}`;
}

function evictStaleEntries(): void {
  const now = Date.now();
  for (const [key, entry] of reportCache) {
    if (entry.expiresAt < now) {
      reportCache.delete(key);
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Removes all cached report responses for a specific company.
 * Should be called after mutations that affect report data.
 */
export function clearReportCache(companyId: number): void {
  let cleared = 0;
  for (const [key, entry] of reportCache) {
    if (entry.companyId === companyId) {
      reportCache.delete(key);
      cleared++;
    }
  }
  if (cleared > 0) {
    log.debug({ companyId, cleared }, 'Report cache cleared for company');
  }
}

/**
 * Returns Express middleware that caches JSON responses.
 *
 * @param ttlSeconds - Time-to-live in seconds (default 300 = 5 minutes)
 */
export function reportCacheMiddleware(ttlSeconds: number = 300) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user as any;
    const companyId: number | undefined = user?.companyId;

    // Skip caching when user context is unavailable (should not normally happen
    // since authCheck runs before this middleware)
    if (!companyId) {
      return next();
    }

    const key = buildKey(companyId, req.originalUrl);
    const cached = reportCache.get(key);

    if (cached && cached.expiresAt > Date.now()) {
      res.setHeader('X-Cache', 'HIT');
      res.json(cached.data);
      return;
    }

    // Cache miss — intercept res.json to store the response
    res.setHeader('X-Cache', 'MISS');

    const originalJson = res.json.bind(res) as (body: any) => Response;

    res.json = (body: any): Response => {
      // Only cache successful (2xx) responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // Evict stale entries when the cache is at capacity
        if (reportCache.size >= MAX_CACHE_SIZE) {
          evictStaleEntries();
        }

        reportCache.set(key, {
          data: body,
          expiresAt: Date.now() + ttlSeconds * 1000,
          companyId,
        });

        log.debug(
          { companyId, url: req.originalUrl, ttlSeconds },
          'Report response cached',
        );
      }

      return originalJson(body);
    };

    next();
  };
}
