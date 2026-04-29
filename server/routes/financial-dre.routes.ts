/**
 * Financial DRE (Demonstrativo de Resultado) Routes
 * Extracted from financial.routes.ts for maintainability.
 *
 * Mounted at /api/v1/financial/dre via financial.routes.ts
 */
import { Router } from 'express';
import { db } from '../db';
import {
  financialTransactions,
  users,
  appointments,
  companies,
} from '@shared/schema';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import { notDeleted } from '../lib/soft-delete';
import { authCheck, tenantAwareAuth, asyncHandler } from '../middleware/auth';

import { logger } from '../logger';
const router = Router();

// ==========================================
// DRE PROFISSIONAL (Demonstrativo de Resultado)
// ==========================================

/**
 * GET /professional
 * DRE por profissional - mostra faturamento, comissão e resultado de cada dentista
 */
router.get(
  '/professional',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { startDate, endDate, professionalId } = req.query as any;

    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const periodStart = startDate ? new Date(startDate) : defaultStart;
    const periodEnd = endDate ? new Date(endDate) : defaultEnd;

    const professionals = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        speciality: users.speciality,
        role: users.role,
      })
      .from(users)
      .where(and(
        eq(users.companyId, companyId),
        eq(users.active, true),
        notDeleted(users.deletedAt),
        sql`${users.role} IN ('dentist', 'admin')`
      ));

    type Professional = typeof professionals[0];
    const targetProfessionals = professionalId
      ? professionals.filter((p: Professional) => p.id === parseInt(professionalId))
      : professionals;

    const defaultCommissionRate = 0.5;

    const dreResults = await Promise.all(
      targetProfessionals.map(async (professional: Professional) => {
        const revenues = await db
          .select({
            total: sql<number>`COALESCE(SUM(${financialTransactions.amount}), 0)`,
            count: sql<number>`COUNT(*)`,
            netTotal: sql<number>`COALESCE(SUM(COALESCE(${financialTransactions.netAmount}, ${financialTransactions.amount})), 0)`,
          })
          .from(financialTransactions)
          .where(and(
            eq(financialTransactions.companyId, companyId),
            notDeleted(financialTransactions.deletedAt),
            eq(financialTransactions.professionalId, professional.id),
            sql`${financialTransactions.type} IN ('revenue', 'income')`,
            gte(financialTransactions.date, periodStart),
            lte(financialTransactions.date, periodEnd),
            sql`${financialTransactions.status} != 'cancelled'`
          ));

        const expenses = await db
          .select({
            total: sql<number>`COALESCE(SUM(${financialTransactions.amount}), 0)`,
            count: sql<number>`COUNT(*)`,
          })
          .from(financialTransactions)
          .where(and(
            eq(financialTransactions.companyId, companyId),
            notDeleted(financialTransactions.deletedAt),
            eq(financialTransactions.professionalId, professional.id),
            eq(financialTransactions.type, 'expense'),
            gte(financialTransactions.date, periodStart),
            lte(financialTransactions.date, periodEnd),
            sql`${financialTransactions.status} != 'cancelled'`
          ));

        const byCategory = await db
          .select({
            category: financialTransactions.category,
            total: sql<number>`COALESCE(SUM(${financialTransactions.amount}), 0)`,
            count: sql<number>`COUNT(*)`,
          })
          .from(financialTransactions)
          .where(and(
            eq(financialTransactions.companyId, companyId),
            notDeleted(financialTransactions.deletedAt),
            eq(financialTransactions.professionalId, professional.id),
            sql`${financialTransactions.type} IN ('revenue', 'income')`,
            gte(financialTransactions.date, periodStart),
            lte(financialTransactions.date, periodEnd),
            sql`${financialTransactions.status} != 'cancelled'`
          ))
          .groupBy(financialTransactions.category);

        const completedAppointments = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(appointments)
          .where(and(
            eq(appointments.companyId, companyId),
            notDeleted(appointments.deletedAt),
            eq(appointments.professionalId, professional.id),
            eq(appointments.status, 'completed'),
            gte(appointments.startTime, periodStart),
            lte(appointments.startTime, periodEnd)
          ));

        const grossRevenue = (revenues[0]?.total || 0) / 100;
        const netRevenue = (revenues[0]?.netTotal || 0) / 100;
        const totalExpenses = (expenses[0]?.total || 0) / 100;
        const revenueForCommission = netRevenue > 0 ? netRevenue : grossRevenue;
        const professionalCommission = revenueForCommission * defaultCommissionRate;
        const clinicShare = revenueForCommission - professionalCommission;
        const professionalNetResult = professionalCommission - totalExpenses;

        return {
          professional: { id: professional.id, name: professional.fullName, speciality: professional.speciality },
          period: { start: periodStart.toISOString().split('T')[0], end: periodEnd.toISOString().split('T')[0] },
          metrics: { completedAppointments: completedAppointments[0]?.count || 0, transactionCount: revenues[0]?.count || 0 },
          revenue: { gross: grossRevenue, net: netRevenue > 0 ? netRevenue : grossRevenue, fees: grossRevenue - (netRevenue > 0 ? netRevenue : grossRevenue) },
          expenses: { total: totalExpenses, count: expenses[0]?.count || 0 },
          split: { commissionRate: defaultCommissionRate, professionalShare: professionalCommission, clinicShare },
          result: { professionalNet: professionalNetResult, clinicNet: clinicShare },
          breakdown: byCategory.map((c: typeof byCategory[0]) => ({ category: c.category, total: (c.total || 0) / 100, count: c.count })),
        };
      })
    );

    const totals = {
      grossRevenue: dreResults.reduce((sum, r) => sum + r.revenue.gross, 0),
      netRevenue: dreResults.reduce((sum, r) => sum + r.revenue.net, 0),
      totalExpenses: dreResults.reduce((sum, r) => sum + r.expenses.total, 0),
      professionalShares: dreResults.reduce((sum, r) => sum + r.split.professionalShare, 0),
      clinicShares: dreResults.reduce((sum, r) => sum + r.split.clinicShare, 0),
      completedAppointments: dreResults.reduce((sum, r) => sum + r.metrics.completedAppointments, 0),
    };

    res.json({
      period: { start: periodStart.toISOString().split('T')[0], end: periodEnd.toISOString().split('T')[0] },
      professionals: dreResults,
      totals,
      settings: { defaultCommissionRate: defaultCommissionRate * 100 },
    });
  })
);

