import { log } from './vite';
import path from 'path';
import fs from 'fs/promises';

interface CDNConfig {
  images: string;
  assets: string;
  uploads: string;
  websites: string;
}

class CDNManager {
  private cdnEndpoints: CDNConfig;
  private localStoragePath: string;
  private cacheHeaders: Record<string, string>;

  constructor() {
    this.cdnEndpoints = {
      images: process.env.CDN_IMAGES_URL || '/assets/images',
      assets: process.env.CDN_ASSETS_URL || '/assets/static',
      uploads: process.env.CDN_UPLOADS_URL || '/assets/uploads',
      websites: process.env.CDN_WEBSITES_URL || '/assets/websites'
    };

    this.localStoragePath = path.join(process.cwd(), 'uploads');
    
    this.cacheHeaders = {
      'Cache-Control': 'public, max-age=31536000', // 1 year
      'ETag': '',
      'Last-Modified': ''
    };

    this.initializeStorage();
  }

  private async initializeStorage() {
    try {
      await fs.mkdir(this.localStoragePath, { recursive: true });
      await fs.mkdir(path.join(this.localStoragePath, 'images'), { recursive: true });
      await fs.mkdir(path.join(this.localStoragePath, 'documents'), { recursive: true });
      await fs.mkdir(path.join(this.localStoragePath, 'websites'), { recursive: true });
      
      log('CDN storage directories initialized');
    } catch (error) {
      console.error('CDN storage initialization error:', error);
    }
  }

  getCdnUrl(type: keyof CDNConfig, filePath: string, companyId?: number): string {
    const baseUrl = this.cdnEndpoints[type];
    const fullPath = companyId ? `company-${companyId}/${filePath}` : filePath;
    
    // Add version parameter for cache busting if needed
    const timestamp = Date.now();
    return `${baseUrl}/${fullPath}?v=${timestamp}`;
  }

  async uploadFile(
    file: Buffer | string, 
    filename: string, 
    type: keyof CDNConfig, 
    companyId: number
  ): Promise<string> {
    try {
      const companyDir = path.join(this.localStoragePath, `company-${companyId}`);
      const typeDir = path.join(companyDir, type);
      
      await fs.mkdir(typeDir, { recursive: true });
      
      const filePath = path.join(typeDir, filename);
      
      if (Buffer.isBuffer(file)) {
        await fs.writeFile(filePath, file);
      } else {
        await fs.writeFile(filePath, file, 'utf8');
      }
      
      const cdnUrl = this.getCdnUrl(type, filename, companyId);
      
      log(`File uploaded: ${filename} for company ${companyId}`);
      return cdnUrl;
    } catch (error) {
      console.error('File upload error:', error);
      throw new Error('Upload failed');
    }
  }

  async deleteFile(filename: string, type: keyof CDNConfig, companyId: number): Promise<boolean> {
    try {
      const filePath = path.join(
        this.localStoragePath, 
        `company-${companyId}`, 
        type, 
        filename
      );
      
      await fs.unlink(filePath);
      log(`File deleted: ${filename} for company ${companyId}`);
      return true;
    } catch (error) {
      console.error('File deletion error:', error);
      return false;
    }
  }

  async getFileInfo(filename: string, type: keyof CDNConfig, companyId: number) {
    try {
      const filePath = path.join(
        this.localStoragePath, 
        `company-${companyId}`, 
        type, 
        filename
      );
      
      const stats = await fs.stat(filePath);
      
      return {
        exists: true,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        cdnUrl: this.getCdnUrl(type, filename, companyId)
      };
    } catch (error) {
      return {
        exists: false,
        size: 0,
        created: null,
        modified: null,
        cdnUrl: null
      };
    }
  }

  async optimizeImage(
    buffer: Buffer, 
    options: {
      width?: number;
      height?: number;
      quality?: number;
      format?: 'jpeg' | 'png' | 'webp';
    } = {}
  ): Promise<Buffer> {
    // Simple image optimization (in production, use sharp or similar)
    // For now, return original buffer
    log(`Image optimization requested: ${JSON.stringify(options)}`);
    return buffer;
  }

  getCacheHeaders(filename: string): Record<string, string> {
    const ext = path.extname(filename).toLowerCase();
    
    const headers = { ...this.cacheHeaders };
    
    // Different cache strategies for different file types
    switch (ext) {
      case '.html':
      case '.json':
        headers['Cache-Control'] = 'public, max-age=300'; // 5 minutes
        break;
      case '.css':
      case '.js':
        headers['Cache-Control'] = 'public, max-age=31536000'; // 1 year
        break;
      case '.jpg':
      case '.jpeg':
      case '.png':
      case '.gif':
      case '.webp':
        headers['Cache-Control'] = 'public, max-age=2592000'; // 30 days
        break;
      default:
        headers['Cache-Control'] = 'public, max-age=86400'; // 1 day
    }
    
    return headers;
  }

  async cleanupOldFiles(companyId: number, olderThanDays = 30): Promise<number> {
    let deletedCount = 0;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    
    try {
      const companyDir = path.join(this.localStoragePath, `company-${companyId}`);
      const entries = await fs.readdir(companyDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const typeDir = path.join(companyDir, entry.name);
          const files = await fs.readdir(typeDir);
          
          for (const file of files) {
            const filePath = path.join(typeDir, file);
            const stats = await fs.stat(filePath);
            
            if (stats.mtime < cutoffDate) {
              await fs.unlink(filePath);
              deletedCount++;
            }
          }
        }
      }
      
      log(`Cleaned up ${deletedCount} old files for company ${companyId}`);
    } catch (error) {
      console.error('Cleanup error:', error);
    }
    
