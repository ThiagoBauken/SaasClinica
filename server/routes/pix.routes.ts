/**
 * PIX QR Code — dynamic generation endpoint
 *
 * POST /api/v1/payments/pix
 *
 * Generates a Brazilian PIX EMV QR-code payload (Pix Copia e Cola) and a
 * data-URL PNG image for display in the frontend.  When MercadoPago is
 * configured the endpoint will delegate to that gateway (future work stub);
 * otherwise it builds a static EMV payload using the clinic's configured PIX
 * key, which is stored in clinicSettings.financialSettings.pixKey.
 *
 * The generated QR code is saved as a pending `payments` record so that
 * webhook reconciliation or manual confirmation can later update its status.
 */

import { Router } from 'express';
import { authCheck, asyncHandler } from '../middleware/auth';
import { z } from 'zod';
import { db } from '../db';
import { payments, clinicSettings } from '@shared/schema';
import { eq } from 'drizzle-orm';
import QRCode from 'qrcode';

const router = Router();

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

const pixRequestSchema = z.object({
  amount: z
    .number({ required_error: 'amount é obrigatório' })
    .positive({ message: 'Valor deve ser positivo' }),
  patientId: z.number().int().positive().optional(),
  description: z.string().max(30).optional(),
  appointmentId: z.number().int().positive().optional(),
});

// ---------------------------------------------------------------------------
// EMV / PIX payload helpers
// ---------------------------------------------------------------------------

/**
 * Encodes a single EMV TLV field: ID (2 chars) + length (2 chars) + value.
 */
function emvField(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return `${id}${len}${value}`;
}

/**
 * Computes CRC-16/CCITT-FALSE checksum (polynomial 0x1021, init 0xFFFF,
 * no reflection, XOR-out 0x0000).  This is the algorithm mandated by the
 * Banco Central do Brasil for PIX QR code integrity.
 */
function crc16Ccitt(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Options for generatePixPayload.
 */
export interface PixPayloadOptions {
  pixKey: string;
  amount: number;          // decimal (e.g. 150.00)
  merchantName: string;    // max 25 chars
  merchantCity: string;    // max 15 chars
  txid?: string;           // max 25 chars, alphanumeric + hyphen
  description?: string;    // max 30 chars, optional (goes into txid field if present)
}

/**
 * Builds a valid PIX EMV QR-code payload string ready to be encoded into a
 * QR image.  The payload includes the CRC-16 check at the end.
 *
 * Field reference: BCB Resolução nº 1 de 2020 — Anexo II.
 */
export function generatePixPayload(opts: PixPayloadOptions): string {
  const {
    pixKey,
    amount,
    merchantName,
    merchantCity,
    txid,
    description,
  } = opts;

  // ---- 26: Merchant Account Information (GUI + key) ----
  const gui = emvField('00', 'br.gov.bcb.pix');
  const keyField = emvField('01', pixKey);
  // Optional description inside field 26
  const descField = description ? emvField('02', description.substring(0, 30)) : '';
  const merchantAccount = emvField('26', gui + keyField + descField);

  // ---- 62: Additional Data Field Template (txid) ----
  const safeTxid = (txid ?? '***').replace(/[^a-zA-Z0-9-]/g, '').substring(0, 25) || '***';
  const additionalData = emvField('62', emvField('05', safeTxid));

  // ---- Amount: only include when non-zero (omitting = "any amount") ----
  const amountStr = amount.toFixed(2);
  const amountField = amount > 0 ? emvField('54', amountStr) : '';

  // ---- Assemble payload (without CRC) ----
  const payloadWithoutCrc =
    emvField('00', '01') +        // Payload Format Indicator
    emvField('01', '12') +        // Point of Initiation Method: 12 = dynamic
    merchantAccount +              // 26
    emvField('52', '0000') +       // Merchant Category Code (unspecified)
    emvField('53', '986') +        // Transaction Currency: BRL
    amountField +                  // 54 (may be empty)
    emvField('58', 'BR') +         // Country Code
    emvField('59', merchantName.substring(0, 25)) +  // Merchant Name
    emvField('60', merchantCity.substring(0, 15)) +  // Merchant City
    additionalData +               // 62
    '6304';                        // CRC tag + length placeholder

  const crc = crc16Ccitt(payloadWithoutCrc);
  return payloadWithoutCrc + crc;
}

// ---------------------------------------------------------------------------
// POST /pix
// ---------------------------------------------------------------------------

/**
 * POST /api/v1/payments/pix
 *
 * Body:
 *   amount       number   — value in BRL (e.g. 150.00)
 *   patientId    number?  — patient ID for record linkage
 *   description  string?  — up to 30 chars shown on payer's banking app
 *   appointmentId number? — appointment ID to link the payment
 *
 * Response:
 *   paymentId    number   — ID of the newly created pending payment record
 *   qrCode       string   — data:image/png;base64,… ready for <img src="…">
 *   pixCopiaECola string  — raw EMV payload for "Copia e Cola"
 *   amount       number   — echoed back
 *   expiresIn    string   — informational expiry notice
 */
router.post(
  '/pix',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'Usuário não está associado a nenhuma empresa' });
    }

    // Validate request body
    const parseResult = pixRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Dados inválidos',
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const { amount, patientId, description, appointmentId } = parseResult.data;

    // Load clinic settings
    const [settings] = await db
      .select()
      .from(clinicSettings)
      .where(eq(clinicSettings.companyId, companyId))
      .limit(1);

    // Resolve PIX key: prefer dedicated financialSettings.pixKey, fall back to CNPJ
    const financialSettings = (settings?.financialSettings as Record<string, any>) ?? {};
    const pixKey: string =
      financialSettings.pixKey ||
      settings?.cnpj?.replace(/[^\d]/g, '') || // CNPJ digits-only as PIX key
      '';

    if (!pixKey) {
      return res.status(400).json({
        error: 'Chave PIX não configurada. Configure em Configurações > Financeiro.',
      });
    }

    const clinicName = settings?.name || 'Clinica';
    const city = (settings?.city || 'SAO PAULO')
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, ''); // strip accents — BCB requires ASCII

    // Build a deterministic-enough txid
    const txid = `C${companyId}${patientId ? `P${patientId}` : ''}${Date.now().toString(36).toUpperCase()}`.substring(0, 25);

    // Generate EMV payload
    const pixPayload = generatePixPayload({
      pixKey,
      amount,
      merchantName: clinicName
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .substring(0, 25),
      merchantCity: city.substring(0, 15),
      txid,
      description: description || 'Pagamento clinica',
    });

    // Generate QR code PNG data URL
    const qrCodeDataUrl = await QRCode.toDataURL(pixPayload, {
      width: 400,
      margin: 2,
      errorCorrectionLevel: 'M',
    });

    // Persist as a pending payment record
    // amount column is stored in cents (integer)
    const amountCents = Math.round(amount * 100);

    const [payment] = await db
      .insert(payments)
      .values({
        companyId,
        patientId: patientId ?? null,
        appointmentId: appointmentId ?? null,
        amount: amountCents,
        status: 'pending',
        paymentDate: new Date(),
        paymentMethod: 'pix',
        // description repurposed to store the raw EMV payload for audit/reconciliation
        description: pixPayload,
      })
      .returning();

    return res.status(201).json({
      paymentId: payment.id,
      qrCode: qrCodeDataUrl,
      pixCopiaECola: pixPayload,
      amount,
      expiresIn: '30 minutes',
    });
  }),
);

export default router;
