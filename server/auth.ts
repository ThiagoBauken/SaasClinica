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
import { User as SelectUser, companies, plans, subscriptions } from "@shared/schema";
import { asyncHandler } from "./middleware/auth";
import { sendEmail, getWelcomeTemplate } from "./services/email-service";
import { redisCacheClient, isRedisAvailable } from "./redis";
import { eq } from "drizzle-orm";
import { createAuditLog, getAuditContext } from "./services/audit-log.service";

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

// Senha forte: 12+ caracteres, upper, lower, digit, especial.
// Mantemos uma única função para evitar divergência entre register/reset.
function validatePasswordStrength(password: unknown): string | null {
  if (!password || typeof password !== "string" || password.length < 12) {
    return "A senha deve ter pelo menos 12 caracteres";
  }
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
    return "A senha deve conter pelo menos uma letra maiúscula, uma minúscula e um número";
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return "A senha deve conter pelo menos um caractere especial (ex: !@#$%&*)";
  }
  return null;
}

// Cria uma nova empresa para o usuário recém-cadastrado e retorna o ID.
// Cada signup ganha o próprio tenant — multi-tenancy real.
async function createCompanyForNewUser(displayName: string): Promise<number> {
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 7);
  const safeName = (displayName || "Minha Clínica").slice(0, 120);

  const [created] = await db
    .insert(companies)
    .values({
      name: safeName,
      active: true,
      trialEndsAt,
    })
    .returning();

  return created.id;
}

// Lockout de conta: 10 falhas consecutivas → trava por 30 minutos.
const FAILED_LOGIN_LOCK_THRESHOLD = 10;
const FAILED_LOGIN_LOCK_MINUTES = 30;

// Garante que user_sessions.user_id seja preenchido imediatamente — o trigger
// SQL é fallback caso isso seja esquecido. Best-effort, nunca quebra o request.
async function tagSessionWithUserId(sid: string, userId: number): Promise<void> {
  try {
    await db.$client.query(
      `UPDATE user_sessions SET user_id = $1 WHERE sid = $2`,
      [userId, sid],
    );
  } catch (err) {
    logger.error({ err, sid, userId }, 'Failed to tag session with user_id');
  }
}

async function recordLoginSuccess(userId: number, ip: string): Promise<void> {
  await db.$client.query(
    `UPDATE users
       SET last_login_at = NOW(),
           last_login_ip = $1,
           failed_login_count = 0,
           locked_until = NULL,
           updated_at = NOW()
     WHERE id = $2`,
    [ip || null, userId],
  );
}

async function recordLoginFailure(userId: number): Promise<{ locked: boolean; failedCount: number }> {
  const r = await db.$client.query(
    `UPDATE users
       SET failed_login_count = failed_login_count + 1,
           locked_until = CASE
             WHEN failed_login_count + 1 >= $1
               THEN NOW() + ($2 * INTERVAL '1 minute')
             ELSE locked_until
           END,
           updated_at = NOW()
     WHERE id = $3
   RETURNING failed_login_count, locked_until`,
    [FAILED_LOGIN_LOCK_THRESHOLD, FAILED_LOGIN_LOCK_MINUTES, userId],
  );
  const row = r.rows?.[0];
  return {
    locked: !!row?.locked_until && new Date(row.locked_until) > new Date(),
    failedCount: row?.failed_login_count ?? 0,
  };
}

