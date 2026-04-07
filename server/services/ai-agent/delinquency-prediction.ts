/**
 * Delinquency Prediction Service
 *
 * Scores patients by their likelihood to default on outstanding balances,
 * combining overdue count, outstanding amount, and days overdue.
 *
 * Risk thresholds:
 *   90 — >3 overdue entries, OR outstanding > R$1 000 with any overdue
 *   70 — >1 overdue entry, OR avg days overdue > 60
 *   50 — 1 overdue entry, OR avg days overdue > 30
 *   30 — >5 pending entries (payment behavior signal)
 *   15 — low risk / early stage
 *
 * Only patients with a positive pending/overdue balance are returned
 * (top 50 by descending risk score then outstanding amount).
 *
 * Note: amounts are stored as integer cents in financial_transactions.
 */

import { db } from '../../db';

export interface DelinquencyRisk {
  patientId: number;
  patientName: string;
  totalOutstanding: number; // cents
  overdueCount: number;
  avgDaysOverdue: number;
  paymentHistory: {
    onTime: number;
    late: number;
    missed: number;
  };
  riskScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high';
}

/**
 * Predicts delinquency risk for patients with outstanding balances.
 * Returns up to 50 patients ordered by descending risk then outstanding amount.
 */
export async function predictDelinquency(companyId: number): Promise<DelinquencyRisk[]> {
  const result = await db.$client.query(
    `
    WITH payment_stats AS (
      SELECT
        p.id                                                                              AS patient_id,
        p.full_name,
        COUNT(CASE WHEN ft.status = 'pending'  THEN 1 END)                              AS pending_count,
        COALESCE(SUM(CASE WHEN ft.status = 'pending' THEN ft.amount ELSE 0 END), 0)     AS total_outstanding,
        COUNT(CASE WHEN ft.status = 'completed' THEN 1 END)                             AS completed_count,
        COUNT(CASE WHEN ft.status = 'overdue'   THEN 1 END)                             AS overdue_count,
        AVG(
          CASE WHEN ft.status = 'overdue'
            THEN EXTRACT(DAY FROM NOW() - ft.date)
          END
        )                                                                                AS avg_days_overdue
      FROM patients p
      LEFT JOIN financial_transactions ft
        ON  ft.customer_id = p.id
        AND ft.company_id  = $1
        AND ft.type        = 'income'
      WHERE p.company_id  = $1
        AND p.active       = true
        AND p.deleted_at   IS NULL
      GROUP BY p.id, p.full_name
      HAVING COALESCE(
        SUM(CASE WHEN ft.status IN ('pending', 'overdue') THEN ft.amount ELSE 0 END), 0
      ) > 0
    )
    SELECT *,
      CASE
        WHEN overdue_count > 3
          OR (total_outstanding > 100000 AND overdue_count > 0)  THEN 90
        WHEN overdue_count > 1
          OR avg_days_overdue > 60                               THEN 70
        WHEN overdue_count = 1
          OR avg_days_overdue > 30                               THEN 50
        WHEN pending_count > 5                                   THEN 30
        ELSE 15
      END AS risk_score
    FROM payment_stats
    ORDER BY risk_score DESC, total_outstanding DESC
    LIMIT 50
    `,
    [companyId],
  );

  return result.rows.map((row: any) => ({
    patientId: row.patient_id,
    patientName: row.full_name,
    totalOutstanding: Number(row.total_outstanding) || 0,
    overdueCount: Number(row.overdue_count) || 0,
    avgDaysOverdue: Math.round(Number(row.avg_days_overdue) || 0),
    paymentHistory: {
      onTime: Number(row.completed_count) || 0,
      late: Number(row.overdue_count) || 0,
      missed: 0,
    },
    riskScore: Number(row.risk_score),
    riskLevel: getRiskLevel(Number(row.risk_score)),
  }));
}

function getRiskLevel(riskScore: number): DelinquencyRisk['riskLevel'] {
  if (riskScore >= 70) return 'high';
  if (riskScore >= 40) return 'medium';
  return 'low';
}
