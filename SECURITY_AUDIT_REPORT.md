# Security Audit Report
# Dental Clinic SaaS Application (Brazilian Market — LGPD)
# Date: 2026-04-02
# Auditor: Senior Application Security Auditor

---

## Executive Summary

This report covers a comprehensive security audit of the dental clinic SaaS application. The application manages sensitive health data subject to Brazil's Lei Geral de Proteção de Dados (LGPD), which places it in the highest risk category for data protection obligations.

The codebase demonstrates a meaningful security foundation: session-based authentication with scrypt password hashing, CSRF protection, Helmet.js security headers, rate limiting on auth endpoints, tenant isolation middleware, and structured audit logging. Several recent improvements (PINO logging, global error handler, CSRF, feature gating) show active security investment.

However, critical and high severity findings exist that require immediate remediation, particularly around unauthenticated test routes exposed in production, WebSocket identity spoofing, missing CSRF protection on two payment endpoints, timing-safe comparison gaps on API keys, and information disclosure in the health endpoint.

**Risk Score Summary**

| Severity  | Count |
|-----------|-------|
| Critical  | 2     |
| High      | 6     |
| Medium    | 8     |
| Low       | 6     |

---

## Table of Contents

1. CRITICAL Findings
2. HIGH Findings
3. MEDIUM Findings
4. LOW Findings
5. Positive Security Controls
6. LGPD Compliance Assessment
7. Remediation Priority Matrix

---

## SECTION 1: CRITICAL FINDINGS

---

### CRIT-01: Unauthenticated Test Routes Exposed in All Environments

**Severity:** Critical
**CWE:** CWE-306 (Missing Authentication for Critical Function)
**OWASP:** A01:2021 – Broken Access Control

**Description:**
The file `server/testRoutes.ts` defines three endpoints that have zero authentication and are unconditionally registered by `server/index.ts` (line 295) at startup, including production:

```
GET  /api/test/saas/companies
GET  /api/test/saas/companies/:companyId/modules
POST /api/test/saas/companies/:companyId/modules/:moduleId/toggle
```

Any unauthenticated internet user can:
1. Enumerate all companies in the SaaS database (including names, email addresses, configuration).
2. Enumerate all modules configured for any company.
3. Enable or disable modules for any company tenant, effectively sabotaging their subscription or enabling premium features without payment.

The comment in `server/index.ts` at line 294 reads "Setup test routes (temporary for SaaS testing)" — this code was never removed before going to production.

**File References:**
- `server/testRoutes.ts` — lines 4–51 (all routes unauthenticated)
- `server/index.ts` — line 295: `setupTestRoutes(app);`

**Steps to Reproduce:**
```
curl https://<production-host>/api/test/saas/companies
# Returns full company list with no auth required

curl -X POST https://<production-host>/api/test/saas/companies/2/modules/5/toggle \
  -H "Content-Type: application/json" \
  -d '{"enabled": true}'
# Enables a module for any tenant
```

**Remediation:**
Delete `server/testRoutes.ts` entirely. Remove the import and call from `server/index.ts` (lines 13 and 295). These routes must not exist in any environment. Equivalent functionality for testing is available through the authenticated `/api/saas/companies` endpoints with `authCheck + adminOnly` middleware.

**Immediate Action Required:** Remove or gate behind `NODE_ENV !== 'production'` check before any production deployment.

---

### CRIT-02: WebSocket Authentication Based on Untrusted Client-Supplied Parameters

**Severity:** Critical
**CWE:** CWE-284 (Improper Access Control) / CWE-346 (Origin Validation Error)
**OWASP:** A01:2021 – Broken Access Control

**Description:**
The WebSocket server at `/ws/notifications` authenticates connections solely by reading `userId` and `companyId` from URL query parameters, with no server-side session validation:

```typescript
// server/services/notificationService.ts, lines 36–47
const url = new URL(req.url || '', `http://${req.headers.host}`);
const userId = url.searchParams.get('userId');
const companyId = url.searchParams.get('companyId');

if (!userId || !companyId) {
  ws.close(1008, 'Unauthorized - Missing credentials');
  return;
}

