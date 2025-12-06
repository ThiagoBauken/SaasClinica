/**
 * Admin Phones API Routes
 * Gerencia telefones de administradores/dentistas para notificações
 */

import { Router } from 'express';
import { db } from '../db';
import { eq, and } from 'drizzle-orm';
import { adminPhones, type AdminPhone } from '@shared/schema';
import { asyncHandler, requireAuth, getCompanyId } from '../middleware/auth';

const router = Router();

/**
 * GET /api/v1/admin-phones
 * Lista todos os telefones admin da empresa
 */
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);
    const { role, isActive } = req.query;

    let conditions = [eq(adminPhones.companyId, companyId)];

    if (role) {
      conditions.push(eq(adminPhones.role, role as string));
    }

    if (isActive !== undefined) {
      conditions.push(eq(adminPhones.isActive, isActive === 'true'));
    }

    const phones = await db
      .select({
        id: adminPhones.id,
        companyId: adminPhones.companyId,
        phone: adminPhones.phone,
        name: adminPhones.name,
        role: adminPhones.role,
        isActive: adminPhones.isActive,
        receiveDailyReport: adminPhones.receiveDailyReport,
        receiveUrgencies: adminPhones.receiveUrgencies,
        receiveNewAppointments: adminPhones.receiveNewAppointments,
        receiveCancellations: adminPhones.receiveCancellations,
        createdAt: adminPhones.createdAt,
      })
      .from(adminPhones)
      .where(and(...conditions))
      .orderBy(adminPhones.name);

    res.json({
      success: true,
      data: phones,
    });
  })
);

/**
 * GET /api/v1/admin-phones/:id
 * Retorna um telefone admin específico
 */
router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);
    const id = parseInt(req.params.id);

    const [phone] = await db
      .select()
      .from(adminPhones)
      .where(
        and(
          eq(adminPhones.id, id),
          eq(adminPhones.companyId, companyId)
        )
      )
      .limit(1);

    if (!phone) {
      return res.status(404).json({ error: 'Telefone não encontrado' });
    }

    res.json({
      success: true,
      data: phone,
    });
  })
);

/**
 * POST /api/v1/admin-phones
 * Cria um novo telefone admin
 */
router.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);
    const {
      phone,
      name,
      role,
      isActive,
      receiveDailyReport,
      receiveUrgencies,
      receiveNewAppointments,
      receiveCancellations,
    } = req.body;

    if (!phone || !name) {
      return res.status(400).json({
        error: 'phone e name são obrigatórios',
      });
    }

    // Limpar telefone
    const cleanPhone = phone.replace(/[^\d+]/g, '');

    // Verificar se telefone já existe para esta empresa
    const [existing] = await db
      .select()
      .from(adminPhones)
      .where(
        and(
          eq(adminPhones.companyId, companyId),
          eq(adminPhones.phone, cleanPhone)
        )
      )
      .limit(1);

    if (existing) {
      return res.status(400).json({
        error: 'Este telefone já está cadastrado',
      });
    }

    const [newPhone] = await db
      .insert(adminPhones)
      .values({
        companyId,
        phone: cleanPhone,
        name,
        role: role || 'admin',
        isActive: isActive !== false,
        receiveDailyReport: receiveDailyReport !== false,
        receiveUrgencies: receiveUrgencies !== false,
        receiveNewAppointments: receiveNewAppointments !== false,
        receiveCancellations: receiveCancellations !== false,
      })
      .returning();

    res.status(201).json({
      success: true,
      data: newPhone,
    });
  })
);

/**
 * PUT /api/v1/admin-phones/:id
 * Atualiza um telefone admin
 */
router.put(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);
    const id = parseInt(req.params.id);
    const {
      phone,
      name,
      role,
      isActive,
      receiveDailyReport,
      receiveUrgencies,
      receiveNewAppointments,
      receiveCancellations,
    } = req.body;

    // Verificar se existe
    const [existing] = await db
      .select()
      .from(adminPhones)
      .where(
        and(
          eq(adminPhones.id, id),
          eq(adminPhones.companyId, companyId)
        )
      )
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: 'Telefone não encontrado' });
    }

    // Se está mudando o telefone, verificar duplicidade
    if (phone && phone !== existing.phone) {
      const cleanPhone = phone.replace(/[^\d+]/g, '');
      const [duplicate] = await db
        .select()
        .from(adminPhones)
        .where(
          and(
            eq(adminPhones.companyId, companyId),
            eq(adminPhones.phone, cleanPhone)
          )
        )
        .limit(1);

      if (duplicate && duplicate.id !== id) {
        return res.status(400).json({
          error: 'Este telefone já está cadastrado',
        });
      }
    }

    const updateData: Partial<AdminPhone> = {};

    if (phone) updateData.phone = phone.replace(/[^\d+]/g, '');
    if (name) updateData.name = name;
    if (role) updateData.role = role;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (receiveDailyReport !== undefined) updateData.receiveDailyReport = receiveDailyReport;
    if (receiveUrgencies !== undefined) updateData.receiveUrgencies = receiveUrgencies;
    if (receiveNewAppointments !== undefined) updateData.receiveNewAppointments = receiveNewAppointments;
    if (receiveCancellations !== undefined) updateData.receiveCancellations = receiveCancellations;

    const [updated] = await db
      .update(adminPhones)
      .set(updateData)
      .where(eq(adminPhones.id, id))
      .returning();

    res.json({
      success: true,
      data: updated,
    });
  })
);

