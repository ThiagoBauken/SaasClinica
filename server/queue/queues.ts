import { createQueue, QueueNames, redisConnection } from './config';

/**
 * Filas do sistema
 * Lazy-loaded para não causar erro se Redis não estiver disponível
 */

let _automationsQueue: any = null;
let _notificationsQueue: any = null;
let _emailsQueue: any = null;
let _whatsappQueue: any = null;
let _reportsQueue: any = null;

// Fila de automações
export const automationsQueue = {
  get queue() {
    if (!redisConnection) {
      console.warn('⚠️  Redis não configurado - jobs serão ignorados');
      return null;
    }
    if (!_automationsQueue) {
      _automationsQueue = createQueue(QueueNames.AUTOMATIONS);
    }
    return _automationsQueue;
  },
  add: function(...args: any[]) {
    return this.queue?.add(...args) || Promise.resolve(null);
  },
  getJobs: function(...args: any[]) {
    return this.queue?.getJobs(...args) || Promise.resolve([]);
  },
  getJob: function(jobId: string) {
    return this.queue?.getJob(jobId) || Promise.resolve(null);
  },
  clean: function(...args: any[]) {
    return this.queue?.clean(...args) || Promise.resolve([]);
  },
  getWaitingCount: function() {
    return this.queue?.getWaitingCount() || Promise.resolve(0);
  },
  getActiveCount: function() {
    return this.queue?.getActiveCount() || Promise.resolve(0);
  },
  getCompletedCount: function() {
    return this.queue?.getCompletedCount() || Promise.resolve(0);
  },
  getFailedCount: function() {
    return this.queue?.getFailedCount() || Promise.resolve(0);
  },
  getDelayedCount: function() {
    return this.queue?.getDelayedCount() || Promise.resolve(0);
  }
};

// Fila de notificações gerais
export const notificationsQueue = {
  get queue() {
    if (!redisConnection) {
      console.warn('⚠️  Redis não configurado - jobs serão ignorados');
      return null;
    }
    if (!_notificationsQueue) {
      _notificationsQueue = createQueue(QueueNames.NOTIFICATIONS);
    }
    return _notificationsQueue;
  },
  add: function(...args: any[]) {
    return this.queue?.add(...args) || Promise.resolve(null);
  },
  getJobs: function(...args: any[]) {
    return this.queue?.getJobs(...args) || Promise.resolve([]);
  },
  getJob: function(jobId: string) {
    return this.queue?.getJob(jobId) || Promise.resolve(null);
  },
  clean: function(...args: any[]) {
    return this.queue?.clean(...args) || Promise.resolve([]);
  },
  getWaitingCount: function() {
    return this.queue?.getWaitingCount() || Promise.resolve(0);
  },
  getActiveCount: function() {
    return this.queue?.getActiveCount() || Promise.resolve(0);
  },
  getCompletedCount: function() {
    return this.queue?.getCompletedCount() || Promise.resolve(0);
  },
  getFailedCount: function() {
    return this.queue?.getFailedCount() || Promise.resolve(0);
  },
  getDelayedCount: function() {
    return this.queue?.getDelayedCount() || Promise.resolve(0);
  }
};

// Fila de emails
export const emailsQueue = {
  get queue() {
    if (!redisConnection) {
      console.warn('⚠️  Redis não configurado - jobs serão ignorados');
      return null;
    }
    if (!_emailsQueue) {
      _emailsQueue = createQueue(QueueNames.EMAILS);
    }
    return _emailsQueue;
  },
  add: function(...args: any[]) {
    return this.queue?.add(...args) || Promise.resolve(null);
  },
  getJobs: function(...args: any[]) {
    return this.queue?.getJobs(...args) || Promise.resolve([]);
  },
  getJob: function(jobId: string) {
    return this.queue?.getJob(jobId) || Promise.resolve(null);
  },
  clean: function(...args: any[]) {
    return this.queue?.clean(...args) || Promise.resolve([]);
  },
  getWaitingCount: function() {
    return this.queue?.getWaitingCount() || Promise.resolve(0);
  },
  getActiveCount: function() {
    return this.queue?.getActiveCount() || Promise.resolve(0);
  },
  getCompletedCount: function() {
    return this.queue?.getCompletedCount() || Promise.resolve(0);
  },
  getFailedCount: function() {
    return this.queue?.getFailedCount() || Promise.resolve(0);
  },
  getDelayedCount: function() {
    return this.queue?.getDelayedCount() || Promise.resolve(0);
  }
};

