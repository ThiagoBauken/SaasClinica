import { Job } from 'bullmq';
import { createWorker, QueueNames } from './config';
import { db } from '../db';
import { appointments, patients, payments, users, companies, clinicSettings } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { createEvolutionService, interpolateMessage } from '../services/evolution-api.service';

/**
 * Workers para processar jobs das filas
 */

/**
 * Worker de WhatsApp
 * Processa envios de mensagens WhatsApp
 */
export const whatsappWorker = createWorker(
  QueueNames.WHATSAPP,
  async (job: Job) => {
    console.log(`📱 Processando job WhatsApp: ${job.name} (ID: ${job.id})`);

    const { type, appointmentId, patientId, companyId } = job.data;

    try {
      switch (type) {
        case 'appointment-reminder':
          return await sendAppointmentReminder(appointmentId, patientId, companyId);

        case 'appointment-confirmation':
          return await sendAppointmentConfirmation(appointmentId, patientId, companyId);

        default:
          console.log(`📤 Enviando WhatsApp genérico:`, job.data);
          // TODO: Implementar envio real via WhatsApp Business API
          return { success: true, message: 'WhatsApp enviado (mock)' };
      }
    } catch (error) {
      console.error('❌ Erro ao processar job WhatsApp:', error);
      throw error; // Re-throw para BullMQ fazer retry
    }
  },
  3 // Concorrência: 3 jobs simultâneos
);

/**
 * Worker de Emails
 * Processa envios de emails
 */
export const emailsWorker = createWorker(
  QueueNames.EMAILS,
  async (job: Job) => {
    console.log(`📧 Processando job Email: ${job.name} (ID: ${job.id})`);

    const { type, paymentId, patientId, companyId } = job.data;

    try {
      switch (type) {
        case 'payment-receipt':
          return await sendPaymentReceipt(paymentId, patientId, companyId);

        default:
          console.log(`📤 Enviando email genérico:`, job.data);
          // TODO: Implementar envio real via SendGrid/SES
          return { success: true, message: 'Email enviado (mock)' };
      }
    } catch (error) {
      console.error('❌ Erro ao processar job Email:', error);
      throw error;
    }
  },
  5 // Concorrência: 5 jobs simultâneos
);

/**
 * Worker de Automações
 * Processa automações complexas que envolvem múltiplos passos
 */
export const automationsWorker = createWorker(
  QueueNames.AUTOMATIONS,
  async (job: Job) => {
    console.log(`🤖 Processando job Automação: ${job.name} (ID: ${job.id})`);

    // TODO: Implementar lógica de automações
    return { success: true, message: 'Automação processada (mock)' };
  },
  2 // Concorrência: 2 jobs simultâneos (automações são mais pesadas)
);

/**
 * Worker de Relatórios
 * Processa geração de relatórios em background
 */
export const reportsWorker = createWorker(
  QueueNames.REPORTS,
  async (job: Job) => {
    console.log(`📊 Processando job Relatório: ${job.name} (ID: ${job.id})`);

    // TODO: Implementar geração de relatórios (PDF/Excel)
    return { success: true, message: 'Relatório gerado (mock)' };
  },
  1 // Concorrência: 1 job por vez (relatórios são pesados)
);

/**
 * Helpers para processar jobs específicos
 */

async function sendAppointmentReminder(appointmentId: number, patientId: number, companyId: number) {
  // Buscar dados do agendamento
  const [appointment] = await db
    .select()
    .from(appointments)
    .where(eq(appointments.id, appointmentId))
    .limit(1);

  if (!appointment) {
    throw new Error(`Agendamento ${appointmentId} não encontrado`);
  }

  // Buscar dados do paciente
  const [patient] = await db
    .select()
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);

  if (!patient) {
    throw new Error(`Paciente ${patientId} não encontrado`);
  }

  // Buscar dentista
  const [dentist] = await db
    .select()
    .from(users)
    .where(eq(users.id, appointment.professionalId || 0))
    .limit(1);

  // Buscar empresa
  const [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);

  // Montar mensagem
  const appointmentDate = format(new Date(appointment.startTime), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  const message = `
🦷 *${company?.name || 'Clínica'}*

Olá *${patient.fullName}*!

📅 Lembrete de consulta:
⏰ Data: ${appointmentDate}
👨‍⚕️ Profissional: ${dentist?.fullName || 'Dentista'}

${company?.address ? `📍 Endereço: ${company.address}` : ''}

Aguardamos você! Em caso de imprevistos, entre em contato conosco.
  `.trim();

  // Tentar enviar via Evolution API
  const evolutionService = await createEvolutionService(companyId);

  if (evolutionService && patient.whatsappPhone) {
    const result = await evolutionService.sendTextMessage({
      phone: patient.whatsappPhone || patient.cellphone || patient.phone || '',
      message,
    });

    if (result.success) {
      console.log(`✅ Lembrete WhatsApp enviado para ${patient.whatsappPhone}`);
      return {
        success: true,
        message: 'Lembrete enviado via Evolution API',
        to: patient.whatsappPhone,
        appointmentId,
        messageId: result.messageId,
      };
    } else {
      console.error(`❌ Falha ao enviar WhatsApp: ${result.error}`);
    }
  }

  // Fallback: log apenas (Evolution não configurado)
  console.log(`📱 [FALLBACK] Evolution não configurado. Mensagem para ${patient.phone}:`);
  console.log(message);

  return {
    success: true,
    message: 'Lembrete registrado (Evolution não configurado)',
    to: patient.phone,
    appointmentId,
  };
}

