/**
 * Auto Receipt Generator
 * Generates a Brazilian-compliant payment receipt (Recibo) PDF using PDFKit.
 * Returns the server-relative URL path to the saved file so it can be served
 * as a static asset or streamed back to the client.
 */

import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { logger } from '../logger';

const receiptLogger = logger.child({ module: 'receipt-generator' });

export interface ReceiptData {
  companyName: string;
  companyAddress?: string;
  companyCnpj?: string;
  companyPhone?: string;
  patientName: string;
  patientCpf?: string;
  description: string;
  /** Amount in cents (integer) */
  amount: number;
  paymentMethod: string;
  paymentDate: Date;
  receiptNumber: string;
  /** e.g. "Parcela 2/6" */
  installmentInfo?: string;
}

/**
 * Generate a receipt PDF and persist it under uploads/receipts/.
 * @returns The server-relative URL path (e.g. "/uploads/receipts/recibo_xxx.pdf").
 */
export async function generateReceipt(data: ReceiptData): Promise<string> {
  const uploadsDir = path.join(process.cwd(), 'uploads', 'receipts');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const safeName = data.receiptNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `recibo_${safeName}_${Date.now()}.pdf`;
  const filepath = path.join(uploadsDir, filename);

  receiptLogger.info(
    { receiptNumber: data.receiptNumber, patientName: data.patientName },
    'Generating receipt PDF'
  );

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const stream = fs.createWriteStream(filepath);
    doc.pipe(stream);

    // ─── Header ────────────────────────────────────────────────────────────────
    doc
      .fontSize(22)
      .font('Helvetica-Bold')
      .text('RECIBO', { align: 'center' });

    doc
      .fontSize(10)
      .font('Helvetica')
      .text(`N. ${data.receiptNumber}`, { align: 'center' });

    doc.moveDown(1.5);

    // ─── Company block ─────────────────────────────────────────────────────────
    doc.fontSize(13).font('Helvetica-Bold').text(data.companyName);

    doc.fontSize(9).font('Helvetica');
    if (data.companyAddress) doc.text(data.companyAddress);
    if (data.companyCnpj) doc.text(`CNPJ: ${data.companyCnpj}`);
    if (data.companyPhone) doc.text(`Tel: ${data.companyPhone}`);

    doc.moveDown(1);

    // ─── Separator ─────────────────────────────────────────────────────────────
    doc
      .moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .strokeColor('#333333')
      .lineWidth(0.5)
      .stroke();

    doc.moveDown(1);

    // ─── Receipt body ──────────────────────────────────────────────────────────
    const amountBRL = (data.amount / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });

    const patientLabel = data.patientCpf
      ? `${data.patientName} (CPF: ${data.patientCpf})`
      : data.patientName;

    doc.fontSize(11).font('Helvetica');
    doc.text(`Recebi de ${patientLabel}`);
    doc.text(`a quantia de ${amountBRL}`);
    doc.text(`referente a: ${data.description}`);

    if (data.installmentInfo) {
      doc.text(data.installmentInfo);
    }

    doc.moveDown(1);
    doc.text(`Forma de pagamento: ${data.paymentMethod}`);
    doc.text(
      `Data: ${data.paymentDate.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })}`
    );

    doc.moveDown(3);

    // ─── Signature line ────────────────────────────────────────────────────────
    const pageWidth = doc.page.width - 100; // accounting for margins
    const lineStart = 50 + (pageWidth - 250) / 2;
    const lineEnd = lineStart + 250;

    doc
      .moveTo(lineStart, doc.y)
      .lineTo(lineEnd, doc.y)
      .strokeColor('#000000')
      .lineWidth(0.5)
      .stroke();

    doc.moveDown(0.4);
    doc.fontSize(9).text('Assinatura', { align: 'center' });
    doc.fontSize(8).text(data.companyName, { align: 'center' });

    // ─── Footer ────────────────────────────────────────────────────────────────
    doc.moveDown(2);
    doc
      .fontSize(7)
      .fillColor('#888888')
      .text(
        `Documento gerado eletronicamente em ${new Date().toLocaleString('pt-BR')}`,
        { align: 'center' }
      );

    doc.end();

    stream.on('finish', () => {
      receiptLogger.info({ filepath }, 'Receipt PDF saved');
      resolve(`/uploads/receipts/${filename}`);
    });

    stream.on('error', (err) => {
      receiptLogger.error({ err }, 'Failed to write receipt PDF');
      reject(err);
    });
  });
}

/**
 * Convenience helper: generate a receipt PDF directly from an accounts_receivable
 * record row and company data fetched by the caller.
 */
export async function generateReceiptFromPayment(params: {
  companyId: number;
  patientId: number;
  amount: number;
  description: string;
  paymentMethod: string;
  paymentDate: Date;
  installmentInfo?: string;
}): Promise<string> {
  const { db } = await import('../db');

  // Fetch company details
  const companyResult = await db.$client.query(
    `SELECT name, address, cnpj, phone FROM companies WHERE id = $1 LIMIT 1`,
    [params.companyId]
  );
  const company = companyResult.rows[0] ?? {};

  // Fetch patient details
  const patientResult = await db.$client.query(
    `SELECT full_name, cpf FROM patients WHERE id = $1 AND company_id = $2 LIMIT 1`,
    [params.patientId, params.companyId]
  );
  const patient = patientResult.rows[0] ?? {};

  // Generate sequential receipt number using the DB sequence or timestamp fallback
  const seqResult = await db.$client
    .query(
      `SELECT COALESCE(MAX(receipt_number_seq), 0) + 1 AS next
       FROM financial_transactions
       WHERE company_id = $1`,
      [params.companyId]
    )
    .catch(() => ({ rows: [{ next: Date.now() }] }));

  const receiptNumber = String(seqResult.rows[0]?.next ?? Date.now()).padStart(6, '0');

  const receiptData: ReceiptData = {
    companyName: company.name ?? 'Clínica',
    companyAddress: company.address,
    companyCnpj: company.cnpj,
    companyPhone: company.phone,
    patientName: patient.full_name ?? 'Paciente',
    patientCpf: patient.cpf,
    description: params.description,
    amount: params.amount,
    paymentMethod: params.paymentMethod,
    paymentDate: params.paymentDate,
    receiptNumber,
    installmentInfo: params.installmentInfo,
  };

  return generateReceipt(receiptData);
}
