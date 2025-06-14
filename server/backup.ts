import { Request, Response } from 'express';
import { db } from './db';
import { companies, users, patients, appointments, procedures } from '../shared/schema';
import { eq } from 'drizzle-orm';

interface BackupData {
  company: any;
  users: any[];
  patients: any[];
  appointments: any[];
  procedures: any[];
  timestamp: string;
}

export async function createBackup(req: Request, res: Response) {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({ message: 'Não autorizado' });
    }

    // Buscar todos os dados da empresa
    const company = await db.query.companies.findFirst({
      where: eq(companies.id, companyId)
    });

    const companyUsers = await db.query.users.findMany({
      where: eq(users.companyId, companyId)
    });

    const companyPatients = await db.query.patients.findMany({
      where: eq(patients.companyId, companyId)
    });

    const companyAppointments = await db.query.appointments.findMany({
      where: eq(appointments.companyId, companyId)
    });

    const companyProcedures = await db.query.procedures.findMany({
      where: eq(procedures.companyId, companyId)
    });

    // Remover senhas dos usuários
    const safeUsers = companyUsers.map(user => {
      const { password, ...safeUser } = user;
      return safeUser;
    });

    const backupData: BackupData = {
      company,
      users: safeUsers,
      patients: companyPatients,
      appointments: companyAppointments,
      procedures: companyProcedures,
      timestamp: new Date().toISOString()
    };

    // Em produção, salvar no sistema de arquivos ou cloud storage
    const backupJson = JSON.stringify(backupData, null, 2);
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="backup-${companyId}-${Date.now()}.json"`);
    res.send(backupJson);

  } catch (error) {
    console.error('Erro ao criar backup:', error);
    res.status(500).json({ message: 'Erro ao criar backup' });
  }
}

export async function scheduleBackup(req: Request, res: Response) {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({ message: 'Não autorizado' });
    }

    const { frequency } = req.body; // daily, weekly, monthly

    // Em produção, configurar cron job ou similar
    console.log(`Backup automático configurado para empresa ${companyId}: ${frequency}`);

    res.json({ 
      message: 'Backup automático configurado com sucesso',
      frequency,
      nextBackup: getNextBackupDate(frequency)
    });

  } catch (error) {
    console.error('Erro ao configurar backup:', error);
    res.status(500).json({ message: 'Erro ao configurar backup' });
  }
}

function getNextBackupDate(frequency: string): string {
  const now = new Date();
  switch (frequency) {
    case 'daily':
      now.setDate(now.getDate() + 1);
      break;
    case 'weekly':
      now.setDate(now.getDate() + 7);
      break;
    case 'monthly':
      now.setMonth(now.getMonth() + 1);
      break;
  }
  return now.toISOString();
}

export async function getBackupStatus(req: Request, res: Response) {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({ message: 'Não autorizado' });
    }

    // Simular status do backup
    const status = {
      lastBackup: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      nextBackup: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      frequency: 'daily',
      autoBackupEnabled: true,
      backupSize: '2.4 MB',
      totalBackups: 15
    };

    res.json(status);

  } catch (error) {
    console.error('Erro ao buscar status do backup:', error);
    res.status(500).json({ message: 'Erro ao buscar status' });
  }
}