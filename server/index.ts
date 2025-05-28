import express from "express";
import session from "express-session";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import path from "path";
import { coreStorage } from "./core/storage";
import coreRoutes from "./core/routes";
import { moduleManager } from "./core/moduleManager";
import bcrypt from "bcryptjs";

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));

app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use("/api", limiter);

// Body parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Session configuration
app.use(session({
  store: coreStorage.getSessionStore(),
  secret: process.env.SESSION_SECRET || "your-secret-key-change-this",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
}));

// Trust proxy in production
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// Core routes (authentication and administration)
app.use(coreRoutes);

// Serve static files from client/dist in production
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(process.cwd(), "client/dist")));
}

// Admin dashboard route
app.get("/admin", (req, res) => {
  if (process.env.NODE_ENV === "development") {
    res.send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Painel Administrativo - Sistema Modular</title>
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="bg-gray-50 min-h-screen">
        <div class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div class="px-4 py-6 sm:px-0">
            <h1 class="text-3xl font-bold text-gray-900 mb-8">🎛️ Painel Administrativo</h1>
            
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <!-- Sistema Status -->
              <div class="bg-white overflow-hidden shadow rounded-lg">
                <div class="p-6">
                  <div class="flex items-center">
                    <div class="flex-shrink-0">
                      <div class="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                        <span class="text-white font-bold">✓</span>
                      </div>
                    </div>
                    <div class="ml-4">
                      <div class="text-sm font-medium text-gray-500">Sistema</div>
                      <div class="text-lg font-semibold text-gray-900">Ativo</div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Módulos Carregados -->
              <div class="bg-white overflow-hidden shadow rounded-lg">
                <div class="p-6">
                  <div class="flex items-center">
                    <div class="flex-shrink-0">
                      <div class="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                        <span class="text-white font-bold">🧩</span>
                      </div>
                    </div>
                    <div class="ml-4">
                      <div class="text-sm font-medium text-gray-500">Módulos</div>
                      <div class="text-lg font-semibold text-gray-900">1 Ativo</div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Empresas -->
              <div class="bg-white overflow-hidden shadow rounded-lg">
                <div class="p-6">
                  <div class="flex items-center">
                    <div class="flex-shrink-0">
                      <div class="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                        <span class="text-white font-bold">🏢</span>
                      </div>
                    </div>
                    <div class="ml-4">
                      <div class="text-sm font-medium text-gray-500">Empresas</div>
                      <div class="text-lg font-semibold text-gray-900">1 Ativa</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Módulos Disponíveis -->
            <div class="mt-8">
              <h2 class="text-xl font-semibold text-gray-900 mb-4">📦 Módulos Disponíveis</h2>
              <div class="bg-white shadow overflow-hidden sm:rounded-md">
                <ul class="divide-y divide-gray-200">
                  <li class="px-6 py-4">
                    <div class="flex items-center justify-between">
                      <div class="flex items-center">
                        <div class="flex-shrink-0 h-10 w-10">
                          <div class="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                            <span class="text-green-600 font-semibold">🦷</span>
                          </div>
                        </div>
                        <div class="ml-4">
                          <div class="text-sm font-medium text-gray-900">Clínica Odontológica</div>
                          <div class="text-sm text-gray-500">Sistema completo de gestão para clínicas odontológicas</div>
                        </div>
                      </div>
                      <div class="flex items-center">
                        <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          Ativo
                        </span>
                      </div>
                    </div>
                  </li>
                </ul>
              </div>
            </div>

            <!-- Ações -->
            <div class="mt-8">
              <h2 class="text-xl font-semibold text-gray-900 mb-4">⚡ Ações Rápidas</h2>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button onclick="loadModuleData()" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                  🔄 Recarregar Módulos
                </button>
                <button onclick="viewSystemLogs()" class="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded">
                  📋 Ver Logs do Sistema
                </button>
              </div>
            </div>

            <div class="mt-8 p-4 bg-green-50 rounded-lg">
              <h3 class="text-lg font-semibold text-green-900 mb-2">🎉 Sistema Modular Ativo!</h3>
              <p class="text-green-700">
                A arquitetura modular foi implementada com sucesso. O sistema core está rodando apenas com autenticação e administração, 
                enquanto o módulo clínica opera de forma independente.
              </p>
            </div>

            <div class="mt-4 text-center">
              <button onclick="logout()" class="text-red-600 hover:text-red-800 font-medium">
                🚪 Sair do Sistema
              </button>
            </div>
          </div>
        </div>

        <script>
          function loadModuleData() {
            alert('🔄 Funcionalidade em desenvolvimento: Recarregar módulos');
          }

          function viewSystemLogs() {
            alert('📋 Funcionalidade em desenvolvimento: Visualizar logs');
          }

          function logout() {
            fetch('/api/auth/logout', { method: 'POST' })
              .then(() => {
                window.location.href = '/';
              });
          }
        </script>
      </body>
      </html>
    `);
  } else {
    res.sendFile(path.join(process.cwd(), "client/dist", "index.html"));
  }
});

// Catch-all handler: send back React's index.html file for all non-API routes
app.get("*", (req, res) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ error: "API route not found" });
  }
  
  // In development, serve a simple login page
  if (process.env.NODE_ENV === "development") {
    res.send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Sistema Modular - Login</title>
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="bg-gray-50 min-h-screen flex items-center justify-center">
        <div class="max-w-md w-full space-y-8">
          <div>
            <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Sistema Modular
            </h2>
            <p class="mt-2 text-center text-sm text-gray-600">
              Faça login para acessar o sistema
            </p>
          </div>
          <form class="mt-8 space-y-6" onsubmit="login(event)">
            <div class="rounded-md shadow-sm -space-y-px">
              <div>
                <input id="username" name="username" type="text" required 
                       class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm" 
                       placeholder="Usuário" value="superadmin">
              </div>
              <div>
                <input id="password" name="password" type="password" required 
                       class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm" 
                       placeholder="Senha" value="admin123">
              </div>
            </div>
            <div>
              <button type="submit" 
                      class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                Entrar
              </button>
            </div>
          </form>
          <div id="message" class="text-center text-sm"></div>
        </div>
        
        <script>
          async function login(event) {
            event.preventDefault();
            const formData = new FormData(event.target);
            const username = formData.get('username');
            const password = formData.get('password');
            
            try {
              const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
              });
              
              const data = await response.json();
              
              if (response.ok) {
                document.getElementById('message').innerHTML = '<span class="text-green-600">✅ Login realizado com sucesso! Redirecionando...</span>';
                setTimeout(() => {
                  window.location.href = '/admin';
                }, 1000);
              } else {
                document.getElementById('message').innerHTML = '<span class="text-red-600">❌ ' + data.error + '</span>';
              }
            } catch (error) {
              document.getElementById('message').innerHTML = '<span class="text-red-600">❌ Erro de conexão</span>';
            }
          }
        </script>
      </body>
      </html>
    `);
  } else {
    res.sendFile(path.join(process.cwd(), "client/dist", "index.html"));
  }
});

