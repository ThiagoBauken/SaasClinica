/**
 * Report Export Service
 * Provides PDF and Excel (XLSX) export for tabular report data.
 * Uses pdfkit (already in dependencies) for PDF and xlsx for spreadsheets.
 */

import PDFDocument from 'pdfkit';
import * as XLSX from 'xlsx';
import type { Response } from 'express';

export interface ReportColumn {
  header: string;
  key: string;
  width?: number;
  format?: 'currency' | 'date' | 'percent' | 'number';
}

export interface ReportData {
  title: string;
  subtitle?: string;
  columns: ReportColumn[];
  rows: Record<string, any>[];
  summary?: Record<string, any>;
  companyName?: string;
  generatedAt?: Date;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatCell(value: any, format?: ReportColumn['format']): string {
  if (value === null || value === undefined) return '-';

  if (format === 'currency') {
    const num = typeof value === 'number' ? value : parseFloat(value);
    return `R$ ${(num / 100).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
  }

  if (format === 'date' && value) {
    try {
      return new Date(value).toLocaleDateString('pt-BR');
    } catch {
      return String(value);
    }
  }

  if (format === 'percent') {
    return `${value}%`;
  }

  return String(value);
}

function rawValue(value: any, format?: ReportColumn['format']): any {
  if (value === null || value === undefined) return '';

  if (format === 'currency') {
    const num = typeof value === 'number' ? value : parseFloat(value);
    return Number((num / 100).toFixed(2));
  }

  if (format === 'date' && value) {
    try {
      return new Date(value).toLocaleDateString('pt-BR');
    } catch {
      return String(value);
    }
  }

  if (format === 'percent') {
    return `${value}%`;
  }

  return value;
}

// ---------------------------------------------------------------------------
// PDF Export
// ---------------------------------------------------------------------------

export async function exportPDF(data: ReportData, res: Response): Promise<void> {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${data.title.replace(/\s+/g, '_')}.pdf"`
  );

  doc.pipe(res);

  // ---- Header ----
  doc.fontSize(16).font('Helvetica-Bold').text(data.title, { align: 'center' });

  if (data.subtitle) {
    doc.moveDown(0.2).fontSize(10).font('Helvetica').text(data.subtitle, { align: 'center' });
  }

  if (data.companyName) {
    doc.moveDown(0.2).fontSize(10).font('Helvetica').text(data.companyName, { align: 'center' });
  }

  doc
    .moveDown(0.2)
    .fontSize(8)
    .font('Helvetica')
    .text(
      `Gerado em: ${(data.generatedAt ?? new Date()).toLocaleDateString('pt-BR')} ${(data.generatedAt ?? new Date()).toLocaleTimeString('pt-BR')}`,
      { align: 'center' }
    );

  doc.moveDown(1.5);

  // ---- Table ----
  const pageWidth = doc.page.width - 100; // 50px margin each side
  const colCount = data.columns.length;

  // Compute column widths: prefer explicit, else distribute evenly
  const totalExplicit = data.columns.reduce((s, c) => s + (c.width ?? 0), 0);
  const colWidths: number[] = data.columns.map((col) => {
    if (col.width) {
      // treat width as proportion of pageWidth (pt units would be too small)
      return (col.width / (totalExplicit || colCount * 15)) * pageWidth;
    }
    return pageWidth / colCount;
  });

  // Header row
  const tableStartX = 50;
  let currentY = doc.y;

  doc.font('Helvetica-Bold').fontSize(8);

  let x = tableStartX;
  data.columns.forEach((col, i) => {
    doc.text(col.header, x, currentY, { width: colWidths[i] - 4, ellipsis: true });
    x += colWidths[i];
  });

  // Separator line under header
  currentY = doc.y + 3;
  doc.moveTo(tableStartX, currentY).lineTo(tableStartX + pageWidth, currentY).lineWidth(0.5).stroke();
  currentY += 4;

  // Data rows
  doc.font('Helvetica').fontSize(7);

  for (const row of data.rows) {
    // Page break guard
    if (currentY > doc.page.height - 80) {
      doc.addPage();
      currentY = doc.page.margins?.top ?? 50;
    }

    x = tableStartX;
    data.columns.forEach((col, i) => {
      const cellText = formatCell(row[col.key], col.format);
      doc.text(cellText, x, currentY, { width: colWidths[i] - 4, ellipsis: true });
      x += colWidths[i];
    });

    currentY += 14;
  }

  // ---- Summary ----
  if (data.summary && Object.keys(data.summary).length > 0) {
    currentY += 8;

    if (currentY > doc.page.height - 80) {
      doc.addPage();
      currentY = doc.page.margins?.top ?? 50;
    }

    doc.moveTo(tableStartX, currentY).lineTo(tableStartX + pageWidth, currentY).lineWidth(0.5).stroke();
    currentY += 6;

    doc.font('Helvetica-Bold').fontSize(8);

    Object.entries(data.summary).forEach(([key, val]) => {
      doc.text(`${key}: ${val}`, tableStartX, currentY);
      currentY += 13;
    });
  }

  doc.end();
}

// ---------------------------------------------------------------------------
// Excel Export
// ---------------------------------------------------------------------------

export async function exportExcel(data: ReportData, res: Response): Promise<void> {
  const wb = XLSX.utils.book_new();

  // Title row + blank row + header row + data rows + optional summary
  const sheetData: any[][] = [];

  // Row 1: title
  sheetData.push([data.title]);

  // Row 2: subtitle / company / generated-at
  const meta = [
    data.subtitle,
    data.companyName,
    `Gerado em: ${(data.generatedAt ?? new Date()).toLocaleDateString('pt-BR')}`,
  ]
    .filter(Boolean)
    .join(' | ');

  sheetData.push([meta]);

  // Row 3: blank
  sheetData.push([]);

  // Row 4: column headers
  sheetData.push(data.columns.map((c) => c.header));

  // Rows 5+: data
  for (const row of data.rows) {
    sheetData.push(data.columns.map((col) => rawValue(row[col.key], col.format)));
  }

  // Summary rows at the bottom (blank separator + key/value pairs)
  if (data.summary && Object.keys(data.summary).length > 0) {
    sheetData.push([]);
    for (const [key, val] of Object.entries(data.summary)) {
      sheetData.push([key, val]);
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // Column widths
  ws['!cols'] = data.columns.map((col) => ({
    wch: col.width ?? 18,
  }));

  // Merge title across all columns (row 0, cols 0..n-1)
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(data.columns.length - 1, 0) } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: Math.max(data.columns.length - 1, 0) } },
  ];

  const safeSheetName = data.title.replace(/[\\/*?[\]:]/g, '').substring(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, safeSheetName || 'Relatorio');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${data.title.replace(/\s+/g, '_')}.xlsx"`
  );

  res.end(buffer);
}

// ---------------------------------------------------------------------------
// Class wrapper (for dependency-injection style usage if preferred)
// ---------------------------------------------------------------------------

export class ReportExportService {
  async exportPDF(data: ReportData, res: Response): Promise<void> {
    return exportPDF(data, res);
  }

  async exportExcel(data: ReportData, res: Response): Promise<void> {
    return exportExcel(data, res);
  }
}

export const reportExportService = new ReportExportService();