// Gera e persiste token de verificação de e-mail e dispara o email com o link.
// Best-effort: erros de envio de email são logados mas não interrompem o fluxo.
async function issueEmailVerificationToken(userId: number, email: string): Promise<void> {
  const rawToken = randomBytes(32).toString("hex");
  const hashedToken = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 horas

  await db.$client.query(
    `UPDATE users SET email_verification_token = $1, email_verification_expires = $2, updated_at = NOW() WHERE id = $3`,
    [hashedToken, expiresAt, userId],
  );

  const baseUrl = process.env.BASE_URL || "http://localhost:5000";
  const verifyUrl = `${baseUrl}/auth/verify-email?token=${rawToken}&email=${encodeURIComponent(email)}`;

  try {
    await sendEmail({
      to: email,
      subject: "Confirme seu e-mail - DentCare",
      html: `<h2>Confirme seu e-mail</h2>
        <p>Olá! Para concluir o cadastro, confirme seu endereço de e-mail clicando no botão abaixo:</p>
        <p><a href="${verifyUrl}" style="background:#2563eb;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">Confirmar e-mail</a></p>
        <p>Ou copie e cole este link no navegador:<br><code>${verifyUrl}</code></p>
        <p><small>Este link expira em 48 horas. Se você não criou uma conta, ignore este e-mail.</small></p>`,
    });
    logger.info({ userId }, "Email verification sent");
  } catch (err) {
    logger.error({ err, userId }, "Error sending email verification");
  }
}

