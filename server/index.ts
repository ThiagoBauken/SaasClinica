// IMPORTANTE: Carregar variáveis de ambiente PRIMEIRO, antes de qualquer outro import
import { config } from 'dotenv';
config({ override: true });

// Validar variáveis de ambiente
import { validateEnvOrExit } from './config/env-validation';
validateEnvOrExit();

import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { registerRoutes } from "./routes";
import { setupTestRoutes } from "./testRoutes";
import { serveStatic, log } from "./vite";
import cluster from "cluster";
import os from "os";
import compression from "compression";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { moduleLoader } from "../modules/moduleLoader";
// WebSocket é inicializado no routes.ts via notificationService
// import { initializeWebSocket } from "./websocket";

// Importações das melhorias arquiteturais
import { initializeClusterCache } from './clusterCache';
import { distributedCache } from './distributedCache';
import { distributedDb } from './distributedDb';
import { sessionManager } from './sessionManager';
import { cdnManager } from './cdnManager';
import { queueSystem } from './queueSystem';
import session from 'express-session';
import { RedisStore } from 'connect-redis';
import { redisClient, isRedisAvailable } from './redis';
import { startBillingCronJobs } from './jobs/billing-cron';

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

  app.use(cors({
    origin: (origin, callback) => {
      // Em produção, exigir origin. Em desenvolvimento, permitir requisições sem origin (Postman, etc)
      if (!origin) {
        if (isProduction) {
          console.warn('⚠️  CORS: Blocked request without origin in production');
          return callback(new Error('Origin header required'));
        }
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`⚠️  CORS: Blocked request from origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true, // Permitir envio de cookies
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['set-cookie'],
    maxAge: 86400, // 24 horas de cache do preflight
  }));

  // SEGURANÇA: Proteção contra ataques comuns com CSP habilitado
  // Configuração CSP mais restritiva em produção
  const cspScriptSrc = isProduction
    ? ["'self'", "'unsafe-inline'"] // Remover unsafe-eval em produção
    : ["'self'", "'unsafe-inline'", "'unsafe-eval'"]; // Manter unsafe-eval apenas em dev (necessário para Vite HMR)

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
        sessionConfig.store = new RedisStore({
          client: redisClient,
          prefix: 'dental:sess:',
          ttl: 86400, // 24 horas em segundos
        });
        console.log('✓ Using Redis for session storage');
      } else {
        console.warn('⚠️  Using in-memory session storage (not recommended for production)');
      }
    } catch (err) {
      console.error('Redis connection error:', err);
      console.warn('⚠️  Falling back to in-memory session storage');
    }

    app.use(session(sessionConfig));
  }
  
  // Limitador de requisições para evitar abuso
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 500, // limite por IP
    standardHeaders: true,
    legacyHeaders: false,
    message: "Muitas requisições deste IP, tente novamente após 15 minutos"
  });
  
  // Aplica limitador apenas nas rotas da API
  app.use("/api", apiLimiter);
  
  // Aumenta o limite do bodyParser para lidar com uploads maiores de forma eficiente
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: false, limit: "10mb" }));
  
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
      if (path.startsWith("/api")) {
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
    // Configurar sessão com Redis ou memorystore
    await setupSession();

    // Inicializar sistema de módulos
    try {
      await moduleLoader.loadAllModules();
    } catch (error) {
      console.error('❌ Falha ao carregar módulos:', error);
    }

    const server = await registerRoutes(app);

    // WebSocket Server é inicializado no routes.ts via notificationService.initialize(httpServer)
    // O path é /ws/notifications e o cliente já está configurado para conectar nesse path

    // Middleware de tratamento de erros mais robusto
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      // Log detalhado em caso de erro
      console.error(`[ERROR] ${new Date().toISOString()}: ${err.stack || err}`);

      // Resposta sanitizada para o cliente
      res.status(status).json({
        message: process.env.NODE_ENV === "production" && status === 500
          ? "Ocorreu um erro no servidor. Nossa equipe foi notificada."
          : message
      });

      // Não lançamos o erro novamente para evitar quebrar o processo
    });

    // Setup para desenvolvimento e produção
    if (app.get("env") === "development") {
      // Dynamic import - vite-dev.ts is only used in development
      const { setupVite } = await import("./vite-dev");
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    const port = 5000;
    server.listen(port, "0.0.0.0", () => {
      log(`Worker ${process.pid} servindo na porta ${port}`);

      // Iniciar cron jobs de billing (apenas no primeiro worker ou em desenvolvimento)
      if (cluster.isWorker && cluster.worker?.id === 1 || process.env.NODE_ENV === 'development') {
        startBillingCronJobs();
      }
    });
  })();
}
