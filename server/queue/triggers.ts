import {
  addAppointmentReminderJob,
  addAppointmentConfirmationJob,
  addPaymentReceiptJob,
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

  // TODO: Implementar cancelamento de jobs agendados
  // await cancelScheduledReminders(appointment.id);
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

  // TODO: Implementar email de boas-vindas
  // await addEmailJob({
  //   to: patient.email,
  //   subject: 'Bem-vindo à nossa clínica!',
  //   body: welcomeEmailTemplate(patient.name),
  //   companyId: patient.companyId,
  // });
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

  // TODO: Implementar notificação de estoque baixo
  // await notifyAdmins(item);
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