    return deletedCount;
  }

  async getStorageUsage(companyId: number): Promise<{
    totalSize: number;
    fileCount: number;
    typeBreakdown: Record<string, { size: number; count: number }>;
  }> {
    let totalSize = 0;
    let fileCount = 0;
    const typeBreakdown: Record<string, { size: number; count: number }> = {};
    
    try {
      const companyDir = path.join(this.localStoragePath, `company-${companyId}`);
      const entries = await fs.readdir(companyDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const typeDir = path.join(companyDir, entry.name);
          const files = await fs.readdir(typeDir);
          
          let typeSize = 0;
          let typeCount = 0;
          
          for (const file of files) {
            const filePath = path.join(typeDir, file);
            const stats = await fs.stat(filePath);
            
            typeSize += stats.size;
            typeCount++;
            totalSize += stats.size;
            fileCount++;
          }
          
          typeBreakdown[entry.name] = {
            size: typeSize,
            count: typeCount
          };
        }
      }
    } catch (error) {
      console.error('Storage usage calculation error:', error);
    }
    
    return {
      totalSize,
      fileCount,
      typeBreakdown
    };
  }

  // Generate optimized website assets
  async generateWebsiteAssets(
    companyId: number, 
    websiteData: any
  ): Promise<{
    cssUrl: string;
    jsUrl: string;
    imagesUrls: string[];
  }> {
    try {
      // Generate custom CSS
      const customCSS = this.generateCustomCSS(websiteData.design || {});
      const cssFilename = `website-${companyId}-${Date.now()}.css`;
      const cssUrl = await this.uploadFile(
        customCSS, 
        cssFilename, 
        'websites', 
        companyId
      );
      
      // Generate custom JS (if needed)
      const customJS = this.generateCustomJS(websiteData.interactions || {});
      const jsFilename = `website-${companyId}-${Date.now()}.js`;
      const jsUrl = await this.uploadFile(
        customJS, 
        jsFilename, 
        'websites', 
        companyId
      );
      
      // Process and optimize images
      const imagesUrls: string[] = [];
      if (websiteData.gallery && websiteData.gallery.length > 0) {
        for (const [index, imageData] of websiteData.gallery.entries()) {
          if (imageData.startsWith('data:image/')) {
            const buffer = Buffer.from(imageData.split(',')[1], 'base64');
            const optimizedBuffer = await this.optimizeImage(buffer, {
              width: 800,
              quality: 85,
              format: 'webp'
            });
            
            const imageFilename = `gallery-${index}-${Date.now()}.webp`;
            const imageUrl = await this.uploadFile(
              optimizedBuffer, 
              imageFilename, 
              'images', 
              companyId
            );
            imagesUrls.push(imageUrl);
          }
        }
      }
      
      return {
        cssUrl,
        jsUrl,
        imagesUrls
      };
    } catch (error) {
      console.error('Website assets generation error:', error);
      throw new Error('Failed to generate website assets');
    }
  }

  private generateCustomCSS(design: any): string {
    return `
      /* Custom CSS generated for website */
      :root {
        --primary-color: ${design.primaryColor || '#2563eb'};
        --secondary-color: ${design.secondaryColor || '#64748b'};
        --accent-color: ${design.accentColor || '#0ea5e9'};
        --font-family: ${design.fontFamily || 'Inter, sans-serif'};
      }
      
      .custom-primary { color: var(--primary-color); }
      .custom-secondary { color: var(--secondary-color); }
      .custom-accent { color: var(--accent-color); }
      
      .custom-bg-primary { background-color: var(--primary-color); }
      .custom-bg-secondary { background-color: var(--secondary-color); }
      .custom-bg-accent { background-color: var(--accent-color); }
      
      body { font-family: var(--font-family); }
      
      @media (max-width: 768px) {
        .mobile-responsive { 
          padding: 1rem;
          font-size: 0.875rem;
        }
      }
    `;
  }

  private generateCustomJS(interactions: any): string {
    return `
      // Custom JavaScript for website interactions
      document.addEventListener('DOMContentLoaded', function() {
        // Smooth scrolling for anchor links
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
          anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
              target.scrollIntoView({ behavior: 'smooth' });
            }
          });
        });
        
        // Form validation and submission
        const forms = document.querySelectorAll('form');
        forms.forEach(form => {
          form.addEventListener('submit', function(e) {
            e.preventDefault();
            // Add form submission logic here
            console.log('Form submitted');
          });
        });
        
        // Image lazy loading
        const images = document.querySelectorAll('img[data-src]');
        const imageObserver = new IntersectionObserver((entries, observer) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const img = entry.target;
              img.src = img.dataset.src;
              img.removeAttribute('data-src');
              observer.unobserve(img);
            }
          });
        });
        
        images.forEach(img => imageObserver.observe(img));
        
        console.log('Website JavaScript initialized');
      });
    `;
  }
}

export const cdnManager = new CDNManager();