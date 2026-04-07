/**
 * Quotes / Orçamentos Routes
 *
 * Authenticated (clinic staff) routes are mounted at:
 *   /api/v1/quotes
 *
 * Public (patient-facing) routes are mounted at:
 *   /api/v1/quotes/public/:token   (read/approve/reject — no auth)
 *
 * Money values are always stored / returned as integer centavos.
 */

import { Router } from 'express';
import { randomBytes } from 'crypto';
import { sql } from 'drizzle-orm';

import { db } from '../db';
import { authCheck, asyncHandler } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { publicTokenLimiter, publicSubmitLimiter } from '../middleware/public-rate-limit';
import {
  createQuoteSchema,
  updateQuoteSchema,
  listQuotesQuerySchema,
  patientApproveSchema,
  patientRejectSchema,
  manualApproveSchema,
  sendWhatsAppSchema,
  sendEmailSchema,
  type QuoteItemInput,
} from '../schemas/quotes.schema';

const router = Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Derive companyId from the authenticated session.
 * Returns null (and sends 403) when missing.
 */
function getCompanyId(req: any, res: any): number | null {
  const id = req.user!.companyId;
  if (!id) {
    res.status(403).json({ error: 'User not associated with any company' });
    return null;
  }
  return id;
}

/**
 * Calculate quote totals from items + discount configuration.
 *
 * @param items        - Validated line items (already contain unitPrice/quantity)
 * @param discountPct  - Discount as a percentage (0–100)
 * @param discountAmt  - Fixed discount in centavos applied AFTER percentage
 * @param installments - Number of installments
 * @param interestRate - Monthly interest rate (0 = no interest)
 */
function calculateTotals(
  items: QuoteItemInput[],
  discountPct: number,
  discountAmt: number,
  installments: number,
  interestRate: number,
): {
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  installmentValue: number | null;
  totalWithInterest: number | null;
} {
  // Sum line-item totals; derive total from quantity × unitPrice so the
  // client does not have to send pre-computed totals (avoids manipulation).
  const subtotal = items.reduce(
    (acc, item) => acc + item.quantity * item.unitPrice,
    0,
  );

  // Percentage discount first
  const pctDiscount = Math.round(subtotal * (discountPct / 100));
  // Then fixed discount (capped so total cannot go negative)
  const fixedDiscount = Math.min(discountAmt, subtotal - pctDiscount);
  const totalDiscount = pctDiscount + fixedDiscount;
  const totalAmount = Math.max(0, subtotal - totalDiscount);

  // Installment calculation
  let installmentValue: number | null = null;
  let totalWithInterest: number | null = null;

  if (installments > 1 && interestRate > 0) {
    // Price × Monthly_rate × (1 + Monthly_rate)^n  /  ((1 + Monthly_rate)^n − 1)
    const r = interestRate / 100;
    const factor = Math.pow(1 + r, installments);
    installmentValue = Math.round((totalAmount * r * factor) / (factor - 1));
    totalWithInterest = installmentValue * installments;
  } else if (installments > 1) {
    installmentValue = Math.round(totalAmount / installments);
    totalWithInterest = totalAmount;
  }

  return {
    subtotal,
    discountAmount: totalDiscount,
    totalAmount,
    installmentValue,
    totalWithInterest,
  };
}

/**
 * Enrich items with pre-computed `total` field so the stored JSONB always
 * has consistent data regardless of what the client sends.
 */
function enrichItems(items: QuoteItemInput[]): QuoteItemInput[] {
  return items.map(item => ({
    ...item,
    total: item.quantity * item.unitPrice,
  }));
}

// ---------------------------------------------------------------------------
// POST /api/v1/quotes
// Create a new quote (optionally seeded from a treatment plan)
// ---------------------------------------------------------------------------