/**
 * GET /professional/:id
 * DRE detalhado de um profissional específico com MoM comparison.
 */
router.get(
  '/professional/:id',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { id } = req.params;
    const { startDate, endDate, monthlyTarget: monthlyTargetParam } = req.query as any;

    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const periodStart = startDate ? new Date(startDate) : defaultStart;
    const periodEnd = endDate ? new Date(endDate) : defaultEnd;

    const [professional] = await db
      .select({ id: users.id, fullName: users.fullName, speciality: users.speciality, email: users.email, phone: users.phone })
      .from(users)
      .where(and(eq(users.id, parseInt(id)), eq(users.companyId, companyId), notDeleted(users.deletedAt)));

    if (!professional) {
      return res.status(404).json({ error: 'Professional not found' });
    }

    const allTransactions = await db
      .select()
      .from(financialTransactions)
      .where(and(
        eq(financialTransactions.companyId, companyId),
        notDeleted(financialTransactions.deletedAt),
        eq(financialTransactions.professionalId, parseInt(id)),
        gte(financialTransactions.date, periodStart),
        lte(financialTransactions.date, periodEnd),
        sql`${financialTransactions.status} != 'cancelled'`
      ))
      .orderBy(desc(financialTransactions.date));

    const dailyBreakdown: Record<string, { revenue: number; expense: number; net: number }> = {};
    type Transaction = typeof allTransactions[0];

    allTransactions.forEach((t: Transaction) => {
      const day = t.date!.toISOString().split('T')[0];
      if (!dailyBreakdown[day]) dailyBreakdown[day] = { revenue: 0, expense: 0, net: 0 };
      const amount = (t.amount || 0) / 100;
      if (t.type === 'revenue' || t.type === 'income') {
        dailyBreakdown[day].revenue += amount;
        dailyBreakdown[day].net += amount;
      } else {
        dailyBreakdown[day].expense += amount;
        dailyBreakdown[day].net -= amount;
      }
    });

    const byPaymentMethod: Record<string, number> = {};
    allTransactions
      .filter((t: Transaction) => t.type === 'revenue' || t.type === 'income')
      .forEach((t: Transaction) => {
        const method = t.paymentMethod || 'other';
        byPaymentMethod[method] = (byPaymentMethod[method] || 0) + (t.amount || 0) / 100;
      });

    const revenues = allTransactions.filter((t: Transaction) => t.type === 'revenue' || t.type === 'income');
    const expenses = allTransactions.filter((t: Transaction) => t.type === 'expense');

    const grossRevenue = revenues.reduce((sum: number, t: Transaction) => sum + (t.amount || 0), 0) / 100;
    const netRevenue = revenues.reduce((sum: number, t: Transaction) => sum + (t.netAmount || t.amount || 0), 0) / 100;
    const totalExpenses = expenses.reduce((sum: number, t: Transaction) => sum + (t.amount || 0), 0) / 100;

    const commissionRate = 0.5;
    const professionalShare = netRevenue * commissionRate;
    const clinicShare = netRevenue - professionalShare;

    // Monthly target / progress
    let monthlyTarget: number | null = null;
    if (monthlyTargetParam) {
      monthlyTarget = parseFloat(monthlyTargetParam);
    } else {
      try {
        const targetResult = await db.$client.query(
          `SELECT monthly_target FROM professional_targets WHERE company_id = $1 AND professional_id = $2 LIMIT 1`,
          [companyId, parseInt(id)]
        );
        if (targetResult.rows[0]?.monthly_target) monthlyTarget = parseFloat(targetResult.rows[0].monthly_target);
      } catch { /* Table may not exist */ }
    }

    const targetProgress = monthlyTarget && monthlyTarget > 0
      ? Math.round((grossRevenue / monthlyTarget) * 10000) / 100
      : null;

    // Previous period (MoM comparison)
    const periodLengthMs = periodEnd.getTime() - periodStart.getTime();
    const prevPeriodEnd = new Date(periodStart.getTime() - 1);
    const prevPeriodStart = new Date(prevPeriodEnd.getTime() - periodLengthMs);

    const prevTransactions = await db
      .select().from(financialTransactions)
      .where(and(
        eq(financialTransactions.companyId, companyId),
        notDeleted(financialTransactions.deletedAt),
        eq(financialTransactions.professionalId, parseInt(id)),
        gte(financialTransactions.date, prevPeriodStart),
        lte(financialTransactions.date, prevPeriodEnd),
        sql`${financialTransactions.status} != 'cancelled'`
      ));

    type PrevTransaction = typeof prevTransactions[0];
    const prevRevenues = prevTransactions.filter((t: PrevTransaction) => t.type === 'revenue' || t.type === 'income');
    const prevExpenses = prevTransactions.filter((t: PrevTransaction) => t.type === 'expense');
    const prevGrossRevenue = prevRevenues.reduce((s: number, t: PrevTransaction) => s + (t.amount || 0), 0) / 100;
    const prevNetRevenue = prevRevenues.reduce((s: number, t: PrevTransaction) => s + (t.netAmount || t.amount || 0), 0) / 100;
    const prevTotalExpenses = prevExpenses.reduce((s: number, t: PrevTransaction) => s + (t.amount || 0), 0) / 100;
    const prevProfessionalShare = prevNetRevenue * commissionRate;
    const momChange = prevGrossRevenue > 0 ? Math.round(((grossRevenue - prevGrossRevenue) / prevGrossRevenue) * 10000) / 100 : null;

    res.json({
      professional,
      period: { start: periodStart.toISOString().split('T')[0], end: periodEnd.toISOString().split('T')[0] },
      summary: { grossRevenue, netRevenue, fees: grossRevenue - netRevenue, expenses: totalExpenses, commissionRate: commissionRate * 100, professionalShare, clinicShare, professionalNet: professionalShare - totalExpenses },
      target: { monthlyTarget, targetProgress, onTrack: targetProgress !== null ? targetProgress >= 100 : null },
      previousPeriod: { start: prevPeriodStart.toISOString().split('T')[0], end: prevPeriodEnd.toISOString().split('T')[0], grossRevenue: prevGrossRevenue, netRevenue: prevNetRevenue, expenses: prevTotalExpenses, professionalShare: prevProfessionalShare, professionalNet: prevProfessionalShare - prevTotalExpenses, momChangePercent: momChange },
      transactions: allTransactions.map((t: Transaction) => ({ id: t.id, date: t.date, type: t.type, category: t.category, description: t.description, amount: (t.amount || 0) / 100, netAmount: (t.netAmount || t.amount || 0) / 100, paymentMethod: t.paymentMethod, status: t.status })),
      dailyBreakdown: Object.entries(dailyBreakdown).map(([date, data]) => ({ date, ...data })).sort((a, b) => b.date.localeCompare(a.date)),
      byPaymentMethod: Object.entries(byPaymentMethod).map(([method, total]) => ({ method, total })).sort((a, b) => b.total - a.total),
    });
  })
);

