import { Router } from 'express';
import { db } from '../db';
import { holidays } from '@shared/schema';
import { eq, and, or, isNull, sql } from 'drizzle-orm';
import { tenantAwareAuth, asyncHandler } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

// ── Validation schemas ─────────────────────────────────────────────────────────

const holidaySchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  date: z.string().refine((val) => !isNaN(Date.parse(val)), 'Data inválida'),
  isRecurringYearly: z.boolean().default(false),
});

const seedNationalSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

// ── Brazilian national holidays (fixed dates, recurring yearly) ───────────────

function getBrazilianNationalHolidays(year: number) {
  return [
    { name: 'Confraternização Universal', date: `${year}-01-01`, recurring: true },
    { name: 'Tiradentes', date: `${year}-04-21`, recurring: true },
    { name: 'Dia do Trabalho', date: `${year}-05-01`, recurring: true },
    { name: 'Independência do Brasil', date: `${year}-09-07`, recurring: true },
    { name: 'Nossa Senhora Aparecida', date: `${year}-10-12`, recurring: true },
    { name: 'Finados', date: `${year}-11-02`, recurring: true },
    { name: 'Proclamação da República', date: `${year}-11-15`, recurring: true },
    { name: 'Natal', date: `${year}-12-25`, recurring: true },
  ];
}

// ── Routes ─────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/holidays
 * Lists all holidays visible to the company:
 *   - Company-specific holidays (company_id = companyId)
 *   - National/shared holidays (company_id IS NULL)
 * Optional query param: ?year=2026 — filters by year, but always includes
 * recurring holidays regardless of year stored in the date column.
 */
router.get(
  '/',
  tenantAwareAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { year } = req.query;

    let query: string;
    let params: (number | string)[];

    if (year) {
      const yearInt = parseInt(year as string, 10);
      if (isNaN(yearInt)) {
        return res.status(400).json({ error: 'Parâmetro year inválido' });
      }
      // Include rows that match the year OR that recur yearly (regardless of the year stored)
      query = `
        SELECT *
        FROM holidays
        WHERE (company_id = $1 OR company_id IS NULL)
          AND (EXTRACT(YEAR FROM date) = $2 OR is_recurring_yearly = TRUE)
        ORDER BY date ASC
      `;
      params = [companyId, yearInt];
    } else {
      query = `
        SELECT *
        FROM holidays
        WHERE (company_id = $1 OR company_id IS NULL)
        ORDER BY date ASC
      `;
      params = [companyId];
    }

    const result = await db.$client.query(query, params);
    res.json({ data: result.rows });
  })
);

/**
 * POST /api/v1/holidays
 * Creates a new holiday scoped to the authenticated company.
 */
router.post(
  '/',
  tenantAwareAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const parseResult = holidaySchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Dados inválidos',
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const { name, date, isRecurringYearly } = parseResult.data;

    const result = await db.$client.query(
      `INSERT INTO holidays (company_id, name, date, is_recurring_yearly)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [companyId, name, new Date(date), isRecurringYearly]
    );

    res.status(201).json(result.rows[0]);
  })
);

/**
 * PATCH /api/v1/holidays/:id
 * Updates an existing holiday. Only the owning company may update it.
 * National holidays (company_id IS NULL) cannot be modified by tenants.
 */
router.patch(
  '/:id',
  tenantAwareAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;
    const id = parseInt(req.params.id, 10);

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const { name, date, isRecurringYearly } = req.body;

    const setClauses: string[] = [];
    const params: (number | string | boolean | Date)[] = [companyId, id];
    let idx = 3;

    if (name !== undefined) {
      setClauses.push(`name = $${idx++}`);
      params.push(name);
    }
    if (date !== undefined) {
      const parsed = new Date(date);
      if (isNaN(parsed.getTime())) {
        return res.status(400).json({ error: 'Data inválida' });
      }
      setClauses.push(`date = $${idx++}`);
      params.push(parsed);
    }
    if (isRecurringYearly !== undefined) {
      setClauses.push(`is_recurring_yearly = $${idx++}`);
      params.push(isRecurringYearly);
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }

    setClauses.push(`updated_at = NOW()`);

    const result = await db.$client.query(
      `UPDATE holidays
       SET ${setClauses.join(', ')}
       WHERE company_id = $1 AND id = $2
       RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Feriado não encontrado ou pertence a outro tenant' });
    }

    res.json(result.rows[0]);
  })
);

/**
 * DELETE /api/v1/holidays/:id
 * Hard-deletes a company-specific holiday.
 * National holidays (company_id IS NULL) are protected and cannot be deleted by tenants.
 */
router.delete(
  '/:id',
  tenantAwareAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;
    const id = parseInt(req.params.id, 10);

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const result = await db.$client.query(
      `DELETE FROM holidays
       WHERE company_id = $1 AND id = $2
       RETURNING id`,
      [companyId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Feriado não encontrado ou pertence a outro tenant' });
    }

    res.json({ message: 'Feriado removido com sucesso' });
  })
);

/**
 * POST /api/v1/holidays/seed-national
 * Seeds the standard Brazilian national holidays for a given year into the
 * authenticated company's holiday list. Skips duplicates by name + year.
 * Body: { year?: number }  — defaults to the current year.
 */
router.post(
  '/seed-national',
  tenantAwareAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const parseResult = seedNationalSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Dados inválidos',
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const year = parseResult.data.year ?? new Date().getFullYear();
    const nationalHolidays = getBrazilianNationalHolidays(year);

    let inserted = 0;
    const skipped: string[] = [];

    for (const h of nationalHolidays) {
      // Check for an existing record with the same name in the same year for this company
      const existing = await db.$client.query(
        `SELECT id FROM holidays
         WHERE company_id = $1
           AND name = $2
           AND EXTRACT(YEAR FROM date) = $3`,
        [companyId, h.name, year]
      );

      if (existing.rows.length > 0) {
        skipped.push(h.name);
        continue;
      }

      await db.$client.query(
        `INSERT INTO holidays (company_id, name, date, is_recurring_yearly)
         VALUES ($1, $2, $3, $4)`,
        [companyId, h.name, new Date(h.date), h.recurring]
      );
      inserted++;
    }

    res.json({
      message: `${inserted} feriado(s) nacional(is) adicionado(s) para ${year}`,
      year,
      inserted,
      skipped,
    });
  })
);

export default router;
