import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Express } from "express";
import session from "express-session";
import rateLimit from "express-rate-limit";
import { scrypt, randomBytes, timingSafeEqual, createHash } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import { sendEmail, getWelcomeTemplate } from "./services/email-service";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);
const isProduction = process.env.NODE_ENV === "production";

// SEGURANÇA: Validar SESSION_SECRET obrigatório
const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
  throw new Error(
    'SECURITY ERROR: SESSION_SECRET must be set and at least 32 characters long. ' +
    'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
  );
}

// SEGURANÇA: Rate limiting específico para login
// Em desenvolvimento: 50 tentativas / 5 minutos (mais permissivo para testes)
// Em produção: 5 tentativas / 15 minutos (mais restritivo)
const loginLimiter = rateLimit({
  windowMs: isProduction ? 15 * 60 * 1000 : 5 * 60 * 1000, // 15 min prod / 5 min dev
  max: isProduction ? 5 : 50, // 5 prod / 50 dev
  message: {
    error: isProduction
      ? "Muitas tentativas de login. Por favor, tente novamente em 15 minutos."
      : "Muitas tentativas de login. Por favor, tente novamente em 5 minutos."
  },
  skipSuccessfulRequests: true, // Não conta logins bem-sucedidos
  standardHeaders: true,
  legacyHeaders: false,
  // Handler personalizado para log de tentativas bloqueadas
  handler: (req, res) => {
    console.warn(`⚠️  SECURITY: Rate limit exceeded for IP ${req.ip} on path ${req.path}`);
    res.status(429).json({
      error: isProduction
        ? "Muitas tentativas de login. Por favor, tente novamente em 15 minutos."
        : "Muitas tentativas de login. Por favor, tente novamente em 5 minutos."
    });
  }
});

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  try {
    // Ensure the stored password has the expected format
    if (!stored || !stored.includes('.')) {
      return false;
    }

    const [hashed, salt] = stored.split(".");
    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;

    // Ensure buffers have the same length
    if (hashedBuf.length !== suppliedBuf.length) {
      return false;
    }

    return timingSafeEqual(hashedBuf, suppliedBuf);
  } catch (error) {
    console.error("Error comparing passwords:", error);
    return false;
  }
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: SESSION_SECRET!, // Garantido pela validação acima
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 1 day
      secure: isProduction, // HTTPS obrigatório em produção
      httpOnly: true, // Previne XSS
      sameSite: isProduction ? 'strict' : 'lax', // Previne CSRF
    },
    name: 'sid', // Nome genérico para dificultar fingerprinting
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // Local authentication strategy
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        // Autenticação via banco de dados
        const user = await storage.getUserByUsername(username);

        if (!user || !(await comparePasswords(password, user.password))) {
          // SEGURANÇA: Log de tentativa de login falhada
          console.warn(`⚠️  Failed login attempt for username: ${username}`);
          return done(null, false, { message: 'Usuário ou senha inválidos' });
        }

        // SEGURANÇA: Log de login bem-sucedido
        console.log(`✓ Successful login for user: ${username} (ID: ${user.id})`);
        return done(null, user);
      } catch (error) {
        console.error("❌ Erro na estratégia de login:", error);
        return done(error);
      }
    }),
  );

  // Google OAuth strategy
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: process.env.GOOGLE_CALLBACK_URL || "http://localhost:5000/auth/google/callback",
          scope: ["profile", "email"],
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            // Check if user already exists
            let user = await storage.getUserByGoogleId(profile.id);

            if (user) {
              console.log(`✓ Google login for existing user: ${user.username}`);
              return done(null, user);
            }

            // Check if user exists with same email
            if (profile.emails && profile.emails.length > 0) {
              const email = profile.emails[0].value;
              user = await storage.getUserByEmail(email);

              if (user) {
                // Update user with Google ID
                user = await storage.updateUser(user.id, { googleId: profile.id });
                console.log(`✓ Linked Google account to existing user: ${user.username}`);
                return done(null, user);
              }
            }

            // Create new user
            if (profile.emails && profile.emails.length > 0) {
              const email = profile.emails[0].value;
              const displayName = profile.displayName || email.split('@')[0];

              // Set trial period to 7 days from now
              const trialEndsAt = new Date();
              trialEndsAt.setDate(trialEndsAt.getDate() + 7);

              // Get or create default company for new user
              let defaultCompanyId = 1; // Fallback to first company
              try {
                // Buscar empresas diretamente do banco
                const { db } = await import("./db");
                const { companies } = await import("@shared/schema");
                const companiesList = await db.select().from(companies).limit(1);
                if (companiesList && companiesList.length > 0) {
                  defaultCompanyId = companiesList[0].id;
                }
              } catch (error) {
                console.error('❌ Error fetching companies:', error);
              }

              const newUser = await storage.createUser({
                username: email.split('@')[0] + '_' + Date.now().toString().slice(-4),
                password: await hashPassword(createHash('sha256').update(Math.random().toString()).digest('hex')),
                fullName: displayName,
                email: email,
                role: "dentist",
                companyId: defaultCompanyId,
                googleId: profile.id,
                trialEndsAt: trialEndsAt
              });

              console.log(`✓ Created new user via Google: ${newUser.username}`);
              return done(null, newUser);
            }

            return done(null, false);
          } catch (error) {
            console.error("❌ Google authentication error:", error);
            return done(error);
          }
        }
      )
    );
  }

  // Serialização: armazenar apenas o ID do usuário
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  // Deserialização: buscar usuário do banco de dados
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);

      if (!user) {
        console.warn(`⚠️  Session invalid: User ID ${id} not found in database`);
        return done(new Error('User not found'));
      }

      done(null, user);
    } catch (error) {
      console.error('❌ Deserialization error:', error);
      done(error);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        return res.status(400).json({ error: "Nome de usuário já existe" });
      }

      const user = await storage.createUser({
        ...req.body,
        password: await hashPassword(req.body.password),
      });

      // Enviar email de boas-vindas (não aguardar para não bloquear o login)
      if (user.email) {
        const trialDays = user.trialEndsAt
          ? Math.ceil((new Date(user.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : 7;

        sendEmail({
          to: user.email,
          subject: '🎉 Bem-vindo ao DentalSystem!',
          html: getWelcomeTemplate(
            user.fullName || user.username,
            'Básico', // Default plan for new users
            trialDays
          ),
        }).catch(err => console.error('Erro ao enviar email de boas-vindas:', err));
      }

      req.login(user, (err) => {
        if (err) return next(err);

        // SEGURANÇA: Não retornar dados sensíveis
        const { password, googleAccessToken, googleRefreshToken, ...safeUser } = user;
        res.status(201).json(safeUser);
      });
    } catch (error) {
      next(error);
    }
  });

  // SEGURANÇA: Rate limiting aplicado ao login
  app.post("/api/auth/login", loginLimiter, passport.authenticate("local"), (req, res) => {
    // Suporte para "Manter Conectado"
    const rememberMe = req.body.rememberMe === true;
    if (rememberMe && req.session.cookie) {
      // Estender cookie para 30 dias se "Manter Conectado" estiver marcado
      req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 dias
      console.log(`✓ Remember me enabled for user: ${(req.user as SelectUser).id}`);
    }

    // SEGURANÇA: Não retornar dados sensíveis
    const { password, googleAccessToken, googleRefreshToken, ...safeUser } = req.user as SelectUser;
    res.status(200).json(safeUser);
  });

  app.post("/api/auth/logout", (req, res, next) => {
    const userId = (req.user as SelectUser)?.id;
    req.logout((err) => {
      if (err) return next(err);
      console.log(`✓ User logged out: ${userId}`);
      res.sendStatus(200);
    });
  });

  // Google auth routes
  app.get("/auth/google", passport.authenticate("google"));

  app.get(
    "/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/auth" }),
    (_req, res) => {
      res.redirect("/");
    }
  );

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    // SEGURANÇA: Não retornar dados sensíveis
    const { password, googleAccessToken, googleRefreshToken, ...safeUser } = req.user as SelectUser;
    res.json(safeUser);
  });

  app.get("/api/user/company", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const user = req.user as SelectUser;

      // Import db and companies from schema
      const { db } = await import('./db');
      const { companies } = await import('../shared/schema');
      const { eq } = await import('drizzle-orm');

      const [company] = await db
        .select()
        .from(companies)
        .where(eq(companies.id, user.companyId));

      if (!company) {
        return res.status(404).json({ error: "Empresa não encontrada" });
      }

      res.json(company);
    } catch (error) {
      console.error('Erro ao buscar empresa do usuário:', error);
      res.status(500).json({ error: "Erro ao buscar informações da empresa" });
    }
  });
}

export { hashPassword, comparePasswords };
