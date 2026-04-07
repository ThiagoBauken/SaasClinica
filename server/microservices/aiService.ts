/**
 * LEGACY AI SERVICE — DEPRECATED AND DISABLED
 *
 * SECURITY: This file previously sent patient data (images, symptoms) directly to
 * OpenAI WITHOUT anonymization, in violation of LGPD Art. 11 (sensitive health data).
 *
 * All methods now throw errors. Use `server/services/ai-provider.ts` (AIProviderService)
 * which provides:
 *  - Local Ollama as default (data never leaves the server)
 *  - PII anonymization for any external provider fallback
 *  - 6-layer prompt injection defense
 *  - Token usage tracking for billing
 *
 * Migration: Replace `import { createAIService }` with `import { aiProviderService } from '../services/ai-provider'`
 */

import express from 'express';
import { logger } from '../logger';

const log = logger.child({ module: 'legacy-ai-service' });

const DEPRECATED_ERROR =
  'aiService.ts is deprecated and disabled for LGPD compliance. ' +
  'Use server/services/ai-provider.ts (AIProviderService) instead.';

class AIService {
  async analyzeDentalImage(_imageUrl: string, _companyId: number): Promise<never> {
    log.error('SECURITY BLOCK: Attempted call to deprecated analyzeDentalImage');
    throw new Error(DEPRECATED_ERROR);
  }

  async generateTreatmentPlan(_diagnosis: unknown): Promise<never> {
    log.error('SECURITY BLOCK: Attempted call to deprecated generateTreatmentPlan');
    throw new Error(DEPRECATED_ERROR);
  }

  async optimizeSchedule(_companyId: number, _appointments: unknown[]): Promise<never> {
    log.error('SECURITY BLOCK: Attempted call to deprecated optimizeSchedule');
    throw new Error(DEPRECATED_ERROR);
  }
}

export function createAIService(): express.Application {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'deprecated', service: 'ai-service-legacy' });
  });

  // All endpoints now return 410 Gone — forcing migration to AIProviderService
  const deprecatedHandler = (_req: express.Request, res: express.Response) => {
    log.warn('SECURITY: Legacy aiService endpoint called — returning 410 Gone');
    res.status(410).json({
      error: 'Endpoint deprecated for LGPD compliance',
      message: DEPRECATED_ERROR,
      migrate_to: '/api/v1/ai/* (AIProviderService)',
    });
  };

  app.post('/analyze-image', deprecatedHandler);
  app.post('/treatment-plan', deprecatedHandler);
  app.post('/optimize-schedule', deprecatedHandler);

  return app;
}

// Export the disabled class so any direct imports will fail loudly at runtime
export { AIService };
