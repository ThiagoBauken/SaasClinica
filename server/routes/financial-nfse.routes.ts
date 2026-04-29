/**
 * Financial NFS-e (Nota Fiscal de Serviço Eletrônica) Routes
 * Extracted from financial.routes.ts for maintainability.
 *
 * Mounted at /api/v1/financial/nfse via financial.routes.ts
 */
import { Router } from 'express';
import { db } from '../db';
import { tenantAwareAuth, asyncHandler } from '../middleware/auth';

const router = Router();

/**
 * POST /emit
 * Emite NFS-e para um pagamento/serviço prestado
 */
router.post(
  '/emit',
  tenantAwareAuth,
  asyncHandler(async (req, res) => {
    const { nfseService } = await import('../services/nfse-emission.service');
    const user = req.user!;
    const companyId = user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const result = await nfseService.emit({ ...req.body, companyId });

    if (result.success) {
      await db.$client.query(
        `INSERT INTO audit_logs (company_id, user_id, action, resource_type, details)
         VALUES ($1, $2, 'create', 'nfse', $3)`,
        [companyId, user.id, JSON.stringify(result)]
      );
    }

    res.json(result);
  })
);

/**
 * POST /cancel
 * Cancela uma NFS-e emitida
 */
router.post(
  '/cancel',
  tenantAwareAuth,
  asyncHandler(async (req, res) => {
    const { nfseService } = await import('../services/nfse-emission.service');
    const user = req.user!;
    const companyId = user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { nfseNumber, reason } = req.body;

    if (!nfseNumber) {
      return res.status(400).json({ error: 'nfseNumber is required' });
    }

    const result = await nfseService.cancel(companyId, nfseNumber, reason || 'Cancelamento solicitado pelo usuario');

    if (result.success) {
      await db.$client.query(
        `INSERT INTO audit_logs (company_id, user_id, action, resource_type, details)
         VALUES ($1, $2, 'delete', 'nfse', $3)`,
        [companyId, user.id, JSON.stringify({ nfseNumber, reason })]
      );
    }

    res.json(result);
  })
);

/**
 * GET /query/:nfseNumber
 * Consulta o status de uma NFS-e emitida
 */
router.get(
  '/query/:nfseNumber',
  tenantAwareAuth,
  asyncHandler(async (req, res) => {
    const { nfseService } = await import('../services/nfse-emission.service');
    const user = req.user!;
    const companyId = user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const result = await nfseService.query(companyId, req.params.nfseNumber);
    res.json(result);
  })
);

export default router;