router.post(
  '/',
  authCheck,
  validate({ body: createQuoteSchema }),
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req, res);
    if (!companyId) return;

    const userId = req.user!.id;
    const {
      patientId,
      treatmentPlanId,
      professionalId,
      items,
      discountPercent = 0,
      discountAmount = 0,
      installments = 1,
      interestRate = 0,
      validUntil,
      sentVia,
      notes,
    } = req.body;

    // Verify patient belongs to this company
    const patientCheck = await db.execute(sql`
      SELECT id FROM patients
      WHERE id = ${patientId}
        AND company_id = ${companyId}
        AND deleted_at IS NULL
    `);
    if (patientCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Verify treatment plan (if provided)
    if (treatmentPlanId) {
      const planCheck = await db.execute(sql`
        SELECT id FROM treatment_plans
        WHERE id = ${treatmentPlanId}
          AND company_id = ${companyId}
          AND deleted_at IS NULL
      `);
      if (planCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Treatment plan not found' });
      }
    }

    const enrichedItems = enrichItems(items);
    const totals = calculateTotals(
      enrichedItems,
      discountPercent,
      discountAmount,
      installments,
      interestRate,
    );

    const token = randomBytes(32).toString('hex');

    const result = await db.execute(sql`
      INSERT INTO quotes (
        company_id,
        treatment_plan_id,
        patient_id,
        professional_id,
        items,
        subtotal,
        discount_percent,
        discount_amount,
        total_amount,
        installments,
        installment_value,
        interest_rate,
        total_with_interest,
        token,
        status,
        valid_until,
        sent_via,
        notes,
        created_by,
        created_at,
        updated_at
      ) VALUES (
        ${companyId},
        ${treatmentPlanId ?? null},
        ${patientId},
        ${professionalId ?? null},
        ${JSON.stringify(enrichedItems)},
        ${totals.subtotal},
        ${discountPercent},
        ${totals.discountAmount},
        ${totals.totalAmount},
        ${installments},
        ${totals.installmentValue ?? null},
        ${interestRate},
        ${totals.totalWithInterest ?? null},
        ${token},
        'pending',
        ${validUntil ?? null},
        ${sentVia ?? null},
        ${notes ?? null},
        ${userId},
        NOW(),
        NOW()
      )
      RETURNING *
    `);

    const quote = result.rows[0] as Record<string, any>;

    return res.status(201).json({
      ...quote,
      publicUrl: `${process.env.BASE_URL}/orcamento/${token}`,
    });
  }),
);

// ---------------------------------------------------------------------------
// GET /api/v1/quotes
// List quotes with filters
// ---------------------------------------------------------------------------

router.get(
  '/',
  authCheck,
  validate({ query: listQuotesQuerySchema }),
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req, res);
    if (!companyId) return;

    const { patientId, status, dateFrom, dateTo, page, limit } =
      req.query as any;
    const offset = (page - 1) * limit;

    // Build dynamic WHERE clause
    const conditions: string[] = [
      `q.company_id = ${companyId}`,
      `q.deleted_at IS NULL`,
    ];
    if (patientId) conditions.push(`q.patient_id = ${patientId}`);
    if (status) conditions.push(`q.status = '${status}'`);
    if (dateFrom) conditions.push(`q.created_at >= '${dateFrom}'`);
    if (dateTo) conditions.push(`q.created_at <= '${dateTo}'`);

    const where = conditions.join(' AND ');

    const [quotesResult, countResult] = await Promise.all([
      db.execute(sql.raw(`
        SELECT
          q.*,
          p.name          AS patient_name,
          p.phone         AS patient_phone,
          p.email         AS patient_email,
          u.full_name     AS professional_name,
          cb.full_name    AS created_by_name
        FROM quotes q
        LEFT JOIN patients p  ON p.id = q.patient_id
        LEFT JOIN users u     ON u.id = q.professional_id
        LEFT JOIN users cb    ON cb.id = q.created_by
        WHERE ${where}
        ORDER BY q.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `)),
      db.execute(sql.raw(`
        SELECT COUNT(*) AS total FROM quotes q WHERE ${where}
      `)),
    ]);

    const total = parseInt((countResult.rows[0] as any).total, 10);

    return res.json({
      data: quotesResult.rows,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  }),
);

// ---------------------------------------------------------------------------
// GET /api/v1/quotes/:id
// Single quote with full detail
// ---------------------------------------------------------------------------

