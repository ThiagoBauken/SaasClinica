/**
 * CRM Auto-Progression Service
 *
 * Bridges WhatsApp chat sessions with CRM pipeline stages.
 * Automatically creates opportunities from new WhatsApp conversations
 * and moves them through funnel stages based on AI agent events.
 *
 * AI Stage Flow:
 *   first_contact → scheduling → confirmation → consultation_done → payment_done → won
 */

import { db } from '../db';
import { eq, and, desc, sql } from 'drizzle-orm';
import {
  salesOpportunities,
  salesFunnelStages,
  salesOpportunityHistory,
  chatSessions,
  patients,
  type SalesOpportunity,
  type SalesFunnelStage,
} from '@shared/schema';
import { logger } from '../logger';
import { broadcastToCompany } from '../websocket-redis-adapter';

const log = logger.child({ module: 'crm-auto-progression' });

/** Valid AI stages in progression order */
export const AI_STAGES = [
  'first_contact',
  'scheduling',
  'confirmation',
  'consultation_done',
  'payment_done',
] as const;

export type AIStage = typeof AI_STAGES[number];

/** Human-readable labels for AI stages */
export const AI_STAGE_LABELS: Record<string, string> = {
  first_contact: 'Primeiro Contato',
  scheduling: 'Agendamento',
  confirmation: 'Confirmação',
  consultation_done: 'Consulta Realizada',
  payment_done: 'Pagamento Realizado',
};

/**
 * Creates or retrieves a CRM opportunity linked to a WhatsApp chat session.
 * Called when a new WhatsApp conversation starts or when we need to ensure
 * a session has an associated opportunity.
 */
export async function ensureOpportunityForSession(
  companyId: number,
  sessionId: number,
  data?: {
    patientId?: number;
    patientName?: string;
    phone?: string;
    source?: string;
  }
): Promise<SalesOpportunity> {
  // Check if opportunity already exists for this session
  const [existing] = await db
    .select()
    .from(salesOpportunities)
    .where(
      and(
        eq(salesOpportunities.companyId, companyId),
        eq(salesOpportunities.chatSessionId, sessionId)
      )
    )
    .limit(1);

  if (existing) {
    return existing;
  }

  // Find the default (first_contact) stage for this company
  let [defaultStage] = await db
    .select()
    .from(salesFunnelStages)
    .where(
      and(
        eq(salesFunnelStages.companyId, companyId),
        eq(salesFunnelStages.automationTrigger, 'first_contact'),
        eq(salesFunnelStages.isActive, true)
      )
    )
    .limit(1);

  // Fallback to default stage
  if (!defaultStage) {
    [defaultStage] = await db
      .select()
      .from(salesFunnelStages)
      .where(
        and(
          eq(salesFunnelStages.companyId, companyId),
          eq(salesFunnelStages.isDefault, true),
          eq(salesFunnelStages.isActive, true)
        )
      )
      .limit(1);
  }

  // If still no stage, create default stages for this company
  if (!defaultStage) {
    await seedDefaultStages(companyId);
    [defaultStage] = await db
      .select()
      .from(salesFunnelStages)
      .where(
        and(
          eq(salesFunnelStages.companyId, companyId),
          eq(salesFunnelStages.automationTrigger, 'first_contact'),
          eq(salesFunnelStages.isActive, true)
        )
      )
      .limit(1);
  }

  if (!defaultStage) {
    throw new Error(`No funnel stages configured for company ${companyId}`);
  }

  const title = data?.patientName
    ? `WhatsApp - ${data.patientName}`
    : `WhatsApp - ${data?.phone || 'Novo Contato'}`;

  const [opportunity] = await db
    .insert(salesOpportunities)
    .values({
      companyId,
      chatSessionId: sessionId,
      stageId: defaultStage.id,
      aiStage: 'first_contact',
      aiStageUpdatedAt: new Date(),
      patientId: data?.patientId || null,
      leadName: data?.patientName || null,
      leadPhone: data?.phone || null,
      leadSource: data?.source || 'whatsapp',
      title,
      stageEnteredAt: new Date(),
    })
    .returning();

  // Record history
  await db.insert(salesOpportunityHistory).values({
    opportunityId: opportunity.id,
    toStageId: defaultStage.id,
    action: 'created',
    description: 'Oportunidade criada automaticamente via WhatsApp',
    metadata: { source: 'whatsapp_auto', sessionId },
  });

  log.info(
    { opportunityId: opportunity.id, sessionId, companyId },
    'Auto-created CRM opportunity from WhatsApp session'
  );

  // Notify frontend via WebSocket
  broadcastToCompany(companyId, 'crm:opportunity_created', {
    opportunity,
    stage: defaultStage,
  });

  return opportunity;
}

