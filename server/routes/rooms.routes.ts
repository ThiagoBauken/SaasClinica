import { Router } from 'express';
import { storage } from '../storage';
import { authCheck, asyncHandler } from '../middleware/auth';
import { validate, idParamSchema } from '../middleware/validation';
import { createRoomSchema, updateRoomSchema, searchRoomsSchema } from '../schemas/rooms.schema';
import { cacheMiddleware } from '../simpleCache';

const router = Router();

/**
 * GET /api/v1/rooms
 * Lista todas as salas da empresa (apenas ativas por padrão)
 */
router.get(
  '/',
  authCheck,
  validate({ query: searchRoomsSchema }),
  cacheMiddleware(60),
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const rooms = await storage.getRooms(companyId);

    // Se houver filtro de busca, aplicar
    const { search } = req.query as any;
    let filteredRooms = rooms;

    if (search) {
      filteredRooms = rooms.filter((room: any) =>
        room.name.toLowerCase().includes(search.toLowerCase()) ||
        room.description?.toLowerCase().includes(search.toLowerCase())
      );
    }

    res.json(filteredRooms);
  })
);

/**
 * GET /api/v1/rooms/:id
 * Busca uma sala específica da empresa
 */
router.get(
  '/:id',
  authCheck,
  validate({ params: idParamSchema }),
  cacheMiddleware(60),
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { id } = req.params as any;
    const room = await storage.getRoom(parseInt(id), companyId);

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.json(room);
  })
);

/**
 * POST /api/v1/rooms
 * Cria uma nova sala para a empresa
 */
router.post(
  '/',
  authCheck,
  validate({ body: createRoomSchema }),
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const room = await storage.createRoom(req.body, companyId);
    res.status(201).json(room);
  })
);

/**
 * PATCH /api/v1/rooms/:id
 * Atualiza uma sala da empresa
 */
router.patch(
  '/:id',
  authCheck,
  validate({
    params: idParamSchema,
    body: updateRoomSchema
  }),
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { id } = req.params as any;

    try {
      const updatedRoom = await storage.updateRoom(parseInt(id), req.body, companyId);
      res.json(updatedRoom);
    } catch (error: any) {
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return res.status(404).json({ error: 'Room not found' });
      }
      throw error;
    }
  })
);

/**
 * DELETE /api/v1/rooms/:id
 * Remove (soft delete) uma sala da empresa
 */
router.delete(
  '/:id',
  authCheck,
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const companyId = user?.companyId;

    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const { id } = req.params as any;
    const deleted = await storage.deleteRoom(parseInt(id), companyId);

    if (!deleted) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.status(204).send();
  })
);

export default router;
