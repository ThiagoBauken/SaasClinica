import { Router } from 'express';
import { storage } from '../storage';
import { authCheck, asyncHandler } from '../middleware/auth';
import { validate, dateRangeSchema } from '../middleware/validation';
import { z } from 'zod';
import { db } from '../db';
import { appointments, patients, procedures, users } from '@shared/schema';
import { sql, eq, and, gte, lte, count, desc } from 'drizzle-orm';

const router = Router();

// Schema para query de analytics
const analyticsQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  professionalId: z.string().transform(Number).optional(),
});

/**
 * GET /api/v1/analytics/overview
 * Retorna visão geral das métricas da clínica
 */
router.get(
  '/overview',
  authCheck,
  validate({ query: analyticsQuerySchema }),
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { startDate, endDate, professionalId } = req.query as any;

    // Período padrão: últimos 30 dias
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    // Buscar agendamentos do período
    const allAppointments = await storage.getAppointments(companyId);
    const periodAppointments = allAppointments.filter((apt: any) => {
      const aptDate = new Date(apt.startTime);
      const matchesPeriod = aptDate >= start && aptDate <= end;
      const matchesProfessional = professionalId ? apt.professionalId === Number(professionalId) : true;
      return matchesPeriod && matchesProfessional;
    });

    // Calcular métricas
    const totalAppointments = periodAppointments.length;
    const completedAppointments = periodAppointments.filter((apt: any) => apt.status === 'completed').length;
    const cancelledAppointments = periodAppointments.filter((apt: any) => apt.status === 'cancelled').length;
    const noShowAppointments = periodAppointments.filter((apt: any) => apt.status === 'no_show').length;

    // Taxa de ocupação (agendamentos completados vs total de slots disponíveis)
    const workingDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const workingHoursPerDay = 8; // 8h às 18h = 10 horas, assumindo 80% é tempo útil
    const avgAppointmentDuration = 1; // 1 hora média
    const availableSlots = workingDays * workingHoursPerDay;
    const occupancyRate = availableSlots > 0 ? ((completedAppointments / availableSlots) * 100).toFixed(1) : '0';

    // Taxa de cancelamento e falta
    const cancellationRate = totalAppointments > 0 ? ((cancelledAppointments / totalAppointments) * 100).toFixed(1) : '0';
    const noShowRate = totalAppointments > 0 ? ((noShowAppointments / totalAppointments) * 100).toFixed(1) : '0';

    // Crescimento comparado ao período anterior
    const previousStart = new Date(start.getTime() - (end.getTime() - start.getTime()));
    const previousPeriodAppointments = allAppointments.filter((apt: any) => {
      const aptDate = new Date(apt.startTime);
      return aptDate >= previousStart && aptDate < start;
    });

    const growthRate = previousPeriodAppointments.length > 0
      ? (((totalAppointments - previousPeriodAppointments.length) / previousPeriodAppointments.length) * 100).toFixed(1)
      : '0';

    res.json({
      period: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        days: workingDays,
      },
      summary: {
        totalAppointments,
        completedAppointments,
        cancelledAppointments,
        noShowAppointments,
        occupancyRate: parseFloat(occupancyRate),
        cancellationRate: parseFloat(cancellationRate),
        noShowRate: parseFloat(noShowRate),
        growthRate: parseFloat(growthRate),
      },
      statusDistribution: [
        { status: 'completed', count: completedAppointments, label: 'Concluídos' },
        { status: 'scheduled', count: periodAppointments.filter((apt: any) => apt.status === 'scheduled').length, label: 'Agendados' },
        { status: 'confirmed', count: periodAppointments.filter((apt: any) => apt.status === 'confirmed').length, label: 'Confirmados' },
        { status: 'in_progress', count: periodAppointments.filter((apt: any) => apt.status === 'in_progress').length, label: 'Em Andamento' },
        { status: 'cancelled', count: cancelledAppointments, label: 'Cancelados' },
        { status: 'no_show', count: noShowAppointments, label: 'Faltou' },
      ],
    });
  })
);

/**
 * GET /api/v1/analytics/professionals
 * Retorna métricas por profissional
 */
router.get(
  '/professionals',
  authCheck,
  validate({ query: analyticsQuerySchema }),
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { startDate, endDate } = req.query as any;
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    // Buscar todos os profissionais
    const professionals = await storage.getProfessionals(companyId);

    // Buscar agendamentos do período
    const allAppointments = await storage.getAppointments(companyId);
    const periodAppointments = allAppointments.filter((apt: any) => {
      const aptDate = new Date(apt.startTime);
      return aptDate >= start && aptDate <= end;
    });

    // Calcular métricas por profissional
    const professionalMetrics = professionals.map((professional: any) => {
      const profAppointments = periodAppointments.filter((apt: any) => apt.professionalId === professional.id);
      const completed = profAppointments.filter((apt: any) => apt.status === 'completed').length;
      const cancelled = profAppointments.filter((apt: any) => apt.status === 'cancelled').length;
      const noShow = profAppointments.filter((apt: any) => apt.status === 'no_show').length;

      return {
        professionalId: professional.id,
        professionalName: professional.fullName || professional.username,
        totalAppointments: profAppointments.length,
        completedAppointments: completed,
        cancelledAppointments: cancelled,
        noShowAppointments: noShow,
        completionRate: profAppointments.length > 0 ? ((completed / profAppointments.length) * 100).toFixed(1) : '0',
      };
    });

    // Ordenar por total de agendamentos
    professionalMetrics.sort((a, b) => b.totalAppointments - a.totalAppointments);

    res.json({
      period: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      },
      professionals: professionalMetrics,
    });
  })
);

