import { db } from '../db';
import { coupons, couponUsages, subscriptions } from '@shared/schema';
import { eq, and, gte, lte, or, isNull, sql } from 'drizzle-orm';

/**
 * Serviço de Cupons e Descontos
 */

interface ValidateCouponParams {
  code: string;
  companyId: number;
  planId?: number;
}

interface ValidateCouponResult {
  isValid: boolean;
  coupon?: typeof coupons.$inferSelect;
  message?: string;
  discountAmount?: number;
}

/**
 * Valida um cupom para uso
 */
export async function validateCoupon(params: ValidateCouponParams): Promise<ValidateCouponResult> {
  const { code, companyId, planId } = params;

  try {
    // Buscar cupom pelo código
    const [coupon] = await db
      .select()
      .from(coupons)
      .where(eq(coupons.code, code.toUpperCase()))
      .limit(1);

    if (!coupon) {
      return {
        isValid: false,
        message: 'Cupom não encontrado',
      };
    }

    // Verificar se está ativo
    if (!coupon.isActive) {
      return {
        isValid: false,
        message: 'Cupom desativado',
      };
    }

    // Verificar datas de validade
    const now = new Date();
    if (coupon.validFrom && new Date(coupon.validFrom) > now) {
      return {
        isValid: false,
        message: 'Cupom ainda não está válido',
      };
    }

    if (coupon.validUntil && new Date(coupon.validUntil) < now) {
      return {
        isValid: false,
        message: 'Cupom expirado',
      };
    }

    // Verificar limite de usos
    if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
      return {
        isValid: false,
        message: 'Cupom esgotado',
      };
    }

    // Verificar se pode ser usado no plano especificado
    if (planId && coupon.planIds) {
      const allowedPlans = coupon.planIds as number[];
      if (allowedPlans.length > 0 && !allowedPlans.includes(planId)) {
        return {
          isValid: false,
          message: 'Cupom não válido para este plano',
        };
      }
    }

    // Verificar se a empresa já usou este cupom
    const [existingUsage] = await db
      .select()
      .from(couponUsages)
      .where(
        and(
          eq(couponUsages.couponId, coupon.id),
          eq(couponUsages.companyId, companyId)
        )
      )
      .limit(1);

    if (existingUsage) {
      return {
        isValid: false,
        message: 'Cupom já foi utilizado por esta empresa',
      };
    }

    return {
      isValid: true,
      coupon,
      message: 'Cupom válido',
    };
  } catch (error) {
    console.error('Erro ao validar cupom:', error);
    return {
      isValid: false,
      message: 'Erro ao validar cupom',
    };
  }
}

/**
 * Calcula o valor do desconto baseado no cupom
 */
export function calculateDiscount(coupon: typeof coupons.$inferSelect, originalAmount: number): number {
  if (coupon.discountType === 'percentage') {
    const percentage = parseFloat(coupon.discountValue);
    return (originalAmount * percentage) / 100;
  } else {
    // fixed amount
    return Math.min(parseFloat(coupon.discountValue), originalAmount);
  }
}

/**
 * Aplica um cupom a uma assinatura
 */
export async function applyCoupon(params: {
  couponCode: string;
  companyId: number;
  subscriptionId: number;
  planId: number;
  originalAmount: number;
}) {
  const { couponCode, companyId, subscriptionId, planId, originalAmount } = params;

  // Validar cupom
  const validation = await validateCoupon({ code: couponCode, companyId, planId });

  if (!validation.isValid || !validation.coupon) {
    throw new Error(validation.message || 'Cupom inválido');
  }

  const discountAmount = calculateDiscount(validation.coupon, originalAmount);

  // Registrar uso do cupom
  await db.insert(couponUsages).values({
    couponId: validation.coupon.id,
    companyId,
    subscriptionId,
    discountAmount: discountAmount.toString(),
  });

  // Incrementar contador de usos
  await db
    .update(coupons)
    .set({
      usedCount: sql`${coupons.usedCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(coupons.id, validation.coupon.id));

  return {
    success: true,
    coupon: validation.coupon,
    discountAmount,
    finalAmount: originalAmount - discountAmount,
  };
}

/**
 * Cria um novo cupom
 */
export async function createCoupon(data: typeof coupons.$inferInsert) {
  // Converter código para maiúsculas
  const couponData = {
    ...data,
    code: data.code.toUpperCase(),
  };

  const [newCoupon] = await db.insert(coupons).values(couponData).returning();

  return newCoupon;
}

/**
 * Lista todos os cupons
 */
export async function listCoupons(filters?: {
  isActive?: boolean;
  validNow?: boolean;
}) {
  let query = db.select().from(coupons);

  if (filters?.isActive !== undefined) {
    query = query.where(eq(coupons.isActive, filters.isActive)) as any;
  }

  if (filters?.validNow) {
    const now = new Date();
    query = query.where(
      and(
        lte(coupons.validFrom, now),
        or(isNull(coupons.validUntil), gte(coupons.validUntil, now))
      )
    ) as any;
  }

  return await query;
}

/**
 * Atualiza um cupom
 */
export async function updateCoupon(id: number, data: Partial<typeof coupons.$inferInsert>) {
  const updateData = {
    ...data,
    ...(data.code ? { code: data.code.toUpperCase() } : {}),
    updatedAt: new Date(),
  };

  const [updated] = await db
    .update(coupons)
    .set(updateData)
    .where(eq(coupons.id, id))
    .returning();

  return updated;
}

/**
 * Desativa um cupom
 */
export async function deactivateCoupon(id: number) {
  const [deactivated] = await db
    .update(coupons)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(eq(coupons.id, id))
    .returning();

  return deactivated;
}

/**
 * Busca histórico de uso de um cupom
 */
export async function getCouponUsageHistory(couponId: number) {
  return await db
    .select()
    .from(couponUsages)
    .where(eq(couponUsages.couponId, couponId));
}
