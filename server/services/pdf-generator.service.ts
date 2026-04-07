import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { logger } from '../logger';
export interface PrescriptionData {
  id: number;
  patientName: string;
  patientAge?: number;
  patientCpf?: string;
  professionalName: string;
  professionalCro: string;
  professionalCroState: string;
  type: string; // 'prescription', 'certificate', 'attestation'
  title: string;
  content: string;
  medications?: Array<{
    name: string;
    dosage: string;
    usage: string;
  }>;
  instructions?: string;
  period?: string;
  cid?: string;
  date: Date;
  clinicName?: string;
  clinicAddress?: string;
  clinicPhone?: string;
  validationUrl?: string;
}

export class PdfGeneratorService {
  /**
   * Gera PDF de prescrição médica/odontológica
   */
  async generatePrescriptionPDF(data: PrescriptionData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 }
      });

      const buffers: Buffer[] = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });
      doc.on('error', reject);

      // Header com logo da clínica (se houver)
      doc.fontSize(20)
        .font('Helvetica-Bold')
        .text(data.clinicName || 'Clínica Odontológica', { align: 'center' });

      if (data.clinicAddress) {
        doc.fontSize(10)
          .font('Helvetica')
          .text(data.clinicAddress, { align: 'center' });
      }

      if (data.clinicPhone) {
        doc.text(data.clinicPhone, { align: 'center' });
      }

      doc.moveDown(2);

      // Linha separadora
      doc.moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .stroke();

      doc.moveDown();

      // Título do documento
      doc.fontSize(16)
        .font('Helvetica-Bold')
        .text(data.title, { align: 'center' });

      doc.moveDown(2);

      // Dados do paciente
      doc.fontSize(12)
        .font('Helvetica-Bold')
        .text('Paciente:', { continued: false });

      doc.font('Helvetica')
        .text(`Nome: ${data.patientName}`);

      if (data.patientAge) {
        doc.text(`Idade: ${data.patientAge} anos`);
      }

      if (data.patientCpf) {
        doc.text(`CPF: ${data.patientCpf}`);
      }

      doc.moveDown();

      // Data
      doc.text(`Data: ${format(data.date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`);

      doc.moveDown(2);

      // Conteúdo específico por tipo
      if (data.type === 'prescription' && data.medications) {
        // Receita Médica
        doc.fontSize(14)
          .font('Helvetica-Bold')
          .text('Medicamentos Prescritos:', { underline: true });

        doc.moveDown();

        data.medications.forEach((med, index) => {
          doc.fontSize(12)
            .font('Helvetica-Bold')
            .text(`${index + 1}. ${med.name}`, { continued: false });

          doc.font('Helvetica')
            .text(`   Dosagem: ${med.dosage}`)
            .text(`   Uso: ${med.usage}`);

          doc.moveDown(0.5);
        });

        if (data.instructions) {
          doc.moveDown();
          doc.fontSize(12)
            .font('Helvetica-Bold')
            .text('Instruções:', { underline: true });

          doc.font('Helvetica')
            .text(data.instructions, { align: 'justify' });
        }
      } else {
        // Atestado ou Declaração
        doc.fontSize(12)
          .font('Helvetica')
          .text(data.content, { align: 'justify' });

        if (data.period) {
          doc.moveDown();
          doc.font('Helvetica-Bold')
            .text(`Período: ${data.period}`);
        }

        if (data.cid) {
          doc.text(`CID: ${data.cid}`);
        }
      }

      doc.moveDown(3);

      // QR Code para validação (se houver URL)
      if (data.validationUrl) {
        this.addQRCode(doc, data.validationUrl).then(() => {
          this.addSignatureSection(doc, data);
          doc.end();
        }).catch(reject);
      } else {
        this.addSignatureSection(doc, data);
        doc.end();
      }
    });
  }

  /**
   * Adiciona QR Code ao PDF
   */
  private async addQRCode(doc: PDFKit.PDFDocument, validationUrl: string): Promise<void> {
    try {
      const qrCodeDataUrl = await QRCode.toDataURL(validationUrl, {
        width: 150,
        margin: 1
      });

      // Converter data URL para buffer
      const base64Data = qrCodeDataUrl.replace(/^data:image\/png;base64,/, '');
      const imageBuffer = Buffer.from(base64Data, 'base64');

      // Adicionar QR code no canto inferior direito
      doc.image(imageBuffer, 420, doc.page.height - 200, {
        width: 120,
        height: 120
      });

      doc.fontSize(8)
        .font('Helvetica')
        .text('Validar no Portal CFO', 420, doc.page.height - 75, {
          width: 120,
          align: 'center'
        });
    } catch (error) {
      logger.error({ err: error }, 'Error generating QR code:');
    }
  }

  /**
   * Adiciona seção de assinatura ao PDF
   */
  private addSignatureSection(doc: PDFKit.PDFDocument, data: PrescriptionData): void {
    const signatureY = doc.page.height - 150;

    // Linha de assinatura
    doc.moveTo(50, signatureY)
      .lineTo(300, signatureY)
      .stroke();

    doc.fontSize(10)
      .font('Helvetica-Bold')
      .text(data.professionalName, 50, signatureY + 10, {
        width: 250,
        align: 'center'
      });

    doc.font('Helvetica')
      .text(`CRO-${data.professionalCroState}: ${data.professionalCro}`, 50, signatureY + 25, {
        width: 250,
        align: 'center'
      });

    // Rodapé com informações de autenticidade
    doc.fontSize(8)
      .font('Helvetica-Oblique')
      .text('Documento gerado eletronicamente', 50, doc.page.height - 50, {
        align: 'center',
        width: doc.page.width - 100
      });

    if (data.validationUrl) {
      doc.text(data.validationUrl, {
        align: 'center',
        link: data.validationUrl
      });
    }
  }

  /**
   * Gera PDF genérico a partir de HTML (para casos mais complexos)
   */
  async generatePDFFromHTML(html: string): Promise<Buffer> {
    // TODO: Implementar conversão HTML -> PDF se necessário
    // Pode usar bibliotecas como html-pdf ou puppeteer
    throw new Error('HTML to PDF conversion not implemented yet');
  }
}