/**
 * GET /api/v1/analytics/procedures
 * Retorna procedimentos mais agendados
 */
router.get(
  '/procedures',
  authCheck,
  validate({ query: analyticsQuerySchema }),
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { startDate, endDate } = req.query as any;
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    // Buscar agendamentos do período
    const allAppointments = await storage.getAppointments(companyId);
    const periodAppointments = allAppointments.filter((apt: any) => {
      const aptDate = new Date(apt.startTime);
      return aptDate >= start && aptDate <= end && apt.procedureId;
    });

    // Agrupar por procedimento
    const procedureCounts = new Map<number, { count: number; name: string; revenue: number }>();

    for (const apt of periodAppointments) {
      if (apt.procedureId) {
        const current = procedureCounts.get(apt.procedureId) || { count: 0, name: apt.procedureName || 'Sem nome', revenue: 0 };
        current.count += 1;
        // Revenue seria adicionado aqui se tivesse integração com pagamentos
        procedureCounts.set(apt.procedureId, current);
      }
    }

    // Converter para array e ordenar
    const procedureStats = Array.from(procedureCounts.entries()).map(([id, data]) => ({
      procedureId: id,
      procedureName: data.name,
      count: data.count,
      percentage: ((data.count / periodAppointments.length) * 100).toFixed(1),
    }));

    procedureStats.sort((a, b) => b.count - a.count);

    res.json({
      period: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      },
      topProcedures: procedureStats.slice(0, 10),
      totalWithProcedure: periodAppointments.length,
    });
  })
);

/**
 * GET /api/v1/analytics/peak-hours
 * Retorna análise de horários de pico
 */
router.get(
  '/peak-hours',
  authCheck,
  validate({ query: analyticsQuerySchema }),
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { startDate, endDate } = req.query as any;
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    // Buscar agendamentos do período
    const allAppointments = await storage.getAppointments(companyId);
    const periodAppointments = allAppointments.filter((apt: any) => {
      const aptDate = new Date(apt.startTime);
      return aptDate >= start && aptDate <= end;
    });

    // Agrupar por hora do dia
    const hourCounts = new Array(24).fill(0);
    const dayOfWeekCounts = new Array(7).fill(0);

    periodAppointments.forEach((apt: any) => {
      const aptDate = new Date(apt.startTime);
      const hour = aptDate.getHours();
      const dayOfWeek = aptDate.getDay(); // 0 = Domingo, 6 = Sábado

      hourCounts[hour]++;
      dayOfWeekCounts[dayOfWeek]++;
    });

    const daysOfWeek = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

    res.json({
      period: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      },
      peakHours: hourCounts.map((count, hour) => ({
        hour: `${hour.toString().padStart(2, '0')}:00`,
        count,
      })).filter(h => h.count > 0),
      peakDays: dayOfWeekCounts.map((count, day) => ({
        day: daysOfWeek[day],
        dayOfWeek: day,
        count,
      })).filter(d => d.count > 0),
    });
  })
);

/**
 * GET /api/v1/analytics/trends
 * Retorna tendências ao longo do tempo (diário/semanal/mensal)
 */
router.get(
  '/trends',
  authCheck,
  validate({
    query: analyticsQuerySchema.extend({
      groupBy: z.enum(['day', 'week', 'month']).optional().default('day'),
    })
  }),
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { startDate, endDate, groupBy } = req.query as any;
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    // Buscar agendamentos do período
    const allAppointments = await storage.getAppointments(companyId);
    const periodAppointments = allAppointments.filter((apt: any) => {
      const aptDate = new Date(apt.startTime);
      return aptDate >= start && aptDate <= end;
    });

    // Agrupar por período
    const grouped = new Map<string, { total: number; completed: number; cancelled: number; noShow: number }>();

    periodAppointments.forEach((apt: any) => {
      const aptDate = new Date(apt.startTime);
      let key: string;

      if (groupBy === 'day') {
        key = aptDate.toISOString().split('T')[0];
      } else if (groupBy === 'week') {
        const weekNumber = Math.ceil((aptDate.getDate() - aptDate.getDay()) / 7);
        key = `${aptDate.getFullYear()}-W${weekNumber}`;
      } else {
        key = `${aptDate.getFullYear()}-${(aptDate.getMonth() + 1).toString().padStart(2, '0')}`;
      }

      const current = grouped.get(key) || { total: 0, completed: 0, cancelled: 0, noShow: 0 };
      current.total++;
      if (apt.status === 'completed') current.completed++;
      if (apt.status === 'cancelled') current.cancelled++;
      if (apt.status === 'no_show') current.noShow++;

      grouped.set(key, current);
    });

    const trends = Array.from(grouped.entries())
      .map(([period, counts]) => ({
        period,
        ...counts,
      }))
      .sort((a, b) => a.period.localeCompare(b.period));

    res.json({
      period: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      },
      groupBy,
      trends,
    });
  })
);

export default router;
