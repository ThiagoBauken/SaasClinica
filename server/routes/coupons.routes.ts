import { Router, Request, Response } from 'express';
import {
  validateCoupon,
  createCoupon,
  listCoupons,
  updateCoupon,
  deactivateCoupon,
  getCouponUsageHistory,
} from '../services/coupon-service';

const router = Router();

/**
 * POST /api/coupons/validate
 * Valida um cupom sem aplicá-lo
 */
router.post('/validate', async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user || !user.companyId) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const { code, planId } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Código do cupom é obrigatório' });
    }

    const result = await validateCoupon({
      code,
      companyId: user.companyId,
      planId,
    });

    res.json(result);
  } catch (error: any) {
    console.error('Erro ao validar cupom:', error);
    res.status(500).json({ error: error.message || 'Erro ao validar cupom' });
  }
});

/**
 * POST /api/coupons
 * Criar novo cupom (admin only)
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const coupon = await createCoupon({
      ...req.body,
      createdBy: user.id,
    });

    res.status(201).json(coupon);
  } catch (error: any) {
    console.error('Erro ao criar cupom:', error);
    res.status(400).json({ error: error.message || 'Erro ao criar cupom' });
  }
});

/**
 * GET /api/coupons
 * Listar todos os cupons (admin only)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const { isActive, validNow } = req.query;

    const filters: any = {};
    if (isActive !== undefined) {
      filters.isActive = isActive === 'true';
    }
    if (validNow === 'true') {
      filters.validNow = true;
    }

    const coupons = await listCoupons(filters);

    res.json(coupons);
  } catch (error: any) {
    console.error('Erro ao listar cupons:', error);
    res.status(500).json({ error: error.message || 'Erro ao listar cupons' });
  }
});

/**
 * PUT /api/coupons/:id
 * Atualizar cupom (admin only)
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const { id } = req.params;
    const updated = await updateCoupon(parseInt(id), req.body);

    res.json(updated);
  } catch (error: any) {
    console.error('Erro ao atualizar cupom:', error);
    res.status(400).json({ error: error.message || 'Erro ao atualizar cupom' });
  }
});

/**
 * DELETE /api/coupons/:id
 * Desativar cupom (admin only)
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const { id } = req.params;
    const deactivated = await deactivateCoupon(parseInt(id));

    res.json(deactivated);
  } catch (error: any) {
    console.error('Erro ao desativar cupom:', error);
    res.status(400).json({ error: error.message || 'Erro ao desativar cupom' });
  }
});

/**
 * GET /api/coupons/:id/usage
 * Buscar histórico de uso de um cupom (admin only)
 */
router.get('/:id/usage', async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const { id } = req.params;
    const usage = await getCouponUsageHistory(parseInt(id));

    res.json(usage);
  } catch (error: any) {
    console.error('Erro ao buscar histórico de uso:', error);
    res.status(500).json({ error: error.message || 'Erro ao buscar histórico de uso' });
  }
});

export default router;
