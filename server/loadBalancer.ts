import express from 'express';
import httpProxy from 'http-proxy-middleware';
import { createProxyMiddleware } from 'http-proxy-middleware';

interface ServerInstance {
  url: string;
  weight: number;
  healthy: boolean;
  connections: number;
  lastCheck: number;
}

class LoadBalancer {
  private servers: ServerInstance[] = [];
  private currentIndex = 0;

  constructor() {
    this.initializeServers();
    this.startHealthChecks();
  }

  private initializeServers() {
    const serverUrls = process.env.APP_SERVERS?.split(',') || ['http://localhost:5000'];
    
    this.servers = serverUrls.map(url => ({
      url: url.trim(),
      weight: 1,
      healthy: true,
      connections: 0,
      lastCheck: Date.now()
    }));
  }

  private async checkServerHealth(server: ServerInstance): Promise<boolean> {
    try {
      const response = await fetch(`${server.url}/health`, {
        method: 'GET',
        timeout: 5000
      });
      return response.ok;
    } catch (error) {
      console.error(`Health check failed for ${server.url}:`, error);
      return false;
    }
  }

  private startHealthChecks() {
    setInterval(async () => {
      for (const server of this.servers) {
        server.healthy = await this.checkServerHealth(server);
        server.lastCheck = Date.now();
      }
    }, 30000); // Check every 30 seconds
  }

  getNextServer(): ServerInstance | null {
    const healthyServers = this.servers.filter(s => s.healthy);
    
    if (healthyServers.length === 0) {
      return null;
    }

    // Least connections algorithm
    return healthyServers.reduce((prev, current) => 
      prev.connections < current.connections ? prev : current
    );
  }

  createProxyMiddleware() {
    return createProxyMiddleware({
      target: 'http://localhost:5000', // Default fallback
      changeOrigin: true,
      router: (req) => {
        const server = this.getNextServer();
        if (server) {
          server.connections++;
          // Decrease connection count after response
          setTimeout(() => server.connections--, 100);
          return server.url;
        }
        throw new Error('No healthy servers available');
      },
      onError: (err, req, res) => {
        console.error('Proxy error:', err);
        res.status(503).json({ error: 'Service temporarily unavailable' });
      }
    });
  }
}

export const loadBalancer = new LoadBalancer();