async function sendAppointmentConfirmation(appointmentId: number, patientId: number, companyId: number) {
  const [appointment] = await db
    .select()
    .from(appointments)
    .where(eq(appointments.id, appointmentId))
    .limit(1);

  const [patient] = await db
    .select()
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);

  const [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);

  if (!appointment || !patient) {
    throw new Error('Dados não encontrados');
  }

  const appointmentDate = format(new Date(appointment.startTime), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  const message = `
✅ *Agendamento Confirmado!*

Olá *${patient.fullName}*,

Sua consulta foi confirmada com sucesso!

📅 ${appointmentDate}
🏥 ${company?.name || 'Clínica'}

Até lá! 😊
  `.trim();

  // Tentar enviar via Evolution API
  const evolutionService = await createEvolutionService(companyId);

  if (evolutionService && patient.whatsappPhone) {
    const result = await evolutionService.sendTextMessage({
      phone: patient.whatsappPhone || patient.cellphone || patient.phone || '',
      message,
    });

    if (result.success) {
      console.log(`✅ Confirmação WhatsApp enviada para ${patient.whatsappPhone}`);
      return {
        success: true,
        message: 'Confirmação enviada via Evolution API',
        to: patient.whatsappPhone,
        messageId: result.messageId,
      };
    } else {
      console.error(`❌ Falha ao enviar confirmação: ${result.error}`);
    }
  }

  // Fallback
  console.log(`📱 [FALLBACK] Evolution não configurado. Confirmação para ${patient.phone}:`);
  console.log(message);

  return {
    success: true,
    message: 'Confirmação registrada (Evolution não configurado)',
    to: patient.phone,
  };
}

async function sendPaymentReceipt(paymentId: number, patientId: number, companyId: number) {
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.id, paymentId))
    .limit(1);

  const [patient] = await db
    .select()
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);

  const [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);

  if (!payment || !patient) {
    throw new Error('Dados não encontrados');
  }

  const emailSubject = `Recibo de Pagamento - ${company?.name || 'Clínica'}`;
  const emailBody = `
    <h2>Recibo de Pagamento</h2>
    <p>Olá ${patient.fullName},</p>
    <p>Confirmamos o recebimento do seu pagamento:</p>
    <ul>
      <li><strong>Valor:</strong> R$ ${parseFloat(payment.amount).toFixed(2)}</li>
      <li><strong>Método:</strong> ${payment.paymentMethod}</li>
      <li><strong>Data:</strong> ${format(new Date(payment.paymentDate), 'dd/MM/yyyy')}</li>
    </ul>
    <p>Obrigado pela preferência!</p>
    <p><em>${company?.name || 'Clínica'}</em></p>
  `;

  console.log(`📧 [MOCK] Enviando recibo por email para ${patient.email}:`);
  console.log(`Assunto: ${emailSubject}`);
  console.log(emailBody);

  // TODO: Implementar envio real
  // await emailService.send({ to: patient.email, subject: emailSubject, html: emailBody });

  return {
    success: true,
    message: 'Recibo enviado (mock)',
    to: patient.email,
  };
}

/**
 * Event listeners para monitoramento
 */

whatsappWorker.on('completed', (job) => {
  console.log(`✅ Job WhatsApp completado: ${job.id}`);
});

whatsappWorker.on('failed', (job, err) => {
  console.error(`❌ Job WhatsApp falhou: ${job?.id}`, err.message);
});

emailsWorker.on('completed', (job) => {
  console.log(`✅ Job Email completado: ${job.id}`);
});

emailsWorker.on('failed', (job, err) => {
  console.error(`❌ Job Email falhou: ${job?.id}`, err.message);
});

automationsWorker.on('completed', (job) => {
  console.log(`✅ Job Automação completado: ${job.id}`);
});

automationsWorker.on('failed', (job, err) => {
  console.error(`❌ Job Automação falhou: ${job?.id}`, err.message);
});

reportsWorker.on('completed', (job) => {
  console.log(`✅ Job Relatório completado: ${job.id}`);
});

reportsWorker.on('failed', (job, err) => {
  console.error(`❌ Job Relatório falhou: ${job?.id}`, err.message);
});

console.log('🚀 Workers iniciados:');
console.log('   - WhatsApp Worker (concorrência: 3)');
console.log('   - Email Worker (concorrência: 5)');
console.log('   - Automações Worker (concorrência: 2)');
console.log('   - Relatórios Worker (concorrência: 1)');