/**
 * DELETE /api/v1/admin-phones/:id
 * Remove um telefone admin
 */
router.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);
    const id = parseInt(req.params.id);

    const [existing] = await db
      .select()
      .from(adminPhones)
      .where(
        and(
          eq(adminPhones.id, id),
          eq(adminPhones.companyId, companyId)
        )
      )
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: 'Telefone não encontrado' });
    }

    await db
      .delete(adminPhones)
      .where(eq(adminPhones.id, id));

    res.json({
      success: true,
      message: 'Telefone removido',
    });
  })
);

/**
 * GET /api/v1/admin-phones/for-notification/:type
 * Retorna telefones que devem receber determinado tipo de notificação
 */
router.get(
  '/for-notification/:type',
  asyncHandler(async (req, res) => {
    const { companyId } = req.query;
    const notificationType = req.params.type;

    if (!companyId) {
      return res.status(400).json({ error: 'companyId é obrigatório' });
    }

    const phones = await db
      .select({
        id: adminPhones.id,
        phone: adminPhones.phone,
        name: adminPhones.name,
        role: adminPhones.role,
        receiveDailyReport: adminPhones.receiveDailyReport,
        receiveUrgencies: adminPhones.receiveUrgencies,
        receiveNewAppointments: adminPhones.receiveNewAppointments,
        receiveCancellations: adminPhones.receiveCancellations,
      })
      .from(adminPhones)
      .where(
        and(
          eq(adminPhones.companyId, Number(companyId)),
          eq(adminPhones.isActive, true)
        )
      );

    // Filtrar por tipo de notificação
    type PhoneWithNotifications = typeof phones[0];
    const filtered = phones.filter((phone: PhoneWithNotifications) => {
      switch (notificationType) {
        case 'daily_report':
        case 'daily_summary':
          return phone.receiveDailyReport;
        case 'urgency':
        case 'emergency':
          return phone.receiveUrgencies;
        case 'new_appointment':
          return phone.receiveNewAppointments;
        case 'cancelled_appointment':
        case 'cancellation':
          return phone.receiveCancellations;
        case 'all':
          return true;
        default:
          return true; // Por padrão, envia para todos
      }
    });

    res.json({
      success: true,
      data: filtered,
    });
  })
);

/**
 * GET /api/v1/admin-phones/meta/roles
 * Lista os roles disponíveis
 */
router.get(
  '/meta/roles',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const roles = [
      { value: 'owner', label: 'Proprietário', description: 'Dono da clínica' },
      { value: 'admin', label: 'Administrador', description: 'Administrador geral' },
      { value: 'dentist', label: 'Dentista', description: 'Profissional dentista' },
      { value: 'receptionist', label: 'Recepcionista', description: 'Atendimento ao cliente' },
      { value: 'manager', label: 'Gerente', description: 'Gerente da clínica' },
    ];

    res.json({
      success: true,
      data: roles,
    });
  })
);

/**
 * GET /api/v1/admin-phones/meta/notification-types
 * Lista os tipos de notificação disponíveis
 */
router.get(
  '/meta/notification-types',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const notificationTypes = [
      { value: 'all', label: 'Todas', description: 'Receber todas as notificações' },
      { value: 'new_appointment', label: 'Novos Agendamentos', description: 'Quando um novo agendamento é criado' },
      { value: 'cancelled_appointment', label: 'Cancelamentos', description: 'Quando um agendamento é cancelado' },
      { value: 'emergency', label: 'Emergências', description: 'Mensagens de emergência' },
      { value: 'daily_summary', label: 'Resumo Diário', description: 'Resumo de agendamentos do dia' },
    ];

    res.json({
      success: true,
      data: notificationTypes,
    });
  })
);

export default router;
