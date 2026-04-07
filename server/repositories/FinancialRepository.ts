/**
 * FinancialRepository.ts
 * Handles financial transaction operations.
 * Extracted from DatabaseStorage to improve maintainability.
 *
 * Note: The current DatabaseStorage.getTransactions / createTransaction
 * implementations are stubs (no dedicated DB table yet). They are preserved
 * here verbatim so the facade remains backward-compatible.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Transaction {
  id: number;
  type: 'revenue' | 'expense';
  date: string;
  category: string;
  description: string;
  amount: number; // in cents
  paymentMethod: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Repository functions
// ---------------------------------------------------------------------------

/**
 * Returns all financial transactions for a company.
 * Currently a stub — the dedicated transactions table has not yet been added
 * to the schema. Returns an empty array until the migration is applied.
 */
export async function getTransactions(_companyId?: number): Promise<Transaction[]> {
  // Note: Transactions are currently handled in-memory / not in a DB table yet.
  return [];
}

/**
 * Creates a financial transaction.
 * Currently a stub — the dedicated transactions table has not yet been added
 * to the schema.
 */
export async function createTransaction(_transaction: any, _companyId?: number): Promise<Transaction> {
  throw new Error("Method not implemented with database storage");
}
