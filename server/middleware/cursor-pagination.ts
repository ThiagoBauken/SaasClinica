/**
 * Cursor-based Pagination Helper
 *
 * Provides utilities for implementing efficient, stable cursor pagination
 * instead of OFFSET/LIMIT. Cursor pagination avoids the "page drift" problem
 * (rows shifting between pages when new data is inserted) and is significantly
 * more performant on large tables because the database can use an index seek
 * instead of scanning and discarding rows.
 *
 * Cursor encoding:
 *   The cursor is a base64-encoded string of the form "id:timestamp" where:
 *     id        — integer primary key of the last row on the current page
 *     timestamp — ISO-8601 created_at value of that row
 *
 * Typical usage in a route handler:
 *
 *   import { decodeCursor, encodeCursor, buildCursorQuery, type CursorPaginationParams } from '../middleware/cursor-pagination';
 *
 *   const params: CursorPaginationParams = {
 *     cursor: req.query.cursor as string | undefined,
 *     limit: Math.min(Number(req.query.limit) || 20, 100),
 *   };
 *
 *   const baseQuery = `SELECT * FROM appointments WHERE company_id = $1`;
 *   const baseParams: any[] = [companyId];
 *   const { query, params: sqlParams } = buildCursorQuery(baseQuery, baseParams, params.cursor, params.limit);
 *
 *   const rows = await db.$client.query(query, sqlParams);
 *   const hasMore = rows.rows.length > params.limit;
 *   const data = rows.rows.slice(0, params.limit);
 *
 *   const nextCursor = hasMore
 *     ? encodeCursor(data[data.length - 1].id, data[data.length - 1].created_at)
 *     : undefined;
 *
 *   res.json(buildPaginatedResponse(data, nextCursor, hasMore));
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CursorPaginationParams {
  /** Base64-encoded cursor from the previous page's response */
  cursor?: string;
  /** Maximum number of records to return per page (caller should cap this) */
  limit: number;
}

export interface CursorPaginatedResponse<T> {
  data: T[];
  /** Opaque cursor — pass as `?cursor=` on the next request to get the following page */
  nextCursor?: string;
  hasMore: boolean;
  /** Optional total count — only include when inexpensive to compute */
  total?: number;
}

// ---------------------------------------------------------------------------
// Encoding / decoding
// ---------------------------------------------------------------------------

/**
 * Decodes a base64 cursor string into its component parts.
 * Throws if the cursor is malformed.
 */
export function decodeCursor(cursor: string): { id: number; timestamp: string } {
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf8');
    const separatorIndex = decoded.indexOf(':');
    if (separatorIndex === -1) {
      throw new Error('Invalid cursor format: missing separator');
    }
    const id = parseInt(decoded.substring(0, separatorIndex), 10);
    const timestamp = decoded.substring(separatorIndex + 1);
    if (isNaN(id) || !timestamp) {
      throw new Error('Invalid cursor format: id or timestamp missing');
    }
    return { id, timestamp };
  } catch (err) {
    throw new Error(`Cannot decode pagination cursor: ${(err as Error).message}`);
  }
}

/**
 * Encodes a row's id and created_at into an opaque base64 cursor string.
 *
 * @param id        - Primary key of the row
 * @param timestamp - ISO-8601 string or Date object for created_at
 */
export function encodeCursor(id: number, timestamp: string | Date): string {
  const ts = timestamp instanceof Date ? timestamp.toISOString() : timestamp;
  return Buffer.from(`${id}:${ts}`).toString('base64');
}

// ---------------------------------------------------------------------------
// Query builder
// ---------------------------------------------------------------------------

/**
 * Appends cursor-based WHERE clause and ORDER BY / LIMIT to an existing
 * parameterised SQL query.
 *
 * IMPORTANT: The base query must NOT already contain an ORDER BY or LIMIT
 * clause — they are added by this function.
 *
 * The returned `params` array is an extension of `existingParams` — do not
 * use separate param arrays; always spread the returned one into your query call.
 *
 * @param baseQuery     - SELECT … FROM … WHERE … (no ORDER BY / LIMIT)
 * @param existingParams - Params already bound in baseQuery ($1, $2, …)
 * @param cursor        - Opaque cursor from the previous response (optional)
 * @param limit         - Page size (function fetches limit+1 to detect hasMore)
 *
 * @returns { query, params } — pass both to db.$client.query(query, params)
 */
export function buildCursorQuery(
  baseQuery: string,
  existingParams: any[],
  cursor?: string,
  limit: number = 20,
): { query: string; params: any[] } {
  // Clone to avoid mutating the caller's array
  const params = [...existingParams];
  let query = baseQuery;

  if (cursor) {
    const { id, timestamp } = decodeCursor(cursor);
    // Keyset pagination: rows strictly before the cursor position
    // Using (created_at, id) composite comparison gives a stable, index-friendly predicate
    // INDEX HINT: (created_at DESC, id DESC) composite index on the target table
    const tsIdx = params.length + 1;
    const idIdx = params.length + 2;
    query += ` AND (created_at < $${tsIdx} OR (created_at = $${tsIdx} AND id < $${idIdx}))`;
    params.push(timestamp, id);
  }

  // Fetch one extra row to determine whether a next page exists
  const limitIdx = params.length + 1;
  query += ` ORDER BY created_at DESC, id DESC LIMIT $${limitIdx}`;
  params.push(limit + 1);

  return { query, params };
}

// ---------------------------------------------------------------------------
// Response builder
// ---------------------------------------------------------------------------

/**
 * Wraps paginated data into a standard response envelope.
 *
 * @param data       - The sliced data array (already trimmed to `limit` items)
 * @param nextCursor - Encoded cursor for the next page, or undefined if last page
 * @param hasMore    - Whether more records exist beyond this page
 * @param total      - Optional total count
 */
export function buildPaginatedResponse<T>(
  data: T[],
  nextCursor: string | undefined,
  hasMore: boolean,
  total?: number,
): CursorPaginatedResponse<T> {
  const response: CursorPaginatedResponse<T> = { data, nextCursor, hasMore };
  if (total !== undefined) {
    response.total = total;
  }
  return response;
}