// Export singleton
export const pdfGenerator = new PdfGeneratorService();

// ---------------------------------------------------------------------------
// Report HTML Generator
//
// Generates a self-contained, print-ready HTML page from tabular report data.
// The client opens the response in a new browser tab; the user invokes the
// browser's native Print dialog (Ctrl/Cmd + P) and chooses "Save as PDF".
//
// Trade-off vs. PDFKit: layout is controlled by the browser's print engine
// rather than pixel-perfect coordinates. For tabular clinic reports this is
// acceptable and produces cleaner pagination than manual PDFKit arithmetic.
// ---------------------------------------------------------------------------

export interface PdfReportColumn {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  format?: 'currency' | 'percent' | 'date' | 'number' | 'text';
}

export interface PdfSummaryItem {
  label: string;
  value: string;
}

export interface PdfReportOptions {
  title: string;
  subtitle?: string;
  clinicName?: string;
  dateRange?: string;
  columns: PdfReportColumn[];
  data: Record<string, unknown>[];
  summary?: PdfSummaryItem[];
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatReportCell(value: unknown, col: PdfReportColumn): string {
  if (value === null || value === undefined) return '-';

  if (col.format === 'currency') {
    const num = typeof value === 'number' ? value : parseFloat(String(value));
    if (isNaN(num)) return '-';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num / 100);
  }

  if (col.format === 'percent') {
    const num = typeof value === 'number' ? value : parseFloat(String(value));
    if (isNaN(num)) return '-';
    return `${num.toFixed(1)}%`;
  }

  if (col.format === 'date') {
    try {
      return new Date(String(value)).toLocaleDateString('pt-BR');
    } catch {
      return String(value);
    }
  }

  if (col.format === 'number') {
    const num = typeof value === 'number' ? value : parseFloat(String(value));
    if (isNaN(num)) return '-';
    return num.toLocaleString('pt-BR');
  }

  // Heuristic inference from key name when no explicit format is provided
  if (typeof value === 'number') {
    const key = col.key.toLowerCase();
    if (/amount|value|total|receita|valor|custo|preco|price|faturamento|revenue|commission|balance/.test(key)) {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value / 100);
    }
    if (/percent|taxa|rate/.test(key)) {
      return `${value.toFixed(1)}%`;
    }
    return value.toLocaleString('pt-BR');
  }

  return escapeHtml(String(value));
}

