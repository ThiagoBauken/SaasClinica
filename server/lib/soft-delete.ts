import { SQL, sql, isNull } from "drizzle-orm";
import { PgColumn } from "drizzle-orm/pg-core";

/**
 * Adds a `deleted_at IS NULL` condition to filter out soft-deleted records.
 * Use in Drizzle ORM queries: .where(and(eq(table.companyId, id), notDeleted(table.deletedAt)))
 */
export function notDeleted(deletedAtColumn: PgColumn): SQL {
  return isNull(deletedAtColumn);
}

/**
 * Generates a raw SQL fragment for soft delete filtering in raw queries.
 * Usage: `WHERE company_id = $1 AND ${softDeleteFilter('tablealias')}`
 */
export function softDeleteFilter(tableAlias?: string): string {
  const prefix = tableAlias ? `${tableAlias}.` : "";
  return `${prefix}deleted_at IS NULL`;
}

/**
 * Marks a record as soft-deleted by setting deleted_at to NOW().
 * Returns the SQL for an UPDATE statement.
 */
export function softDeleteNow(): { deletedAt: SQL } {
  return { deletedAt: sql`NOW()` };
}
