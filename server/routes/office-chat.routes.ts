/**
 * Rotas de Chat Interno - Comunicação entre Equipe da Clínica
 *
 * Fornece canais de grupo e mensagens diretas (DM) para a equipe
 * interna da clínica. Suporta paginação, contagem de não lidos
 * e rastreamento de leitura via campo JSONB read_by.
 *
 * Estrutura de leitura:
 *   - read_by: JSONB array de user IDs que já leram a mensagem
 *   - Não lido = mensagem onde o userId atual NÃO está em read_by
 *   - SQL: NOT (read_by @> '[userId]'::jsonb)
 */

import { Router } from 'express';
import { authCheck, asyncHandler } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { z } from 'zod';

const router = Router();

// ==================== SCHEMAS ====================

const createChannelSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

const sendMessageSchema = z.object({
  content: z.string().min(1).max(4000),
});

const paginationQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .default('50')
    .transform((v) => Math.min(Math.max(parseInt(v, 10) || 50, 1), 100)),
  offset: z
    .string()
    .optional()
    .default('0')
    .transform((v) => Math.max(parseInt(v, 10) || 0, 0)),
});

// ==================== CHANNELS ====================

/**
 * GET /api/v1/office-chat/channels
 * Lista canais do chat interno da empresa
 */
router.get(
  '/channels',
  authCheck,
  asyncHandler(async (req, res) => {
    const companyId = (req.user!)?.companyId;
    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const userId = (req.user!)?.id;

    const channels = await db.execute(sql`
      SELECT
        c.*,
        u.full_name  AS created_by_name,
        -- Contagem de mensagens não lidas neste canal para o usuário atual
        (
          SELECT COUNT(*)
          FROM office_chat_messages ocm
          WHERE ocm.channel_id = c.id
            AND NOT (ocm.read_by @> ${JSON.stringify([userId])}::jsonb)
            AND ocm.sender_id != ${userId}
        ) AS unread_count
      FROM office_chat_channels c
      LEFT JOIN users u ON u.id = c.created_by
      WHERE c.company_id = ${companyId}
        AND c.deleted_at IS NULL
      ORDER BY c.name ASC
    `);

    res.json(channels.rows);
  })
);

/**
 * POST /api/v1/office-chat/channels
 * Cria um novo canal de chat interno
 */
router.post(
  '/channels',
  authCheck,
  validate({ body: createChannelSchema }),
  asyncHandler(async (req, res) => {
    const companyId = (req.user!)?.companyId;
    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const userId = (req.user!)?.id;
    const { name, description } = req.body;

    // Verificar duplicidade de nome no mesmo empresa
    const existing = await db.execute(sql`
      SELECT id FROM office_chat_channels
      WHERE company_id = ${companyId}
        AND name = ${name}
        AND deleted_at IS NULL
    `);

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'A channel with this name already exists' });
    }

    const result = await db.execute(sql`
      INSERT INTO office_chat_channels (company_id, name, description, created_by, created_at, updated_at)
      VALUES (${companyId}, ${name}, ${description ?? null}, ${userId}, NOW(), NOW())
      RETURNING *
    `);

    res.status(201).json(result.rows[0]);
  })
);

// ==================== CHANNEL MESSAGES ====================

/**
 * GET /api/v1/office-chat/channels/:channelId/messages
 * Lista mensagens de um canal com paginação (mais recentes primeiro)
 * Marca automaticamente as mensagens como lidas pelo usuário atual
 */