export function generateReportHtml(options: PdfReportOptions): string {
  const { title, subtitle, clinicName, dateRange, columns, data, summary } = options;

  const now = new Date();
  const generatedAt = `${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

  const headerCells = columns
    .map((col) => `<th class="th" style="text-align:${col.align ?? 'left'};">${escapeHtml(col.label)}</th>`)
    .join('');

  const tableRows =
    data.length === 0
      ? `<tr><td colspan="${columns.length}" class="empty-cell">Nenhum dado encontrado para o periodo selecionado</td></tr>`
      : data
          .map(
            (row) =>
              `<tr>${columns
                .map(
                  (col) =>
                    `<td class="cell" style="text-align:${col.align ?? 'left'};">${formatReportCell(row[col.key], col)}</td>`,
                )
                .join('')}</tr>`,
          )
          .join('\n');

  const summaryHtml =
    summary && summary.length > 0
      ? `<div class="summary">${summary
          .map(
            (s) =>
              `<div class="summary-row"><span class="summary-label">${escapeHtml(s.label)}</span><strong class="summary-value">${escapeHtml(s.value)}</strong></div>`,
          )
          .join('\n')}</div>`
      : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 13px;
      color: #111827;
      background: #fff;
      max-width: 1100px;
      margin: 0 auto;
      padding: 24px 28px;
    }
    .btn-bar { display: flex; justify-content: flex-end; margin-bottom: 20px; gap: 8px; }
    .btn-print {
      padding: 8px 20px; background: #2563eb; color: #fff;
      border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500;
    }
    .btn-print:hover { background: #1d4ed8; }
    .btn-close {
      padding: 8px 16px; background: #f3f4f6; color: #374151;
      border: 1px solid #d1d5db; border-radius: 6px; cursor: pointer; font-size: 14px;
    }
    .btn-close:hover { background: #e5e7eb; }
    .report-header {
      display: flex; justify-content: space-between; align-items: flex-start;
      margin-bottom: 20px; padding-bottom: 16px; border-bottom: 2px solid #e5e7eb;
    }
    .report-title { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
    .report-subtitle { color: #6b7280; font-size: 13px; margin-top: 2px; }
    .report-date { color: #6b7280; font-size: 12px; margin-top: 4px; }
    .clinic-info { text-align: right; }
    .clinic-name { font-size: 14px; font-weight: 600; }
    .generated-at { color: #9ca3af; font-size: 11px; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 4px; }
    .th {
      background: #f3f4f6; padding: 8px 10px; font-size: 11px;
      font-weight: 600; color: #374151; border-bottom: 2px solid #d1d5db; white-space: nowrap;
    }
    .cell { padding: 6px 10px; border-bottom: 1px solid #e5e7eb; font-size: 12px; }
    tr:hover .cell { background: #f9fafb; }
    .empty-cell { text-align: center; padding: 20px; color: #9ca3af; }
    .summary {
      margin-top: 20px; padding: 14px 16px;
      background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px;
    }
    .summary-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
    .summary-label { color: #6b7280; }
    .summary-value { font-weight: 600; }
    .report-footer {
      margin-top: 28px; padding-top: 10px;
      border-top: 1px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 10px;
    }
    @media print {
      .btn-bar { display: none !important; }
      body { padding: 0; max-width: 100%; }
      tr:hover .cell { background: transparent; }
      @page { margin: 15mm; size: A4 landscape; }
    }
  </style>
</head>
<body>
  <div class="btn-bar">
    <button class="btn-close" onclick="window.close()">Fechar</button>
    <button class="btn-print" onclick="window.print()">Imprimir / Salvar PDF</button>
  </div>

  <div class="report-header">
    <div>
      <h1 class="report-title">${escapeHtml(title)}</h1>
      ${subtitle ? `<p class="report-subtitle">${escapeHtml(subtitle)}</p>` : ''}
      ${dateRange ? `<p class="report-date">Periodo: ${escapeHtml(dateRange)}</p>` : ''}
    </div>
    ${clinicName
      ? `<div class="clinic-info"><div class="clinic-name">${escapeHtml(clinicName)}</div><div class="generated-at">Gerado em ${generatedAt}</div></div>`
      : `<div class="generated-at">${generatedAt}</div>`}
  </div>

  <table>
    <thead><tr>${headerCells}</tr></thead>
    <tbody>${tableRows}</tbody>
  </table>

  ${summaryHtml}

  <div class="report-footer">
    Documento gerado automaticamente pelo sistema &mdash; ${generatedAt}
  </div>
</body>
</html>`;
}
