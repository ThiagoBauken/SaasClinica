/**
 * Feature Gating by Plan
 * Controls which features are available based on the company's subscription plan
 */
import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { subscriptions, plans } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../logger';

/**
 * Feature definitions by plan tier
 * Each feature maps to which plan levels include it
 */
export const PLAN_FEATURES: Record<string, string[]> = {
  // Core features (available on all plans)
  'patients.crud': ['free', 'starter', 'professional', 'enterprise'],
  'appointments.crud': ['free', 'starter', 'professional', 'enterprise'],
  'calendar.basic': ['free', 'starter', 'professional', 'enterprise'],
  'odontogram.basic': ['free', 'starter', 'professional', 'enterprise'],

  // Starter features
  'financial.basic': ['starter', 'professional', 'enterprise'],
  'inventory.basic': ['starter', 'professional', 'enterprise'],
  'reports.basic': ['starter', 'professional', 'enterprise'],
  'whatsapp.reminders': ['starter', 'professional', 'enterprise'],

  // Professional features
  'automation.n8n': ['professional', 'enterprise'],
  'whatsapp.chatbot': ['professional', 'enterprise'],
  'crm.pipeline': ['professional', 'enterprise'],
  'analytics.advanced': ['professional', 'enterprise'],
  'prosthesis.control': ['professional', 'enterprise'],
  'digital.signature': ['professional', 'enterprise'],
  'financial.advanced': ['professional', 'enterprise'],
  'reports.pdf': ['professional', 'enterprise'],
  'patient.import': ['professional', 'enterprise'],
  'patient.digitization': ['professional', 'enterprise'],
  'google.calendar': ['professional', 'enterprise'],

  // Enterprise features
  'api.access': ['enterprise'],
  'multi.branch': ['enterprise'],
  'custom.branding': ['enterprise'],
  'sla.support': ['enterprise'],
  'audit.log': ['enterprise'],
  'data.export': ['enterprise'],
  'webhook.custom': ['enterprise'],
};

// Cache for plan data (avoids DB lookup on every request)
const planCache = new Map<number, { planName: string; features: string[]; expiresAt: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get company's plan features from cache or DB
 */
async function getCompanyFeatures(companyId: number): Promise<{ planName: string; features: string[] }> {
  // Check cache first
  const cached = planCache.get(companyId);
  if (cached && cached.expiresAt > Date.now()) {
    return { planName: cached.planName, features: cached.features };
  }

  try {
    // Look up subscription and plan
    const result = await db
      .select({
        planName: plans.name,
        status: subscriptions.status,
      })
      .from(subscriptions)
      .innerJoin(plans, eq(subscriptions.planId, plans.id))
      .where(eq(subscriptions.companyId, companyId))
      .limit(1);

    if (!result.length) {
      // No subscription = free tier
      const features = Object.entries(PLAN_FEATURES)
        .filter(([, tiers]) => tiers.includes('free'))
        .map(([feature]) => feature);
      planCache.set(companyId, { planName: 'free', features, expiresAt: Date.now() + CACHE_TTL });
      return { planName: 'free', features };
    }

    const { planName, status } = result[0];

    // If subscription is not active/trialing, treat as free
    if (!['active', 'trial'].includes(status)) {
      const features = Object.entries(PLAN_FEATURES)
        .filter(([, tiers]) => tiers.includes('free'))
        .map(([feature]) => feature);
      planCache.set(companyId, { planName: 'free', features, expiresAt: Date.now() + CACHE_TTL });
      return { planName: 'free', features };
    }

    // Get features for this plan tier
    const tierName = planName.toLowerCase();
    const features = Object.entries(PLAN_FEATURES)
      .filter(([, tiers]) => tiers.includes(tierName))
      .map(([feature]) => feature);

    planCache.set(companyId, { planName: tierName, features, expiresAt: Date.now() + CACHE_TTL });
    return { planName: tierName, features };
  } catch (error) {
    logger.error({ err: error, companyId }, 'Error fetching company features');
    // On error, allow all features to avoid blocking the user
    return { planName: 'unknown', features: Object.keys(PLAN_FEATURES) };
  }
}

/**
 * Middleware to check if a feature is available for the company's plan
 */
export function requireFeature(featureKey: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as any;
      if (!user?.companyId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      // Superadmins bypass feature gates
      if (user.role === 'superadmin') {
        return next();
      }

      const { planName, features } = await getCompanyFeatures(user.companyId);

      if (!features.includes(featureKey)) {
        return res.status(403).json({
          error: {
            code: 'FEATURE_NOT_AVAILABLE',
            message: `This feature requires an upgrade. Your current plan (${planName}) does not include "${featureKey}".`,
            feature: featureKey,
            currentPlan: planName,
            requiredPlans: PLAN_FEATURES[featureKey] || [],
            upgradeUrl: '/billing',
          },
        });
      }

      next();
    } catch (error) {
      logger.error({ err: error }, 'Feature gate error');
      // On error, allow access to avoid blocking users
      next();
    }
  };
}

/**
 * Get all features available for a company (for frontend rendering)
 */
export async function getAvailableFeatures(companyId: number): Promise<{
  plan: string;
  features: string[];
  allFeatures: Record<string, string[]>;
}> {
  const { planName, features } = await getCompanyFeatures(companyId);
  return {
    plan: planName,
    features,
    allFeatures: PLAN_FEATURES,
  };
}

/**
 * Clear cache for a specific company (call when subscription changes)
 */
export function clearFeatureCache(companyId?: number): void {
  if (companyId) {
    planCache.delete(companyId);
  } else {
    planCache.clear();
  }
}