// Cria a subscription "basic" automaticamente (best-effort — não bloqueia signup).
async function createDefaultSubscription(companyId: number): Promise<void> {
  try {
    const existing = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.companyId, companyId))
      .limit(1);
    if (existing.length > 0) return;

    const [basicPlan] = await db
      .select()
      .from(plans)
      .where(eq(plans.name, "basic"))
      .limit(1);

    if (!basicPlan) {
      logger.warn({ companyId }, "Plan 'basic' not found — subscription not created");
      return;
    }

    const { subscriptionService } = await import("./billing/subscription-service");
    await subscriptionService.createSubscription({
      companyId,
      planId: basicPlan.id,
      billingCycle: "monthly",
    });
    logger.info({ companyId }, "Default subscription created");
  } catch (err) {
    logger.error({ err, companyId }, "Error creating default subscription (non-critical)");
  }
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
    new LocalStrategy({ passReqToCallback: true }, async (req, username, password, done) => {
      try {
        const cleanUsername = username?.trim();
        const user = await storage.getUserByUsername(cleanUsername);
        if (!user) {
          logger.warn({ username: cleanUsername, usernameLength: cleanUsername?.length }, 'Failed login attempt (user not found)');
          return done(null, false, { message: 'Usuário ou senha inválidos' });
        }

        // Bloqueia contas desativadas / soft-deleted (LGPD).
        if (user.active === false || user.deletedAt) {
          logger.warn({ username: cleanUsername }, 'Login attempt on deactivated/deleted account');
          return done(null, false, { message: 'Conta desativada. Contate o administrador.' });
        }

        // Lockout: conta travada por excesso de tentativas falhas
        if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
          const minutesLeft = Math.ceil((new Date(user.lockedUntil).getTime() - Date.now()) / 60_000);
          logger.warn({ username: cleanUsername, minutesLeft }, 'Login attempt on locked account');
          createAuditLog({
            companyId: user.companyId,
            userId: user.id,
            action: 'login_locked',
            resourceType: 'user',
            resourceId: user.id,
            details: { minutesLeft },
            ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '',
            userAgent: req.headers['user-agent'] || '',
          });
          return done(null, false, {
            message: `Conta temporariamente bloqueada. Tente novamente em ${minutesLeft} minuto(s).`,
          });
        }

        const passwordMatches = await comparePasswords(password, user.password);
        const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '';
        const userAgent = req.headers['user-agent'] || '';

        if (!passwordMatches) {
          const result = await recordLoginFailure(user.id);
          logger.warn({ username: cleanUsername, failedCount: result.failedCount, locked: result.locked }, 'Failed login attempt (wrong password)');
          createAuditLog({
            companyId: user.companyId,
            userId: user.id,
            action: result.locked ? 'login_locked' : 'login_failed',
            resourceType: 'user',
            resourceId: user.id,
            details: { failedCount: result.failedCount },
            ipAddress,
            userAgent,
          });
          return done(null, false, { message: 'Usuário ou senha inválidos' });
        }

        await recordLoginSuccess(user.id, ipAddress);
        logger.info({ username: cleanUsername, userId: user.id }, 'Successful login');
        createAuditLog({
          companyId: user.companyId,
          userId: user.id,
          action: 'login_success',
          resourceType: 'user',
          resourceId: user.id,
          ipAddress,
          userAgent,
        });
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
            // 1) Usuário já existe pelo googleId
            const existingByGoogle = await storage.getUserByGoogleId(profile.id);
            if (existingByGoogle) {
              logger.info({ username: existingByGoogle.username }, "Google login for existing user");
              return done(null, existingByGoogle);
            }

            const email = profile.emails?.[0]?.value;
            if (!email) {
              logger.warn("Google profile without email — cannot register");
              return done(null, false, { message: "Sua conta Google precisa ter um email associado." });
            }

            // 2) Usuário existe por email — vincular googleId
            const existingByEmail = await storage.getUserByEmail(email);
            if (existingByEmail) {
              const updated = await storage.updateUser(existingByEmail.id, { googleId: profile.id });
              logger.info({ username: updated.username }, "Linked Google account to existing user");
              return done(null, updated);
            }

            // 3) Novo usuário: cria empresa + subscription + user (admin do tenant)
            const displayName = profile.displayName || email.split("@")[0];
            const companyId = await createCompanyForNewUser(displayName);

            const trialEndsAt = new Date();
            trialEndsAt.setDate(trialEndsAt.getDate() + 7);

            // Username único derivado do email + sufixo aleatório (não previsível)
            const uniqueSuffix = randomBytes(3).toString("hex");
            const baseUsername = email.split("@")[0].replace(/[^a-zA-Z0-9_.-]/g, "");
            const username = `${baseUsername}_${uniqueSuffix}`;

            // Senha aleatória forte (usuário OAuth não fará login com senha local).
            const randomPassword = randomBytes(32).toString("hex") + "Aa1!";

            const newUser = await storage.createUser({
              username,
              password: await hashPassword(randomPassword),
              fullName: displayName,
              email,
              role: "admin",
              companyId,
              googleId: profile.id,
              trialEndsAt,
              // Google entrega emails já verificados — não precisamos pedir confirmação.
              emailVerified: true,
            });

            await createDefaultSubscription(companyId);

            logger.info({ username: newUser.username }, "Created new user via Google");
            // Sinaliza ao callback HTTP que é primeiro login → redireciona para /setup.
            (newUser as any).__isNewUser = true;
            return done(null, newUser);
          } catch (error) {
            logger.error({ err: error }, "Google authentication error");
            return done(error as Error);
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
        return done(null, false);
      }

      // Sessões pertencentes a contas desativadas / soft-deleted são invalidadas.
      if (user.active === false || user.deletedAt) {
        logger.warn({ userId: id }, 'Session invalid: account deactivated or deleted');
        return done(null, false);
      }

      done(null, user);
    } catch (error) {
      logger.error({ err: error }, 'Deserialization error');
      done(error);
    }
  });

  // Handler de registro extraído para suportar dois paths (/api/register e /api/auth/register).
  const registerHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { username, password, fullName, email } = req.body ?? {};

      if (!username || typeof username !== "string" || username.trim().length < 3) {
        return res.status(400).json({ error: "Nome de usuário deve ter pelo menos 3 caracteres" });
      }
      const cleanUsername = username.trim();

      if (!fullName || typeof fullName !== "string" || fullName.trim().length < 2) {
        return res.status(400).json({ error: "Nome completo é obrigatório" });
      }

      // SEGURANÇA: email é obrigatório (a coluna users.email é NOT NULL).
      if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: "E-mail válido é obrigatório" });
      }

      const passwordError = validatePasswordStrength(password);
      if (passwordError) {
        return res.status(400).json({ error: passwordError });
      }

      const existingUser = await storage.getUserByUsername(cleanUsername);
      if (existingUser) {
        return res.status(400).json({ error: "Nome de usuário já existe" });
      }

      const existingEmail = await storage.getUserByEmail(email);
      if (existingEmail) {
        return res.status(400).json({ error: "Este e-mail já está cadastrado" });
      }

      // Cada signup cria a própria empresa (tenant). Quem se cadastra é admin do tenant.
      const companyId = await createCompanyForNewUser(fullName.trim());

      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 7);

      const user = await storage.createUser({
        username: cleanUsername,
        password: await hashPassword(password),
        fullName: fullName.trim(),
        email,
        role: "admin",
        companyId,
        trialEndsAt,
      });

      await createDefaultSubscription(companyId);

      // Email de verificação + boas-vindas (best-effort).
      await issueEmailVerificationToken(user.id, email);

      const trialDays = Math.ceil(
        (trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      );
      sendEmail({
        to: email,
        subject: "🎉 Bem-vindo ao DentalSystem!",
        html: getWelcomeTemplate(user.fullName || user.username, "Básico", trialDays),
      }).catch((err) => logger.error({ err }, "Error sending welcome email"));

      // SEGURANÇA: regenerar a sessão antes do login para evitar session fixation (CWE-384).
      req.session.regenerate((regenErr) => {
        if (regenErr) {
          logger.error({ err: regenErr }, "Session regeneration error (register)");
          return next(regenErr);
        }
        req.login(user, (loginErr) => {
          if (loginErr) return next(loginErr);
          tagSessionWithUserId(req.sessionID, user.id);
          const { password: _p, googleAccessToken, googleRefreshToken, totpSecret, totpBackupCodes, passwordResetToken, ...safeUser } = user;
          res.status(201).json(safeUser);
        });
      });
    } catch (error) {
      next(error);
    }
  };

  app.post("/api/register", registerLimiter, registerHandler);
  // Alias canônico: padroniza com /api/auth/login, /api/auth/logout, etc.
  app.post("/api/auth/register", registerLimiter, registerHandler);

  // SEGURANÇA: sessões MFA pendentes em Redis (5 min TTL).
  // Fallback para Map em memória apenas se Redis indisponível — multi-instância exige Redis.
  type MfaSession = { userId: number; rememberMe: boolean; expiresAt: number };
  const MFA_SESSION_TTL_SECONDS = 5 * 60;
  const mfaSessionFallback = new Map<string, MfaSession>();
  const mfaKey = (token: string) => `mfa:pending:${token}`;

  setInterval(() => {
    const now = Date.now();
    for (const [token, session] of mfaSessionFallback) {
      if (session.expiresAt < now) mfaSessionFallback.delete(token);
    }
  }, 60_000);

  async function setMfaSession(token: string, session: MfaSession): Promise<void> {
    if (await isRedisAvailable()) {
      await redisCacheClient.set(
        mfaKey(token),
        JSON.stringify(session),
        "EX",
        MFA_SESSION_TTL_SECONDS,
      );
      return;
    }
    mfaSessionFallback.set(token, session);
  }

  async function getMfaSession(token: string): Promise<MfaSession | null> {
    if (await isRedisAvailable()) {
      const raw = await redisCacheClient.get(mfaKey(token));
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw) as MfaSession;
        if (parsed.expiresAt < Date.now()) {
          await redisCacheClient.del(mfaKey(token));
          return null;
        }
        return parsed;
      } catch {
        return null;
      }
    }
    const session = mfaSessionFallback.get(token);
    if (!session || session.expiresAt < Date.now()) {
      mfaSessionFallback.delete(token);
      return null;
    }
    return session;
  }

  async function deleteMfaSession(token: string): Promise<void> {
    if (await isRedisAvailable()) {
      await redisCacheClient.del(mfaKey(token));
    }
    mfaSessionFallback.delete(token);
  }

  // SEGURANÇA: Rate limiting aplicado ao login (com suporte MFA)
  app.post("/api/auth/login", loginLimiter, passport.authenticate("local"), async (req, res) => {
    const user = req.user as SelectUser;

    // Se TOTP está habilitado, não criar sessão completa — exigir segundo fator
    if (user.totpEnabled) {
      const mfaToken = randomBytes(32).toString('hex');
      await setMfaSession(mfaToken, {
        userId: user.id,
        rememberMe: req.body.rememberMe === true,
        expiresAt: Date.now() + MFA_SESSION_TTL_SECONDS * 1000,
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
        tagSessionWithUserId(req.sessionID, userData.id);

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

    const pending = await getMfaSession(mfaToken);
    if (!pending) {
      return res.status(401).json({ error: "Sessão MFA expirada. Faça login novamente." });
    }

    const user = await storage.getUser(pending.userId);
    if (!user || !user.totpSecret) {
      await deleteMfaSession(mfaToken);
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

    // Código válido — criar sessão completa (com regeneração para evitar fixation)
    await deleteMfaSession(mfaToken);

    req.session.regenerate((regenErr) => {
      if (regenErr) {
        logger.error({ err: regenErr }, "Session regeneration error (TOTP verify)");
      }
      req.login(user, (err) => {
        if (err) return res.status(500).json({ error: "Erro ao criar sessão" });
        tagSessionWithUserId(req.sessionID, user.id);

        if (pending.rememberMe && req.session.cookie) {
          req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
        }

        const { password, googleAccessToken, googleRefreshToken, totpSecret, totpBackupCodes, passwordResetToken, ...safeUser } = user;
        res.status(200).json(safeUser);
      });
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

    const passwordError = validatePasswordStrength(newPassword);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
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
    if (!row?.password_reset_token) {
      return res.status(400).json({ error: "Token inválido ou expirado" });
    }

    // Constant-time comparison to prevent timing attacks on token enumeration.
    let tokenMatches = false;
    try {
      const storedBuf = Buffer.from(row.password_reset_token, 'hex');
      const providedBuf = Buffer.from(hashedToken, 'hex');
      tokenMatches = storedBuf.length === providedBuf.length && timingSafeEqual(storedBuf, providedBuf);
    } catch {
      tokenMatches = false;
    }
    if (!tokenMatches) {
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

  // ─── Email verification ────────────────────────────────────────────────
  // GET para suportar clique direto no link do email (sem JS necessário).
  app.get("/api/auth/verify-email", asyncHandler(async (req: Request, res: Response) => {
    const token = req.query.token as string | undefined;
    const email = req.query.email as string | undefined;
    if (!token || !email) {
      return res.redirect("/auth/verify-email?status=missing");
    }

    const user = await storage.getUserByEmail(email);
    if (!user) {
      return res.redirect("/auth/verify-email?status=invalid");
    }
    if (user.emailVerified) {
      return res.redirect("/auth/verify-email?status=already");
    }

    const result = await db.$client.query(
      `SELECT email_verification_token, email_verification_expires FROM users WHERE id = $1`,
      [user.id],
    );
    const row = result.rows?.[0];
    if (!row?.email_verification_token) {
      return res.redirect("/auth/verify-email?status=invalid");
    }

    // Comparação constant-time do hash do token enviado vs armazenado.
    const hashedProvided = createHash("sha256").update(token).digest("hex");
    let matches = false;
    try {
      const a = Buffer.from(row.email_verification_token, "hex");
      const b = Buffer.from(hashedProvided, "hex");
      matches = a.length === b.length && timingSafeEqual(a, b);
    } catch {
      matches = false;
    }
    if (!matches) {
      return res.redirect("/auth/verify-email?status=invalid");
    }
    if (new Date(row.email_verification_expires) < new Date()) {
      return res.redirect("/auth/verify-email?status=expired");
    }

    await db.$client.query(
      `UPDATE users SET email_verified = true, email_verification_token = NULL, email_verification_expires = NULL, updated_at = NOW() WHERE id = $1`,
      [user.id],
    );
    logger.info({ userId: user.id }, "Email verified");
    return res.redirect("/auth/verify-email?status=success");
  }));

  // Reenvio do email de verificação (autenticado).
  app.post("/api/auth/resend-verification", passwordResetLimiter, asyncHandler(async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as SelectUser;
    if (user.emailVerified) {
      return res.status(400).json({ error: "E-mail já verificado." });
    }
    if (!user.email) {
      return res.status(400).json({ error: "Usuário sem e-mail cadastrado." });
    }
    await issueEmailVerificationToken(user.id, user.email);
    res.json({ success: true, message: "E-mail de verificação reenviado." });
  }));

  // ─── LGPD self-service ─────────────────────────────────────────────────
  // Exportação dos dados do próprio usuário (LGPD/GDPR direito de portabilidade).
  app.get("/api/auth/account/export", asyncHandler(async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as SelectUser;

    const fresh = await storage.getUser(user.id);
    if (!fresh) return res.status(404).json({ error: "Usuário não encontrado." });

    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, fresh.companyId));

    // Remove segredos antes de exportar.
    const {
      password,
      googleAccessToken,
      googleRefreshToken,
      totpSecret,
      totpBackupCodes,
      passwordResetToken,
      passwordResetExpires,
      emailVerificationToken,
      emailVerificationExpires,
      ...userPublic
    } = fresh as any;

    const payload = {
      exportedAt: new Date().toISOString(),
      user: userPublic,
      company: company
        ? {
            id: company.id,
            name: company.name,
            email: company.email,
            phone: company.phone,
            address: company.address,
            cnpj: company.cnpj,
            createdAt: company.createdAt,
          }
        : null,
      notice:
        "Esta exportação contém apenas seus dados de usuário e a identificação da empresa que você administra. " +
        "Para exportar dados clínicos completos (pacientes, agendamentos, prontuários), entre em contato com o suporte.",
    };

    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="dentcare-export-user-${fresh.id}-${Date.now()}.json"`,
    );
    res.send(JSON.stringify(payload, null, 2));
    logger.info({ userId: fresh.id }, "User data exported (LGPD)");
  }));

  // Soft-delete da própria conta (LGPD/GDPR direito ao apagamento).
  // Requer reautenticação por senha — não permite via OAuth-only para evitar
  // que tokens roubados causem deleção acidental.
  app.post("/api/auth/account/delete", asyncHandler(async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as SelectUser;
    const { password: confirmPassword } = req.body ?? {};

    if (!confirmPassword || typeof confirmPassword !== "string") {
      return res.status(400).json({ error: "Confirme sua senha para excluir a conta." });
    }
    const passwordOk = await comparePasswords(confirmPassword, user.password);
    if (!passwordOk) {
      return res.status(401).json({ error: "Senha incorreta." });
    }

    // Soft-delete: marca deletedAt + active=false. Não remove company nem dados clínicos.
    await db.$client.query(
      `UPDATE users SET active = false, deleted_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [user.id],
    );
    logger.warn({ userId: user.id }, "User account soft-deleted (LGPD)");

    req.logout(() => {
      req.session.destroy(() => {
        res.json({
          success: true,
          message:
            "Conta encerrada. Para excluir definitivamente os dados clínicos da sua clínica, entre em contato com o suporte.",
        });
      });
    });
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
    passport.authenticate("google", { failureRedirect: "/auth?error=google_oauth_failed" }),
    (req, res) => {
      // Novo usuário (vindo da estratégia Google) → setup wizard.
      const isNewUser = (req.user as any)?.__isNewUser === true;
      res.redirect(isNewUser ? "/setup" : "/");
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