ws.userId = parseInt(userId);
ws.companyId = parseInt(companyId);
```

Any authenticated user (or even unauthenticated user with knowledge of the URL format) can connect with an arbitrary `userId` and `companyId`, immediately receiving real-time notifications intended for other users and companies. This is a complete cross-tenant data leak via the notification channel.

The system sends unread notifications to the connecting WebSocket, meaning an attacker who connects with another tenant's `companyId` and a guessed user's `userId` receives those users' private clinical notifications.

**File References:**
- `server/services/notificationService.ts` — lines 32–60

**Steps to Reproduce:**
```javascript
// Attacker connects as another company's user
const ws = new WebSocket('wss://<host>/ws/notifications?userId=5&companyId=3');
ws.onmessage = (event) => console.log('Stolen notification:', event.data);
```

**Remediation:**
Replace query-parameter identity with session cookie validation. In the WebSocket upgrade handler, parse the session cookie from `req.headers.cookie` and validate it against the Redis session store before accepting the connection. The validated `userId` must come from the session, not the client.

```typescript
// Pseudocode for secure WebSocket auth
this.wss.on('connection', async (ws, req) => {
  const session = await getSessionFromCookieHeader(req.headers.cookie);
  if (!session?.userId) {
    ws.close(1008, 'Unauthorized');
    return;
  }
  ws.userId = session.userId;
  ws.companyId = session.companyId;
  // ... rest of handler
});
```

---

## SECTION 2: HIGH FINDINGS

---

### HIGH-01: Two N8N Tool Endpoints Missing Authentication Middleware

**Severity:** High
**CWE:** CWE-306 (Missing Authentication for Critical Function)
**OWASP:** A01:2021 – Broken Access Control

**Description:**
The file `server/routes/n8n-tools.routes.ts` defines 27+ endpoints. The vast majority apply `n8nAuth` middleware. However, two endpoints — `POST /generate-payment-link` (line 2597) and `POST /generate-confirmation-link` (line 2639) — omit `n8nAuth` entirely:

```typescript
// Ferramenta 24 — NO n8nAuth middleware
router.post(
  '/generate-payment-link',
  asyncHandler(async (req, res) => {           // line 2598
    const companyId = (req as any).companyId || req.body.companyId;
    ...
```

```typescript
// Ferramenta 25 — NO n8nAuth middleware
router.post(
  '/generate-confirmation-link',
  asyncHandler(async (req, res) => {           // line 2639
    const companyId = (req as any).companyId || req.body.companyId;
    ...
```

The second issue compounds this: since `req.companyId` is only set by `n8nAuth`, it will always be undefined here. The code falls back to `req.body.companyId`, meaning an unauthenticated caller supplies the target company ID. The generate-confirmation-link endpoint then inserts records into `appointmentConfirmationLinks` for arbitrary company/appointment IDs.

**Note:** These routes are currently present in `n8n-tools.routes.ts` which does not appear to be mounted in `server/routes/index.ts`. If the file is dead code, CRIT-01 and this finding are moot for those endpoints. If the router is ever mounted, these are immediately exploitable. The file should either be deleted or properly mounted — verify deployment configuration.

**File References:**
- `server/routes/n8n-tools.routes.ts` — lines 2597–2633 and 2639–2674

**Remediation:**
Add `n8nAuth` as the second argument to both route handlers:
```typescript
router.post('/generate-payment-link', n8nAuth, asyncHandler(async (req, res) => { ... }));
router.post('/generate-confirmation-link', n8nAuth, asyncHandler(async (req, res) => { ... }));
```

---

### HIGH-02: API Key Comparison Uses Non-Timing-Safe String Equality

**Severity:** High
**CWE:** CWE-208 (Observable Timing Discrepancy)
**OWASP:** A02:2021 – Cryptographic Failures

**Description:**
The `SAAS_MASTER_API_KEY` and company-specific API keys are compared with JavaScript's `===` operator throughout:

```typescript
// server/middleware/n8n-auth.ts, line 18
if (apiKey && apiKey === masterKey) { ... }

// server/routes/saas.routes.ts, line 23
if (!apiKey || apiKey !== masterKey) { ... }

// server/routes/n8n-conversation.routes.ts, line 114
if (apiKey && apiKey === masterKey) { ... }
```

JavaScript string comparison terminates early on mismatch, making the comparison time-dependent on the position of the first differing character. This creates a timing oracle that can be exploited to brute-force the master API key character by character.

The `SAAS_MASTER_API_KEY` has access to all tenant data across the entire SaaS platform, making this a high-impact target.

**File References:**
- `server/middleware/n8n-auth.ts` — line 18
- `server/routes/saas.routes.ts` — line 23
- `server/routes/n8n-conversation.routes.ts` — line 114

**Remediation:**
Replace all API key comparisons with `timingSafeEqual` from Node.js's `crypto` module:

```typescript
import { timingSafeEqual } from 'crypto';

function safeCompare(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

if (apiKey && safeCompare(apiKey, masterKey)) { ... }
```

---

### HIGH-03: Password Reset Sends Plaintext Temporary Password via Email

**Severity:** High
**CWE:** CWE-640 (Weak Password Recovery Mechanism)
**OWASP:** A07:2021 – Identification and Authentication Failures

**Description:**
There are two password reset code paths in `server/auth.ts`. The first (and apparently current production path based on code placement after the `passwordResetLimiter` application comment at line 70) generates a 4-byte (8-character hex) temporary password and sends it in the email body:

```typescript
// server/auth.ts, lines 417–420 (original implementation)
const tempPassword = randomBytes(4).toString("hex"); // 8 char temp password
...
html: `...<strong>${tempPassword}</strong>...`
```

Furthermore, in non-production mode, the plaintext temporary password is returned directly in the JSON response (line 449):
```typescript
...(process.env.NODE_ENV !== "production" && { tempPassword })
```

An 8-character hex password has only 16^8 = ~4 billion possible values, which is extremely weak by modern standards. Sending a password in an email also exposes it to email server logs, forwarding chains, and email provider breaches.

The second, better-implemented path (lines 405–499) uses a proper secure token with 30-minute expiration — but both code paths exist and the original weak path at line 417 is also applied at `/api/auth/forgot-password` with `passwordResetLimiter`.

**File References:**
- `server/auth.ts` — lines 415–451 (weak path)
- `server/auth.ts` — lines 405–499 (secure token path)

**Remediation:**
Remove the weak temporary-password path entirely. The secure token implementation (generating `randomBytes(32)`, hashing with SHA-256, storing in the database with 30-minute expiry, sending only a link) is already implemented and correct. Consolidate to only that path. Never return secrets in response bodies under any `NODE_ENV` condition.

---

### HIGH-04: Session Not Destroyed on Logout (Only Passport De-Authenticated)

**Severity:** High
**CWE:** CWE-613 (Insufficient Session Expiration)
**OWASP:** A07:2021 – Identification and Authentication Failures

**Description:**
The logout handler calls `req.logout()` but does not destroy the underlying session:

```typescript
// server/auth.ts, lines 502–509
app.post("/api/auth/logout", (req, res, next) => {
  const userId = (req.user as SelectUser)?.id;
  req.logout((err) => {
    if (err) return next(err);
    console.log(`✓ User logged out: ${userId}`);
    res.sendStatus(200);
  });
});
```

`req.logout()` removes the user object from the session but leaves the session itself active in Redis. An attacker who captures the session cookie (via XSS, physical access, network interception) can continue using it after the legitimate user logs out, because the server-side session record still exists.

**File References:**
- `server/auth.ts` — lines 502–509

**Remediation:**
Destroy the session on logout and clear the session cookie:
```typescript
app.post("/api/auth/logout", (req, res, next) => {
  const userId = (req.user as any)?.id;
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy((destroyErr) => {
      if (destroyErr) console.error('Session destroy error:', destroyErr);
      res.clearCookie('sid', { httpOnly: true, secure: isProduction });
      res.sendStatus(200);
    });
  });
});
```

---

### HIGH-05: No Session Regeneration on Login (Session Fixation)

**Severity:** High
**CWE:** CWE-384 (Session Fixation)
**OWASP:** A07:2021 – Identification and Authentication Failures

**Description:**
The login handler at `server/auth.ts` line 391 does not regenerate the session ID after successful authentication. When a user visits the application, a session is created with a guest session ID. If an attacker can set or predict this pre-login session ID (e.g., via shared device, session injection), they inherit the authenticated session after the victim logs in.

Passport.js does not automatically regenerate sessions on login.

**File References:**
- `server/auth.ts` — line 391: `app.post("/api/auth/login", loginLimiter, passport.authenticate("local"), ...)`

**Remediation:**
After `passport.authenticate` succeeds, regenerate the session before responding:
```typescript
app.post("/api/auth/login", loginLimiter, (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ error: info?.message || 'Invalid credentials' });
    req.logIn(user, (loginErr) => {
      if (loginErr) return next(loginErr);
      req.session.regenerate((regenErr) => {     // <-- CRITICAL
        if (regenErr) return next(regenErr);
        // Re-attach user to new session
        req.session.passport = { user: user.id };
        req.session.save((saveErr) => {
          if (saveErr) return next(saveErr);
          const { password, ...safeUser } = user;
          res.status(200).json(safeUser);
        });
      });
    });
  })(req, res, next);
});
```

---

### HIGH-06: CORS Wildcard for All *.easypanel.host Subdomains

**Severity:** High
**CWE:** CWE-942 (Permissive Cross-domain Policy with Untrusted Domains)
**OWASP:** A05:2021 – Security Misconfiguration

**Description:**
The CORS configuration in `server/index.ts` at line 107 automatically allows any subdomain of `easypanel.host`:

```typescript
if (origin.endsWith('.easypanel.host')) {
  return callback(null, true);
}
```

Easypanel is a shared hosting platform. Any other user of Easypanel who knows the platform's domain format can host a malicious application at `attacker-app.easypanel.host` and make credentialed cross-origin requests to this API. Because `credentials: true` is set on the CORS configuration, session cookies will be included, allowing full account takeover of any logged-in user who visits the attacker's page.

**File References:**
- `server/index.ts` — lines 106–109

**Remediation:**
Remove the wildcard subdomain allowance. Use `CORS_ORIGINS` environment variable to explicitly list all allowed production origins. In Easypanel, each application gets a fixed hostname — add only those specific hostnames:

```typescript
// Remove:
if (origin.endsWith('.easypanel.host')) {
  return callback(null, true);
}

// Replace with explicit origins in CORS_ORIGINS env var:
// CORS_ORIGINS=https://your-app.easypanel.host,https://your-custom-domain.com
```

---

## SECTION 3: MEDIUM FINDINGS

---

### MED-01: No Account Lockout After Failed Login Attempts

**Severity:** Medium
**CWE:** CWE-307 (Improper Restriction of Excessive Authentication Attempts)
**OWASP:** A07:2021 – Identification and Authentication Failures

**Description:**
The login rate limiter (`loginLimiter`, `server/auth.ts` lines 36–56) applies a per-IP limit (5 attempts / 15 minutes in production). However, there is no per-account lockout. A distributed attack using thousands of different IP addresses can attempt unlimited passwords against a specific account without triggering the rate limit on any individual IP.

There is no field in the schema for failed login counts, lockout timestamps, or suspicious login flags. The rate limiter uses the default `express-rate-limit` memory store, which resets between server restarts and is not shared across cluster workers.

**File References:**
- `server/auth.ts` — lines 36–56 (rate limiter, IP-only)
- `server/auth.ts` — lines 107–130 (LocalStrategy, no lockout logic)

**Remediation:**
1. Add a `failedLoginAttempts` and `lockedUntil` column to the `users` table.
2. In the LocalStrategy, increment the counter on failure and lock the account for 15 minutes after 10 failures.
3. Use Redis to store rate-limit state so it survives restarts and is shared across cluster workers.
4. Add a per-username/per-email rate limit using the `keyGenerator` option in `express-rate-limit`.

---

### MED-02: Health Endpoint Exposes Server Memory Metrics Without Authentication

**Severity:** Medium
**CWE:** CWE-200 (Exposure of Sensitive Information)
**OWASP:** A05:2021 – Security Misconfiguration

**Description:**
The `/health` endpoint (`server/routes/health.routes.ts`, lines 11–55) is publicly accessible without authentication and returns:
- Database service status (up/down)
- Redis service status
- Process memory usage (RSS, heap used, heap total in MB)
- System uptime in seconds

Memory metrics and uptime reveal the operational state of the server, assist in timing attacks and denial-of-service planning, and disclose whether backup services are available. This information is useful to an attacker preparing a targeted attack.

**File References:**
- `server/routes/health.routes.ts` — lines 22–44
- `server/index.ts` — lines 89–92 (health bypasses all middleware including CORS)

**Remediation:**
Separate the endpoint into two variants:
1. `/health/live` and `/health/ready` — minimal status (200/503) for load balancer probes only, no detailed data.
2. `/health/details` — full metrics behind `authCheck + adminOnly`.

Remove memory usage details from the public endpoint:
```typescript
// Public endpoint (keep minimal):
res.json({ status: 'healthy', timestamp: new Date().toISOString() });
```

---

### MED-03: Password Complexity Not Enforced at Registration

**Severity:** Medium
**CWE:** CWE-521 (Weak Password Requirements)
**OWASP:** A07:2021 – Identification and Authentication Failures

**Description:**
The `POST /api/register` endpoint (`server/auth.ts`, line 290) applies no server-side password validation beyond what is provided in `req.body`. There is no minimum length, character complexity, or common-password check enforced at the server level.

Only the password reset endpoint (`server/auth.ts`, line 465) enforces a minimum of 8 characters. Registration has no such constraint, allowing users to register with single-character passwords.

Patients' health records under LGPD require appropriate security measures — trivially weak passwords directly undermine this.

**File References:**
- `server/auth.ts` — lines 290–372 (no password validation before `hashPassword`)
- `server/auth.ts` — line 465 (reset path has 8-char minimum — inconsistent)

**Remediation:**
Add server-side password validation before creating the user:
```typescript
if (!req.body.password || req.body.password.length < 8) {
  return res.status(400).json({ error: "A senha deve ter pelo menos 8 caracteres." });
}
// Optionally add regex for complexity: uppercase, lowercase, digit
```

Apply the same rule consistently across registration, password reset, and admin-created accounts.

---

### MED-04: Content Security Policy Contains 'unsafe-inline' for Scripts in Production

**Severity:** Medium
**CWE:** CWE-693 (Protection Mechanism Failure)
**OWASP:** A05:2021 – Security Misconfiguration

**Description:**
The production CSP (`server/index.ts`, line 124) includes `'unsafe-inline'` in `scriptSrc`:

```typescript
const cspScriptSrc = isProduction
  ? ["'self'", "'unsafe-inline'"]   // production still has unsafe-inline
  : ["'self'", "'unsafe-inline'", "'unsafe-eval'"];
```

`'unsafe-inline'` permits inline `<script>` tags and inline event handlers. This makes the Content Security Policy ineffective against stored XSS attacks — any injected inline script will execute. Since this application handles PHI (Protected Health Information) under LGPD, XSS in this context can lead to credential theft, patient data exfiltration, and session hijacking.

Additionally, `styleSrc` also includes `'unsafe-inline'`, which allows CSS injection attacks.

**File References:**
- `server/index.ts` — lines 123–125, 132

**Remediation:**
Replace `'unsafe-inline'` with a nonce-based approach. Express should generate a per-request nonce and pass it to Helmet:

```typescript
app.use((req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
  next();
});

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      scriptSrc: ["'self'", (req, res) => `'nonce-${(res as any).locals.cspNonce}'`],
      ...
    }
  }
}));
```

This requires updating all inline scripts to use `<script nonce="...">`.

---

### MED-05: Avatar Upload Has No MIME Type Validation

**Severity:** Medium
**CWE:** CWE-434 (Unrestricted Upload of File with Dangerous Type)
**OWASP:** A05:2021 – Security Misconfiguration

**Description:**
The avatar upload endpoint (`server/routes.ts`, lines 1172–1188) uses multer without a `fileFilter`:

```typescript
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
  // NO fileFilter — any file type accepted
});
```

The file's `mimetype` value is used directly from the client-reported MIME type (which multer reads from the Content-Type of the multipart part — trivially spoofable) and embedded into a data URI stored in the database:

```typescript
const base64 = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
```

An attacker can upload an SVG with embedded JavaScript (served as `data:image/svg+xml`), a polyglot file, or use the data URI to exfiltrate large binary data. Since the value is stored in the database as a data URI and potentially rendered in other users' browsers (profile pictures), this creates a stored XSS vector if the CSP `img-src` allows `data:` (which it does — `imgSrc: ["'self'", "data:", ...]`).

**File References:**
- `server/routes.ts` — lines 1172–1188

**Remediation:**
Add a `fileFilter` that validates both extension and actual MIME type, and considers using magic byte inspection:
```typescript
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // Reduce to 2MB for avatars
  fileFilter: (_req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
    }
  }
});
```

Avoid embedding arbitrary `file.mimetype` into the data URI — hardcode `image/jpeg` or `image/png` based on validated type.

---

### MED-06: scrypt Used Without Explicit Work Factor Parameters

**Severity:** Medium
**CWE:** CWE-916 (Use of Password Hash With Insufficient Computational Effort)
**OWASP:** A02:2021 – Cryptographic Failures

**Description:**
The `hashPassword` function (`server/auth.ts`, lines 82–85) uses Node.js's `crypto.scrypt` with only the output length parameter of 64:

```typescript
const buf = (await scryptAsync(password, salt, 64)) as Buffer;
```

This uses Node.js's default scrypt parameters: N=16384, r=8, p=1. While these defaults are acceptable for current hardware, they are not explicitly documented in the codebase, making them invisible to future developers who might "optimize" them. Additionally, the N parameter of 16384 is at the lower end of recommendations for 2026 hardware.

More importantly, the salt is only 16 bytes (128 bits) — while acceptable, 32 bytes is the current recommendation for new implementations.

**File References:**
- `server/auth.ts` — lines 82–85, 96–98

**Remediation:**
Explicitly document the work factors and consider increasing N for new password hashes while maintaining backward compatibility:

```typescript
const SCRYPT_PARAMS = { N: 32768, r: 8, p: 1 }; // Explicit, documented
const SALT_LENGTH = 32; // 256 bits

