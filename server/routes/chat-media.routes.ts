/**
 * Chat Media Routes
 *
 * Serves and downloads media attachments from chat messages. Enforces
 * tenant isolation (message must belong to the requesting company) and
 * prevents path traversal by validating resolved file paths.
 *
 * Mounted at /api/v1/chat/media via chat.routes.ts.
 */
import { Router } from 'express';
import { db } from '../db';
import { eq, and } from 'drizzle-orm';
import { chatSessions, chatMessages, clinicSettings } from '@shared/schema';
import { asyncHandler, requireAuth, getCompanyId } from '../middleware/auth';
import { logger } from '../logger';

const router = Router();

/**
 * GET /:messageId
 * Returns the media file inline (for display in the browser).
 * - Validates that the message belongs to the requesting company
 * - Streams from local disk (uploads/chat/<companyId>/...) with path-traversal protection
 * - Never exposes direct S3/MinIO URLs
 */
router.get(
  '/:messageId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);
    const messageId = req.params.messageId;

    const [message] = await db
      .select({
        id: chatMessages.id,
        sessionId: chatMessages.sessionId,
        mediaUrl: chatMessages.mediaUrl,
        mimeType: chatMessages.mimeType,
        fileName: chatMessages.fileName,
      })
      .from(chatMessages)
      .innerJoin(chatSessions, eq(chatMessages.sessionId, chatSessions.id))
      .where(
        and(
          eq(chatMessages.wuzapiMessageId, messageId),
          eq(chatSessions.companyId, companyId),
        ),
      )
      .limit(1);

    if (!message) {
      return res.status(404).json({ error: 'Mídia não encontrada ou acesso negado' });
    }

    if (!message.mediaUrl) {
      return res.status(404).json({ error: 'Mensagem não contém mídia' });
    }

    if (message.mediaUrl.startsWith('/uploads/')) {
      const path = await import('path');
      const fs = await import('fs');

      const filePath = path.join(process.cwd(), message.mediaUrl);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Arquivo não encontrado' });
      }

      // Path traversal guard: the resolved file must live inside the tenant's uploads dir.
      const expectedDir = path.join(process.cwd(), 'uploads', 'chat', String(companyId));
      const normalizedPath = path.normalize(filePath);

      if (!normalizedPath.startsWith(expectedDir)) {
        logger.warn(
          { filePath },
          '[Security] Tentativa de acesso a arquivo fora do diretório',
        );
        return res.status(403).json({ error: 'Acesso negado' });
      }

      res.setHeader('Content-Type', message.mimeType || 'application/octet-stream');
      res.setHeader('Cache-Control', 'private, max-age=3600');

      if (message.fileName) {
        res.setHeader('Content-Disposition', `inline; filename="${message.fileName}"`);
      }

      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
      return;
    }

    // Look up tenant settings for potential future S3/MinIO proxy support.
    await db
      .select()
      .from(clinicSettings)
      .where(eq(clinicSettings.companyId, companyId))
      .limit(1);

    return res.status(404).json({
      error: 'Mídia não disponível',
      hint: 'Configure o armazenamento S3/MinIO para mídias externas',
    });
  }),
);

/**
 * GET /download/:messageId
 * Forces the browser to download the media (Content-Disposition: attachment).
 */
router.get(
  '/download/:messageId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const companyId = getCompanyId(req);
    const messageId = req.params.messageId;

    const [message] = await db
      .select({
        id: chatMessages.id,
        sessionId: chatMessages.sessionId,
        mediaUrl: chatMessages.mediaUrl,
        mimeType: chatMessages.mimeType,
        fileName: chatMessages.fileName,
      })
      .from(chatMessages)
      .innerJoin(chatSessions, eq(chatMessages.sessionId, chatSessions.id))
      .where(
        and(
          eq(chatMessages.wuzapiMessageId, messageId),
          eq(chatSessions.companyId, companyId),
        ),
      )
      .limit(1);

    if (!message || !message.mediaUrl) {
      return res.status(404).json({ error: 'Mídia não encontrada' });
    }

    if (message.mediaUrl.startsWith('/uploads/')) {
      const path = await import('path');
      const fs = await import('fs');

      const filePath = path.join(process.cwd(), message.mediaUrl);
      const expectedDir = path.join(process.cwd(), 'uploads', 'chat', String(companyId));
      const normalizedPath = path.normalize(filePath);

      if (!normalizedPath.startsWith(expectedDir) || !fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Arquivo não encontrado' });
      }

      const fileName = message.fileName || `media_${messageId}`;
      res.setHeader('Content-Type', message.mimeType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
      return;
    }

    return res.status(404).json({ error: 'Mídia não disponível' });
  }),
);

export default router;
