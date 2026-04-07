/**
 * Zod validation schemas for the Quotes (Orçamentos) feature.
 *
 * Used by the validate() middleware in quotes.routes.ts.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Quote item (one line of the budget)
// ---------------------------------------------------------------------------

export const quoteItemSchema = z.object({
  /** Human-readable procedure/service name */
  procedureName: z.string().min(1, 'Nome do procedimento é obrigatório').max(255),
  /** How many units of the procedure */
  quantity: z.number().int().min(1, 'Quantidade mínima é 1'),
  /** Unit price in centavos (integer) */
  unitPrice: z.number().int().min(0, 'Preço unitário não pode ser negativo'),
  /** Optional reference to a procedures table row */
  procedureId: z.number().int().positive().optional(),
});

export type QuoteItemInput = z.infer<typeof quoteItemSchema>;

// ---------------------------------------------------------------------------
// Create quote
// ---------------------------------------------------------------------------

export const createQuoteSchema = z.object({
  /** Required: patient this quote belongs to */
  patientId: z.number().int().positive('patientId é obrigatório'),

  /** Optional: link to an existing treatment plan */
  treatmentPlanId: z.number().int().positive().optional(),

  /** Optional: responsible professional */
  professionalId: z.number().int().positive().optional(),

  /** At least one line item is mandatory */
  items: z
    .array(quoteItemSchema)
    .min(1, 'O orçamento deve ter pelo menos um item'),

  /** Discount as percentage (0–100), stored as NUMERIC(5,2) */
  discountPercent: z
    .number()
    .min(0, 'Desconto não pode ser negativo')
    .max(100, 'Desconto não pode exceder 100%')
    .optional()
    .default(0),

  /** Fixed discount amount in centavos — applied after percentage discount */
  discountAmount: z
    .number()
    .int()
    .min(0, 'Valor de desconto não pode ser negativo')
    .optional()
    .default(0),

  /** Number of installments (1 = à vista) */
  installments: z.number().int().min(1).max(360).optional().default(1),

  /** Monthly interest rate applied to installments (0 = sem juros) */
  interestRate: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .default(0),

  /** Expiry date for the quote — ISO datetime string */
  validUntil: z.string().datetime({ offset: true }).optional(),

  /** Delivery channel for later reference */
  sentVia: z.enum(['whatsapp', 'email', 'manual']).optional(),

  /** Internal notes visible only to clinic staff */
  notes: z.string().max(2000).optional(),
});

export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;

// ---------------------------------------------------------------------------
// Update quote (all fields optional except they must pass the same rules)
// ---------------------------------------------------------------------------

export const updateQuoteSchema = createQuoteSchema
  .partial()
  .extend({
    /**
     * Allow explicitly updating the status for manual workflows,
     * e.g., marking as "approved" or "rejected" from the admin UI.
     */
    status: z
      .enum(['pending', 'sent', 'viewed', 'approved', 'rejected', 'expired'])
      .optional(),
  });

export type UpdateQuoteInput = z.infer<typeof updateQuoteSchema>;

// ---------------------------------------------------------------------------
// Query / filter params for GET /quotes
// ---------------------------------------------------------------------------

export const listQuotesQuerySchema = z.object({
  /** Filter by patient */
  patientId: z
    .string()
    .regex(/^\d+$/, 'patientId deve ser um número inteiro')
    .transform(Number)
    .optional(),

  /** Filter by lifecycle status */
  status: z
    .enum(['pending', 'sent', 'viewed', 'approved', 'rejected', 'expired'])
    .optional(),

  /** ISO date string — return quotes created on or after this date */
  dateFrom: z.string().datetime({ offset: true }).optional(),

  /** ISO date string — return quotes created on or before this date */
  dateTo: z.string().datetime({ offset: true }).optional(),

  /** Pagination */
  page: z
    .string()
    .optional()
    .default('1')
    .transform(val => {
      const n = parseInt(val, 10);
      return isNaN(n) || n < 1 ? 1 : n;
    }),
  limit: z
    .string()
    .optional()
    .default('50')
    .transform(val => {
      const n = parseInt(val, 10);
      return isNaN(n) || n < 1 ? 50 : Math.min(n, 200);
    }),
});

export type ListQuotesQuery = z.infer<typeof listQuotesQuerySchema>;

// ---------------------------------------------------------------------------
// Patient approval (public route — no auth required)
// ---------------------------------------------------------------------------

export const patientApproveSchema = z.object({
  /** Client signature/consent text captured on the approval page (optional) */
  signatureNote: z.string().max(500).optional(),
});

// ---------------------------------------------------------------------------
// Patient rejection (public route — no auth required)
// ---------------------------------------------------------------------------

export const patientRejectSchema = z.object({
  reason: z.string().min(1, 'Motivo é obrigatório').max(500),
});

// ---------------------------------------------------------------------------
// Manual approval by clinic staff
// ---------------------------------------------------------------------------

export const manualApproveSchema = z.object({
  /** How the approval was collected: 'manual' = phone/in-person verbal, 'presencial' = signed paper */
  method: z.enum(['manual', 'presencial']).default('manual'),
  notes: z.string().max(500).optional(),
});

// ---------------------------------------------------------------------------
// Send via WhatsApp
// ---------------------------------------------------------------------------

export const sendWhatsAppSchema = z.object({
  /** Override the patient's stored phone number (optional) */
  phone: z
    .string()
    .regex(/^\d{10,15}$/, 'Telefone deve conter entre 10 e 15 dígitos')
    .optional(),
  /** Custom message prepended before the quote link */
  customMessage: z.string().max(500).optional(),
});

// ---------------------------------------------------------------------------
// Send via Email
// ---------------------------------------------------------------------------

export const sendEmailSchema = z.object({
  /** Override the patient's stored email (optional) */
  email: z.string().email('E-mail inválido').optional(),
  /** Custom subject line */
  subject: z.string().max(255).optional(),
  /** Additional body text appended before the quote link */
  customMessage: z.string().max(1000).optional(),
});