// Initialize module system
async function initializeModules() {
  try {
    // Create default company for superadmin
    const companies = await coreStorage.getCompanies();
    if (companies.length === 0) {
      console.log("Creating default company...");
      const defaultCompany = await coreStorage.createCompany({
        name: "Sistema Principal",
        email: "admin@sistema.com",
        active: true,
      });
      console.log("Default company created:", defaultCompany.id);

      // Create superadmin user
      const hashedPassword = await bcrypt.hash("admin123", 10);
      const superAdmin = await coreStorage.createUser({
        companyId: defaultCompany.id,
        username: "superadmin",
        password: hashedPassword,
        fullName: "Super Administrator",
        email: "admin@sistema.com",
        role: "superadmin",
        active: true,
      });
      console.log("Superadmin user created:", superAdmin.username);
    }

    // Register clinic module if it doesn't exist
    const modules = await coreStorage.getModules();
    const clinicModule = modules.find(m => m.name === "clinic");
    
    if (!clinicModule) {
      console.log("Creating clinic module...");
      await coreStorage.createModule({
        name: "clinic",
        displayName: "Clínica Odontológica",
        description: "Sistema completo de gestão para clínicas odontológicas",
        version: "1.0.0",
        isActive: true,
        requiredPermissions: ["clinic:read", "clinic:write"],
      });
      console.log("Clinic module created");
    }

    // Initialize module manager
    await moduleManager.initialize();
    console.log("Module system initialized");

    // Load module routes dynamically
    app.use("/api/modules", moduleManager.getModuleRoutes());
    console.log("Module routes loaded");

  } catch (error) {
    console.error("Failed to initialize modules:", error);
  }
}

// Start server
async function startServer() {
  try {
    await initializeModules();
    
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Core system running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || "development"}`);
      console.log(`🔐 Authentication and administration ready`);
      console.log(`🧩 Modular architecture active`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();

export default app;