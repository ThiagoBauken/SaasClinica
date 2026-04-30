// IMPORTANTE: Carregar variáveis de ambiente PRIMEIRO, antes de qualquer outro import
import { config } from 'dotenv';
config({ override: true });

// Validar variáveis de ambiente
import { validateEnvOrExit } from './config/env-validation';
validateEnvOrExit();

import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

// Lazy-load Prometheus metrics module (ESM-safe, tolerates absence)
let metricsModule: { httpRequestDuration: any; httpRequestsTotal: any } | null = null;
import('./lib/metrics')
  .then((mod) => { metricsModule = mod as any; })
  .catch(() => { /* metrics module optional */ });

import { registerRoutes } from "./routes";
import { setupTestRoutes } from "./testRoutes";
import { serveStatic } from "./vite";
import { logger, log } from "./logger";
import cluster from "cluster";
import os from "os";
import compression from "compression";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { moduleLoader } from "../modules/moduleLoader";

// Security & monitoring middleware
import { globalErrorHandler, setupProcessErrorHandlers } from "./middleware/errorHandler";
import { csrfProtection, csrfTokenEndpoint } from "./middleware/csrf";
import { requestIdMiddleware } from "./middleware/requestId";
import { initSentry, getSentryErrorHandler } from "./middleware/sentry";
import { createDistributedRateLimiter } from "./middleware/distributed-rate-limit";

// Architectural improvements
import { initializeClusterCache } from './clusterCache';
import { distributedCache } from './distributedCache';
import { distributedDb } from './distributedDb';
import { sessionManager } from './sessionManager';
import { cdnManager } from './cdnManager';
import { queueSystem } from './queueSystem';
import session from 'express-session';
import { RedisStore } from 'connect-redis';
import { createClient } from 'redis';
import { isRedisAvailable } from './redis';
import { startBillingCronJobs } from './jobs/billing-cron';
import { startBackupCronJobs } from './jobs/backup-cron';
import { startAllScheduledJobs } from './services/automation-engine';
import { requestTracingMiddleware } from './lib/tracing';
import { startSlowQueryMonitor } from './lib/slow-query-monitor';

// Setup process-level error handlers (unhandledRejection, uncaughtException)
setupProcessErrorHandlers();

// Determina quantos workers serão usados (customizável via .env)
const maxWorkers = parseInt(process.env.MAX_WORKERS || '16');
const WORKERS = process.env.NODE_ENV === "production"
  ? Math.min(os.cpus().length, maxWorkers) // Limita ao MAX_WORKERS configurado
  : 1; // Em desenvolvimento, usamos apenas 1 worker