// Fila de WhatsApp
export const whatsappQueue = {
  get queue() {
    if (!redisConnection) {
      console.warn('⚠️  Redis não configurado - jobs serão ignorados');
      return null;
    }
    if (!_whatsappQueue) {
      _whatsappQueue = createQueue(QueueNames.WHATSAPP);
    }
    return _whatsappQueue;
  },
  add: function(...args: any[]) {
    return this.queue?.add(...args) || Promise.resolve(null);
  },
  getJobs: function(...args: any[]) {
    return this.queue?.getJobs(...args) || Promise.resolve([]);
  },
  getJob: function(jobId: string) {
    return this.queue?.getJob(jobId) || Promise.resolve(null);
  },
  clean: function(...args: any[]) {
    return this.queue?.clean(...args) || Promise.resolve([]);
  },
  getWaitingCount: function() {
    return this.queue?.getWaitingCount() || Promise.resolve(0);
  },
  getActiveCount: function() {
    return this.queue?.getActiveCount() || Promise.resolve(0);
  },
  getCompletedCount: function() {
    return this.queue?.getCompletedCount() || Promise.resolve(0);
  },
  getFailedCount: function() {
    return this.queue?.getFailedCount() || Promise.resolve(0);
  },
  getDelayedCount: function() {
    return this.queue?.getDelayedCount() || Promise.resolve(0);
  }
};

// Fila de relatórios
export const reportsQueue = {
  get queue() {
    if (!redisConnection) {
      console.warn('⚠️  Redis não configurado - jobs serão ignorados');
      return null;
    }
    if (!_reportsQueue) {
      _reportsQueue = createQueue(QueueNames.REPORTS);
    }
    return _reportsQueue;
  },
  add: function(...args: any[]) {
    return this.queue?.add(...args) || Promise.resolve(null);
  },
  getJobs: function(...args: any[]) {
    return this.queue?.getJobs(...args) || Promise.resolve([]);
  },
  getJob: function(jobId: string) {
    return this.queue?.getJob(jobId) || Promise.resolve(null);
  },
  clean: function(...args: any[]) {
    return this.queue?.clean(...args) || Promise.resolve([]);
  },
  getWaitingCount: function() {
    return this.queue?.getWaitingCount() || Promise.resolve(0);
  },
  getActiveCount: function() {
    return this.queue?.getActiveCount() || Promise.resolve(0);
  },
  getCompletedCount: function() {
    return this.queue?.getCompletedCount() || Promise.resolve(0);
  },
  getFailedCount: function() {
    return this.queue?.getFailedCount() || Promise.resolve(0);
  },
  getDelayedCount: function() {
    return this.queue?.getDelayedCount() || Promise.resolve(0);
  }
};

/**
 * Tipos de jobs para cada fila
 */

export interface AppointmentReminderJob {
  type: 'appointment-reminder';
  appointmentId: number;
  patientId: number;
  companyId: number;
  reminderType: '24h' | '1h' | 'now';
}

export interface AppointmentConfirmationJob {
  type: 'appointment-confirmation';
  appointmentId: number;
  patientId: number;
  companyId: number;
}

export interface PaymentReceiptJob {
  type: 'payment-receipt';
  paymentId: number;
  patientId: number;
  companyId: number;
}

export interface EmailJob {
  to: string;
  subject: string;
  body: string;
  companyId: number;
}

export interface WhatsAppJob {
  to: string;
  message: string;
  companyId: number;
  mediaUrl?: string;
}

export interface ReportJob {
  type: 'monthly-revenue' | 'inventory' | 'appointments';
  companyId: number;
  format: 'pdf' | 'excel';
  period: {
    start: Date;
    end: Date;
  };
}

/**
 * Adicionar job de lembrete de agendamento
 */
export async function addAppointmentReminderJob(data: AppointmentReminderJob) {
  return await whatsappQueue.add('appointment-reminder', data, {
    priority: 1, // Alta prioridade
  });
}

/**
 * Adicionar job de confirmação de agendamento
 */
export async function addAppointmentConfirmationJob(data: AppointmentConfirmationJob) {
  return await whatsappQueue.add('appointment-confirmation', data, {
    priority: 2,
  });
}

/**
 * Adicionar job de recibo de pagamento
 */
export async function addPaymentReceiptJob(data: PaymentReceiptJob) {
  return await emailsQueue.add('payment-receipt', data, {
    priority: 1,
  });
}

/**
 * Adicionar job de email
 */
export async function addEmailJob(data: EmailJob) {
  return await emailsQueue.add('send-email', data, {
    priority: 3,
  });
}

/**
 * Adicionar job de WhatsApp
 */
export async function addWhatsAppJob(data: WhatsAppJob) {
  return await whatsappQueue.add('send-whatsapp', data, {
    priority: 2,
  });
}

/**
 * Adicionar job de relatório
 */
export async function addReportJob(data: ReportJob) {
  return await reportsQueue.add('generate-report', data, {
    priority: 5, // Baixa prioridade
  });
}

/**
 * Agendar lembrete de agendamento
 * @param appointmentDate Data do agendamento
 * @param data Dados do job
 */
export async function scheduleAppointmentReminder(
  appointmentDate: Date,
  data: AppointmentReminderJob
) {
  const reminderTime = new Date(appointmentDate);

  // Lembrete 24h antes
  if (data.reminderType === '24h') {
    reminderTime.setHours(reminderTime.getHours() - 24);
  }
  // Lembrete 1h antes
  else if (data.reminderType === '1h') {
    reminderTime.setHours(reminderTime.getHours() - 1);
  }

  const delay = reminderTime.getTime() - Date.now();

  if (delay > 0) {
    return await whatsappQueue.add('appointment-reminder', data, {
      delay,
      priority: 1,
    });
  }

  return null; // Não agendar se a data já passou
}
