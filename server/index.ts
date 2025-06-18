import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import cluster from "cluster";
import os from "os";
import compression from "compression";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

// Determina quantos workers serão usados (no máximo)
const WORKERS = process.env.NODE_ENV === "production" 
  ? Math.min(os.cpus().length, 16) // Limita a 16 workers no máximo para evitar overhead de context switching
  : 1; // Em desenvolvimento, usamos apenas 1 worker

// Importação do sistema de cache distribuído
import { initializeClusterCache } from './clusterCache';

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

  (async () => {
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
    server.listen({
      port,
      host: "0.0.0.0",
      reusePort: true,
    }, () => {
      log(`Worker ${process.pid} servindo na porta ${port}`);
    });
  })();
}