router.get(
  '/:id',
  authCheck,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req, res);
    if (!companyId) return;

    const quoteId = parseInt(req.params.id, 10);
    if (isNaN(quoteId)) {
      return res.status(400).json({ error: 'Invalid quote ID' });
    }

    const result = await db.execute(sql`
      SELECT
        q.*,
        p.name          AS patient_name,
        p.phone         AS patient_phone,
        p.email         AS patient_email,
        p.cpf           AS patient_cpf,
        u.full_name     AS professional_name,
        tp.name         AS treatment_plan_name,
        cb.full_name    AS created_by_name
      FROM quotes q
      LEFT JOIN patients p      ON p.id = q.patient_id
      LEFT JOIN users u         ON u.id = q.professional_id
      LEFT JOIN treatment_plans tp ON tp.id = q.treatment_plan_id
      LEFT JOIN users cb        ON cb.id = q.created_by
      WHERE q.id = ${quoteId}
        AND q.company_id = ${companyId}
        AND q.deleted_at IS NULL
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    const quote = result.rows[0] as Record<string, any>;
    return res.json({
      ...quote,
      publicUrl: `${process.env.BASE_URL}/orcamento/${quote.token}`,
    });
  }),
);

// ---------------------------------------------------------------------------
// PATCH /api/v1/quotes/:id
// Update quote (items, discount, notes — only while not yet approved/expired)
// ---------------------------------------------------------------------------

router.patch(
  '/:id',
  authCheck,
  validate({ body: updateQuoteSchema }),
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req, res);
    if (!companyId) return;

    const quoteId = parseInt(req.params.id, 10);
    if (isNaN(quoteId)) {
      return res.status(400).json({ error: 'Invalid quote ID' });
    }

    // Load existing quote
    const existing = await db.execute(sql`
      SELECT * FROM quotes
      WHERE id = ${quoteId}
        AND company_id = ${companyId}
        AND deleted_at IS NULL
    `);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    const current = existing.rows[0] as Record<string, any>;

    // Prevent editing approved / rejected quotes
    if (['approved', 'rejected'].includes(current.status)) {
      return res.status(409).json({
        error: `Cannot edit a quote that is already "${current.status}"`,
      });
    }

    const {
      items,
      discountPercent,
      discountAmount,
      installments,
      interestRate,
      validUntil,
      notes,
      status,
      professionalId,
      sentVia,
    } = req.body;

    // Re-calculate totals if pricing fields changed
    let totals: ReturnType<typeof calculateTotals> | null = null;
    let enrichedItems: QuoteItemInput[] | null = null;

    if (items !== undefined) {
      enrichedItems = enrichItems(items);
      totals = calculateTotals(
        enrichedItems,
        discountPercent ?? Number(current.discount_percent) ?? 0,
        discountAmount ?? current.discount_amount ?? 0,
        installments ?? current.installments ?? 1,
        interestRate ?? Number(current.interest_rate) ?? 0,
      );
    } else if (
      discountPercent !== undefined ||
      discountAmount !== undefined ||
      installments !== undefined ||
      interestRate !== undefined
    ) {
      // Re-calc totals from existing items with new discount/installment params
      const existingItems = (current.items as QuoteItemInput[]) ?? [];
      enrichedItems = existingItems;
      totals = calculateTotals(
        existingItems,
        discountPercent ?? Number(current.discount_percent) ?? 0,
        discountAmount ?? current.discount_amount ?? 0,
        installments ?? current.installments ?? 1,
        interestRate ?? Number(current.interest_rate) ?? 0,
      );
    }

    const result = await db.execute(sql`
      UPDATE quotes SET
        items              = COALESCE(${enrichedItems ? JSON.stringify(enrichedItems) : null}::jsonb,       items),
        subtotal           = COALESCE(${totals?.subtotal ?? null},            subtotal),
        discount_percent   = COALESCE(${discountPercent ?? null},             discount_percent),
        discount_amount    = COALESCE(${totals?.discountAmount ?? null},      discount_amount),
        total_amount       = COALESCE(${totals?.totalAmount ?? null},         total_amount),
        installments       = COALESCE(${installments ?? null},                installments),
        installment_value  = COALESCE(${totals?.installmentValue ?? null},    installment_value),
        interest_rate      = COALESCE(${interestRate ?? null},                interest_rate),
        total_with_interest= COALESCE(${totals?.totalWithInterest ?? null},   total_with_interest),
        valid_until        = COALESCE(${validUntil ?? null},                  valid_until),
        notes              = COALESCE(${notes ?? null},                       notes),
        status             = COALESCE(${status ?? null},                      status),
        professional_id    = COALESCE(${professionalId ?? null},              professional_id),
        sent_via           = COALESCE(${sentVia ?? null},                     sent_via),
        updated_at         = NOW()
      WHERE id = ${quoteId}
        AND company_id = ${companyId}
        AND deleted_at IS NULL
      RETURNING *
    `);

    return res.json(result.rows[0]);
  }),
);

// ---------------------------------------------------------------------------
// DELETE /api/v1/quotes/:id
// Soft delete
// ---------------------------------------------------------------------------

router.delete(
  '/:id',
  authCheck,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req, res);
    if (!companyId) return;

    const quoteId = parseInt(req.params.id, 10);
    if (isNaN(quoteId)) {
      return res.status(400).json({ error: 'Invalid quote ID' });
    }

    const result = await db.execute(sql`
      UPDATE quotes
      SET deleted_at = NOW(), updated_at = NOW()
      WHERE id = ${quoteId}
        AND company_id = ${companyId}
        AND deleted_at IS NULL
      RETURNING id
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    return res.json({ success: true, message: 'Quote deleted successfully' });
  }),
);

