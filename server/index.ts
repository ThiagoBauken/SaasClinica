// IMPORTANTE: Carregar variáveis de ambiente PRIMEIRO, antes de qualquer outro import
import { config } from 'dotenv';
config({ override: true });

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupTestRoutes } from "./testRoutes";
import { setupVite, serveStatic, log } from "./vite";
import cluster from "cluster";
import os from "os";
import compression from "compression";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { moduleLoader } from "../modules/moduleLoader";

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

// Determina quantos workers serão usados (no máximo)
const WORKERS = process.env.NODE_ENV === "production" 
  ? Math.min(os.cpus().length, 16) // Limita a 16 workers no máximo para evitar overhead de context switching
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
  
  // Proteção contra ataques comuns
  app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === "production" ? undefined : false,
  }));
  
  // Configuração de sessões com Redis (com fallback para memorystore)
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret && process.env.NODE_ENV === "production") {
    console.error('⚠️  WARNING: SESSION_SECRET not set in production! Using default (INSECURE)');
  }

  const sessionConfig: any = {
    secret: sessionSecret || "dental-management-system-secret-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24, // 24 horas
      sameSite: 'lax'
    },
    name: 'dental.sid', // Nome customizado do cookie de sessão
  };

  // Tenta usar Redis se disponível, senão usa memorystore
  isRedisAvailable().then(available => {
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
  }).catch(err => {
    console.error('Redis connection error:', err);
    console.warn('⚠️  Falling back to in-memory session storage');
  });

  app.use(session(sessionConfig));
  
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
    // Inicializar sistema de módulos
    try {
      await moduleLoader.loadAllModules();
    } catch (error) {
      console.error('❌ Falha ao carregar módulos:', error);
    }
    
    const server = await registerRoutes(app);

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
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    const port = 5000;
    server.listen(port, "0.0.0.0", () => {
      log(`Worker ${process.pid} servindo na porta ${port}`);
    });
  })();
}