// Implementação com clusters para aproveitar múltiplos cores
if (cluster.isPrimary && process.env.NODE_ENV === "production") {
  log(`Master process ${process.pid} está rodando`);
  
  // Inicializa o sistema de cache compartilhado no processo principal
  initializeClusterCache();
  
  // Cria workers
  for (let i = 0; i < WORKERS; i++) {
    cluster.fork();
  }
  
  // Reinicia workers se eles morrerem
  cluster.on("exit", (worker, code, signal) => {
    log(`Worker ${worker.process.pid} morreu com código: ${code} e sinal: ${signal}`);
    log("Iniciando um novo worker");
    cluster.fork();
  });
} else {
  // Inicializa o sistema de cache nos workers
  initializeClusterCache();
  // Código do worker
  const app = express();
  
  // Compressão de respostas para reduzir tráfego
  app.use(compression());

  // SEGURANÇA: Configuração CORS adequada
  const allowedOrigins = process.env.CORS_ORIGINS?.split(',') || [
    'http://localhost:5173',
    'http://localhost:5000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5000'
  ];

  const isProduction = process.env.NODE_ENV === 'production';

  // Health check endpoints devem bypassar CORS (são chamados pelo Docker/Easypanel sem Origin)
  app.use('/health', (req, res, next) => {
    // Permitir health checks sem Origin header
    next();
  });

  app.use(cors({
    origin: (origin, callback) => {
      // Permitir requisições sem origin (health checks, webhooks, server-to-server)
      if (!origin) {
        return callback(null, true);
      }

      // Lista explícita de origens permitidas
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Auto-permitir domínios Easypanel (*.easypanel.host)
      if (origin.endsWith('.easypanel.host')) {
        return callback(null, true);
      }

      logger.warn({ origin }, 'CORS: Blocked request from origin');
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true, // Permitir envio de cookies
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token', 'x-api-key', 'x-request-id'],
    exposedHeaders: ['set-cookie', 'x-request-id'],
    maxAge: 86400, // 24 horas de cache do preflight
  }));

  // SEGURANÇA: Proteção contra ataques comuns com CSP habilitado
  // Configuração CSP mais restritiva em produção
  const cspScriptSrc = isProduction
    ? ["'self'"] // Produção: sem unsafe-inline/unsafe-eval (XSS protection)
    : ["'self'", "'unsafe-inline'", "'unsafe-eval'"]; // Dev: necessário para Vite HMR

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: cspScriptSrc,
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        connectSrc: ["'self'", "ws://localhost:*", "wss://localhost:*", "ws://127.0.0.1:*", "wss://127.0.0.1:*"],
        mediaSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    crossOriginEmbedderPolicy: false, // Permite carregar recursos externos
  }));

  // Headers de segurança adicionais
  app.use((req, res, next) => {
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    next();
  });

  // SEGURANÇA: Validar SESSION_SECRET obrigatório (sem fallback)
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret || sessionSecret.length < 32) {
    throw new Error(
      'SECURITY ERROR: SESSION_SECRET must be set and at least 32 characters long. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }

  // Função async para configurar sessão com Redis ou memorystore
  async function setupSession() {
    const sessionConfig: any = {
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24, // 24 horas
        sameSite: process.env.NODE_ENV === "production" ? 'strict' : 'lax'
      },
      name: 'sid', // Nome genérico para dificultar fingerprinting
    };

    // Tenta usar Redis se disponível, senão usa memorystore
    try {
      const available = await isRedisAvailable();
      if (available) {
        // Cria cliente redis (node-redis) para connect-redis v9
        // connect-redis v9 NÃO é compatível com ioredis, apenas com node-redis
        let redisUrl = process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}`;
        // Garante que a URL tenha o protocolo redis://
        if (redisUrl && !redisUrl.startsWith('redis://') && !redisUrl.startsWith('rediss://')) {
          redisUrl = `redis://${redisUrl}`;
        }
        logger.info({ redisUrl: redisUrl.replace(/\/\/.*@/, '//***@') }, 'Session Redis connecting');
        const sessionRedisClient = createClient({ url: redisUrl });

        sessionRedisClient.on('error', (err) => {
          logger.error({ err }, 'Session Redis error');
        });

        await sessionRedisClient.connect();
        logger.info('Session Redis client connected');

        sessionConfig.store = new RedisStore({
          client: sessionRedisClient,
          prefix: 'dental:sess:',
          ttl: 86400, // 24 horas em segundos
        });
        logger.info('Using Redis for session storage');
      } else {
        if (process.env.NODE_ENV === 'production') {
          logger.fatal(
            'CRITICAL: Redis not available in production. ' +
            'In-memory sessions break horizontal scaling and lose all sessions on restart. ' +
            'Configure REDIS_URL/REDIS_HOST or set ALLOW_INSECURE_SESSIONS=true to override.'
          );
          if (process.env.ALLOW_INSECURE_SESSIONS !== 'true') {
            process.exit(1);
          }
        }
        logger.warn('Using in-memory session storage (DEV ONLY)');
      }
    } catch (err) {
      logger.error({ err }, 'Redis connection error');
      if (process.env.NODE_ENV === 'production' && process.env.ALLOW_INSECURE_SESSIONS !== 'true') {
        logger.fatal('Exiting: cannot run production without Redis sessions');
        process.exit(1);
      }
      logger.warn('Falling back to in-memory session storage (DEV ONLY)');
    }

    app.use(session(sessionConfig));
  }
  
  // Limitador de requisições DISTRIBUÍDO (Redis-backed) — consistente entre instâncias
  const apiLimiter = createDistributedRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: parseInt(process.env.RATE_LIMIT_MAX || '500', 10),
    prefix: 'rl:api:',
    message: "Muitas requisições deste IP, tente novamente após 15 minutos",
  });

  // Aplica limitador apenas nas rotas da API
  app.use("/api", apiLimiter);
  
  // Request ID for tracing
  app.use(requestIdMiddleware);

  // Stripe webhooks need the raw request body for HMAC signature verification.
  // We capture it BEFORE the JSON parser so the original bytes are preserved.
  app.use('/api/webhooks/stripe', express.raw({ type: 'application/json', limit: '1mb' }));

  // Body parsers (everything except the Stripe webhook route handled above)
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: false, limit: "10mb" }));
  app.use(cookieParser());
  
  // Middleware para CDN e assets otimizados
  app.use('/assets', express.static('uploads', {
    maxAge: '1y',
    etag: true,
    lastModified: true,
    setHeaders: (res, path) => {
      const headers = cdnManager.getCacheHeaders(path);
      Object.entries(headers).forEach(([key, value]) => {
        res.setHeader(key, value);
      });
    }
  }));

  // Request tracing middleware (slow request detection)
  app.use(requestTracingMiddleware);

  // Middleware para logging e monitoramento de performance
  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, any> | undefined = undefined;

    // Evitar capturar dados sensíveis ou muito grandes na produção
    if (process.env.NODE_ENV !== "production" || path.includes("/metrics")) {
      const originalResJson = res.json;
      res.json = function (bodyJson, ...args) {
        capturedJsonResponse = bodyJson;
        return originalResJson.apply(res, [bodyJson, ...args]);
      };
    }

    res.on("finish", () => {
      const duration = Date.now() - start;

      // Prometheus metrics — normalize route to avoid cardinality explosion
      if (path.startsWith("/api")) {
        const normalizedRoute = path.replace(/\/\d+/g, '/:id');
        try {
          // metrics module is loaded lazily via top-level import above (if present)
          // If not loaded, observe() calls are no-ops
          if (metricsModule) {
            metricsModule.httpRequestDuration.observe(
              { method: req.method, route: normalizedRoute, status_code: res.statusCode },
              duration / 1000
            );
            metricsModule.httpRequestsTotal.inc({ method: req.method, route: normalizedRoute, status_code: res.statusCode });
          }
        } catch {
          // metrics module not loaded yet
        }

        let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;

        // Em produção, limitamos os logs de resposta para economizar recursos
        if (process.env.NODE_ENV !== "production" && capturedJsonResponse) {
          const stringifiedResponse = JSON.stringify(capturedJsonResponse);
          if (stringifiedResponse.length < 200) {
            logLine += ` :: ${stringifiedResponse}`;
          } else {
            logLine += ` :: [Resposta grande omitida]`;
          }
        }

        log(logLine);
      }
    });

    next();
  });

  // Setup test routes (temporary for SaaS testing)
  setupTestRoutes(app);
  
  (async () => {
    // Initialize Sentry monitoring (if SENTRY_DSN is set)
    await initSentry();

    // Configure session with Redis or memorystore
    await setupSession();

    // CSRF token endpoint (must be after session setup)
    app.get('/api/csrf-token', csrfTokenEndpoint);

    // CSRF protection for state-changing requests (after session, before routes)
    app.use('/api', csrfProtection);

    // RLS: Set PostgreSQL tenant context per-request (defense-in-depth for multi-tenancy)
    const { rlsMiddleware } = await import('./middleware/rls');
    app.use('/api', rlsMiddleware);

    // Client error reporting endpoint
    app.post('/api/client-errors', express.json(), (req: Request, res: Response) => {
      logger.warn({ clientError: req.body, ip: req.ip }, 'Client-side error reported');
      res.status(204).send();
    });

    // Initialize module system
    try {
      await moduleLoader.loadAllModules();
    } catch (error) {
      logger.error({ err: error }, 'Failed to load modules');
    }

    const server = await registerRoutes(app);

    // Feature gate API endpoint (for frontend to check available features)
    const { getAvailableFeatures } = await import('./billing/feature-gate');
    app.get('/api/features', async (req: Request, res: Response) => {
      const user = req.user as any;
      if (!user?.companyId) {
        return res.json({ plan: 'free', features: [], allFeatures: {} });
      }
      const features = await getAvailableFeatures(user.companyId);
      res.json(features);
    });

    // Sentry error handler (before our global handler, if available)
    const sentryHandler = getSentryErrorHandler();
    if (sentryHandler) {
      app.use(sentryHandler);
    }

    // Global error handler - MUST be last middleware
    app.use(globalErrorHandler);

    // Setup for development and production
    if (app.get("env") === "development") {
      const { setupVite } = await import("./vite-dev");
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // Graceful shutdown
    const port = 5000;
    const httpServer = server.listen(port, "0.0.0.0", () => {
      logger.info({ pid: process.pid, port }, `Worker serving on port ${port}`);

      // Start billing cron jobs (only on first worker or in development)
      if (cluster.isWorker && cluster.worker?.id === 1 || process.env.NODE_ENV === 'development') {
        startBillingCronJobs();
        startBackupCronJobs();

        startAllScheduledJobs().catch((err) => {
          logger.error({ err }, 'Failed to start automation scheduled jobs (recall/reviews/confirmations)');
        });

        // Start slow query monitor (only on first worker)
        import('./db').then(({ pool }) => {
          startSlowQueryMonitor(pool);
        }).catch(() => {});
      }
    });

    // Graceful shutdown handler
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received, starting graceful shutdown...`);
      httpServer.close(async () => {
        logger.info('HTTP server closed');
        try {
          const { closeDatabasePool } = await import('./db');
          await closeDatabasePool();
          const { closeRedisConnections } = await import('./redis');
          await closeRedisConnections();
        } catch (err) {
          logger.error({ err }, 'Error during shutdown cleanup');
        }
        process.exit(0);
      });
      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.warn('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  })();
}
