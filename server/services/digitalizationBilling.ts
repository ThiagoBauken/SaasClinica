import { db } from '../db';
import {
  digitalizationUsage,
  digitalizationLogs,
  digitalizationInvoices,
  type InsertDigitalizationLog,
} from '@shared/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { addMonths, startOfMonth, endOfMonth } from 'date-fns';

/**
 * Serviço de Billing para Digitalização de Fichas
 *
 * Preço: R$ 30,00 por 1.000 digitalizações
 * - Cobrança mensal automática
 * - Opção de pré-pago (pacotes)
 * - Alertas de uso
 */

const PRICE_PER_THOUSAND = 3000; // R$ 30,00 em centavos

export interface UsageStats {
  currentCycleCount: number;
  totalCount: number;
  remainingPrepaid: number;
  estimatedCost: number; // em centavos
  cycleStart: Date;
  cycleEnd: Date;
  isActive: boolean;
}

/**
 * Inicializa controle de uso para uma empresa
 */
export async function initializeUsageTracking(companyId: number) {
  const existing = await db
    .select()
    .from(digitalizationUsage)
    .where(eq(digitalizationUsage.companyId, companyId))
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  const now = new Date();
  const cycleEnd = endOfMonth(now);

  const [usage] = await db
    .insert(digitalizationUsage)
    .values({
      companyId,
      usageCount: 0,
      currentCycleStart: startOfMonth(now),
      currentCycleEnd: cycleEnd,
      currentCycleCount: 0,
      paidUnits: 0,
      remainingUnits: 0,
      pricePerThousand: PRICE_PER_THOUSAND,
      totalSpent: 0,
      isActive: true,
    })
    .returning();

  return usage;
}

/**
 * Registra uso de digitalização
 */
export async function recordDigitalizationUsage(params: {
  companyId: number;
  userId?: number;
  imageCount: number;
  successCount: number;
  failedCount: number;
  ocrConfidence?: number;
  aiModel?: string;
  processingTime?: number;
  importType: 'images' | 'xlsx';
  metadata?: Record<string, any>;
}): Promise<{ allowed: boolean; reason?: string; usage?: UsageStats }> {
  // Inicializa tracking se não existir
  await initializeUsageTracking(params.companyId);

  // Busca status atual
  const [currentUsage] = await db
    .select()
    .from(digitalizationUsage)
    .where(eq(digitalizationUsage.companyId, params.companyId))
    .limit(1);

  if (!currentUsage) {
    return { allowed: false, reason: 'Erro ao buscar informações de uso' };
  }

  // Verifica se está ativo
  if (!currentUsage.isActive) {
    return { allowed: false, reason: 'Serviço de digitalização desativado' };
  }

  // Verifica ciclo atual
  const now = new Date();
  if (now > new Date(currentUsage.currentCycleEnd)) {
    // Novo ciclo mensal
    await startNewBillingCycle(params.companyId);
  }

  // Calcula custo (apenas para fichas processadas com sucesso)
  const unitsToCharge = params.importType === 'images' ? params.successCount : params.imageCount;
  const cost = Math.ceil((unitsToCharge / 1000) * PRICE_PER_THOUSAND);

  // Se for pré-pago, verifica unidades restantes
  if (currentUsage.billingCycle === 'prepaid') {
    if (currentUsage.remainingUnits < unitsToCharge) {
      return {
        allowed: false,
        reason: `Unidades insuficientes. Restam ${currentUsage.remainingUnits} digitalizações pré-pagas.`,
      };
    }
  }

  // Registra log
  await db.insert(digitalizationLogs).values({
    companyId: params.companyId,
    userId: params.userId,
    imageCount: params.imageCount,
    successCount: params.successCount,
    failedCount: params.failedCount,
    ocrConfidence: params.ocrConfidence?.toString(),
    aiModel: params.aiModel || 'deepseek-chat',
    processingTime: params.processingTime,
    cost,
    importType: params.importType,
    metadata: params.metadata,
  });

  // Atualiza contadores
  const newCycleCount = currentUsage.currentCycleCount + unitsToCharge;
  const newTotalCount = currentUsage.usageCount + unitsToCharge;
  const newTotalSpent = currentUsage.totalSpent + cost;
  const newRemainingUnits =
    currentUsage.billingCycle === 'prepaid'
      ? currentUsage.remainingUnits - unitsToCharge
      : currentUsage.remainingUnits;

  await db
    .update(digitalizationUsage)
    .set({
      usageCount: newTotalCount,
      lastUsedAt: now,
      currentCycleCount: newCycleCount,
      totalSpent: newTotalSpent,
      remainingUnits: newRemainingUnits,
      updatedAt: now,
    })
    .where(eq(digitalizationUsage.companyId, params.companyId));

  // Retorna status atualizado
  const stats: UsageStats = {
    currentCycleCount: newCycleCount,
    totalCount: newTotalCount,
    remainingPrepaid: newRemainingUnits,
    estimatedCost: Math.ceil((newCycleCount / 1000) * PRICE_PER_THOUSAND),
    cycleStart: new Date(currentUsage.currentCycleStart),
    cycleEnd: new Date(currentUsage.currentCycleEnd),
    isActive: currentUsage.isActive,
  };

  return { allowed: true, usage: stats };
}

/**
 * Inicia novo ciclo de cobrança mensal
 */
