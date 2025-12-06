import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { auditLogs } from '@shared/schema';

/**
 * Middleware para audit logging de acordo com LGPD
 * Registra todas as operações em dados sensíveis
 */

// Recursos que contêm dados sensíveis
const SENSITIVE_RESOURCES = [
  'patients',
  'appointments',
  'users',
  'patient-records',
  'anamnesis',
  'exams',
  'treatment-plans',
  'prescriptions',
  'financial',
  'payments'
];

// Categorias de dados
const DATA_CATEGORIES: { [key: string]: string } = {
  'patients': 'personal',
  'appointments': 'health',
  'users': 'personal',
  'patient-records': 'health',
  'anamnesis': 'health',
  'exams': 'health',
  'treatment-plans': 'health',
  'prescriptions': 'health',
  'financial': 'financial',
  'payments': 'financial'
};

// Ações que devem ser auditadas
const AUDITABLE_ACTIONS: { [key: string]: string } = {
  'GET': 'read',
  'POST': 'create',
  'PUT': 'update',
  'PATCH': 'update',
  'DELETE': 'delete'
};

/**
 * Extrai o recurso da URL
 */
function extractResource(url: string): string | null {
  const match = url.match(/\/api\/v1\/([^/?]+)/);
  if (!match) return null;

  return match[1];
}

/**
 * Extrai o ID do recurso da URL
 */
function extractResourceId(url: string): number | null {
  const match = url.match(/\/api\/v1\/[^/]+\/(\d+)/);
  if (!match) return null;

  return parseInt(match[1]);
}

/**
 * Verifica se a operação deve ser auditada
 */
function shouldAudit(method: string, resource: string | null): boolean {
  if (!resource || !AUDITABLE_ACTIONS[method]) {
    return false;
  }

  return SENSITIVE_RESOURCES.includes(resource);
}

/**
 * Captura o corpo original da resposta
 */
function captureResponseBody(res: Response): any {
  const originalJson = res.json.bind(res);
  let responseBody: any = null;

  res.json = function (body: any) {
    responseBody = body;
    return originalJson(body);
  };

  return () => responseBody;
}

/**
 * Middleware de audit logging
 */
export const auditLogMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const method = req.method;
  const url = req.url;
  const resource = extractResource(url);

  // Verificar se deve auditar esta operação
  if (!shouldAudit(method, resource)) {
    return next();
  }

  const user = (req as any).user;
  const companyId = user?.companyId;
  const userId = user?.id;

  // Capturar dados da requisição
  const requestBody = req.body;
  const resourceId = extractResourceId(url);
  const action = AUDITABLE_ACTIONS[method];
  const dataCategory = resource ? DATA_CATEGORIES[resource] : null;

  // Capturar informações do contexto
  const ipAddress = req.ip || req.socket.remoteAddress || null;
  const userAgent = req.get('user-agent') || null;

  // Capturar o corpo da resposta
  const getResponseBody = captureResponseBody(res);

  // Aguardar a conclusão da requisição
  res.on('finish', async () => {
    try {
      const statusCode = res.statusCode;
      const responseBody = getResponseBody();

      // Só registrar operações bem-sucedidas
      if (statusCode < 200 || statusCode >= 300) {
        return;
      }

      // Preparar dados de mudança (para updates)
      let changes: any = null;
      if (action === 'update' && requestBody) {
        changes = {
          fields: Object.keys(requestBody),
          values: requestBody
        };
      }

      // Criar descrição da ação
      let description = `${action.toUpperCase()} operation on ${resource}`;
      if (resourceId) {
        description += ` (ID: ${resourceId})`;
      }

      // Verificar se o usuário deu consentimento (para operações em pacientes)
      let consentGiven = null;
      if (resource === 'patients' && action === 'create') {
        consentGiven = requestBody?.dataProcessingConsent || false;
      }

      // Registrar no audit log
      await db.insert(auditLogs).values({
        companyId: companyId || 0,
        userId: userId || null,
        action,
        resource: resource || 'unknown',
        resourceId: resourceId || null,
        sensitiveData: true,
        dataCategory: dataCategory || 'unknown',
        description,
        changes: changes || null,
        reason: requestBody?.auditReason || null,
        ipAddress,
        userAgent,
        method,
        url,
        statusCode,
        lgpdJustification: requestBody?.lgpdJustification || null,
        consentGiven,
        metadata: {
          timestamp: new Date().toISOString(),
          requestSize: JSON.stringify(requestBody).length,
          responseSize: JSON.stringify(responseBody).length
        }
      });
    } catch (error) {
      // Não falhar a requisição se o audit log falhar
      console.error('Erro ao registrar audit log:', error);
    }
  });

  next();
};

/**
 * Middleware para registrar exportação de dados (LGPD Article 18)
 */
export const auditDataExport = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const user = (req as any).user;
  const companyId = user?.companyId;
  const userId = user?.id;

  const ipAddress = req.ip || req.socket.remoteAddress || null;
  const userAgent = req.get('user-agent') || null;

  // Capturar o corpo da resposta
  const getResponseBody = captureResponseBody(res);

  res.on('finish', async () => {
    try {
      const statusCode = res.statusCode;
      if (statusCode < 200 || statusCode >= 300) {
        return;
      }

      const responseBody = getResponseBody();
      const recordCount = Array.isArray(responseBody) ? responseBody.length : 1;

      await db.insert(auditLogs).values({
        companyId: companyId || 0,
        userId: userId || null,
        action: 'export',
        resource: 'data_export',
        resourceId: null,
        sensitiveData: true,
        dataCategory: 'mixed',
        description: `Data export requested (${recordCount} records)`,
        changes: null,
        reason: req.body?.exportReason || 'User requested data export',
        ipAddress,
        userAgent,
        method: req.method,
        url: req.url,
        statusCode,
        lgpdJustification: 'LGPD Article 18 - Right to data portability',
        consentGiven: true,
        metadata: {
          timestamp: new Date().toISOString(),
          recordCount,
          exportFormat: req.query.format || 'json'
        }
      });
    } catch (error) {
      console.error('Erro ao registrar exportação de dados:', error);
    }
  });

  next();
};

/**
 * Middleware para registrar anonimização de dados (LGPD Article 16)
 */
export const auditDataAnonymization = async (
  patientId: number,
  companyId: number,
  userId: number | null,
  reason: string
) => {
  try {
    await db.insert(auditLogs).values({
      companyId,
      userId: userId || null,
      action: 'anonymize',
      resource: 'patients',
      resourceId: patientId,
      sensitiveData: true,
      dataCategory: 'personal',
      description: `Patient data anonymized (ID: ${patientId})`,
      changes: null,
      reason,
      ipAddress: null,
      userAgent: null,
      method: 'SYSTEM',
      url: '/anonymize',
      statusCode: 200,
      lgpdJustification: 'LGPD Article 16 - Right to deletion/anonymization',
      consentGiven: true,
      metadata: {
        timestamp: new Date().toISOString(),
        automatedProcess: true
      }
    });
  } catch (error) {
    console.error('Erro ao registrar anonimização:', error);
  }
};
