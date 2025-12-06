/**
 * S3-Compatible Storage Service (MinIO/AWS S3)
 * Handles file uploads, downloads, and presigned URLs for secure access
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import crypto from 'crypto';

// Storage configuration
interface StorageConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean; // Required for MinIO
}

// File upload result
interface UploadResult {
  key: string;
  url: string;
  bucket: string;
  size: number;
  contentType: string;
}

// Storage folder structure
type StorageFolder =
  | 'digitization'      // Patient record digitization
  | 'xrays'             // X-ray images
  | 'documents'         // Signed documents, prescriptions
  | 'signatures'        // Digital signatures
  | 'chat'              // Chat media files
  | 'avatars'           // User/patient avatars
  | 'websites';         // Website builder assets

class StorageService {
  private client: S3Client | null = null;
  private bucket: string;
  private isConfigured: boolean = false;
  private localFallbackPath: string;

  constructor() {
    this.bucket = process.env.S3_BUCKET || 'digital';
    this.localFallbackPath = path.join(process.cwd(), 'uploads');
    this.initialize();
  }

  private initialize() {
    const endpoint = process.env.S3_ENDPOINT;
    const accessKeyId = process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;

    if (!endpoint || !accessKeyId || !secretAccessKey) {
      console.warn('⚠️  S3/MinIO not configured. Using local filesystem fallback.');
      console.warn('   Set S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY to enable cloud storage.');
      this.isConfigured = false;
      return;
    }

    try {
      this.client = new S3Client({
        endpoint,
        region: process.env.S3_REGION || 'us-east-1',
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
        forcePathStyle: true, // Required for MinIO
      });
      this.isConfigured = true;
      console.log(`✓ S3/MinIO storage initialized: ${endpoint}`);
    } catch (error) {
      console.error('Failed to initialize S3 client:', error);
      this.isConfigured = false;
    }
  }

  /**
   * Check if cloud storage is available
   */
  isCloudStorageAvailable(): boolean {
    return this.isConfigured && this.client !== null;
  }

  /**
   * Generate a unique file key for storage
   */
  private generateKey(
    folder: StorageFolder,
    filename: string,
    companyId?: number
  ): string {
    const timestamp = Date.now();
    const randomId = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(filename).toLowerCase();
    const safeName = path.basename(filename, ext)
      .replace(/[^a-zA-Z0-9-_]/g, '_')
      .substring(0, 50);

    const key = companyId
      ? `company-${companyId}/${folder}/${timestamp}-${randomId}-${safeName}${ext}`
      : `${folder}/${timestamp}-${randomId}-${safeName}${ext}`;

    return key;
  }

  /**
   * Get content type from file extension
   */
  private getContentType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.tiff': 'image/tiff',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.zip': 'application/zip',
      '.json': 'application/json',
      '.txt': 'text/plain',
      '.csv': 'text/csv',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Upload a file to S3/MinIO
   */
  async upload(
    file: Buffer | string,
    filename: string,
    folder: StorageFolder,
    companyId?: number,
    metadata?: Record<string, string>
  ): Promise<UploadResult> {
    const key = this.generateKey(folder, filename, companyId);
    const contentType = this.getContentType(filename);

    // Get file buffer
    let buffer: Buffer;
    if (typeof file === 'string') {
      // File path provided
      buffer = await fs.readFile(file);
    } else {
      buffer = file;
    }

    // Use cloud storage if available
    if (this.isCloudStorageAvailable() && this.client) {
      try {
        await this.client.send(new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType,
          Metadata: metadata,
        }));

        return {
          key,
          url: `s3://${this.bucket}/${key}`,
          bucket: this.bucket,
          size: buffer.length,
          contentType,
        };
      } catch (error) {
        console.error('S3 upload failed, falling back to local storage:', error);
      }
    }

    // Local fallback
    const localPath = path.join(this.localFallbackPath, key);
    await fs.mkdir(path.dirname(localPath), { recursive: true });
    await fs.writeFile(localPath, buffer);

    return {
      key,
      url: `local://${key}`,
      bucket: 'local',
      size: buffer.length,
      contentType,
    };
  }

  /**
   * Get a presigned URL for secure temporary access
   */
  async getPresignedUrl(
    key: string,
    expiresIn: number = 3600 // 1 hour default
  ): Promise<string> {
    if (!this.isCloudStorageAvailable() || !this.client) {
      // For local storage, return a relative path (handle via Express static)
      return `/api/storage/files/${encodeURIComponent(key)}`;
    }

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.client, command, { expiresIn });
  }

  /**
   * Get presigned URL for uploading (client-side direct upload)
   */
  async getUploadPresignedUrl(
    filename: string,
    folder: StorageFolder,
    companyId?: number,
    expiresIn: number = 3600
  ): Promise<{ url: string; key: string }> {
    if (!this.isCloudStorageAvailable() || !this.client) {
      throw new Error('Cloud storage not configured for direct upload');
    }

    const key = this.generateKey(folder, filename, companyId);
    const contentType = this.getContentType(filename);

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const url = await getSignedUrl(this.client, command, { expiresIn });

    return { url, key };
  }

  /**
   * Download a file from storage
   */
  async download(key: string): Promise<Buffer> {
    if (this.isCloudStorageAvailable() && this.client) {
      try {
        const response = await this.client.send(new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }));

        if (response.Body) {
          const chunks: Uint8Array[] = [];
          for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
            chunks.push(chunk);
          }
          return Buffer.concat(chunks);
        }
      } catch (error) {
        console.error('S3 download failed:', error);
        throw error;
      }
    }

    // Local fallback
    const localPath = path.join(this.localFallbackPath, key);
    return fs.readFile(localPath);
  }

  /**
   * Delete a file from storage
   */
  async delete(key: string): Promise<void> {
    if (this.isCloudStorageAvailable() && this.client) {
      try {
        await this.client.send(new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }));
        return;
      } catch (error) {
        console.error('S3 delete failed:', error);
      }
    }

    // Local fallback
    const localPath = path.join(this.localFallbackPath, key);
    try {
      await fs.unlink(localPath);
    } catch (error) {
      // Ignore if file doesn't exist
    }
  }

  /**
   * Check if a file exists
   */
  async exists(key: string): Promise<boolean> {
    if (this.isCloudStorageAvailable() && this.client) {
      try {
        await this.client.send(new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }));
        return true;
      } catch {
        return false;
      }
    }

    // Local fallback
    const localPath = path.join(this.localFallbackPath, key);
    try {
      await fs.access(localPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List files in a folder
   */
  async list(
    folder: StorageFolder,
    companyId?: number,
    maxKeys: number = 1000
  ): Promise<string[]> {
    const prefix = companyId ? `company-${companyId}/${folder}/` : `${folder}/`;

    if (this.isCloudStorageAvailable() && this.client) {
      try {
        const response = await this.client.send(new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          MaxKeys: maxKeys,
        }));

        return response.Contents?.map(obj => obj.Key!).filter(Boolean) || [];
      } catch (error) {
        console.error('S3 list failed:', error);
        return [];
      }
    }

    // Local fallback
    const localPath = path.join(this.localFallbackPath, prefix);
    try {
      const files = await fs.readdir(localPath, { recursive: true });
      return files.map(f => path.join(prefix, f.toString()));
    } catch {
      return [];
    }
  }

  /**
   * Get a temporary local path for processing
   * Useful for operations that need local file access (OCR, etc.)
   */
  async getLocalTempPath(key: string): Promise<string> {
    const tempDir = path.join(os.tmpdir(), 'dental-storage');
    await fs.mkdir(tempDir, { recursive: true });

    const tempPath = path.join(tempDir, path.basename(key));
    const buffer = await this.download(key);
    await fs.writeFile(tempPath, buffer);

    return tempPath;
  }

  /**
   * Clean up temporary file
   */
  async cleanupTempFile(tempPath: string): Promise<void> {
    try {
      await fs.unlink(tempPath);
    } catch {
      // Ignore errors
    }
  }

  /**
   * Copy file to another location
   */
  async copy(
    sourceKey: string,
    destFolder: StorageFolder,
    companyId?: number
  ): Promise<UploadResult> {
    const buffer = await this.download(sourceKey);
    const filename = path.basename(sourceKey);
    return this.upload(buffer, filename, destFolder, companyId);
  }

  /**
   * Move file to another location
   */
  async move(
    sourceKey: string,
    destFolder: StorageFolder,
    companyId?: number
  ): Promise<UploadResult> {
    const result = await this.copy(sourceKey, destFolder, companyId);
    await this.delete(sourceKey);
    return result;
  }
}

// Export singleton instance
export const storageService = new StorageService();
export type { StorageFolder, UploadResult };