async function hashPassword(password: string) {
  const salt = randomBytes(SALT_LENGTH).toString("hex");
  const buf = (await scryptAsync(password, salt, 64, SCRYPT_PARAMS)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}
```

---

### MED-07: Google OAuth Callback URL Defaults to HTTP in Non-Production

**Severity:** Medium
**CWE:** CWE-319 (Cleartext Transmission of Sensitive Information)
**OWASP:** A02:2021 – Cryptographic Failures

**Description:**
The Google OAuth strategy defaults to an HTTP callback URL:

```typescript
// server/auth.ts, lines 139–144
callbackURL: process.env.GOOGLE_CALLBACK_URL || "http://localhost:5000/auth/google/callback",
```

The `.env.example` specifies:
```
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback  (HTTP)
```

The OAuth state parameter and authorization code are transmitted in the callback URL. If this callback is over HTTP, both are exposed to network interception. In staging environments or when developers forget to update the env var, the authorization code flows over unencrypted HTTP.

The `BASE_URL` defaults to `http://localhost:5000` in multiple places.

**File References:**
- `server/auth.ts` — line 139
- `.env.example` — lines 53–54, 289

**Remediation:**
Enforce HTTPS for the callback URL in any non-local environment. Add a startup validation that rejects HTTP callback URLs when `NODE_ENV !== 'development'`:

```typescript
const callbackURL = process.env.GOOGLE_CALLBACK_URL;
if (!callbackURL) throw new Error('GOOGLE_CALLBACK_URL must be set');
if (isProduction && callbackURL.startsWith('http://')) {
  throw new Error('GOOGLE_CALLBACK_URL must use HTTPS in production');
}
```

---

### MED-08: Audit Log Records companyId = 0 for Unauthenticated Operations

**Severity:** Medium
**CWE:** CWE-778 (Insufficient Logging)
**OWASP:** A09:2021 – Security Logging and Monitoring Failures

**Description:**
The audit log middleware (`server/middleware/auditLog.ts`, line 161) silently inserts `companyId: 0` when the user is unauthenticated:

```typescript
companyId: companyId || 0,
```

This means any access to sensitive patient data routes by unauthenticated requests (which should be rejected by `authCheck` upstream, but could slip through configuration errors) would be logged with `companyId = 0`, making them invisible in any company-specific audit query. Under LGPD Article 37, audit logs must be accurate and attributable.

**File References:**
- `server/middleware/auditLog.ts` — line 161

**Remediation:**
If `companyId` is null on a sensitive resource access, the audit log should record this as an anomaly and the request should not proceed. Add explicit validation and flag this scenario:
```typescript
if (!companyId) {
  logger.warn({ url, method, ip: ipAddress }, 'Audit: Unauthenticated access to sensitive resource');
  // Do not proceed — the authCheck middleware should have prevented this
}
```

---

## SECTION 4: LOW FINDINGS

---

### LOW-01: No Multi-Factor Authentication (MFA) Support

**Severity:** Low
**CWE:** CWE-308 (Use of Single-Factor Authentication)
**OWASP:** A07:2021 – Identification and Authentication Failures

**Description:**
The application has no MFA implementation. The schema contains a `twoFactorEnabled: false` field in `server/clinic-apis.ts` (line 47) suggesting it was planned but never implemented. For a SaaS platform handling LGPD-protected health data, MFA is increasingly expected by security standards.

**Remediation:**
Implement TOTP-based MFA using a library such as `otpauth` or `speakeasy`. Add database columns for `mfaSecret` and `mfaEnabled`. Enforce MFA for admin and superadmin roles at minimum.

---

### LOW-02: Plaintext Hardcoded Secrets in .env.example

**Severity:** Low
**CWE:** CWE-798 (Use of Hard-coded Credentials)
**OWASP:** A02:2021 – Cryptographic Failures

**Description:**
The `.env.example` file contains what appear to be real API keys and secrets rather than placeholder values:

```
WUZAPI_ADMIN_TOKEN=fOMKUgbYd5ga1rGFn8xLygSPcmHzdEo4  (line 284)
WUZAPI_GLOBAL_HMAC_KEY=kNdcuZvLkU9I9WvYAT8gIUvjpClg8MVP  (line 297)
SAAS_MASTER_API_KEY=saas_change_this_to_a_secure_random_key  (line 263)
```

The first two values appear to be actual credentials (not placeholder format). If these are real production credentials, they are now committed to version history and should be rotated immediately. `.env.example` files are typically committed to version control and are publicly accessible in open-source repositories.

**File References:**
- `.env.example` — lines 263, 284, 297

**Remediation:**
Replace all values in `.env.example` with clearly fake placeholders:
```
WUZAPI_ADMIN_TOKEN=<your-wuzapi-admin-token-here>
WUZAPI_GLOBAL_HMAC_KEY=<32-byte-random-hex-from-your-wuzapi-instance>
```

If these were real credentials, rotate them immediately.

---

### LOW-03: Stack Traces Included in Error Responses in Non-Production

**Severity:** Low
**CWE:** CWE-209 (Generation of Error Message Containing Sensitive Information)
**OWASP:** A05:2021 – Security Misconfiguration

**Description:**
The global error handler (`server/middleware/errorHandler.ts`, line 139) includes full stack traces in responses when `NODE_ENV !== 'production'`:

```typescript
...(!isProduction && isServerError && { stack: err.stack }),
```

In staging environments, or if `NODE_ENV` is accidentally set to a non-`production` value, this exposes full server-side stack traces including file paths, module names, and line numbers. This information aids an attacker in understanding the server architecture.

**File References:**
- `server/middleware/errorHandler.ts` — line 139

**Remediation:**
Replace the binary production/non-production check with explicit environment control:
```typescript
const includeStack = process.env.DEBUG_ERRORS === 'true' && !isProduction;
...(!includeStack && isServerError && { stack: err.stack }),
```

---

### LOW-04: Request Body Size Limit Is Overly Permissive

**Severity:** Low
**CWE:** CWE-400 (Uncontrolled Resource Consumption)
**OWASP:** A05:2021 – Security Misconfiguration

**Description:**
The JSON body parser is configured with a 10MB limit (`server/index.ts`, line 241):
```typescript
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false, limit: "10mb" }));
```

For a dental clinic SaaS, most API endpoints deal with structured data (patient records, appointments). A 10MB JSON limit is excessive and allows an attacker to send large payloads to any authenticated endpoint, consuming CPU time for JSON parsing and memory allocation. Consider that `limit` here applies globally to all routes including sensitive ones.

**File References:**
- `server/index.ts` — lines 241–242

**Remediation:**
Reduce the global limit to 1MB and override to higher limits only on specific routes that require it (file upload, AI processing):
```typescript
app.use(express.json({ limit: "1mb" }));
// On specific upload routes:
app.post('/api/upload', express.json({ limit: "10mb" }), ...);
```

---

### LOW-05: Google OAuth Generates Password Using Math.random() for Placeholder

**Severity:** Low
**CWE:** CWE-338 (Use of Cryptographically Weak Pseudo-Random Number Generator)
**OWASP:** A02:2021 – Cryptographic Failures

**Description:**
When creating a new user via Google OAuth, the system generates a placeholder password using `Math.random()` as the input to SHA-256:

```typescript
// server/auth.ts, line 210
password: await hashPassword(createHash('sha256').update(Math.random().toString()).digest('hex')),
```

`Math.random()` is not cryptographically secure. While this password is theoretically never used (Google OAuth users authenticate via OAuth token), if a user's Google account is unlinked or the OAuth flow fails, the fallback local auth path would use this predictably weak password. The SHA-256 wrapping does not add entropy.

**File References:**
- `server/auth.ts` — line 210

**Remediation:**
Use `randomBytes` for the placeholder password generation:
```typescript
password: await hashPassword(randomBytes(32).toString('hex')),
```

---

### LOW-06: No HTTPS Enforcement at Application Level

**Severity:** Low
**CWE:** CWE-319 (Cleartext Transmission of Sensitive Information)
**OWASP:** A02:2021 – Cryptographic Failures

**Description:**
The application relies entirely on the reverse proxy (assumed to be Nginx or Traefik in the Easypanel deployment) for HTTPS enforcement. There is no application-level redirect from HTTP to HTTPS, and no check that the HSTS header from Helmet.js is actually being respected. The `trust proxy` is set to `1`, which is correct for a reverse proxy setup, but there is no code that rejects or redirects non-HTTPS requests at the application layer.

If the reverse proxy is misconfigured or bypassed (direct access to port 5000), all traffic including session cookies and PHI flows in plaintext.

**File References:**
- `server/auth.ts` — line 125: `app.set("trust proxy", 1)`
- `server/index.ts` — lines 144–147: HSTS headers configured but not enforced at app level

**Remediation:**
Add a redirect middleware that checks `req.protocol` and redirects HTTP to HTTPS in production:
```typescript
if (isProduction) {
  app.use((req, res, next) => {
    if (req.protocol !== 'https') {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    next();
  });
}
```

---

## SECTION 5: POSITIVE SECURITY CONTROLS

The following security controls are correctly implemented and commended.

**Authentication:**
- Session-based auth using Passport.js. No JWT tokens that could be stolen from localStorage.
- `SESSION_SECRET` validated to be >= 32 characters at startup — server refuses to start without it.
- `httpOnly: true` on session cookie prevents JavaScript access.
- `sameSite: 'strict'` in production prevents most CSRF attacks on the session cookie.
- `name: 'sid'` replaces default `connect.sid` to prevent server fingerprinting.
- Rate limiting on login (5/15min production), registration (5/1hr), and password reset (3/15min) endpoints.
- Password comparison uses `crypto.timingSafeEqual` — correct for preventing timing attacks on password verification.
- Sensitive fields (`password`, `googleAccessToken`, `googleRefreshToken`) excluded from all API responses.
- Secure password reset flow using `randomBytes(32)` token, SHA-256 hashed storage, 30-minute expiration.

**CSRF:**
- Double-submit cookie pattern correctly implemented.
- `x-api-key` requests correctly bypass CSRF (for server-to-server calls).
- Webhook endpoints correctly bypass CSRF.
- CSRF validation correctly applies only to state-changing methods (POST, PUT, PATCH, DELETE).

**Security Headers (Helmet.js):**
- `X-Content-Type-Options: nosniff` set.
- HSTS with `maxAge: 31536000`, `includeSubDomains`, `preload`.
- `X-Frame-Options` effectively set via `frameAncestors: ["'none'"]` in CSP.
- `Referrer-Policy: strict-origin-when-cross-origin`.
- `Permissions-Policy` restricts geolocation, microphone, camera.
- `objectSrc: ["'none'"]` prevents Flash/plugin attacks.
- `frameSrc: ["'none'"]` prevents clickjacking.

**Tenant Isolation:**
- `tenantIsolationMiddleware` correctly extracts `companyId` from the authenticated session (not from request parameters).
- `getCompanyId()` helper in `server/middleware/auth.ts` throws an error if `companyId` is missing rather than defaulting.
- No remaining `companyId || 1` fallbacks detected in the reviewed route files (previous issue resolved).
- `superadmin` routes correctly use router-level `authCheck + superadminOnly` middleware applied before all handlers.

**Error Handling:**
- Global error handler correctly hides internal error details in production.
- Custom error class hierarchy (`AppError`, `NotFoundError`, etc.) with structured error codes.
- Structured logging with Pino (replaces `console.log`).
- Sentry integration for production error tracking.

**Database Security:**
- Drizzle ORM used for most queries (parameterized).
- Raw SQL queries using `db.$client.query()` observed to use parameterized placeholders (`$1`, `$2`).
- No string interpolation found in raw SQL queries during review.

**LGPD Compliance:**
- `auditLogMiddleware` applied to all `/api/v1` routes capturing CRUD operations on sensitive resources.
- Data export audit logging via `auditDataExport` middleware.
- Data anonymization audit logging via `auditDataAnonymization` function.
- Patient records categorized by `dataCategory` (personal, health, financial).

**Rate Limiting:**
- Global API rate limiter: 500 requests / 15 minutes per IP applied to all `/api` routes.
- Per-endpoint rate limiters on login, registration, and password reset.
- N8N tools rate limiter: 100 requests/minute.

**File Uploads:**
- `patient-digitization.routes.ts` and `patient-import.routes.ts` implement MIME type `fileFilter`.
- `clinical-assistant.routes.ts` validates MIME type for audio uploads.
- File size limits enforced across upload endpoints.

---

## SECTION 6: LGPD COMPLIANCE ASSESSMENT

Brazil's LGPD (Lei 13.709/2018) applies directly to this application as it processes health data of natural persons. Health data is classified as "sensitive personal data" under Article 11, requiring stricter handling.

**Article 46 — Security Measures:**
- Partially compliant. Basic technical controls are in place (encryption in transit via HTTPS, access controls, audit logging). Critical gaps in MFA (LOW-01) and session management (HIGH-04, HIGH-05) weaken this article's compliance.

**Article 37 — Record Keeping:**
- Largely compliant. The audit log middleware captures create, read, update, delete, and export operations. The gap of `companyId = 0` on unauthenticated access (MED-08) creates an inaccurate record.

**Article 18 — Data Subject Rights:**
- Audit log captures data exports. The `auditDataExport` middleware documents data portability operations. Anonymization is tracked. No specific endpoint for "right to erasure" was reviewed in scope.

**Article 48 — Breach Notification:**
- Sentry integration provides incident detection. The error handler and process-level handlers log critical failures. There is no automated breach notification workflow in scope.

**Data Minimization (Article 6):**
- Health endpoints return full patient objects. Consider pagination and field selection (sparse fieldsets) on high-volume read endpoints to reduce unnecessary PHI exposure.

**Critical LGPD Risk:**
CRIT-02 (WebSocket cross-tenant notification leakage) directly violates Article 46 by allowing unauthorized access to health notifications. This must be remediated before the application can claim LGPD compliance.

---

## SECTION 7: REMEDIATION PRIORITY MATRIX

| ID       | Finding                                                 | Severity | Effort | Priority |
|----------|---------------------------------------------------------|----------|--------|----------|
| CRIT-01  | Unauthenticated test routes in production               | Critical | Low    | P0       |
| CRIT-02  | WebSocket auth via untrusted client parameters          | Critical | Medium | P0       |
| HIGH-04  | Session not destroyed on logout                         | High     | Low    | P1       |
| HIGH-05  | No session regeneration on login (session fixation)     | High     | Low    | P1       |
| HIGH-06  | CORS wildcard for *.easypanel.host                      | High     | Low    | P1       |
| HIGH-02  | API key timing-safe comparison                          | High     | Low    | P1       |
| HIGH-03  | Weak password reset path (temp password in email)       | High     | Low    | P1       |
| HIGH-01  | Missing n8nAuth on two endpoints                        | High     | Low    | P1       |
| MED-01   | No per-account lockout                                  | Medium   | Medium | P2       |
| MED-04   | 'unsafe-inline' in production CSP                       | Medium   | Medium | P2       |
| MED-05   | Avatar upload missing MIME validation                   | Medium   | Low    | P2       |
| MED-03   | No password complexity on registration                  | Medium   | Low    | P2       |
| MED-02   | Health endpoint leaks memory metrics                    | Medium   | Low    | P2       |
| MED-06   | scrypt without explicit work factor parameters          | Medium   | Low    | P3       |
| MED-07   | OAuth callback defaults to HTTP                         | Medium   | Low    | P3       |
| MED-08   | Audit log accepts companyId = 0                         | Medium   | Low    | P3       |
| LOW-01   | No MFA support                                          | Low      | High   | P3       |
| LOW-02   | Possible real credentials in .env.example              | Low      | Low    | P2*      |
| LOW-03   | Stack traces in non-production responses                | Low      | Low    | P3       |
| LOW-04   | 10MB body parser limit too permissive                   | Low      | Low    | P3       |
| LOW-05   | Math.random() for OAuth placeholder password            | Low      | Low    | P3       |
| LOW-06   | No app-level HTTPS enforcement                          | Low      | Low    | P3       |

*LOW-02 escalated to P2 if credentials are real and need rotation.

**P0** — Fix before next deployment. Do not deploy to production with these issues open.
**P1** — Fix within 1 sprint (1–2 weeks).
**P2** — Fix within current quarter.
**P3** — Schedule for next security improvement cycle.

---

## Key File Reference Index

| File | Security Relevance |
|------|--------------------|
| `server/auth.ts` | Authentication, session config, password hashing, rate limiting |
| `server/index.ts` | CORS, Helmet, session setup, global rate limiter |
| `server/middleware/csrf.ts` | CSRF double-submit cookie |
| `server/middleware/auth.ts` | authCheck, adminOnly, tenantAwareAuth, getCompanyId |
| `server/middleware/n8n-auth.ts` | API key auth (timing-safe comparison gap) |
| `server/middleware/auditLog.ts` | LGPD audit logging |
| `server/tenantMiddleware.ts` | Tenant isolation |
| `server/testRoutes.ts` | CRITICAL — unauthenticated test routes |
| `server/services/notificationService.ts` | CRITICAL — WebSocket auth vulnerability |
| `server/routes/n8n-tools.routes.ts` | Missing auth on two endpoints |
| `server/routes/saas.routes.ts` | Master API key comparison (non-timing-safe) |
| `server/routes/health.routes.ts` | Information disclosure |
| `server/routes/superadmin.routes.ts` | Superadmin route protection |
| `server/routes/index.ts` | Route registration (n8n-tools NOT registered here) |

---

*Report generated by security audit tooling on 2026-04-02. All findings are based on static analysis of the source code at the referenced commit state. Dynamic testing and penetration testing were not performed as part of this audit.*
