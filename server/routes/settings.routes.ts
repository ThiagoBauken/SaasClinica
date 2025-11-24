import { Router } from 'express';
import { storage } from '../storage';
import { authCheck, adminOnly, asyncHandler } from '../middleware/auth';
import { validate } from '../middleware/validation';

const router = Router();

/**
 * GET /api/v1/settings
 * Busca configurações da empresa
 */
router.get(
  '/',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    // TODO: Implementar getCompanySettings no storage
    res.json({
      companyId,
      // settings here
    });
  })
);

/**
 * PATCH /api/v1/settings
 * Atualiza configurações da empresa (admin only)
 */
router.patch(
  '/',
  authCheck,
  adminOnly,
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    // TODO: Implementar updateCompanySettings no storage

    res.json({
      message: 'Settings updated successfully',
    });
  })
);

export default router;
