/**
 * Admin Seed Routes - Popular banco com dados de teste
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth';

const router = Router();

/**
 * POST /api/v1/admin/seed-complete
 * Popula TODAS as seções com dados realistas para a empresa do admin logado
 */
router.post('/seed-complete', requireAuth, async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    const userRole = req.user?.role;

    if (!companyId) {
      return res.status(400).json({ error: 'Empresa não encontrada' });
    }

    if (userRole !== 'admin' && userRole !== 'superadmin') {
      return res.status(403).json({ error: 'Apenas administradores podem executar o seed' });
    }

    const { seedCompleteData } = await import('../scripts/seed-complete-data');
    const result = await seedCompleteData(companyId);

    res.json(result);
  } catch (error: any) {
    console.error('Erro ao executar seed completo:', error);
    res.status(500).json({ error: 'Erro ao popular dados: ' + (error.message || 'Erro desconhecido') });
  }
});

export default router;