// ---------------------------------------------------------------------------
// POST /api/v1/quotes/:id/send-whatsapp
// Enqueue a WhatsApp message with the public quote link
// ---------------------------------------------------------------------------

router.post(
  '/:id/send-whatsapp',
  authCheck,
  validate({ body: sendWhatsAppSchema }),
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req, res);
    if (!companyId) return;

    const quoteId = parseInt(req.params.id, 10);
    if (isNaN(quoteId)) {
      return res.status(400).json({ error: 'Invalid quote ID' });
    }

    const { phone: overridePhone, customMessage } = req.body;

    // Load quote + patient phone
    const result = await db.execute(sql`
      SELECT
        q.id, q.token, q.total_amount, q.status,
        p.name AS patient_name,
        p.phone AS patient_phone
      FROM quotes q
      JOIN patients p ON p.id = q.patient_id
      WHERE q.id = ${quoteId}
        AND q.company_id = ${companyId}
        AND q.deleted_at IS NULL
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    const quote = result.rows[0] as Record<string, any>;

    const targetPhone: string = overridePhone || quote.patient_phone;
    if (!targetPhone) {
      return res.status(422).json({
        error: 'No phone number available — provide one via the "phone" field',
      });
    }

    const publicUrl = `${process.env.BASE_URL}/orcamento/${quote.token}`;
    const formattedTotal = (Number(quote.total_amount) / 100).toLocaleString(
      'pt-BR',
      { style: 'currency', currency: 'BRL' },
    );
    const message =
      customMessage
        ? `${customMessage}\n\n${publicUrl}`
        : `Olá, ${quote.patient_name}! Seu orçamento no valor de ${formattedTotal} está disponível:\n\n${publicUrl}\n\nAcesse o link para visualizar e aprovar seu plano de tratamento.`;

    // Enqueue — dynamic import keeps the queue layer optional
    const { addWhatsAppJob } = await import('../queue/queues');
    await addWhatsAppJob({
      companyId,
      phone: targetPhone,
      message,
      type: 'quote',
    } as any);

    // Mark as sent
    await db.execute(sql`
      UPDATE quotes
      SET status = 'sent', sent_via = 'whatsapp', sent_at = NOW(), updated_at = NOW()
      WHERE id = ${quoteId}
        AND company_id = ${companyId}
    `);

    return res.json({
      success: true,
      message: 'WhatsApp message queued successfully',
      phone: targetPhone,
      publicUrl,
    });
  }),
);

// ---------------------------------------------------------------------------
// POST /api/v1/quotes/:id/send-email
// Enqueue an email with the public quote link
// ---------------------------------------------------------------------------

router.post(
  '/:id/send-email',
  authCheck,
  validate({ body: sendEmailSchema }),
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req, res);
    if (!companyId) return;

    const quoteId = parseInt(req.params.id, 10);
    if (isNaN(quoteId)) {
      return res.status(400).json({ error: 'Invalid quote ID' });
    }

    const {
      email: overrideEmail,
      subject: customSubject,
      customMessage,
    } = req.body;

    const result = await db.execute(sql`
      SELECT
        q.id, q.token, q.total_amount, q.status,
        p.name AS patient_name,
        p.email AS patient_email,
        c.name AS company_name
      FROM quotes q
      JOIN patients p  ON p.id = q.patient_id
      JOIN companies c ON c.id = q.company_id
      WHERE q.id = ${quoteId}
        AND q.company_id = ${companyId}
        AND q.deleted_at IS NULL
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    const quote = result.rows[0] as Record<string, any>;

    const targetEmail: string = overrideEmail || quote.patient_email;
    if (!targetEmail) {
      return res.status(422).json({
        error: 'No email address available — provide one via the "email" field',
      });
    }

    const publicUrl = `${process.env.BASE_URL}/orcamento/${quote.token}`;
    const formattedTotal = (Number(quote.total_amount) / 100).toLocaleString(
      'pt-BR',
      { style: 'currency', currency: 'BRL' },
    );
    const subject =
      customSubject || `Seu orçamento — ${quote.company_name}`;
    const body = customMessage
      ? `${customMessage}\n\n${publicUrl}`
      : `Olá, ${quote.patient_name}!\n\n` +
        `Seu orçamento no valor de ${formattedTotal} está pronto.\n\n` +
        `Acesse o link abaixo para visualizar e aprovar seu plano de tratamento:\n\n` +
        `${publicUrl}\n\n` +
        `Atenciosamente,\n${quote.company_name}`;

    const { addEmailJob } = await import('../queue/queues');
    await addEmailJob({
      to: targetEmail,
      subject,
      body,
      type: 'quote',
    } as any);

    await db.execute(sql`
      UPDATE quotes
      SET status = 'sent', sent_via = 'email', sent_at = NOW(), updated_at = NOW()
      WHERE id = ${quoteId}
        AND company_id = ${companyId}
    `);

    return res.json({
      success: true,
      message: 'Email queued successfully',
      email: targetEmail,
      publicUrl,
    });
  }),
);

