/**
 * Schedule Optimizer Service
 *
 * Detects idle gaps (> 30 minutes) in each professional's daily schedule
 * and suggests recall patients who could fill them.
 *
 * Algorithm:
 *   1. Use a window function (LEAD) to compute the gap between consecutive
 *      appointments for each professional per day.
 *   2. Keep only gaps > 30 minutes.
 *   3. For each gap, query up to 3 patients who have not returned in 90+ days
 *      and prefer (or have no preference for) that professional.
 *
 * Date inputs are ISO-8601 date strings (YYYY-MM-DD).
 * Cancelled and no_show appointments are excluded from gap detection.
 */

import { db } from '../../db';

export interface ScheduleGap {
  professionalId: number;
  professionalName: string;
  date: string;
  gapStart: string;
  gapEnd: string;
  gapMinutes: number;
  suggestedPatients: Array<{
    patientId: number;
    name: string;
    reason: string;
  }>;
}

/**
 * Finds schedule gaps for all professionals within a date range.
 *
 * @param companyId  - Tenant identifier
 * @param startDate  - ISO date string (inclusive), e.g. "2026-04-07"
 * @param endDate    - ISO date string (inclusive), e.g. "2026-04-14"
 */
export async function findScheduleGaps(
  companyId: number,
  startDate: string,
  endDate: string,
): Promise<ScheduleGap[]> {
  const gapRows = await db.$client.query(
    `
    WITH ordered_appointments AS (
      SELECT
        a.professional_id,
        u.full_name                                                        AS professional_name,
        a.start_time,
        a.end_time,
        DATE(a.start_time)                                                 AS appt_date,
        LEAD(a.start_time) OVER (
          PARTITION BY a.professional_id, DATE(a.start_time)
          ORDER BY a.start_time
        )                                                                  AS next_start
      FROM appointments a
      JOIN users u ON u.id = a.professional_id
      WHERE a.company_id  = $1
        AND a.start_time >= $2
        AND a.start_time <= $3::date + INTERVAL '1 day' - INTERVAL '1 second'
        AND a.status NOT IN ('cancelled', 'no_show')
        AND a.deleted_at   IS NULL
    )
    SELECT
      professional_id,
      professional_name,
      appt_date,
      end_time                                                             AS gap_start,
      next_start                                                           AS gap_end,
      EXTRACT(EPOCH FROM (next_start - end_time)) / 60                    AS gap_minutes
    FROM ordered_appointments
    WHERE next_start IS NOT NULL
      AND EXTRACT(EPOCH FROM (next_start - end_time)) / 60 > 30
    ORDER BY appt_date, professional_id, gap_minutes DESC
    `,
    [companyId, startDate, endDate],
  );

  const gaps: ScheduleGap[] = [];

  for (const row of gapRows.rows) {
    const recallResult = await db.$client.query(
      `
      SELECT DISTINCT p.id, p.full_name
      FROM patients p
      LEFT JOIN appointments a
        ON  a.patient_id  = p.id
        AND a.status      = 'completed'
      WHERE p.company_id = $1
        AND p.active      = true
        AND p.deleted_at  IS NULL
        AND (p.preferred_dentist_id = $2 OR p.preferred_dentist_id IS NULL)
      GROUP BY p.id, p.full_name
      HAVING MAX(a.start_time) < NOW() - INTERVAL '90 days'
      LIMIT 3
      `,
      [companyId, row.professional_id],
    );

    gaps.push({
      professionalId: row.professional_id,
      professionalName: row.professional_name,
      date: row.appt_date,
      gapStart: row.gap_start,
      gapEnd: row.gap_end,
      gapMinutes: Math.round(Number(row.gap_minutes)),
      suggestedPatients: recallResult.rows.map((p: any) => ({
        patientId: p.id,
        name: p.full_name,
        reason: 'Paciente sem retorno ha mais de 90 dias',
      })),
    });
  }

  return gaps;
}
