import { Request, Response } from 'express';
import { db } from './db';
import { clinicSettings, workingHours, users, appointments, patients, procedures, inventoryItems } from '../shared/schema';
import { eq, and, desc, sql, gte, lte, count } from 'drizzle-orm';

// === CONFIGURAÇÕES DA CLÍNICA ===
export async function getClinicSettings(req: Request, res: Response) {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({ message: 'Não autorizado' });
    }

    // Buscar configurações da clínica (global, sem filtro de companyId)
    const settings = await db.query.clinicSettings.findFirst();

    // Buscar horários de funcionamento (filtrado por userId)
    const hours = await db.query.workingHours.findMany({
      where: req.user?.id ? eq(workingHours.userId, req.user.id) : undefined
    });

    const defaultSettings = {
      name: '',
      cnpj: '',
      address: '',
      phone: '',
      email: '',
      website: '',
      workingHours: {
        monday: { start: '08:00', end: '18:00', enabled: true },
        tuesday: { start: '08:00', end: '18:00', enabled: true },
        wednesday: { start: '08:00', end: '18:00', enabled: true },
        thursday: { start: '08:00', end: '18:00', enabled: true },
        friday: { start: '08:00', end: '18:00', enabled: true },
        saturday: { start: '08:00', end: '12:00', enabled: false },
        sunday: { start: '08:00', end: '12:00', enabled: false }
      },
      notifications: {
        emailReminders: true,
        smsReminders: false,
        whatsappReminders: true,
        reminderHours: 24
      },
      security: {
        sessionTimeout: 60,
        passwordExpiry: 90,
        twoFactorEnabled: false,
        backupFrequency: 'daily'
      }
    };

    res.json(settings || defaultSettings);
  } catch (error) {
    console.error('Erro ao buscar configurações:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
}

export async function updateClinicSettings(req: Request, res: Response) {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({ message: 'Não autorizado' });
    }

    const { clinic, workingHours: hours, notifications, system } = req.body;

    // Atualizar ou criar configurações da clínica (global)
    if (clinic) {
      const existingSettings = await db.query.clinicSettings.findFirst();

      if (existingSettings) {
        await db.update(clinicSettings)
          .set({
            ...clinic,
            updatedAt: new Date()
          })
          .where(eq(clinicSettings.id, existingSettings.id));
      } else {
        await db.insert(clinicSettings).values({
          ...clinic,
          updatedAt: new Date()
        } as any);
      }
    }

    res.json({ message: 'Configurações atualizadas com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar configurações:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
}

// === RELATÓRIOS E ANALYTICS ===
export async function getRevenueReport(req: Request, res: Response) {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({ message: 'Não autorizado' });
    }

    const { startDate, endDate } = req.query;
    
    // Simular dados de receita (em produção viria do sistema financeiro)
    const revenueData = [
      { period: '2024-06-01', revenue: 1200000, procedures: 45, patients: 32 },
      { period: '2024-06-02', revenue: 1800000, procedures: 52, patients: 38 },
      { period: '2024-06-03', revenue: 2100000, procedures: 63, patients: 45 },
      { period: '2024-06-04', revenue: 1500000, procedures: 48, patients: 35 },
      { period: '2024-06-05', revenue: 2400000, procedures: 71, patients: 52 }
    ];

    res.json(revenueData);
  } catch (error) {
    console.error('Erro ao buscar relatório de receita:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
}

export async function getAppointmentStats(req: Request, res: Response) {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({ message: 'Não autorizado' });
    }

    // Buscar estatísticas reais dos agendamentos
    const totalAppointments = await db.select({ count: count() })
      .from(appointments)
      .where(eq(appointments.companyId, companyId));

    const completedAppointments = await db.select({ count: count() })
      .from(appointments)
      .where(and(
        eq(appointments.companyId, companyId),
        eq(appointments.status, 'completed')
      ));

    const cancelledAppointments = await db.select({ count: count() })
      .from(appointments)
      .where(and(
        eq(appointments.companyId, companyId),
        eq(appointments.status, 'cancelled')
      ));

    const stats = {
      total: totalAppointments[0]?.count || 0,
      completed: completedAppointments[0]?.count || 0,
      cancelled: cancelledAppointments[0]?.count || 0,
      noShow: 0, // Implementar quando houver status no_show
      averageDuration: 45
    };

    res.json(stats);
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
}

export async function getProcedureAnalytics(req: Request, res: Response) {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({ message: 'Não autorizado' });
    }

    // Buscar procedimentos mais realizados (global, sem category e companyId)
    const procedureStats = await db.select({
      id: procedures.id,
      name: procedures.name,
      count: count(),
      totalRevenue: sql<number>`sum(${procedures.price})`,
      averagePrice: sql<number>`avg(${procedures.price})`
    })
    .from(procedures)
    .groupBy(procedures.id, procedures.name)
    .orderBy(desc(count()))
    .limit(10);

    res.json(procedureStats);
  } catch (error) {
    console.error('Erro ao buscar analytics de procedimentos:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
}

export async function getPatientAnalytics(req: Request, res: Response) {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({ message: 'Não autorizado' });
    }

    // Buscar estatísticas de pacientes
    const totalPatients = await db.select({ count: count() })
      .from(patients)
      .where(eq(patients.companyId, companyId));

    // Pacientes novos (últimos 30 dias)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const newPatients = await db.select({ count: count() })
      .from(patients)
      .where(and(
        eq(patients.companyId, companyId),
        gte(patients.createdAt, thirtyDaysAgo)
      ));

    // Distribuição por gênero
    const malePatients = await db.select({ count: count() })
      .from(patients)
      .where(and(
        eq(patients.companyId, companyId),
        eq(patients.gender, 'male')
      ));

    const femalePatients = await db.select({ count: count() })
      .from(patients)
      .where(and(
        eq(patients.companyId, companyId),
        eq(patients.gender, 'female')
      ));

    const analytics = {
      totalPatients: totalPatients[0]?.count || 0,
      newPatients: newPatients[0]?.count || 0,
      returningPatients: (totalPatients[0]?.count || 0) - (newPatients[0]?.count || 0),
      averageAge: 35, // Calcular quando houver campo de data de nascimento
      genderDistribution: {
        male: malePatients[0]?.count || 0,
        female: femalePatients[0]?.count || 0,
        other: 0
      }
    };

    res.json(analytics);
  } catch (error) {
    console.error('Erro ao buscar analytics de pacientes:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
}

// === USUÁRIOS E CADASTROS ===
export async function getUsers(req: Request, res: Response) {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({ message: 'Não autorizado' });
    }

    const userList = await db.query.users.findMany({
      where: eq(users.companyId, companyId),
      orderBy: desc(users.createdAt)
    });

    // Remover senhas da resposta
    type User = typeof users.$inferSelect;
    const safeUsers = userList.map((user: User) => {
      const { password, ...safeUser } = user;
      return safeUser;
    });

    res.json(safeUsers);
  } catch (error) {
    console.error('Erro ao buscar usuários:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
}

export async function updateUser(req: Request, res: Response) {
  try {
    const companyId = req.user?.companyId;
    const userId = parseInt(req.params.id);
    
    if (!companyId) {
      return res.status(401).json({ message: 'Não autorizado' });
    }

    const { active, ...updateData } = req.body;

    await db.update(users)
      .set({
        ...updateData,
        active,
        updatedAt: new Date()
      })
      .where(and(
        eq(users.id, userId),
        eq(users.companyId, companyId)
      ));

    res.json({ message: 'Usuário atualizado com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
}

export async function deleteUser(req: Request, res: Response) {
  try {
    const companyId = req.user?.companyId;
    const userId = parseInt(req.params.id);
    
    if (!companyId) {
      return res.status(401).json({ message: 'Não autorizado' });
    }

    // Verificar se não é o último admin
    const adminCount = await db.select({ count: count() })
      .from(users)
      .where(and(
        eq(users.companyId, companyId),
        eq(users.role, 'admin'),
        eq(users.active, true)
      ));

    const userToDelete = await db.query.users.findFirst({
      where: and(eq(users.id, userId), eq(users.companyId, companyId))
    });

    if (userToDelete?.role === 'admin' && (adminCount[0]?.count || 0) <= 1) {
      return res.status(400).json({ 
        message: 'Não é possível remover o último administrador' 
      });
    }

    await db.delete(users)
      .where(and(
        eq(users.id, userId),
        eq(users.companyId, companyId)
      ));

    res.json({ message: 'Usuário removido com sucesso' });
  } catch (error) {
    console.error('Erro ao remover usuário:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
}

// === PROCEDIMENTOS ===
export async function getProcedures(req: Request, res: Response) {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({ message: 'Não autorizado' });
    }

    // Buscar todos os procedimentos (global, sem companyId ou createdAt)
    const procedureList = await db.query.procedures.findMany({
      orderBy: desc(procedures.id)
    });

    res.json(procedureList);
  } catch (error) {
    console.error('Erro ao buscar procedimentos:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
}

// === SALAS/CONSULTÓRIOS ===
export async function getRooms(req: Request, res: Response) {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({ message: 'Não autorizado' });
    }

    // Simular dados de salas (implementar tabela específica depois)
    const roomList = [
      {
        id: 1,
        name: 'Consultório 1',
        description: 'Consultório principal com equipamentos completos',
        equipment: ['Cadeira odontológica', 'Raio-X', 'Sugador'],
        active: true
      },
      {
        id: 2,
        name: 'Consultório 2',
        description: 'Consultório para procedimentos simples',
        equipment: ['Cadeira odontológica', 'Sugador'],
        active: true
      }
    ];

    res.json(roomList);
  } catch (error) {
    console.error('Erro ao buscar salas:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
}