// ---------------------------------------------------------------------------
// POST /api/v1/quotes/:id/approve-manual
// Clinic staff marks quote as approved (in-person or by phone)
// ---------------------------------------------------------------------------

router.post(
  '/:id/approve-manual',
  authCheck,
  validate({ body: manualApproveSchema }),
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req, res);
    if (!companyId) return;

    const quoteId = parseInt(req.params.id, 10);
    if (isNaN(quoteId)) {
      return res.status(400).json({ error: 'Invalid quote ID' });
    }

    const { method, notes } = req.body;

    const result = await db.execute(sql`
      UPDATE quotes SET
        status             = 'approved',
        approved_at        = NOW(),
        approval_method    = ${method},
        notes              = COALESCE(${notes ?? null}, notes),
        updated_at         = NOW()
      WHERE id = ${quoteId}
        AND company_id = ${companyId}
        AND deleted_at IS NULL
        AND status NOT IN ('approved', 'rejected', 'expired')
      RETURNING *
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Quote not found or already in a terminal state',
      });
    }

    return res.json({
      success: true,
      message: 'Quote approved',
      quote: result.rows[0],
    });
  }),
);

// ---------------------------------------------------------------------------
// POST /api/v1/quotes/:id/generate-pdf
// Returns structured data for client-side PDF generation (e.g., jsPDF, Puppeteer)
// ---------------------------------------------------------------------------

router.post(
  '/:id/generate-pdf',
  authCheck,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req, res);
    if (!companyId) return;

    const quoteId = parseInt(req.params.id, 10);
    if (isNaN(quoteId)) {
      return res.status(400).json({ error: 'Invalid quote ID' });
    }

    const result = await db.execute(sql`
      SELECT
        q.*,
        p.name        AS patient_name,
        p.cpf         AS patient_cpf,
        p.phone       AS patient_phone,
        p.email       AS patient_email,
        p.address     AS patient_address,
        u.full_name   AS professional_name,
        u.speciality  AS professional_speciality,
        c.name        AS company_name,
        c.cnpj        AS company_cnpj,
        c.phone       AS company_phone,
        c.email       AS company_email,
        c.address     AS company_address
      FROM quotes q
      JOIN patients p  ON p.id = q.patient_id
      JOIN companies c ON c.id = q.company_id
      LEFT JOIN users u ON u.id = q.professional_id
      WHERE q.id = ${quoteId}
        AND q.company_id = ${companyId}
        AND q.deleted_at IS NULL
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    const quote = result.rows[0] as Record<string, any>;

    // Fetch company logo from settings (best-effort)
    const settingsResult = await db.execute(sql`
      SELECT logo_url, clinic_name FROM company_settings
      WHERE company_id = ${companyId}
      LIMIT 1
    `);
    const settings = (settingsResult.rows[0] as Record<string, any>) ?? {};

    // Build structured PDF payload — client renders this with jsPDF / react-pdf
    const pdfData = {
      generatedAt: new Date().toISOString(),
      publicUrl: `${process.env.BASE_URL}/orcamento/${quote.token}`,
      clinic: {
        name: settings.clinic_name || quote.company_name,
        cnpj: quote.company_cnpj,
        phone: quote.company_phone,
        email: quote.company_email,
        address: quote.company_address,
        logoUrl: settings.logo_url ?? null,
      },
      patient: {
        name: quote.patient_name,
        cpf: quote.patient_cpf,
        phone: quote.patient_phone,
        email: quote.patient_email,
        address: quote.patient_address,
      },
      professional: {
        name: quote.professional_name,
        speciality: quote.professional_speciality,
      },
      quote: {
        id: quote.id,
        status: quote.status,
        createdAt: quote.created_at,
        validUntil: quote.valid_until,
        items: quote.items,
        subtotal: quote.subtotal,
        discountPercent: quote.discount_percent,
        discountAmount: quote.discount_amount,
        totalAmount: quote.total_amount,
        installments: quote.installments,
        installmentValue: quote.installment_value,
        interestRate: quote.interest_rate,
        totalWithInterest: quote.total_with_interest,
        notes: quote.notes,
      },
    };

    return res.json(pdfData);
  }),
);