async function startNewBillingCycle(companyId: number) {
  const [currentUsage] = await db
    .select()
    .from(digitalizationUsage)
    .where(eq(digitalizationUsage.companyId, companyId))
    .limit(1);

  if (!currentUsage) return;

  // Se for mensal, gera fatura do ciclo anterior
  if (
    currentUsage.billingCycle === 'monthly' &&
    currentUsage.currentCycleCount > 0
  ) {
    const amount = Math.ceil(
      (currentUsage.currentCycleCount / 1000) * PRICE_PER_THOUSAND
    );

    await db.insert(digitalizationInvoices).values({
      companyId,
      periodStart: currentUsage.currentCycleStart,
      periodEnd: currentUsage.currentCycleEnd,
      unitsUsed: currentUsage.currentCycleCount,
      amount,
      status: 'pending',
    });
  }

  // Inicia novo ciclo
  const now = new Date();
  await db
    .update(digitalizationUsage)
    .set({
      currentCycleStart: startOfMonth(now),
      currentCycleEnd: endOfMonth(now),
      currentCycleCount: 0,
      updatedAt: now,
    })
    .where(eq(digitalizationUsage.companyId, companyId));
}

/**
 * Obtém estatísticas de uso
 */
export async function getUsageStats(companyId: number): Promise<UsageStats | null> {
  const [usage] = await db
    .select()
    .from(digitalizationUsage)
    .where(eq(digitalizationUsage.companyId, companyId))
    .limit(1);

  if (!usage) {
    return null;
  }

  return {
    currentCycleCount: usage.currentCycleCount,
    totalCount: usage.usageCount,
    remainingPrepaid: usage.remainingUnits,
    estimatedCost: Math.ceil((usage.currentCycleCount / 1000) * PRICE_PER_THOUSAND),
    cycleStart: new Date(usage.currentCycleStart),
    cycleEnd: new Date(usage.currentCycleEnd),
    isActive: usage.isActive,
  };
}

/**
 * Adiciona unidades pré-pagas (pacotes)
 */
export async function addPrepaidUnits(
  companyId: number,
  units: number,
  paidAmount: number
): Promise<void> {
  await initializeUsageTracking(companyId);

  const [current] = await db
    .select()
    .from(digitalizationUsage)
    .where(eq(digitalizationUsage.companyId, companyId))
    .limit(1);

  if (!current) return;

  await db
    .update(digitalizationUsage)
    .set({
      paidUnits: current.paidUnits + units,
      remainingUnits: current.remainingUnits + units,
      billingCycle: 'prepaid',
      updatedAt: new Date(),
    })
    .where(eq(digitalizationUsage.companyId, companyId));

  // Registra invoice do pacote pré-pago
  const now = new Date();
  await db.insert(digitalizationInvoices).values({
    companyId,
    periodStart: now,
    periodEnd: addMonths(now, 12), // Válido por 1 ano
    unitsUsed: 0,
    amount: paidAmount,
    status: 'paid',
    paidAt: now,
    metadata: {
      type: 'prepaid_package',
      units,
    },
  });
}

/**
 * Obtém faturas pendentes
 */
export async function getPendingInvoices(companyId: number) {
  return await db
    .select()
    .from(digitalizationInvoices)
    .where(
      and(
        eq(digitalizationInvoices.companyId, companyId),
        eq(digitalizationInvoices.status, 'pending')
      )
    )
    .orderBy(digitalizationInvoices.createdAt);
}

/**
 * Marca fatura como paga
 */
export async function markInvoiceAsPaid(
  invoiceId: number,
  paymentMethod: string
): Promise<void> {
  await db
    .update(digitalizationInvoices)
    .set({
      status: 'paid',
      paidAt: new Date(),
      paymentMethod,
    })
    .where(eq(digitalizationInvoices.id, invoiceId));
}

/**
 * Obtém relatório de uso detalhado
 */
export async function getUsageReport(
  companyId: number,
  startDate: Date,
  endDate: Date
) {
  return await db
    .select()
    .from(digitalizationLogs)
    .where(
      and(
        eq(digitalizationLogs.companyId, companyId),
        gte(digitalizationLogs.createdAt, startDate),
        lte(digitalizationLogs.createdAt, endDate)
      )
    )
    .orderBy(digitalizationLogs.createdAt);
}

/**
 * Verifica se deve enviar alerta de uso
 */
export function shouldSendUsageAlert(stats: UsageStats): {
  send: boolean;
  level: 'warning' | 'critical' | null;
  message: string;
} {
  const costInReais = stats.estimatedCost / 100;

  // Alerta: R$ 100,00
  if (costInReais >= 100 && costInReais < 200) {
    return {
      send: true,
      level: 'warning',
      message: `Você já utilizou ${stats.currentCycleCount} digitalizações neste mês (R$ ${costInReais.toFixed(2)})`,
    };
  }

  // Crítico: R$ 200,00
  if (costInReais >= 200) {
    return {
      send: true,
      level: 'critical',
      message: `ALERTA: Uso elevado de ${stats.currentCycleCount} digitalizações (R$ ${costInReais.toFixed(2)}). Considere um pacote pré-pago.`,
    };
  }

  // Pré-pago acabando
  if (stats.remainingPrepaid > 0 && stats.remainingPrepaid < 100) {
    return {
      send: true,
      level: 'warning',
      message: `Restam apenas ${stats.remainingPrepaid} digitalizações pré-pagas. Recarregue em breve.`,
    };
  }

  return { send: false, level: null, message: '' };
}