/**
 * Progresses a CRM opportunity to the next AI stage.
 * Called by the AI agent when it completes an action (e.g., scheduled appointment).
 *
 * @param companyId - Company ID
 * @param trigger - The AI stage trigger (e.g., 'scheduling', 'confirmation')
 * @param sessionId - Optional chat session ID to identify the opportunity
 * @param opportunityId - Optional opportunity ID (alternative to sessionId)
 */
export async function progressOpportunity(
  companyId: number,
  trigger: string,
  options: {
    sessionId?: number;
    opportunityId?: number;
    metadata?: Record<string, any>;
    userId?: number;
  } = {}
): Promise<SalesOpportunity | null> {
  const { sessionId, opportunityId, metadata, userId } = options;

  // Find the opportunity
  let opportunity: SalesOpportunity | undefined;

  if (opportunityId) {
    [opportunity] = await db
      .select()
      .from(salesOpportunities)
      .where(
        and(
          eq(salesOpportunities.id, opportunityId),
          eq(salesOpportunities.companyId, companyId)
        )
      );
  } else if (sessionId) {
    [opportunity] = await db
      .select()
      .from(salesOpportunities)
      .where(
        and(
          eq(salesOpportunities.chatSessionId, sessionId),
          eq(salesOpportunities.companyId, companyId)
        )
      );
  }

  if (!opportunity) {
    log.warn({ companyId, trigger, sessionId, opportunityId }, 'No opportunity found to progress');
    return null;
  }

  // Find the target stage matching this trigger
  const [targetStage] = await db
    .select()
    .from(salesFunnelStages)
    .where(
      and(
        eq(salesFunnelStages.companyId, companyId),
        eq(salesFunnelStages.automationTrigger, trigger),
        eq(salesFunnelStages.isActive, true)
      )
    )
    .limit(1);

  if (!targetStage) {
    log.warn(
      { companyId, trigger },
      'No funnel stage found for automation trigger'
    );
    return null;
  }

  // Don't move backwards (check order)
  const [currentStage] = await db
    .select()
    .from(salesFunnelStages)
    .where(eq(salesFunnelStages.id, opportunity.stageId));

  if (currentStage && targetStage.order <= currentStage.order) {
    log.debug(
      { opportunityId: opportunity.id, currentOrder: currentStage.order, targetOrder: targetStage.order },
      'Skipping backward progression'
    );
    // Don't update aiStage on backward progression to keep stageId and aiStage in sync
    await db
      .update(salesOpportunities)
      .set({
        lastContactAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(salesOpportunities.id, opportunity.id));

    return opportunity;
  }

  const previousStageId = opportunity.stageId;

  // Update opportunity
  const updateData: Partial<SalesOpportunity> = {
    stageId: targetStage.id,
    aiStage: trigger,
    aiStageUpdatedAt: new Date(),
    stageEnteredAt: new Date(),
    lastContactAt: new Date(),
    updatedAt: new Date(),
  } as any;

  if (targetStage.isWon) {
    (updateData as any).wonAt = new Date();
  } else if (targetStage.isLost) {
    (updateData as any).lostAt = new Date();
  }

  // Update probability based on stage progression
  const stageIndex = AI_STAGES.indexOf(trigger as AIStage);
  if (stageIndex >= 0) {
    (updateData as any).probability = Math.min(20 + stageIndex * 20, 100);
  }

  const [updated] = await db
    .update(salesOpportunities)
    .set(updateData as any)
    .where(eq(salesOpportunities.id, opportunity.id))
    .returning();

  // Record history
  await db.insert(salesOpportunityHistory).values({
    opportunityId: opportunity.id,
    fromStageId: previousStageId,
    toStageId: targetStage.id,
    action: 'auto_progressed',
    description: `IA moveu para: ${targetStage.name}`,
    metadata: { trigger, ...metadata },
    createdBy: userId || null,
  });

  log.info(
    { opportunityId: opportunity.id, from: previousStageId, to: targetStage.id, trigger },
    'Auto-progressed CRM opportunity'
  );

  // Notify frontend via WebSocket
  broadcastToCompany(companyId, 'crm:opportunity_moved', {
    opportunity: updated,
    fromStageId: previousStageId,
    toStageId: targetStage.id,
    trigger,
    stageName: targetStage.name,
  });

  return updated;
}

/**
 * Get the full pipeline view with WhatsApp session data enriched
 */
export async function getEnrichedPipeline(companyId: number) {
  // Get stages
  const stages = await db
    .select()
    .from(salesFunnelStages)
    .where(
      and(
        eq(salesFunnelStages.companyId, companyId),
        eq(salesFunnelStages.isActive, true)
      )
    )
    .orderBy(salesFunnelStages.order);

  // Get opportunities with chat session info (select only existing columns)
  const opportunities = await db
    .select({
      opportunity: salesOpportunities,
      patient: patients,
      chatStatus: chatSessions.status,
      chatLastMessageAt: chatSessions.lastMessageAt,
    })
    .from(salesOpportunities)
    .leftJoin(patients, eq(salesOpportunities.patientId, patients.id))
    .leftJoin(chatSessions, eq(salesOpportunities.chatSessionId, chatSessions.id))
    .where(eq(salesOpportunities.companyId, companyId))
    .orderBy(desc(salesOpportunities.updatedAt));

  type OppRow = typeof opportunities[number];

  // Fetch last history action for each opportunity (batch)
  const oppIds = opportunities.map((o: OppRow) => o.opportunity.id);
  const lastActions: Record<number, { action: string; description: string }> = {};

  if (oppIds.length > 0) {
    try {
      const historyRows = await db
        .select({
          opportunityId: salesOpportunityHistory.opportunityId,
          action: salesOpportunityHistory.action,
          description: salesOpportunityHistory.description,
        })
        .from(salesOpportunityHistory)
        .where(
          sql`${salesOpportunityHistory.opportunityId} IN (${sql.join(oppIds.map((id: number) => sql`${id}`), sql`, `)})`
        )
        .orderBy(desc(salesOpportunityHistory.createdAt));

      // Keep only the latest per opportunity
      for (const row of historyRows) {
        if (!lastActions[row.opportunityId]) {
          lastActions[row.opportunityId] = { action: row.action, description: row.description || '' };
        }
      }
    } catch (e) {
      // Non-critical - continue without history data
    }
  }

  // Fetch next appointment for each patient (batch)
  const patientIds = [...new Set(
    opportunities.map((o: OppRow) => o.opportunity.patientId).filter((id: any): id is number => id != null && id > 0)
  )];
  const nextAppointments: Record<number, Date> = {};

  if (patientIds.length > 0) {
    try {
      const { appointments } = await import('@shared/schema');
      const futureAppts = await db
        .select({
          patientId: appointments.patientId,
          startTime: appointments.startTime
        })
        .from(appointments)
        .where(
          and(
            sql`${appointments.patientId} IN (${sql.join(patientIds.map((id: any) => sql`${id}`), sql`, `)})`,
            sql`${appointments.startTime} >= CURRENT_TIMESTAMP`,
            sql`${appointments.status} != 'cancelled'`
          )
        )
        .orderBy(appointments.startTime);

      for (const appt of futureAppts) {
        if (appt.patientId && appt.startTime && !nextAppointments[appt.patientId]) {
          nextAppointments[appt.patientId] = appt.startTime;
        }
      }
    } catch (e) {
      // Non-critical - continue without appointment data
    }
  }

  // Map orphaned opportunities to the first stage
  if (stages.length > 0) {
    const validStageIds = new Set(stages.map((s: SalesFunnelStage) => s.id));
    for (const o of opportunities) {
      if (!validStageIds.has(o.opportunity.stageId)) {
        o.opportunity.stageId = stages[0].id;
      }
    }
  }

  // Group by stage
  const pipeline = stages.map((stage: SalesFunnelStage) => {
    const stageOpps = opportunities
      .filter((o: OppRow) => o.opportunity.stageId === stage.id)
      .map((o: OppRow) => ({
        ...o.opportunity,
        patientName: o.patient?.fullName || o.opportunity.leadName,
        patientPhone: o.patient?.phone || o.opportunity.leadPhone,
        hasWhatsApp: !!o.opportunity.chatSessionId,
        chatStatus: o.chatStatus || null,
        chatLastMessage: o.chatLastMessageAt || null,
        nextAppointmentDate: (o.opportunity.patientId && nextAppointments[o.opportunity.patientId])
            ? (nextAppointments[o.opportunity.patientId] instanceof Date
                ? nextAppointments[o.opportunity.patientId].toISOString()
                : String(nextAppointments[o.opportunity.patientId]))
            : null,
        aiStageLabel: o.opportunity.aiStage
          ? AI_STAGE_LABELS[o.opportunity.aiStage] || o.opportunity.aiStage
          : null,
        lastAction: lastActions[o.opportunity.id]?.action || null,
        lastActionDescription: lastActions[o.opportunity.id]?.description || null,
      }));

    return {
      ...stage,
      opportunities: stageOpps,
      totalValue: stageOpps.reduce(
        (sum: number, o: { estimatedValue: string | null }) => sum + parseFloat(o.estimatedValue || '0'),
        0
      ),
      count: stageOpps.length,
    };
  });

  // Summary
  const allOpps = opportunities.map((o: OppRow) => o.opportunity);
  const wonStageIds = stages.filter((s: SalesFunnelStage) => s.isWon).map((s: SalesFunnelStage) => s.id);

  return {
    stages: pipeline,
    summary: {
      totalOpportunities: allOpps.length,
      totalValue: allOpps.reduce((s: number, o: SalesOpportunity) => s + parseFloat(o.estimatedValue || '0'), 0),
      wonValue: allOpps
        .filter((o: SalesOpportunity) => wonStageIds.includes(o.stageId))
        .reduce((s: number, o: SalesOpportunity) => s + parseFloat(o.estimatedValue || '0'), 0),
      whatsappActive: allOpps.filter((o: SalesOpportunity) => o.chatSessionId).length,
    },
  };
}

/**
 * Seeds default WhatsApp pipeline stages for a company
 */
export async function seedDefaultStages(companyId: number): Promise<void> {
  const existing = await db
    .select({ id: salesFunnelStages.id })
    .from(salesFunnelStages)
    .where(eq(salesFunnelStages.companyId, companyId))
    .limit(1);

  if (existing.length > 0) {
    return; // Already has stages
  }

  const defaultStages = [
    { name: 'Primeiro Contato', code: 'first_contact', color: '#6366F1', order: 1, isDefault: true, automationTrigger: 'first_contact' },
    { name: 'Agendamento', code: 'scheduling', color: '#3B82F6', order: 2, automationTrigger: 'scheduling' },
    { name: 'Confirmado', code: 'confirmation', color: '#F59E0B', order: 3, automationTrigger: 'confirmation' },
    { name: 'Consulta Realizada', code: 'consultation_done', color: '#10B981', order: 4, automationTrigger: 'consultation_done' },
    { name: 'Pagamento', code: 'payment', color: '#8B5CF6', order: 5, automationTrigger: 'payment_done' },
    { name: 'Concluído', code: 'won', color: '#22C55E', order: 6, isWon: true },
    { name: 'Perdido', code: 'lost', color: '#EF4444', order: 7, isLost: true },
  ];

  for (const stage of defaultStages) {
    await db.insert(salesFunnelStages).values({
      companyId,
      name: stage.name,
      code: stage.code,
      color: stage.color,
      order: stage.order,
      isDefault: stage.isDefault || false,
      isWon: stage.isWon || false,
      isLost: stage.isLost || false,
      automationTrigger: stage.automationTrigger || null,
    });
  }

  log.info({ companyId }, 'Seeded default WhatsApp pipeline stages');
}

/**
 * Progresses a CRM opportunity by patient phone number.
 * Used when appointment status changes (completed, payment) to bridge
 * appointments that may not have a direct chatSessionId link.
 */
export async function progressOpportunityByPhone(
  companyId: number,
  phone: string,
  trigger: string,
  metadata?: Record<string, any>
): Promise<SalesOpportunity | null> {
  // Normalize phone
  const cleanPhone = phone.replace(/\D/g, '');

  // Find chat session by phone
  const [session] = await db
    .select()
    .from(chatSessions)
    .where(
      and(
        eq(chatSessions.companyId, companyId),
        sql`REPLACE(REPLACE(REPLACE(${chatSessions.phone}, '+', ''), '-', ''), ' ', '') LIKE ${'%' + cleanPhone.slice(-10)}`
      )
    )
    .orderBy(desc(chatSessions.updatedAt))
    .limit(1);

  if (session) {
    return progressOpportunity(companyId, trigger, {
      sessionId: session.id,
      metadata: { ...metadata, source: 'appointment_status_change' },
    });
  }

  // Fallback: find opportunity by patient phone directly
  const [opportunity] = await db
    .select()
    .from(salesOpportunities)
    .where(
      and(
        eq(salesOpportunities.companyId, companyId),
        sql`REPLACE(REPLACE(REPLACE(${salesOpportunities.leadPhone}, '+', ''), '-', ''), ' ', '') LIKE ${'%' + cleanPhone.slice(-10)}`
      )
    )
    .orderBy(desc(salesOpportunities.updatedAt))
    .limit(1);

  if (opportunity) {
    return progressOpportunity(companyId, trigger, {
      opportunityId: opportunity.id,
      metadata: { ...metadata, source: 'appointment_status_change_direct' },
    });
  }

  log.debug({ companyId, phone: cleanPhone, trigger }, 'No opportunity found for phone to progress');
  return null;
}

/**
 * Get timeline/activity for an opportunity (history + chat messages)
 */
export async function getOpportunityTimeline(
  companyId: number,
  opportunityId: number
) {
  const [opportunity] = await db
    .select()
    .from(salesOpportunities)
    .where(
      and(
        eq(salesOpportunities.id, opportunityId),
        eq(salesOpportunities.companyId, companyId)
      )
    );

  if (!opportunity) {
    return null;
  }

  // Get stage change history
  const history = await db
    .select({
      id: salesOpportunityHistory.id,
      action: salesOpportunityHistory.action,
      description: salesOpportunityHistory.description,
      metadata: salesOpportunityHistory.metadata,
      createdAt: salesOpportunityHistory.createdAt,
      fromStageName: sql<string>`fs.name`,
      toStageName: sql<string>`ts.name`,
    })
    .from(salesOpportunityHistory)
    .leftJoin(
      sql`sales_funnel_stages fs`,
      sql`${salesOpportunityHistory.fromStageId} = fs.id`
    )
    .leftJoin(
      sql`sales_funnel_stages ts`,
      sql`${salesOpportunityHistory.toStageId} = ts.id`
    )
    .where(eq(salesOpportunityHistory.opportunityId, opportunityId))
    .orderBy(desc(salesOpportunityHistory.createdAt));

  return {
    opportunity,
    history,
  };
}
