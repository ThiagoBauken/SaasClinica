import { distributedCache } from './distributedCache';
import { distributedDb } from './distributedDb';
import { log } from './vite';

interface QueueJob {
  id: string;
  type: string;
  data: any;
  priority: number;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  scheduledFor?: Date;
  completedAt?: Date;
  error?: string;
}

class QueueSystem {
  private queues = new Map<string, QueueJob[]>();
  private workers = new Map<string, (job: QueueJob) => Promise<void>>();
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeQueues();
    this.startProcessing();
  }

  private initializeQueues() {
    // Initialize different queue types
    this.queues.set('email', []);
    this.queues.set('backup', []);
    this.queues.set('reports', []);
    this.queues.set('ai-processing', []);
    this.queues.set('notifications', []);
    
    log('Queue system initialized');
  }

  // Register worker for specific queue type
  registerWorker(queueType: string, worker: (job: QueueJob) => Promise<void>) {
    this.workers.set(queueType, worker);
    log(`Worker registered for queue: ${queueType}`);
  }

  // Add job to queue
  async addJob(
    queueType: string, 
    data: any, 
    options: {
      priority?: number;
      delay?: number;
      maxAttempts?: number;
    } = {}
  ): Promise<string> {
    const job: QueueJob = {
      id: this.generateJobId(),
      type: queueType,
      data,
      priority: options.priority || 0,
      attempts: 0,
      maxAttempts: options.maxAttempts || 3,
      createdAt: new Date(),
      scheduledFor: options.delay ? new Date(Date.now() + options.delay) : new Date()
    };

    const queue = this.queues.get(queueType);
    if (!queue) {
      throw new Error(`Queue type ${queueType} not found`);
    }

    // Insert job in priority order
    const insertIndex = queue.findIndex(existingJob => existingJob.priority < job.priority);
    if (insertIndex === -1) {
      queue.push(job);
    } else {
      queue.splice(insertIndex, 0, job);
    }

    log(`Job ${job.id} added to ${queueType} queue`);
    return job.id;
  }

  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private startProcessing() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    this.processingInterval = setInterval(() => {
      this.processQueues();
    }, 1000); // Process every second

    log('Queue processing started');
  }

  private async processQueues() {
    for (const [queueType, queue] of this.queues.entries()) {
      const worker = this.workers.get(queueType);
      if (!worker || queue.length === 0) continue;

      // Find next job ready for processing
      const now = new Date();
      const jobIndex = queue.findIndex(job => 
        job.scheduledFor && job.scheduledFor <= now
      );

      if (jobIndex === -1) continue;

      const job = queue[jobIndex];
      queue.splice(jobIndex, 1);

      try {
        await worker(job);
        job.completedAt = new Date();
        log(`Job ${job.id} completed successfully`);
      } catch (error) {
        job.attempts++;
        job.error = error instanceof Error ? error.message : 'Unknown error';
        
        if (job.attempts < job.maxAttempts) {
          // Retry with exponential backoff
          job.scheduledFor = new Date(Date.now() + Math.pow(2, job.attempts) * 1000);
          queue.push(job);
          log(`Job ${job.id} failed, retrying (attempt ${job.attempts}/${job.maxAttempts})`);
        } else {
          log(`Job ${job.id} failed permanently after ${job.attempts} attempts`);
        }
      }
    }
  }

  // Get queue statistics
  getQueueStats() {
    const stats: Record<string, any> = {};
    
    for (const [queueType, queue] of this.queues.entries()) {
      stats[queueType] = {
        total: queue.length,
        pending: queue.filter(job => !job.scheduledFor || job.scheduledFor <= new Date()).length,
        scheduled: queue.filter(job => job.scheduledFor && job.scheduledFor > new Date()).length,
        failed: queue.filter(job => job.attempts >= job.maxAttempts).length
      };
    }

    return stats;
  }

  // Graceful shutdown
  shutdown() {
    this.isProcessing = false;
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    log('Queue system shutdown');
  }
}

// Singleton instance
export const queueSystem = new QueueSystem();

// Email worker
queueSystem.registerWorker('email', async (job: QueueJob) => {
  const { to, subject, body, companyId } = job.data;
  
  // Simulate email sending (replace with actual email service)
  await new Promise(resolve => setTimeout(resolve, 500));
  
  log(`Email sent to ${to}: ${subject}`);
  
  // Cache successful send to avoid duplicates
  await distributedCache.set(companyId, 'sent_emails', { 
    to, 
    subject, 
    sentAt: new Date() 
  }, { ttl: 3600 });
});

