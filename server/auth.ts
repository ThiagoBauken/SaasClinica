import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual, createHash } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

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
  const isProduction = process.env.NODE_ENV === "production";

  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "dental-management-system-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 1 day
      secure: isProduction, // HTTPS obrigatório em produção
      httpOnly: true,
      sameSite: isProduction ? 'strict' : 'lax'
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // Local authentication strategy
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        // Import hardcoded users
        const { fixedUsers } = await import('./hardcodedUsers');

        // Check for hardcoded users first (easier debugging)
        const fixedUser = fixedUsers.find(u => u.username === username);
        if (fixedUser && await comparePasswords(password, fixedUser.password)) {
          console.log("Login com usuário fixo:", fixedUser.username);
          return done(null, fixedUser);
        }

        // Fall back to database authentication if not a hard-coded account
        const user = await storage.getUserByUsername(username);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false);
        } else {
          return done(null, user);
        }
      } catch (error) {
        console.error("Erro na estratégia de login:", error);
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
        async (accessToken, refreshToken, profile, done) => {
          try {
            // Check if user already exists
            let user = await storage.getUserByGoogleId(profile.id);
            
            if (user) {
              return done(null, user);
            }
            
            // Check if user exists with same email
            if (profile.emails && profile.emails.length > 0) {
              const email = profile.emails[0].value;
              user = await storage.getUserByEmail(email);
              
              if (user) {
                // Update user with Google ID
                user = await storage.updateUser(user.id, { googleId: profile.id });
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
              
              const newUser = await storage.createUser({
                username: email.split('@')[0] + '_' + Date.now().toString().slice(-4),
                password: await hashPassword(createHash('sha256').update(Math.random().toString()).digest('hex')),
                fullName: displayName,
                email: email,
                role: "dentist",
                companyId: 3,
                googleId: profile.id,
                trialEndsAt: trialEndsAt
              });
              
              return done(null, newUser);
            }
            
            return done(null, false);
          } catch (error) {
            return done(error);
          }
        }
      )
    );
  }

  passport.serializeUser((user, done) => {
    // Special handling for our fixed test users
    if (user.id === 99999 || user.id === 99998) {
      // For fixed users, store the entire user object in the session
      done(null, JSON.stringify(user));
    } else {
      // For regular users, just store the ID
      done(null, user.id);
    }
  });
  
  passport.deserializeUser(async (data: string | number, done) => {
    try {
      console.log('[AUTH] Deserializing user, data type:', typeof data, 'value:', typeof data === 'string' ? data.substring(0, 100) : data);

      if (typeof data === 'string' && (data.includes('"id":99999') || data.includes('"id":99998'))) {
        // This is one of our fixed users, parse it back from JSON
        const user = JSON.parse(data);
        console.log('[AUTH] Deserialized fixed user:', user.id);
        return done(null, user);
      }

      // Check if data is the ID of a fixed user
      if (typeof data === 'number' && (data === 99999 || data === 99998)) {
        const { fixedUsers } = await import('./hardcodedUsers');
        const user = fixedUsers.find(u => u.id === data);
        if (user) {
          console.log('[AUTH] Found fixed user by ID:', user.id);
          return done(null, user);
        }
      }

      // Regular user, fetch from database
      const user = await storage.getUser(data as number);

      if (!user) {
        // User not found - session is invalid
        console.log('[AUTH] User not found for data:', data);
        return done(new Error('User not found in database'));
      }

      done(null, user);
    } catch (error) {
      console.error('[AUTH] Deserialization error:', error);
      done(error);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        return res.status(400).send("Nome de usuário já existe");
      }

      const user = await storage.createUser({
        ...req.body,
        password: await hashPassword(req.body.password),
      });

      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json(user);
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/auth/login", passport.authenticate("local"), (req, res) => {
    res.status(200).json(req.user);
  });

  app.post("/api/login", passport.authenticate("local"), (req, res) => {
    res.status(200).json(req.user);
  });

  app.post("/api/auth/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  // Google auth routes
  app.get("/auth/google", passport.authenticate("google"));
  
  app.get(
    "/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/auth" }),
    (req, res) => {
      res.redirect("/");
    }
  );

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(req.user);
  });
}