// ===========================================================================
// PUBLIC ROUTES — No authentication required
// ===========================================================================

// ---------------------------------------------------------------------------
// GET /api/v1/quotes/public/:token
// Patient views the quote — marks as "viewed" on first access
// ---------------------------------------------------------------------------

router.get(
  '/public/:token',
  publicTokenLimiter,
  asyncHandler(async (req, res) => {
    const { token } = req.params;

    if (!token || token.length !== 64) {
      return res.status(400).json({ error: 'Invalid token' });
    }

    const result = await db.execute(sql`
      SELECT
        q.id,
        q.token,
        q.items,
        q.subtotal,
        q.discount_percent,
        q.discount_amount,
        q.total_amount,
        q.installments,
        q.installment_value,
        q.interest_rate,
        q.total_with_interest,
        q.status,
        q.valid_until,
        q.approved_at,
        q.approval_method,
        q.notes,
        p.name   AS patient_name,
        p.email  AS patient_email,
        u.full_name AS professional_name,
        u.speciality AS professional_speciality,
        c.name   AS company_name,
        c.phone  AS company_phone,
        c.email  AS company_email
      FROM quotes q
      JOIN patients p  ON p.id = q.patient_id
      JOIN companies c ON c.id = q.company_id
      LEFT JOIN users u ON u.id = q.professional_id
      WHERE q.token = ${token}
        AND q.deleted_at IS NULL
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    const quote = result.rows[0] as Record<string, any>;

    // Check expiry
    if (quote.valid_until && new Date(quote.valid_until) < new Date()) {
      // Mark expired if not already in terminal state
      if (!['approved', 'rejected', 'expired'].includes(quote.status)) {
        await db.execute(sql`
          UPDATE quotes SET status = 'expired', updated_at = NOW()
          WHERE token = ${token}
        `);
        quote.status = 'expired';
      }
    }

    // First view — advance status from 'sent' to 'viewed'
    if (quote.status === 'sent') {
      await db.execute(sql`
        UPDATE quotes
        SET status = 'viewed', updated_at = NOW()
        WHERE token = ${token}
          AND status = 'sent'
      `);
      quote.status = 'viewed';
    }

    // Never expose internal columns (company_id, created_by, etc.)
    return res.json({
      id: quote.id,
      status: quote.status,
      items: quote.items,
      subtotal: quote.subtotal,
      discountPercent: quote.discount_percent,
      discountAmount: quote.discount_amount,
      totalAmount: quote.total_amount,
      installments: quote.installments,
      installmentValue: quote.installment_value,
      interestRate: quote.interest_rate,
      totalWithInterest: quote.total_with_interest,
      validUntil: quote.valid_until,
      approvedAt: quote.approved_at,
      approvalMethod: quote.approval_method,
      notes: quote.notes,
      patientName: quote.patient_name,
      professionalName: quote.professional_name,
      professionalSpeciality: quote.professional_speciality,
      companyName: quote.company_name,
      companyPhone: quote.company_phone,
      companyEmail: quote.company_email,
    });
  }),
);

// ---------------------------------------------------------------------------
// POST /api/v1/quotes/public/:token/approve
// Patient approves the quote through the public link
// ---------------------------------------------------------------------------

router.post(
  '/public/:token/approve',
  publicSubmitLimiter,
  validate({ body: patientApproveSchema }),
  asyncHandler(async (req, res) => {
    const { token } = req.params;

    if (!token || token.length !== 64) {
      return res.status(400).json({ error: 'Invalid token' });
    }

    // Capture real IP (respects X-Forwarded-For from reverse proxies)
    const ipAddress =
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      'unknown';

    // Verify quote exists and is in an approvable state
    const check = await db.execute(sql`
      SELECT id, status, valid_until FROM quotes
      WHERE token = ${token}
        AND deleted_at IS NULL
    `);

    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    const q = check.rows[0] as Record<string, any>;

    if (q.valid_until && new Date(q.valid_until) < new Date()) {
      return res.status(410).json({ error: 'This quote has expired' });
    }

    if (q.status === 'approved') {
      return res.status(409).json({ error: 'Quote already approved' });
    }

    if (['rejected', 'expired'].includes(q.status)) {
      return res.status(409).json({
        error: `Quote is in state "${q.status}" and cannot be approved`,
      });
    }

    const result = await db.execute(sql`
      UPDATE quotes SET
        status             = 'approved',
        approved_at        = NOW(),
        approval_ip_address= ${ipAddress},
        approval_method    = 'link',
        updated_at         = NOW()
      WHERE token = ${token}
        AND deleted_at IS NULL
      RETURNING id, status, approved_at, approval_method
    `);

    return res.json({
      success: true,
      message: 'Quote approved successfully',
      ...result.rows[0],
    });
  }),
);

// ---------------------------------------------------------------------------
// POST /api/v1/quotes/public/:token/reject
// Patient rejects the quote through the public link
// ---------------------------------------------------------------------------

router.post(
  '/public/:token/reject',
  publicSubmitLimiter,
  validate({ body: patientRejectSchema }),
  asyncHandler(async (req, res) => {
    const { token } = req.params;

    if (!token || token.length !== 64) {
      return res.status(400).json({ error: 'Invalid token' });
    }

    const { reason } = req.body;

    const check = await db.execute(sql`
      SELECT id, status FROM quotes
      WHERE token = ${token}
        AND deleted_at IS NULL
    `);

    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    const q = check.rows[0] as Record<string, any>;

    if (['approved', 'rejected', 'expired'].includes(q.status)) {
      return res.status(409).json({
        error: `Quote is already "${q.status}"`,
      });
    }

    const result = await db.execute(sql`
      UPDATE quotes SET
        status           = 'rejected',
        rejection_reason = ${reason},
        updated_at       = NOW()
      WHERE token = ${token}
        AND deleted_at IS NULL
      RETURNING id, status, rejection_reason
    `);

    return res.json({
      success: true,
      message: 'Quote rejected',
      ...result.rows[0],
    });
  }),
);

export default router;