/**
 * GET /professional/:id/payslip
 * Gera holerite PDF para o profissional.
 */
router.get(
  '/professional/:id/payslip',
  tenantAwareAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;
    if (!companyId) return res.status(403).json({ error: 'User not associated with any company' });

    const { id } = req.params;
    const { startDate, endDate } = req.query as any;
    const now = new Date();
    const periodStart = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = endDate ? new Date(endDate) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const [professional] = await db
      .select({ id: users.id, fullName: users.fullName, speciality: users.speciality, email: users.email })
      .from(users)
      .where(and(eq(users.id, parseInt(id)), eq(users.companyId, companyId), notDeleted(users.deletedAt)));
    if (!professional) return res.status(404).json({ error: 'Professional not found' });

    const [company] = await db.select({ name: companies.name }).from(companies).where(eq(companies.id, companyId));

    const revTransactions = await db.select().from(financialTransactions)
      .where(and(eq(financialTransactions.companyId, companyId), notDeleted(financialTransactions.deletedAt), eq(financialTransactions.professionalId, parseInt(id)), sql`${financialTransactions.type} IN ('revenue', 'income')`, gte(financialTransactions.date, periodStart), lte(financialTransactions.date, periodEnd), sql`${financialTransactions.status} != 'cancelled'`))
      .orderBy(desc(financialTransactions.date));

    const expTransactions = await db.select().from(financialTransactions)
      .where(and(eq(financialTransactions.companyId, companyId), notDeleted(financialTransactions.deletedAt), eq(financialTransactions.professionalId, parseInt(id)), eq(financialTransactions.type, 'expense'), gte(financialTransactions.date, periodStart), lte(financialTransactions.date, periodEnd), sql`${financialTransactions.status} != 'cancelled'`));

    const completedApts = await db.select({ id: appointments.id, startTime: appointments.startTime, status: appointments.status }).from(appointments)
      .where(and(eq(appointments.companyId, companyId), notDeleted(appointments.deletedAt), eq(appointments.professionalId, parseInt(id)), eq(appointments.status, 'completed'), gte(appointments.startTime, periodStart), lte(appointments.startTime, periodEnd)))
      .orderBy(desc(appointments.startTime));

    type RevTx = typeof revTransactions[0];
    type ExpTx = typeof expTransactions[0];
    const grossRevenue = revTransactions.reduce((s: number, t: RevTx) => s + (t.amount || 0), 0) / 100;
    const netRevenue = revTransactions.reduce((s: number, t: RevTx) => s + (t.netAmount || t.amount || 0), 0) / 100;
    const processingFees = grossRevenue - netRevenue;
    const materialExpenses = expTransactions.reduce((s: number, t: ExpTx) => s + (t.amount || 0), 0) / 100;
    const issRate = 0.05;
    const issDeduction = grossRevenue * issRate;
    const commissionRate = 0.5;
    const grossCommission = netRevenue * commissionRate;
    const netCommission = grossCommission - materialExpenses;

    const PDFDocument = (await import('pdfkit')).default;
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    await new Promise<void>((resolve) => {
      doc.on('end', resolve);
      doc.fontSize(18).font('Helvetica-Bold').text('HOLERITE / DEMONSTRATIVO DE PAGAMENTO', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(9).font('Helvetica').text(company?.name ?? 'Clínica', { align: 'center' });
      doc.moveDown(1);
      doc.fontSize(11).font('Helvetica-Bold').text('Profissional');
      doc.fontSize(10).font('Helvetica').text(`${professional.fullName}${professional.speciality ? ' — ' + professional.speciality : ''}`);
      doc.moveDown(0.3);
      doc.text(`Período: ${periodStart.toLocaleDateString('pt-BR')} a ${periodEnd.toLocaleDateString('pt-BR')}`);
      doc.moveDown(1);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#333').lineWidth(0.5).stroke();
      doc.moveDown(0.8);
      const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      doc.fontSize(11).font('Helvetica-Bold').text('RECEITAS');
      doc.fontSize(10).font('Helvetica');
      doc.text(`Receita Bruta:                          ${fmt(grossRevenue)}`);
      doc.text(`(-) Taxas de Processamento:             ${fmt(processingFees)}`);
      doc.text(`(-) ISS (${(issRate * 100).toFixed(0)}%):                            ${fmt(issDeduction)}`);
      doc.font('Helvetica-Bold').text(`Receita Líquida:                        ${fmt(netRevenue - issDeduction)}`);
      doc.moveDown(1);
      doc.fontSize(11).font('Helvetica-Bold').text('COMISSÃO');
      doc.fontSize(10).font('Helvetica');
      doc.text(`Taxa do Profissional:                   ${(commissionRate * 100).toFixed(0)}%`);
      doc.text(`Comissão Bruta:                         ${fmt(grossCommission)}`);
      doc.text(`(-) Materiais / Despesas Atribuídas:    ${fmt(materialExpenses)}`);
      doc.font('Helvetica-Bold').text(`Comissão Líquida a Receber:             ${fmt(netCommission)}`);
      doc.moveDown(1);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#333').lineWidth(0.5).stroke();
      doc.moveDown(0.5);
      doc.fontSize(11).font('Helvetica-Bold').text(`ATENDIMENTOS REALIZADOS (${completedApts.length})`);
      doc.fontSize(9).font('Helvetica');
      type AptRow = typeof completedApts[0];
      completedApts.slice(0, 50).forEach((apt: AptRow) => {
        doc.text(`• ${new Date(apt.startTime!).toLocaleDateString('pt-BR')} — ID #${apt.id}`);
      });
      if (completedApts.length > 50) doc.text(`... e mais ${completedApts.length - 50} atendimentos`);
      doc.moveDown(1);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#333').lineWidth(0.5).stroke();
      doc.moveDown(0.5);
      doc.fontSize(7).fillColor('#888').text(`Documento gerado em ${new Date().toLocaleString('pt-BR')} por ${user.fullName || 'Sistema'}`, { align: 'center' });
      doc.end();
    });

    const pdfBuffer = Buffer.concat(chunks);
    const filename = `holerite_${professional.id}_${periodStart.toISOString().slice(0, 7)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  })
);

/**
 * GET /ranking
 * Ranking de profissionais por faturamento
 */
router.get(
  '/ranking',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const companyId = user.companyId;
    if (!companyId) return res.status(403).json({ error: 'User not associated with any company' });

    const { period } = req.query as any;
    const now = new Date();
    let periodStart: Date;
    let periodEnd = new Date(now);
    periodEnd.setHours(23, 59, 59, 999);

    switch (period) {
      case 'week': periodStart = new Date(now); periodStart.setDate(now.getDate() - 7); break;
      case 'quarter': periodStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1); break;
      case 'year': periodStart = new Date(now.getFullYear(), 0, 1); break;
      case 'month': default: periodStart = new Date(now.getFullYear(), now.getMonth(), 1); break;
    }

    const ranking = await db
      .select({
        professionalId: financialTransactions.professionalId,
        professionalName: users.fullName,
        speciality: users.speciality,
        totalRevenue: sql<number>`COALESCE(SUM(${financialTransactions.amount}), 0)`,
        transactionCount: sql<number>`COUNT(*)`,
      })
      .from(financialTransactions)
      .innerJoin(users, eq(financialTransactions.professionalId, users.id))
      .where(and(
        eq(financialTransactions.companyId, companyId),
        notDeleted(financialTransactions.deletedAt),
        notDeleted(users.deletedAt),
        sql`${financialTransactions.type} IN ('revenue', 'income')`,
        gte(financialTransactions.date, periodStart),
        lte(financialTransactions.date, periodEnd),
        sql`${financialTransactions.status} != 'cancelled'`
      ))
      .groupBy(financialTransactions.professionalId, users.fullName, users.speciality)
      .orderBy(sql`SUM(${financialTransactions.amount}) DESC`);

    type RankingItem = typeof ranking[0];
    const totalRevenue = ranking.reduce((sum: number, r: RankingItem) => sum + (r.totalRevenue || 0), 0);

    res.json({
      period: { type: period || 'month', start: periodStart.toISOString().split('T')[0], end: periodEnd.toISOString().split('T')[0] },
      ranking: ranking.map((r: RankingItem, index: number) => ({
        position: index + 1, professionalId: r.professionalId, name: r.professionalName, speciality: r.speciality,
        revenue: (r.totalRevenue || 0) / 100, transactionCount: r.transactionCount,
        percentOfTotal: totalRevenue > 0 ? Math.round(((r.totalRevenue || 0) / totalRevenue) * 10000) / 100 : 0,
      })),
      totals: { revenue: totalRevenue / 100, professionals: ranking.length },
    });
  })
);

export default router;