// Backup worker
queueSystem.registerWorker('backup', async (job: QueueJob) => {
  const { companyId, type } = job.data;
  
  try {
    const db = distributedDb.getReadConnection();
    
    // Get all company data (simplified)
    const backupData = {
      timestamp: new Date().toISOString(),
      companyId,
      type,
      // Add actual data queries here
      status: 'completed'
    };
    
    // Cache backup metadata
    await distributedCache.set(companyId, 'backups', backupData, { ttl: 86400 });
    
    log(`Backup completed for company ${companyId}`);
  } catch (error) {
    throw new Error(`Backup failed: ${error}`);
  }
});

// Report generation worker
queueSystem.registerWorker('reports', async (job: QueueJob) => {
  const { companyId, reportType, parameters } = job.data;
  
  try {
    const db = distributedDb.getReadConnection();
    
    // Generate report (simplified)
    const reportData = {
      id: job.id,
      type: reportType,
      companyId,
      parameters,
      generatedAt: new Date().toISOString(),
      // Add actual report generation logic here
      status: 'ready'
    };
    
    // Cache report for download
    await distributedCache.set(companyId, 'reports', reportData, { ttl: 172800 }); // 48 hours
    
    log(`Report ${reportType} generated for company ${companyId}`);
  } catch (error) {
    throw new Error(`Report generation failed: ${error}`);
  }
});

// AI processing worker
queueSystem.registerWorker('ai-processing', async (job: QueueJob) => {
  const { companyId, type, data } = job.data;
  
  try {
    // Simulate AI processing (replace with actual AI service calls)
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const result = {
      jobId: job.id,
      type,
      result: `AI processing completed for ${type}`,
      confidence: 0.95,
      processedAt: new Date().toISOString()
    };
    
    // Cache AI results
    await distributedCache.set(companyId, 'ai_results', result, { ttl: 86400 });
    
    log(`AI processing ${type} completed for company ${companyId}`);
  } catch (error) {
    throw new Error(`AI processing failed: ${error}`);
  }
});

// Notification worker
queueSystem.registerWorker('notifications', async (job: QueueJob) => {
  const { companyId, type, recipient, message, channel } = job.data;
  
  try {
    switch (channel) {
      case 'whatsapp':
        // Simulate WhatsApp API call
        await new Promise(resolve => setTimeout(resolve, 300));
        break;
      case 'sms':
        // Simulate SMS API call
        await new Promise(resolve => setTimeout(resolve, 200));
        break;
      case 'push':
        // Simulate push notification
        await new Promise(resolve => setTimeout(resolve, 100));
        break;
    }
    
    log(`${channel} notification sent to ${recipient} for company ${companyId}`);
  } catch (error) {
    throw new Error(`Notification failed: ${error}`);
  }
});

// Utility functions for common queue operations
export async function sendEmail(companyId: number, to: string, subject: string, body: string, priority = 0) {
  return await queueSystem.addJob('email', { companyId, to, subject, body }, { priority });
}

export async function scheduleBackup(companyId: number, type: 'manual' | 'automatic' = 'manual', delay = 0) {
  return await queueSystem.addJob('backup', { companyId, type }, { delay, priority: type === 'manual' ? 10 : 5 });
}

export async function generateReport(companyId: number, reportType: string, parameters: any, priority = 0) {
  return await queueSystem.addJob('reports', { companyId, reportType, parameters }, { priority });
}

export async function processAI(companyId: number, type: string, data: any, priority = 5) {
  return await queueSystem.addJob('ai-processing', { companyId, type, data }, { priority });
}

export async function sendNotification(
  companyId: number, 
  type: string, 
  recipient: string, 
  message: string, 
  channel: 'whatsapp' | 'sms' | 'push' = 'whatsapp',
  priority = 3
) {
  return await queueSystem.addJob('notifications', { companyId, type, recipient, message, channel }, { priority });
}

// Graceful shutdown
process.on('SIGTERM', () => {
  queueSystem.shutdown();
});

process.on('SIGINT', () => {
  queueSystem.shutdown();
});