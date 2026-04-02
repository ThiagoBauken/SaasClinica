import { db } from '../db';
import { clinicSettings, companies } from '@shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Middleware to authenticate N8N requests.
 * Accepts:
 * 1. SAAS_MASTER_API_KEY (global access)
 * 2. Company-specific n8nApiKey (per-company access)
 * 3. Wuzapi Token (auto-identifies company)
 */
export async function n8nAuth(req: any, res: any, next: any) {
  const apiKey = req.headers['x-api-key'] as string;
  const wuzapiToken = req.headers['x-wuzapi-token'] as string;
  const masterKey = process.env.SAAS_MASTER_API_KEY;

  // 1. Master API Key - global access
  if (apiKey && apiKey === masterKey) {
    req.isMaster = true;
    return next();
  }

  // 2. Wuzapi Token - auto-identifies company via indexed query
  if (wuzapiToken) {
    const [matchedSettings] = await db
      .select()
      .from(clinicSettings)
      .where(eq(clinicSettings.wuzapiApiKey, wuzapiToken))
      .limit(1);

    if (matchedSettings) {
      req.companyId = matchedSettings.companyId;
      req.companySettings = matchedSettings;
      return next();
    }
  }

  // 3. Company-specific API Key
  if (apiKey) {
    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.n8nApiKey, apiKey))
      .limit(1);

    if (company) {
      req.companyId = company.id;
      return next();
    }
  }

  return res.status(401).json({
    success: false,
    error: 'Unauthorized',
    message: 'Forneça X-API-Key ou X-Wuzapi-Token válido',
  });
}
