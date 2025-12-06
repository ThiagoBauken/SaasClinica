/**
 * Storage API Routes
 * Handles file access, presigned URLs, and storage operations
 */

import { Router } from 'express';
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import { authCheck, asyncHandler } from '../middleware/auth';
import { storageService, type StorageFolder } from '../services/storage.service';

const router = Router();

// GET /api/storage/files/:key(*) - Serve local files (fallback when S3 not available)
router.get('/files/*', authCheck, asyncHandler(async (req, res) => {
  const key = req.params[0]; // Get the full path after /files/

  if (!key) {
    return res.status(400).json({ error: 'File key is required' });
  }

  // Security: Prevent directory traversal
  const normalizedKey = path.normalize(key).replace(/^(\.\.(\/|\\|$))+/, '');
  const filePath = path.join(process.cwd(), 'uploads', normalizedKey);

  // Ensure the file is within the uploads directory
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!filePath.startsWith(uploadsDir)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (!fsSync.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  res.sendFile(filePath);
}));

// GET /api/storage/presigned/:folder/:filename - Get presigned URL for upload
router.get('/presigned/:folder/:filename', authCheck, asyncHandler(async (req, res) => {
  const { folder, filename } = req.params;
  const user = req.user as any;
  const companyId = user?.companyId;

  if (!companyId) {
    return res.status(403).json({ error: 'User not associated with any company' });
  }

  // Validate folder
  const validFolders: StorageFolder[] = ['digitization', 'xrays', 'documents', 'signatures', 'chat', 'avatars', 'websites'];
  if (!validFolders.includes(folder as StorageFolder)) {
    return res.status(400).json({ error: 'Invalid folder' });
  }

  try {
    const result = await storageService.getUploadPresignedUrl(
      filename,
      folder as StorageFolder,
      companyId,
      3600 // 1 hour
    );

    res.json({
      uploadUrl: result.url,
      key: result.key,
      expiresIn: 3600,
    });
  } catch (error) {
    console.error('Error generating presigned upload URL:', error);
    res.status(500).json({ error: 'Could not generate upload URL' });
  }
}));

// GET /api/storage/download/:key(*) - Get presigned download URL or redirect
router.get('/download/*', authCheck, asyncHandler(async (req, res) => {
  const key = req.params[0];

  if (!key) {
    return res.status(400).json({ error: 'File key is required' });
  }

  try {
    const presignedUrl = await storageService.getPresignedUrl(key, 3600);

    // If it's a local file URL, redirect to the files endpoint
    if (presignedUrl.startsWith('/api/storage/files/')) {
      return res.redirect(presignedUrl);
    }

    // Otherwise redirect to the presigned S3 URL
    res.redirect(presignedUrl);
  } catch (error) {
    console.error('Error generating presigned download URL:', error);
    res.status(500).json({ error: 'Could not generate download URL' });
  }
}));

// GET /api/storage/info - Get storage information
router.get('/info', authCheck, asyncHandler(async (req, res) => {
  const user = req.user as any;
  const companyId = user?.companyId;

  if (!companyId) {
    return res.status(403).json({ error: 'User not associated with any company' });
  }

  const isCloudStorage = storageService.isCloudStorageAvailable();
  const folders: StorageFolder[] = ['digitization', 'xrays', 'documents', 'signatures'];

  const folderInfo = await Promise.all(
    folders.map(async (folder) => {
      const files = await storageService.list(folder, companyId, 100);
      return {
        folder,
        fileCount: files.length,
      };
    })
  );

  res.json({
    provider: isCloudStorage ? 's3' : 'local',
    isCloudStorage,
    folders: folderInfo,
  });
}));

// DELETE /api/storage/files/:key(*) - Delete a file
router.delete('/files/*', authCheck, asyncHandler(async (req, res) => {
  const key = req.params[0];
  const user = req.user as any;
  const companyId = user?.companyId;

  if (!key) {
    return res.status(400).json({ error: 'File key is required' });
  }

  if (!companyId) {
    return res.status(403).json({ error: 'User not associated with any company' });
  }

  // Security: Ensure the key belongs to the user's company
  if (!key.includes(`company-${companyId}/`)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    await storageService.delete(key);
    res.json({ success: true, message: 'File deleted' });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: 'Could not delete file' });
  }
}));

// POST /api/storage/upload - Upload a file directly (for small files)
router.post('/upload', authCheck, asyncHandler(async (req, res) => {
  // This endpoint is for small files only
  // For larger files, use presigned URLs

  return res.status(501).json({
    error: 'Direct upload not implemented. Use presigned URLs for file uploads.',
    hint: 'GET /api/storage/presigned/:folder/:filename to get an upload URL'
  });
}));

export default router;
