import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import rateLimit from "express-rate-limit";
import { scrypt, randomBytes, timingSafeEqual, createHash } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { db } from "./db";
import { logger } from "./logger";
import { User as SelectUser } from "@shared/schema";
import { asyncHandler } from "./middleware/auth";
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
    logger.warn({ ip: req.ip, path: req.path }, 'SECURITY: Rate limit exceeded');
    res.status(429).json({
      error: isProduction
        ? "Muitas tentativas de login. Por favor, tente novamente em 15 minutos."
        : "Muitas tentativas de login. Por favor, tente novamente em 5 minutos."
    });
  }
});

// SEGURANÇA: Rate limiting para registro (evita spam de contas)
const registerLimiter = rateLimit({
  windowMs: isProduction ? 60 * 60 * 1000 : 5 * 60 * 1000, // 1h prod / 5 min dev
  max: isProduction ? 5 : 50,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn({ ip: req.ip }, 'SECURITY: Registration rate limit exceeded');
    res.status(429).json({ error: "Muitas tentativas de registro. Tente novamente mais tarde." });
  }
});

// SEGURANÇA: Rate limiting para password reset (evita email spam e enumeração)
const passwordResetLimiter = rateLimit({
  windowMs: isProduction ? 15 * 60 * 1000 : 5 * 60 * 1000,
  max: isProduction ? 3 : 50, // Muito restritivo: 3 tentativas / 15 min
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn({ ip: req.ip }, 'SECURITY: Password reset rate limit exceeded');
    res.status(429).json({ error: "Muitas tentativas de recuperação. Tente novamente em 15 minutos." });
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
    logger.error({ err: error }, 'Error comparing passwords');
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
        const cleanUsername = username?.trim();
        const user = await storage.getUserByUsername(cleanUsername);
        if (!user) {
          logger.warn({ username: cleanUsername, usernameLength: cleanUsername?.length }, 'Failed login attempt (user not found)');
          return done(null, false, { message: 'Usuário ou senha inválidos' });
        }

        const passwordMatches = await comparePasswords(password, user.password);
        if (!passwordMatches) {
          logger.warn({ username: cleanUsername }, 'Failed login attempt (wrong password)');
          return done(null, false, { message: 'Usuário ou senha inválidos' });
        }

        logger.info({ username: cleanUsername, userId: user.id }, 'Successful login');
        return done(null, user);
      } catch (error) {
        logger.error({ err: error }, 'Login strategy error');
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
              logger.info({ username: user.username }, 'Google login for existing user');
              return done(null, user);
            }

            // Check if user exists with same email
            if (profile.emails && profile.emails.length > 0) {
              const email = profile.emails[0].value;
              user = await storage.getUserByEmail(email);

              if (user) {
                // Update user with Google ID
                user = await storage.updateUser(user.id, { googleId: profile.id });
                logger.info({ username: user.username }, 'Linked Google account to existing user');
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

              // SEGURANÇA: Buscar empresa padrão — NUNCA usar fallback hardcoded
              const { db } = await import("./db");
              const { companies } = await import("@shared/schema");
              const companiesList = await db.select().from(companies).limit(1);
              if (!companiesList || companiesList.length === 0) {
                logger.error('CRITICAL: No companies found in database for Google OAuth registration');
                return done(new Error('No companies available for registration'));
              }
              const defaultCompanyId = companiesList[0].id;

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

              // Criar subscription automaticamente para novo usuário Google
              try {
                const { subscriptionService } = await import("./billing/subscription-service");
                const { db } = await import("./db");
                const { plans, subscriptions } = await import("@shared/schema");
                const { eq } = await import("drizzle-orm");

                // Verificar se já existe subscription para esta empresa
                const existingSub = await db
                  .select()
                  .from(subscriptions)
                  .where(eq(subscriptions.companyId, defaultCompanyId))
                  .limit(1);

                if (existingSub.length === 0) {
                  // Buscar plano básico
                  const [basicPlan] = await db
                    .select()
                    .from(plans)
                    .where(eq(plans.name, 'basic'))
                    .limit(1);

                  if (basicPlan) {
                    await subscriptionService.createSubscription({
                      companyId: defaultCompanyId,
                      planId: basicPlan.id,
                      billingCycle: 'monthly',
                    });
                    logger.info({ companyId: defaultCompanyId }, 'Subscription created (Google OAuth)');
                  }
                }
              } catch (subError) {
                logger.error({ err: subError }, 'Error creating subscription (Google OAuth)');
              }

              logger.info({ username: newUser.username }, 'Created new user via Google');
              return done(null, newUser);
            }

            return done(null, false);
          } catch (error) {
            logger.error({ err: error }, 'Google authentication error');
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
        logger.warn({ userId: id }, 'Session invalid: User not found in database');
        return done(new Error('User not found'));
      }

      done(null, user);
    } catch (error) {
      logger.error({ err: error }, 'Deserialization error');
      done(error);
    }
  });

  app.post("/api/register", registerLimiter, async (req, res, next) => {
    try {
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        return res.status(400).json({ error: "Nome de usuário já existe" });
      }

      // Validar força da senha
      const password = req.body.password;
      if (!password || password.length < 12) {
        return res.status(400).json({ error: "A senha deve ter pelo menos 12 caracteres" });
      }
      if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
        return res.status(400).json({ error: "A senha deve conter pelo menos uma letra maiúscula, uma minúscula e um número" });
      }

      // Verificar se email já existe
      if (req.body.email) {
        const existingEmail = await storage.getUserByEmail(req.body.email);
        if (existingEmail) {
          return res.status(400).json({ error: "Este e-mail já está cadastrado" });
        }
      }

      // Set trial period to 7 days from now
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 7);

      // SEGURANÇA: Buscar empresa padrão — NUNCA usar fallback hardcoded
      const { db: regDb } = await import("./db");
      const { companies: companiesTable } = await import("@shared/schema");
      const companiesList = await regDb.select().from(companiesTable).limit(1);
      if (!companiesList || companiesList.length === 0) {
        return res.status(503).json({ error: "Sistema indisponível. Nenhuma empresa cadastrada." });
      }
      const defaultCompanyId = companiesList[0].id;

      const user = await storage.createUser({
        ...req.body,
        password: await hashPassword(req.body.password),
        companyId: defaultCompanyId,
        trialEndsAt: trialEndsAt,
        role: req.body.role || "staff", // Default role
      });

      // Criar subscription automaticamente para novo usuário
      try {
        const { subscriptionService } = await import("./billing/subscription-service");
        const { db } = await import("./db");
        const { plans, subscriptions } = await import("@shared/schema");
        const { eq } = await import("drizzle-orm");

        // Verificar se já existe subscription para esta empresa
        const existingSub = await db
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.companyId, defaultCompanyId))
          .limit(1);

        if (existingSub.length === 0) {
          // Buscar plano básico (gratuito/trial)
          const [basicPlan] = await db
            .select()
            .from(plans)
            .where(eq(plans.name, 'basic'))
            .limit(1);

          if (basicPlan) {
            await subscriptionService.createSubscription({
              companyId: defaultCompanyId,
              planId: basicPlan.id,
              billingCycle: 'monthly',
            });
            logger.info({ companyId: defaultCompanyId }, 'Subscription created for company');
          }
        }
      } catch (subError) {
        logger.error({ err: subError }, 'Error creating subscription (non-critical)');
      }

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
        }).catch(err => logger.error({ err }, 'Error sending welcome email'));
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

  // SEGURANÇA: Armazenamento temporário de sessões MFA pendentes (5 min TTL)
  const mfaPendingSessions = new Map<string, { userId: number; rememberMe: boolean; expiresAt: number }>();

  // Limpar sessões MFA expiradas a cada 60 segundos
  setInterval(() => {
    const now = Date.now();
    for (const [token, session] of mfaPendingSessions) {
      if (session.expiresAt < now) mfaPendingSessions.delete(token);
    }
  }, 60_000);

  // SEGURANÇA: Rate limiting aplicado ao login (com suporte MFA)
  app.post("/api/auth/login", loginLimiter, passport.authenticate("local"), (req, res) => {
    const user = req.user as SelectUser;

    // Se TOTP está habilitado, não criar sessão completa — exigir segundo fator
    if (user.totpEnabled) {
      const mfaToken = randomBytes(32).toString('hex');
      mfaPendingSessions.set(mfaToken, {
        userId: user.id,
        rememberMe: req.body.rememberMe === true,
        expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutos
      });

      // Deslogar a sessão parcial criada pelo passport.authenticate
      req.logout(() => {});

      return res.status(200).json({
        mfaRequired: true,
        mfaToken,
        userId: user.id,
      });
    }

    // Sem MFA: regenerar sessao para prevenir session fixation (CWE-384)
    const userData = req.user as SelectUser;
    const rememberMe = req.body.rememberMe === true;

    req.session.regenerate((regenerateErr) => {
      if (regenerateErr) {
        logger.error({ err: regenerateErr }, 'Session regeneration error');
      }

      req.login(userData, (loginErr) => {
        if (loginErr) {
          return res.status(500).json({ error: 'Erro ao criar sessao' });
        }

        if (rememberMe && req.session.cookie) {
          req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 dias
        }

        const { password, googleAccessToken, googleRefreshToken, totpSecret, totpBackupCodes, ...safeUser } = userData;
        res.status(200).json(safeUser);
      });
    });
  });

  // MFA: Verificar código TOTP após login com senha
  app.post("/api/auth/totp/verify", loginLimiter, asyncHandler(async (req: Request, res: Response) => {
    const { mfaToken, totpCode } = req.body;
    if (!mfaToken || !totpCode) {
      return res.status(400).json({ error: "Token MFA e código TOTP são obrigatórios" });
    }

    const pending = mfaPendingSessions.get(mfaToken);
    if (!pending || pending.expiresAt < Date.now()) {
      mfaPendingSessions.delete(mfaToken);
      return res.status(401).json({ error: "Sessão MFA expirada. Faça login novamente." });
    }

    const user = await storage.getUser(pending.userId);
    if (!user || !user.totpSecret) {
      mfaPendingSessions.delete(mfaToken);
      return res.status(401).json({ error: "Usuário não encontrado" });
    }

    const { verifyTOTP, verifyBackupCode } = await import('./services/totp-service');

    // Tentar como código TOTP normal
    let isValid = verifyTOTP(totpCode, user.totpSecret);

    // Se não for TOTP válido, tentar como backup code
    if (!isValid && user.totpBackupCodes) {
      const hashedCodes: string[] = JSON.parse(user.totpBackupCodes);
      const remainingCodes = verifyBackupCode(totpCode, hashedCodes);
      if (remainingCodes !== null) {
        isValid = true;
        // Consumir o backup code
        await db.$client.query(
          `UPDATE users SET totp_backup_codes = $1, updated_at = NOW() WHERE id = $2`,
          [JSON.stringify(remainingCodes), user.id]
        );
      }
    }

    if (!isValid) {
      return res.status(401).json({ error: "Código TOTP inválido" });
    }

    // Código válido — criar sessão completa
    mfaPendingSessions.delete(mfaToken);

    req.login(user, (err) => {
      if (err) return res.status(500).json({ error: "Erro ao criar sessão" });

      if (pending.rememberMe && req.session.cookie) {
        req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
      }

      const { password, googleAccessToken, googleRefreshToken, totpSecret, totpBackupCodes, ...safeUser } = user;
      res.status(200).json(safeUser);
    });
  }));

  // MFA: Setup — gerar secret + QR code
  app.post("/api/auth/totp/setup", asyncHandler(async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as SelectUser;

    if (user.totpEnabled) {
      return res.status(400).json({ error: "MFA já está habilitado" });
    }

    const { generateTOTPSecret } = await import('./services/totp-service');
    const { secret, otpauthUrl, qrCodeUrl } = generateTOTPSecret(user.username);

    // Salvar secret temporariamente (não habilitado até confirm)
    await db.$client.query(
      `UPDATE users SET totp_secret = $1, updated_at = NOW() WHERE id = $2`,
      [secret, user.id]
    );

    res.json({ secret, otpauthUrl, qrCodeUrl });
  }));

  // MFA: Confirm — validar primeiro código e habilitar MFA
  app.post("/api/auth/totp/confirm", asyncHandler(async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as SelectUser;
    const { token } = req.body;

    if (!token) return res.status(400).json({ error: "Código TOTP é obrigatório" });

    // Buscar secret atual
    const result = await db.$client.query(`SELECT totp_secret FROM users WHERE id = $1`, [user.id]);
    const secret = result.rows?.[0]?.totp_secret;
    if (!secret) return res.status(400).json({ error: "Execute /totp/setup primeiro" });

    const { verifyTOTP, generateBackupCodes } = await import('./services/totp-service');
    if (!verifyTOTP(token, secret)) {
      return res.status(400).json({ error: "Código inválido. Verifique o app autenticador e tente novamente." });
    }

    // Gerar backup codes
    const { plain, hashed } = generateBackupCodes(10);

    // Habilitar MFA
    await db.$client.query(
      `UPDATE users SET totp_enabled = true, totp_backup_codes = $1, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(hashed), user.id]
    );

    res.json({
      enabled: true,
      backupCodes: plain, // Mostrar UMA VEZ para o usuário salvar
      message: "MFA habilitado com sucesso. Salve os códigos de backup em local seguro.",
    });
  }));

  // MFA: Disable — desabilitar MFA (requer senha)
  app.post("/api/auth/totp/disable", asyncHandler(async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as SelectUser;
    const { password: suppliedPassword } = req.body;

    if (!suppliedPassword) return res.status(400).json({ error: "Senha é obrigatória para desabilitar MFA" });

    const isValid = await comparePasswords(suppliedPassword, user.password);
    if (!isValid) return res.status(401).json({ error: "Senha incorreta" });

    await db.$client.query(
      `UPDATE users SET totp_enabled = false, totp_secret = NULL, totp_backup_codes = NULL, updated_at = NOW() WHERE id = $1`,
      [user.id]
    );

    res.json({ enabled: false, message: "MFA desabilitado com sucesso." });
  }));

  // SEGURANÇA: Password reset com token seguro e expiração (30 min)
  app.post("/api/auth/forgot-password", passwordResetLimiter, asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email é obrigatório" });
    }

    const user = await storage.getUserByEmail(email);
    if (!user) {
      // Don't reveal if user exists - always return success
      return res.json({ success: true, message: "Se o email estiver cadastrado, você receberá as instruções." });
    }

    // Gerar token seguro (32 bytes = 64 hex chars) com expiração de 30 minutos
    const resetToken = randomBytes(32).toString("hex");
    const hashedToken = createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutos

    // Salvar token hasheado no banco (nunca armazenar o token original)
    await db.$client.query(
      `UPDATE users SET password_reset_token = $1, password_reset_expires = $2, updated_at = NOW() WHERE id = $3`,
      [hashedToken, expiresAt, user.id]
    );

    logger.info({ module: 'auth', userId: user.id, expiresAt: expiresAt.toISOString() }, 'Password reset token generated');

    // Enviar email com link de reset
    const resetUrl = `${process.env.BASE_URL || 'http://localhost:5000'}/auth/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

    try {
      const { sendEmail } = await import("./services/email-service");
      await sendEmail({
        to: email,
        subject: 'Recuperação de Senha - DentCare',
        html: `<h2>Recuperação de Senha</h2>
          <p>Olá!</p>
          <p>Foi solicitada a recuperação de senha para sua conta.</p>
          <p>Clique no link abaixo para redefinir sua senha (válido por 30 minutos):</p>
          <p><a href="${resetUrl}" style="background:#2563eb;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">Redefinir Senha</a></p>
          <p>Se você não solicitou esta recuperação, ignore este email.</p>
          <p><small>Este link expira em 30 minutos.</small></p>`,
      });
      logger.info({ module: 'auth', userId: user.id }, 'Password reset email sent');
    } catch (error) {
      logger.error({ module: 'auth', err: error, userId: user.id }, 'Error sending password reset email');
    }

    res.json({
      success: true,
      message: "Se o email estiver cadastrado, você receberá as instruções de recuperação.",
    });
  }));

  // SEGURANÇA: Endpoint para efetuar o reset de senha com o token
  app.post("/api/auth/reset-password", passwordResetLimiter, asyncHandler(async (req: Request, res: Response) => {
    const { token, email, newPassword } = req.body;
    if (!token || !email || !newPassword) {
      return res.status(400).json({ error: "Token, email e nova senha são obrigatórios" });
    }

    if (newPassword.length < 12) {
      return res.status(400).json({ error: "A senha deve ter pelo menos 12 caracteres" });
    }
    // Require at least: 1 uppercase, 1 lowercase, 1 number
    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return res.status(400).json({ error: "A senha deve conter pelo menos uma letra maiúscula, uma minúscula e um número" });
    }

    const user = await storage.getUserByEmail(email);
    if (!user) {
      return res.status(400).json({ error: "Token inválido ou expirado" });
    }

    // Verificar token (comparar hash do token enviado com o armazenado)
    const hashedToken = createHash('sha256').update(token).digest('hex');

    const result = await db.$client.query(
      `SELECT password_reset_token, password_reset_expires FROM users WHERE id = $1`,
      [user.id]
    );

    const row = result.rows?.[0];
    if (!row?.password_reset_token || row.password_reset_token !== hashedToken) {
      return res.status(400).json({ error: "Token inválido ou expirado" });
    }

    if (new Date(row.password_reset_expires) < new Date()) {
      return res.status(400).json({ error: "Token expirado. Solicite uma nova recuperação." });
    }

    // Atualizar senha e limpar token
    const hashedPassword = await hashPassword(newPassword);
    await db.$client.query(
      `UPDATE users SET password = $1, password_reset_token = NULL, password_reset_expires = NULL, updated_at = NOW() WHERE id = $2`,
      [hashedPassword, user.id]
    );

    logger.info({ module: 'auth', userId: user.id }, 'Password successfully reset');
    res.json({ success: true, message: "Senha atualizada com sucesso. Faça login com a nova senha." });
  }));

  app.post("/api/auth/logout", (req, res, next) => {
    const userId = (req.user as SelectUser)?.id;
    req.logout((err) => {
      if (err) return next(err);
      logger.info({ userId }, 'User logged out');
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

    // SEGURANÇA: Não retornar dados sensíveis (incluindo TOTP secrets)
    const { password, googleAccessToken, googleRefreshToken, totpSecret, totpBackupCodes, passwordResetToken, ...safeUser } = req.user as SelectUser;
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
      logger.error({ err: error }, 'Error fetching user company');
      res.status(500).json({ error: "Erro ao buscar informações da empresa" });
    }
  });
}

export { hashPassword, comparePasswords };
