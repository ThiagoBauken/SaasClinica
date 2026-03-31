import {
  addAppointmentReminderJob,
  addAppointmentConfirmationJob,
  addPaymentReceiptJob,
  addEmailJob,
  scheduleAppointmentReminder,
} from './queues';

/**
 * Sistema de Triggers de Automações
 *
 * Detecta eventos do sistema e dispara jobs automaticamente
 */

/**
 * Trigger: Agendamento criado
 *
 * Ações:
 * - Enviar confirmação imediata por WhatsApp
 * - Agendar lembrete 24h antes
 * - Agendar lembrete 1h antes
 */
export async function onAppointmentCreated(appointment: {
  id: number;
  patientId: number;
  companyId: number;
  startTime: Date;
}) {
  console.log(`🔔 Trigger: Agendamento criado (ID: ${appointment.id})`);

  try {
    // 1. Enviar confirmação imediata
    await addAppointmentConfirmationJob({
      type: 'appointment-confirmation',
      appointmentId: appointment.id,
      patientId: appointment.patientId,
      companyId: appointment.companyId,
    });

    // 2. Agendar lembrete 24h antes
    await scheduleAppointmentReminder(appointment.startTime, {
      type: 'appointment-reminder',
      appointmentId: appointment.id,
      patientId: appointment.patientId,
      companyId: appointment.companyId,
      reminderType: '24h',
    });

    // 3. Agendar lembrete 1h antes
    await scheduleAppointmentReminder(appointment.startTime, {
      type: 'appointment-reminder',
      appointmentId: appointment.id,
      patientId: appointment.patientId,
      companyId: appointment.companyId,
      reminderType: '1h',
    });

    console.log(`✅ Triggers de agendamento criado disparados`);
  } catch (error) {
    console.error('❌ Erro ao disparar triggers de agendamento:', error);
  }
}

/**
 * Trigger: Agendamento confirmado
 *
 * Ações:
 * - Atualizar lembretes (se necessário)
 */
export async function onAppointmentConfirmed(appointment: {
  id: number;
  patientId: number;
  companyId: number;
}) {
  console.log(`🔔 Trigger: Agendamento confirmado (ID: ${appointment.id})`);

  // Pode adicionar lógica adicional aqui se necessário
}

/**
 * Trigger: Agendamento cancelado
 *
 * Ações:
 * - Cancelar lembretes agendados
 * - Notificar paciente sobre cancelamento
 */
export async function onAppointmentCancelled(appointment: {
  id: number;
  patientId: number;
  companyId: number;
}) {
  console.log(`🔔 Trigger: Agendamento cancelado (ID: ${appointment.id})`);

  try {
    // Cancel any scheduled reminder jobs for this appointment
    // Reminders go through the automations queue
    const { automationsQueue } = await import('./queues');
    const queue = automationsQueue;
    if (queue) {
      const jobs = await queue.getJobs(['delayed', 'waiting']);
      for (const job of jobs) {
        if (job.data?.appointmentId === appointment.id) {
          await job.remove();
        }
      }
    }
    console.log(`✅ Reminders cancelados para agendamento ${appointment.id}`);
  } catch (error) {
    console.error('❌ Erro ao cancelar reminders:', error);
  }
}

/**
 * Trigger: Pagamento confirmado
 *
 * Ações:
 * - Enviar recibo por email
 * - Atualizar relatórios financeiros
 */
export async function onPaymentConfirmed(payment: {
  id: number;
  patientId: number;
  companyId: number;
  amount: number;
}) {
  console.log(`🔔 Trigger: Pagamento confirmado (ID: ${payment.id})`);

  try {
    // Enviar recibo por email
    await addPaymentReceiptJob({
      type: 'payment-receipt',
      paymentId: payment.id,
      patientId: payment.patientId,
      companyId: payment.companyId,
    });

    console.log(`✅ Trigger de pagamento confirmado disparado`);
  } catch (error) {
    console.error('❌ Erro ao disparar trigger de pagamento:', error);
  }
}

/**
 * Trigger: Novo paciente cadastrado
 *
 * Ações:
 * - Enviar email de boas-vindas
 * - Adicionar ao sistema de CRM
 */
export async function onPatientCreated(patient: {
  id: number;
  name: string;
  email: string;
  phone: string;
  companyId: number;
}) {
  console.log(`🔔 Trigger: Novo paciente cadastrado (ID: ${patient.id})`);

  if (patient.email) {
    try {
      await addEmailJob({
        to: patient.email,
        subject: 'Bem-vindo à nossa clínica!',
        body: `Olá ${patient.name},\n\nSeja bem-vindo(a) à nossa clínica! Estamos felizes em tê-lo(a) como paciente.\n\nQualquer dúvida, entre em contato conosco.\n\nAtenciosamente,\nEquipe da Clínica`,
        companyId: patient.companyId,
      });
      console.log(`✅ Email de boas-vindas enviado para ${patient.email}`);
    } catch (error) {
      console.error('❌ Erro ao enviar email de boas-vindas:', error);
    }
  }
}

/**
 * Trigger: Estoque baixo
 *
 * Ações:
 * - Notificar administradores
 * - Criar alerta no sistema
 */
export async function onLowStock(item: {
  id: number;
  name: string;
  quantity: number;
  minQuantity: number;
  companyId: number;
}) {
  console.log(`🔔 Trigger: Estoque baixo (Item: ${item.name}, Qtd: ${item.quantity})`);

  try {
    // Get admin users for this company and notify them
    const { db } = await import('../db');
    const admins = await db.$client.query(
      `SELECT email FROM users WHERE company_id = $1 AND role IN ('admin', 'superadmin') AND email IS NOT NULL`,
      [item.companyId]
    );

    for (const admin of admins.rows) {
      await addEmailJob({
        to: admin.email,
        subject: `Estoque baixo: ${item.name}`,
        body: `O item "${item.name}" está com estoque baixo.\n\nQuantidade atual: ${item.quantity}\nQuantidade mínima: ${item.minQuantity}\n\nPor favor, providencie a reposição.`,
        companyId: item.companyId,
      });
    }

    console.log(`✅ Notificação de estoque baixo enviada para ${admins.rows.length} admins`);
  } catch (error) {
    console.error('❌ Erro ao notificar estoque baixo:', error);
  }
}

/**
 * Registrar todos os triggers
 */
export const triggers = {
  appointment: {
    created: onAppointmentCreated,
    confirmed: onAppointmentConfirmed,
    cancelled: onAppointmentCancelled,
  },
  payment: {
    confirmed: onPaymentConfirmed,
  },
  patient: {
    created: onPatientCreated,
  },
  inventory: {
    lowStock: onLowStock,
  },
};

export default triggers;