router.get(
  '/channels/:channelId/messages',
  authCheck,
  validate({ query: paginationQuerySchema }),
  asyncHandler(async (req, res) => {
    const companyId = (req.user!)?.companyId;
    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const userId = (req.user!)?.id;
    const channelId = parseInt(req.params.channelId, 10);
    if (isNaN(channelId)) {
      return res.status(400).json({ error: 'Invalid channel ID' });
    }

    const { limit, offset } = req.query as any;

    // Verificar que o canal pertence à empresa
    const channelCheck = await db.execute(sql`
      SELECT id FROM office_chat_channels
      WHERE id = ${channelId}
        AND company_id = ${companyId}
        AND deleted_at IS NULL
    `);
    if (channelCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const messages = await db.execute(sql`
      SELECT
        m.*,
        u.full_name   AS sender_name,
        u.avatar_url  AS sender_avatar
      FROM office_chat_messages m
      LEFT JOIN users u ON u.id = m.sender_id
      WHERE m.channel_id = ${channelId}
        AND m.deleted_at IS NULL
      ORDER BY m.created_at DESC
      LIMIT  ${limit}
      OFFSET ${offset}
    `);

    // Marcar mensagens não lidas como lidas pelo usuário atual
    // Atualiza apenas as mensagens que ainda não têm o userId no read_by
    await db.execute(sql`
      UPDATE office_chat_messages
      SET
        read_by    = read_by || ${JSON.stringify([userId])}::jsonb,
        updated_at = NOW()
      WHERE channel_id = ${channelId}
        AND sender_id  != ${userId}
        AND NOT (read_by @> ${JSON.stringify([userId])}::jsonb)
        AND deleted_at IS NULL
    `);

    res.json(messages.rows);
  })
);

/**
 * POST /api/v1/office-chat/channels/:channelId/messages
 * Envia uma mensagem em um canal
 */
router.post(
  '/channels/:channelId/messages',
  authCheck,
  validate({ body: sendMessageSchema }),
  asyncHandler(async (req, res) => {
    const companyId = (req.user!)?.companyId;
    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const userId = (req.user!)?.id;
    const channelId = parseInt(req.params.channelId, 10);
    if (isNaN(channelId)) {
      return res.status(400).json({ error: 'Invalid channel ID' });
    }

    const { content } = req.body;

    // Verificar que o canal pertence à empresa
    const channelCheck = await db.execute(sql`
      SELECT id FROM office_chat_channels
      WHERE id = ${channelId}
        AND company_id = ${companyId}
        AND deleted_at IS NULL
    `);
    if (channelCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    // O remetente já leu a própria mensagem — incluir userId no read_by inicial
    const result = await db.execute(sql`
      INSERT INTO office_chat_messages (
        company_id,
        channel_id,
        sender_id,
        content,
        message_type,
        read_by,
        created_at,
        updated_at
      )
      VALUES (
        ${companyId},
        ${channelId},
        ${userId},
        ${content},
        'channel',
        ${JSON.stringify([userId])}::jsonb,
        NOW(),
        NOW()
      )
      RETURNING *
    `);

    // Atualizar updated_at do canal para ordenação de "últimas atividades"
    await db.execute(sql`
      UPDATE office_chat_channels
      SET updated_at = NOW()
      WHERE id = ${channelId}
    `);

    res.status(201).json(result.rows[0]);
  })
);

// ==================== DIRECT MESSAGES ====================

/**
 * GET /api/v1/office-chat/dm/:userId
 * Lista mensagens diretas (DM) entre o usuário atual e outro usuário
 * Marca mensagens recebidas como lidas automaticamente
 */
router.get(
  '/dm/:userId',
  authCheck,
  asyncHandler(async (req, res) => {
    const companyId = (req.user!)?.companyId;
    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const currentUserId = (req.user!)?.id;
    const otherUserId = parseInt(req.params.userId, 10);
    if (isNaN(otherUserId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const limitRaw = parseInt((req.query.limit as string) || '50', 10);
    const offsetRaw = parseInt((req.query.offset as string) || '0', 10);
    const limit = Math.min(Math.max(limitRaw, 1), 100);
    const offset = Math.max(offsetRaw, 0);

    // Verificar que o outro usuário pertence à mesma empresa
    const userCheck = await db.execute(sql`
      SELECT id, full_name FROM users
      WHERE id = ${otherUserId}
        AND company_id = ${companyId}
    `);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const messages = await db.execute(sql`
      SELECT
        m.*,
        u.full_name  AS sender_name,
        u.avatar_url AS sender_avatar
      FROM office_chat_messages m
      LEFT JOIN users u ON u.id = m.sender_id
      WHERE m.message_type = 'dm'
        AND m.company_id   = ${companyId}
        AND m.deleted_at  IS NULL
        AND (
          (m.sender_id = ${currentUserId} AND m.recipient_id = ${otherUserId})
          OR
          (m.sender_id = ${otherUserId}   AND m.recipient_id = ${currentUserId})
        )
      ORDER BY m.created_at DESC
      LIMIT  ${limit}
      OFFSET ${offset}
    `);

    // Marcar mensagens recebidas do outro usuário como lidas
    await db.execute(sql`
      UPDATE office_chat_messages
      SET
        read_by    = read_by || ${JSON.stringify([currentUserId])}::jsonb,
        updated_at = NOW()
      WHERE message_type  = 'dm'
        AND company_id    = ${companyId}
        AND sender_id     = ${otherUserId}
        AND recipient_id  = ${currentUserId}
        AND NOT (read_by @> ${JSON.stringify([currentUserId])}::jsonb)
        AND deleted_at   IS NULL
    `);

    res.json(messages.rows);
  })
);

/**
 * POST /api/v1/office-chat/dm/:userId
 * Envia uma mensagem direta para outro usuário da equipe
 */
router.post(
  '/dm/:userId',
  authCheck,
  validate({ body: sendMessageSchema }),
  asyncHandler(async (req, res) => {
    const companyId = (req.user!)?.companyId;
    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const currentUserId = (req.user!)?.id;
    const recipientId = parseInt(req.params.userId, 10);
    if (isNaN(recipientId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    if (currentUserId === recipientId) {
      return res.status(400).json({ error: 'Cannot send DM to yourself' });
    }

    const { content } = req.body;

    // Verificar que o destinatário pertence à mesma empresa
    const recipientCheck = await db.execute(sql`
      SELECT id FROM users
      WHERE id = ${recipientId}
        AND company_id = ${companyId}
    `);
    if (recipientCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Recipient not found' });
    }

    const result = await db.execute(sql`
      INSERT INTO office_chat_messages (
        company_id,
        sender_id,
        recipient_id,
        content,
        message_type,
        read_by,
        created_at,
        updated_at
      )
      VALUES (
        ${companyId},
        ${currentUserId},
        ${recipientId},
        ${content},
        'dm',
        ${JSON.stringify([currentUserId])}::jsonb,
        NOW(),
        NOW()
      )
      RETURNING *
    `);

    res.status(201).json(result.rows[0]);
  })
);

// ==================== UNREAD COUNTS ====================

/**
 * GET /api/v1/office-chat/unread
 * Retorna contagem total de mensagens não lidas para o usuário atual:
 *   - Por canal (mensagens de canal não lidas)
 *   - Por DM (mensagens diretas não lidas)
 *   - Total geral
 *
 * Lógica: mensagem não lida = userId NÃO está no array JSONB read_by
 * SQL: NOT (read_by @> '[userId]'::jsonb)
 */
router.get(
  '/unread',
  authCheck,
  asyncHandler(async (req, res) => {
    const companyId = (req.user!)?.companyId;
    if (!companyId) {
      return res.status(403).json({ error: 'User not associated with any company' });
    }

    const userId = (req.user!)?.id;
    const userIdJson = JSON.stringify([userId]);

    // Não lidos em canais, agrupado por canal
    const channelUnread = await db.execute(sql`
      SELECT
        m.channel_id,
        c.name     AS channel_name,
        COUNT(*)   AS unread_count
      FROM office_chat_messages m
      JOIN office_chat_channels c ON c.id = m.channel_id
      WHERE m.company_id   = ${companyId}
        AND m.message_type = 'channel'
        AND m.sender_id   != ${userId}
        AND NOT (m.read_by @> ${userIdJson}::jsonb)
        AND m.deleted_at  IS NULL
        AND c.deleted_at  IS NULL
      GROUP BY m.channel_id, c.name
    `);

    // Não lidos em DMs, agrupado por remetente
    const dmUnread = await db.execute(sql`
      SELECT
        m.sender_id,
        u.full_name   AS sender_name,
        COUNT(*)      AS unread_count
      FROM office_chat_messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.company_id   = ${companyId}
        AND m.message_type = 'dm'
        AND m.recipient_id = ${userId}
        AND NOT (m.read_by @> ${userIdJson}::jsonb)
        AND m.deleted_at  IS NULL
      GROUP BY m.sender_id, u.full_name
    `);

    const totalChannelUnread = channelUnread.rows.reduce(
      (sum: number, row: any) => sum + parseInt(row.unread_count, 10),
      0
    );
    const totalDmUnread = dmUnread.rows.reduce(
      (sum: number, row: any) => sum + parseInt(row.unread_count, 10),
      0
    );

    res.json({
      total: totalChannelUnread + totalDmUnread,
      channels: {
        total: totalChannelUnread,
        breakdown: channelUnread.rows,
      },
      directMessages: {
        total: totalDmUnread,
        breakdown: dmUnread.rows,
      },
    });
  })
);

export default router;
