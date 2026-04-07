/**
 * Patient Churn Analysis Service
 *
 * Calculates churn risk scores for patients based on visit patterns.
 * Risk scoring logic:
 *   - 95: No visit in 365+ days
 *   - 75: No visit in 180+ days
 *   - 70: No visit in 120+ days AND gap > 2x their average interval
 *   - 50: No visit in 90+ days
 *   - 40: Gap > 1.5x their average interval
 *   - 10: Low risk
 *
 * Only patients with at least one completed appointment and > 60 days
 * since last visit are included in results (top 100 by risk).
 */

import { db } from '../../db';

export interface ChurnRiskPatient {
  patientId: number;
  patientName: string;
  lastVisit: string;
  daysSinceLastVisit: number;
  totalVisits: number;
  averageVisitInterval: number;
  riskScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  suggestedAction: string;
}

/**
 * Analyzes churn risk for all active patients in a company.
 * Returns up to 100 patients ordered by descending risk score.
 */
export async function analyzeChurnRisk(companyId: number): Promise<ChurnRiskPatient[]> {
  const result = await db.$client.query(
    `
    WITH patient_visits AS (
      SELECT
        p.id                                                          AS patient_id,
        p.full_name,
        p.phone,
        p.email,
        COUNT(a.id)                                                   AS total_visits,
        MAX(a.start_time)                                             AS last_visit,
        EXTRACT(DAY FROM NOW() - MAX(a.start_time))                  AS days_since_last,
        CASE WHEN COUNT(a.id) > 1 THEN
          EXTRACT(DAY FROM MAX(a.start_time) - MIN(a.start_time)) / (COUNT(a.id) - 1)
        ELSE NULL END                                                 AS avg_interval
      FROM patients p
      LEFT JOIN appointments a
        ON  a.patient_id   = p.id
        AND a.status       = 'completed'
        AND a.company_id   = $1
      WHERE p.company_id  = $1
        AND p.active       = true
        AND p.deleted_at   IS NULL
      GROUP BY p.id, p.full_name, p.phone, p.email
      HAVING MAX(a.start_time) IS NOT NULL
    )
    SELECT *,
      CASE
        WHEN days_since_last > 365                                                         THEN 95
        WHEN days_since_last > 180                                                         THEN 75
        WHEN days_since_last > 120
          AND avg_interval IS NOT NULL
          AND days_since_last > avg_interval * 2                                           THEN 70
        WHEN days_since_last > 90                                                          THEN 50
        WHEN avg_interval IS NOT NULL
          AND days_since_last > avg_interval * 1.5                                         THEN 40
        ELSE 10
      END AS risk_score
    FROM patient_visits
    WHERE days_since_last > 60
    ORDER BY risk_score DESC, days_since_last DESC
    LIMIT 100
    `,
    [companyId],
  );

  return result.rows.map((row: any) => ({
    patientId: row.patient_id,
    patientName: row.full_name,
    lastVisit: row.last_visit,
    daysSinceLastVisit: Math.round(Number(row.days_since_last)),
    totalVisits: Number(row.total_visits),
    averageVisitInterval: row.avg_interval ? Math.round(Number(row.avg_interval)) : 0,
    riskScore: Number(row.risk_score),
    riskLevel: getRiskLevel(Number(row.risk_score)),
    suggestedAction: getSuggestedAction(
      Number(row.risk_score),
      Number(row.days_since_last),
      Number(row.total_visits),
    ),
  }));
}

function getRiskLevel(riskScore: number): ChurnRiskPatient['riskLevel'] {
  if (riskScore >= 75) return 'critical';
  if (riskScore >= 50) return 'high';
  if (riskScore >= 30) return 'medium';
  return 'low';
}

function getSuggestedAction(riskScore: number, daysSince: number, totalVisits: number): string {
  if (riskScore >= 75) {
    return 'Enviar WhatsApp urgente com oferta de retorno + ligar se sem resposta em 48h';
  }
  if (riskScore >= 50) {
    return 'Enviar lembrete amigavel via WhatsApp sobre importancia do acompanhamento';
  }
  if (riskScore >= 30 && totalVisits >= 5) {
    return 'Paciente fiel com intervalo atipico - enviar mensagem personalizada';
  }
  return 'Enviar campanha de recall padrao';
}
