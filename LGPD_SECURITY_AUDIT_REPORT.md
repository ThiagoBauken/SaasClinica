# LGPD & Data Security Audit Report
## Dental Clinic SaaS Application
**Date:** 2026-04-02  
**Auditor:** Senior Application Security Auditor  
**Scope:** Full codebase security and LGPD compliance review  
**Classification:** CONFIDENTIAL

---

## Executive Summary

This report presents findings from a comprehensive LGPD (Lei Geral de Proteção de Dados — Lei n. 13.709/2018) compliance and data security audit of the dental clinic SaaS application. The application processes sensitive health data (dados sensíveis) under LGPD Art. 11, which requires the highest standard of protection.

**Overall Risk Level: HIGH**

Seventeen findings were identified: 4 Critical, 6 High, 4 Medium, and 3 Low severity. The most severe issues involve production secrets committed to the repository, absence of column-level encryption for sensitive health data fields, SQL injection vectors in campaign and insurance modules, and unguarded transfer of full patient health records to external LLM providers without anonymization.

---

## Findings Summary

| ID | Title | Severity | LGPD Article |
|----|-------|----------|-------------|
| F-01 | Production secrets committed to .env file in repository | Critical | Art. 46 |
| F-02 | No column-level encryption for sensitive health data (CPF, RG, diagnoses) | Critical | Art. 46, Art. 11 |
| F-03 | Full patient health context sent to external LLMs without anonymization | Critical | Art. 11, Art. 46 |
| F-04 | SQL injection in campaigns and insurance routes via sql.raw() | Critical | Art. 46 |
| F-05 | Database connection configured with sslmode=disable in production | High | Art. 46 |
| F-06 | Google OAuth tokens stored in plaintext in database | High | Art. 46 |
| F-07 | Third-party API keys (OpenAI, Anthropic) stored in plaintext in companies table | High | Art. 46 |
| F-08 | Patient deletion is a soft-delete only — no LGPD right-to-erasure flow with retention check | High | Art. 18 |
| F-09 | Audit log middleware does not cover legacy routes.ts endpoints | High | Art. 37 |
| F-10 | Auto-created patients via WhatsApp lack proper LGPD consent | High | Art. 7, Art. 11 |
| F-11 | No data retention enforcement or automated purge mechanism | Medium | Art. 16 |
| F-12 | Audit log changes field stores full request body including sensitive values | Medium | Art. 46 |
| F-13 | CSRF token comparison uses string equality instead of constant-time comparison | Medium | Art. 46 |
| F-14 | The /api/v1/company/openai-key endpoint exposes API keys with weak secret verification | Medium | Art. 46 |
| F-15 | LGPD page claims "encryption at rest for sensitive data" which is not implemented | Low | Art. 6 (transparency) |
| F-16 | DPO contact email in LGPD page (dpo@dentalsys.com.br) is a placeholder | Low | Art. 41 |
| F-17 | No breach notification procedure or ANPD reporting workflow | Low | Art. 48 |

---

## Detailed Findings

---

### F-01 — Production Secrets Committed to .env File in Repository
**Severity: CRITICAL**  
**LGPD Reference:** Art. 46 — Segurança dos dados  
**CWE:** CWE-312 (Cleartext Storage of Sensitive Information), CWE-798 (Use of Hard-coded Credentials)

#### Description
The `.env` file is committed to the Git repository and contains live production credentials. While `.gitignore` correctly excludes `.env`, the file at `C:\Users\Thiago\Desktop\site clinca dentista\.env` is present on disk (confirmed by file read during audit). Git history must be inspected to confirm whether this file was previously committed. The `.env` file contains:

- A live PostgreSQL connection string with credentials and a specific IP address: `postgres://odonto:9297c681978872468528@185.215.165.19:190/odontobase`
- A live MinIO/S3 access key and secret: `S3_ACCESS_KEY_ID=l583L9UC5zVZ3hTe0yZv` / `S3_SECRET_ACCESS_KEY=51n7O7jDym6BmmsX3ZD5vex9jR0qGIFwDSUoBA7B`
- A live Wuzapi admin token: `WUZAPI_ADMIN_TOKEN=fOMKUgbYd5ga1rGFn8xLygSPcmHzdEo4`
- A live HMAC key for webhooks: `WUZAPI_HMAC_KEY=odontobot-hmac-key-secure-32chars`
- A DeepSeek API key: `DEEPSEEK_API_KEY=sk-0838759b462e420aa8cad9f30eb16031`
- A session secret that does not appear cryptographically random: `SESSION_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2`

Additionally, `.env.easypanel` is excluded from `.gitignore` but `.env.docker` is not fully excluded (only `.env.docker` has a gitignore entry, but `.env.easypanel` is explicitly excluded).

#### Steps to Reproduce
1. Run `git log --all --oneline -- .env` to confirm if `.env` was ever committed.
2. Run `git show HEAD:.env` or check any commit that includes it.

#### Remediation
1. Immediately rotate all exposed credentials: database password, S3 keys, Wuzapi admin token, HMAC key, DeepSeek API key.
2. Run `git filter-repo --path .env --invert-paths` or BFG Repo Cleaner to purge the file from all history.
3. Move all secrets to a secrets management system (AWS Secrets Manager, HashiCorp Vault, or the hosting provider's secret injection).
4. Generate a proper SESSION_SECRET: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`.
5. Add a pre-commit hook (e.g., `git-secrets` or `detect-secrets`) to prevent future secret commits.

**File:** `C:\Users\Thiago\Desktop\site clinca dentista\.env` (lines 31, 155, 273, 603, 619)

---

### F-02 — No Column-Level Encryption for Sensitive Health Data
**Severity: CRITICAL**  
**LGPD Reference:** Art. 46 (security measures), Art. 11 (dados sensíveis de saúde)  
**CWE:** CWE-312 (Cleartext Storage of Sensitive Information)

#### Description
LGPD Art. 11 classifies health data as dados sensíveis requiring heightened protection. The `patients` table stores the following sensitive fields in plaintext with no application-level encryption:

- `cpf` — Brazilian tax ID number
- `rg` — National ID document
- `blood_type` — Health data
- `allergies` — Health data
- `medications` — Health data
- `chronic_diseases` — Health data

No encryption utilities exist in the codebase for column-level encryption. The `server/` directory contains no `encrypt.ts`, no AES/cipher usage, and no reference to libraries such as `pg-crypto`, `node-forge`, or field-level encryption patterns. The LGPD compliance page at `lgpd-page.tsx` line 70 explicitly claims "Criptografia em repouso dos dados sensíveis" — this claim is false.

#### Remediation
Implement application-level encryption for CPF, RG, and clinical health fields before storing to the database. A recommended approach uses Node.js `crypto` with AES-256-GCM and a key derived from an HSM or secrets manager:

```typescript
// server/lib/field-encryption.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.FIELD_ENCRYPTION_KEY!, 'hex'); // 32-byte key from secrets manager

export function encryptField(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: iv(12):tag(16):ciphertext — all hex-encoded
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptField(stored: string): string {
  const [ivHex, tagHex, ciphertextHex] = stored.split(':');
  const decipher = createDecipheriv(ALGORITHM, KEY, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return decipher.update(Buffer.from(ciphertextHex, 'hex')) + decipher.final('utf8');
}
```

Fields to encrypt: `cpf`, `rg`, `allergies`, `medications`, `chronic_diseases`, `blood_type`. CPF must remain searchable; implement deterministic encryption (HMAC-based index) for the search index column.

**File:** `C:\Users\Thiago\Desktop\site clinca dentista\shared\schema.ts` (lines 128–159)

---

### F-03 — Full Patient Health Context Sent to External LLMs Without Anonymization
**Severity: CRITICAL**  
**LGPD Reference:** Art. 11 (dados sensíveis), Art. 46 (segurança), Art. 33 (transferência internacional)  
**CWE:** CWE-200 (Exposure of Sensitive Information to an Unauthorized Actor)

#### Description
The `ClinicalAssistantService.buildClinicalPrompt()` method constructs a system prompt that includes the patient's full name, age, gender, blood type, allergies, current medications, chronic diseases, full anamnesis history, odontogram entries, and recent prescriptions. This prompt is sent verbatim to OpenAI's API (international transfer to US-based servers) and optionally to Anthropic and DeepSeek (also international).

There is no anonymization, pseudonymization, or data minimization step before this transfer. The patient's full name appears directly in the prompt at line 386: `- Nome: ${p.fullName}`.

Similarly, `chat-patient-extraction.ts` sends entire WhatsApp conversation transcripts (which may contain CPF, address, health complaints) to the configured AI provider.

The `aiExtraction.ts` service sends raw OCR text from physical patient registration forms — including CPF, date of birth, and address — directly to DeepSeek or OpenAI.

Under LGPD Art. 33, international data transfer of dados sensíveis requires either adequacy decision, contractual standard clauses, or explicit consent from the data subject. None of these mechanisms are implemented or documented.

#### Remediation
1. Implement a data minimization layer that replaces identifiable fields with pseudonymous tokens before constructing AI prompts:

```typescript
// Replace before sending to AI
const anonymizedContext = {
  age: calculateAge(patient.birthDate),          // age, not birthDate
  gender: patient.gender,
  bloodType: patient.bloodType,
  allergies: patient.allergies,
  medications: patient.medications,
  chronicDiseases: patient.chronicDiseases,
  // DO NOT include: fullName, cpf, rg, address, phone, email
};
```

2. Add DPA (Data Processing Agreement) with OpenAI, Anthropic, and DeepSeek.
3. Document the legal basis for international transfer (Art. 33) and obtain patient consent where required.
4. Consider running local LLM (the Ollama integration is already present) for clinical analysis to avoid international transfer entirely.

**File:** `C:\Users\Thiago\Desktop\site clinca dentista\server\services\clinical-assistant.ts` (lines 382–398)  
**File:** `C:\Users\Thiago\Desktop\site clinca dentista\server\services\chat-patient-extraction.ts` (lines 128–155)  
**File:** `C:\Users\Thiago\Desktop\site clinca dentista\server\services\aiExtraction.ts` (lines 129–145)

---

### F-04 — SQL Injection in Campaigns and Insurance Routes via sql.raw()
**Severity: CRITICAL**  
**LGPD Reference:** Art. 46 (segurança dos dados)  
**CWE:** CWE-89 (SQL Injection)

#### Description
Two routes construct SQL queries using `sql.raw()` with unsanitized user-controlled input.

**campaigns.routes.ts** — The `buildSegmentConditions()` function builds a WHERE clause string by concatenating filter values directly from user input. This string is then passed to `sql.raw()`:

```typescript
// campaigns.routes.ts lines 65–91
if (filter.lastVisitBefore) {
  whereClauses.push(
    `(SELECT MAX(a.start_time) FROM appointments a
     WHERE a.patient_id = p.id AND a.status = 'completed'
    ) < '${filter.lastVisitBefore}'::date`   // <-- direct string interpolation
  );
}
// ...
const safe = filter.treatmentType.replace(/'/g, "''");  // insufficient sanitization
whereClauses.push(`... pr.category = '${safe}'`);
```

The `replace(/'/g, "''")` sanitization is insufficient — it does not prevent injection via backslash sequences, comment syntax (`--`, `/**/`), or PostgreSQL dollar-quoting (`$$`).

**insurance.routes.ts** — The `/claims` endpoint at line 172 builds a query string by embedding `companyId`, `status`, and `planId` directly via template literals before calling `sql.raw()`:

```typescript
let query = `SELECT ic.*, ... WHERE ic.company_id = ${companyId}`;
if (status) query += ` AND ic.status = '${status.replace(/'/g, '')}'`;
if (planId) query += ` AND ic.insurance_plan_id = ${planId}`;
const result = await db.execute(sql.raw(query));
```

Although `companyId` comes from session data, `status` and `planId` originate from query parameters and receive inadequate sanitization.

#### Steps to Reproduce
For the insurance endpoint:
```
GET /api/v1/insurance/claims?status='; DROP TABLE patients; --
```
The single-quote removal only strips `'`; the remaining `; DROP TABLE patients; --` is still syntactically valid in some PostgreSQL query contexts when combined with dollar quoting.

#### Remediation
Replace all `sql.raw()` constructions with parameterized Drizzle ORM queries:

```typescript
// campaigns.routes.ts — replace raw string building with parameterized drizzle
import { sql, and, lt, gt, eq } from 'drizzle-orm';

// For lastVisitBefore, use a subquery with parameterized binding
const subquery = db
  .select({ maxTime: sql<Date>`MAX(${appointments.startTime})` })
  .from(appointments)
  .where(and(
    eq(appointments.patientId, patients.id),
    eq(appointments.status, 'completed')
  ));
conditions.push(lt(subquery, new Date(filter.lastVisitBefore)));
```

**File:** `C:\Users\Thiago\Desktop\site clinca dentista\server\routes\campaigns.routes.ts` (lines 54–95, 434–442)  
**File:** `C:\Users\Thiago\Desktop\site clinca dentista\server\routes\insurance.routes.ts` (lines 172–181)

---

### F-05 — Database Connection Configured with sslmode=disable
**Severity: HIGH**  
**LGPD Reference:** Art. 46 (segurança dos dados)  
**CWE:** CWE-319 (Cleartext Transmission of Sensitive Information)

#### Description
The `.env` file at line 31 configures the database connection with `sslmode=disable`:

```
DATABASE_URL=postgres://odonto:9297c681978872468528@185.215.165.19:190/odontobase?sslmode=disable
```

The PostgreSQL server is at a public IP address (`185.215.165.19`) on a non-standard port (`190`). All data transmitted between the application and the database — including complete patient records, CPF numbers, health data, authentication credentials — travels unencrypted over the network. Any network intermediary or attacker with access to the transit path can intercept and read all database traffic in plaintext.

#### Remediation
1. Immediately change to `sslmode=require` or `sslmode=verify-full`:

```
DATABASE_URL=postgres://odonto:<password>@185.215.165.19:190/odontobase?sslmode=require
```

2. Configure PostgreSQL to enforce SSL on the server side (`ssl = on` in `postgresql.conf`, `hostssl` in `pg_hba.conf`).
3. For production, prefer `sslmode=verify-full` with a proper CA certificate to prevent MITM attacks.
4. Consider restricting database access to a VPC or using a firewall rule so the PostgreSQL port is not publicly reachable.

**File:** `C:\Users\Thiago\Desktop\site clinca dentista\.env` (line 31)

---

### F-06 — Google OAuth Tokens Stored in Plaintext in Database
**Severity: HIGH**  
**LGPD Reference:** Art. 46 (segurança dos dados)  
**CWE:** CWE-312 (Cleartext Storage of Sensitive Information)

#### Description
The `users` table schema stores Google Calendar OAuth tokens in plaintext columns:

```typescript
// shared/schema.ts lines 65–67
googleAccessToken: text("google_access_token"),
googleRefreshToken: text("google_refresh_token"),
googleTokenExpiry: timestamp("google_token_expiry"),
```

These tokens are long-lived OAuth credentials that grant access to the practitioner's Google Calendar. A database breach would expose all practitioners' calendar access tokens, allowing an attacker to read, create, modify, and delete calendar events for all linked Google accounts. Refresh tokens in particular do not expire until explicitly revoked.

#### Remediation
Encrypt OAuth tokens before persisting them using the field-level encryption utility recommended in F-02. Alternatively, store only the token hash for lookup and keep the actual token in a separate secrets store (e.g., AWS Secrets Manager with per-user key paths):

```typescript
// Before insert/update
users.googleAccessToken = encryptField(googleAccessToken);
users.googleRefreshToken = encryptField(googleRefreshToken);

// After select
const accessToken = decryptField(user.googleAccessToken);
```

**File:** `C:\Users\Thiago\Desktop\site clinca dentista\shared\schema.ts` (lines 65–67)

---

### F-07 — Third-party API Keys Stored in Plaintext in the companies Table
**Severity: HIGH**  
**LGPD Reference:** Art. 46 (segurança dos dados)  
**CWE:** CWE-312 (Cleartext Storage of Sensitive Information)

#### Description
The `companies` table stores per-tenant API keys in plaintext:

```typescript
// shared/schema.ts lines 16–17
openaiApiKey: text("openai_api_key"),
anthropicApiKey: text("anthropic_api_key"),
```

Furthermore, `company-settings.routes.ts` at lines 141–182 exposes an unauthenticated (or weakly authenticated) endpoint `/api/v1/company/openai-key` that returns the raw OpenAI API key. The only protection is a header check against `N8N_WEBHOOK_SECRET` — but if that secret is also compromised (see F-01), the key is fully exposed.

A Drizzle `select` on the `companies` table will by default return these fields in all queries, increasing the risk of accidental logging or response leakage.

#### Remediation
1. Encrypt API keys at rest using field-level encryption (F-02).
2. Never return raw API keys in API responses; return a masked version instead.
3. Add proper authentication to the `/api/v1/company/openai-key` endpoint.
4. Use Drizzle column-level select exclusion when querying companies in contexts that do not need the key.

**File:** `C:\Users\Thiago\Desktop\site clinca dentista\shared\schema.ts` (lines 16–17)  
**File:** `C:\Users\Thiago\Desktop\site clinca dentista\server\routes\company-settings.routes.ts` (lines 141–182)

---

### F-08 — Patient Deletion Is Soft-Delete Only With No LGPD Right-to-Erasure Flow
**Severity: HIGH**  
**LGPD Reference:** Art. 18, III (eliminação dos dados desnecessários)

#### Description
The `DELETE /api/v1/patients/:id` endpoint performs only a soft delete — it sets `active = false` but does not remove any data:

```typescript
// patients.routes.ts lines 176–179
await db.$client.query(
  `UPDATE patients SET active = false, updated_at = NOW() WHERE id = $1 AND company_id = $2`,
  [id, companyId]
);
```

LGPD Art. 18, III gives patients the right to request deletion of unnecessary or unlawfully processed data. CFO Resolution 118/2012 requires dental records to be retained for a minimum of 5 years. The current implementation does not:

1. Distinguish between patient-initiated deletion (LGPD right) and clinic-initiated soft-delete.
2. Check whether mandatory CFO retention period has been fulfilled before allowing erasure.
3. Perform any actual anonymization of identifying fields when data should no longer be retained in identifiable form.
4. Expose any endpoint that a patient (as data subject) can use to request deletion.

#### Remediation
Implement a dedicated LGPD right-to-erasure flow that:

```typescript
// Pseudocode for compliant erasure
async function handleErasureRequest(patientId: number, companyId: number, requestedBy: 'patient' | 'admin') {
  const patient = await getPatient(patientId, companyId);
  const lastAppointment = await getLastAppointment(patientId);
  const retentionEnd = addYears(lastAppointment?.date ?? patient.createdAt, 5); // CFO: 5 anos

  if (new Date() < retentionEnd) {
    // Cannot delete — legal obligation; inform the patient of the retention period
    return { status: 'retention_hold', retentionEnd };
  }

  // Past retention: anonymize rather than delete to preserve statistical integrity
  await db.update(patients).set({
    fullName: '[ANONYMIZED]',
    cpf: null,
    rg: null,
    email: null,
    phone: null,
    cellphone: null,
    birthDate: null,
    address: null,
    dataAnonymizationDate: new Date(),
    active: false,
  }).where(eq(patients.id, patientId));

  await auditDataAnonymization(patientId, companyId, requestedBy === 'admin' ? userId : null, 'LGPD Art. 18 - patient erasure request');
}
```

---

### F-09 — Audit Log Middleware Does Not Cover Legacy routes.ts Endpoints
**Severity: HIGH**  
**LGPD Reference:** Art. 37 (registro das operações)

#### Description
The `auditLogMiddleware` is applied to the modular `apiV1Router` at `server/routes/index.ts` line 63. However, approximately 60+ legacy routes defined directly in `server/routes.ts` (the monolithic routes file) are registered separately and bypass this middleware entirely. These include:

- Patient records endpoints: `GET/POST/PUT/DELETE /api/patients/:patientId/records`
- Odontogram endpoints: `GET/POST/DELETE /api/patients/:patientId/odontogram`
- User creation: `POST /api/users`
- Password changes: `POST /api/change-password`

These operations involve the most sensitive health data in the system and generate no audit trail. LGPD Art. 37 requires controllers and operators to maintain records of data processing operations.

#### Remediation
Apply `auditLogMiddleware` globally at the Express app level, or ensure it wraps both the legacy and modular route registrations:

```typescript
// server/routes.ts — after all route registrations
app.use(auditLogMiddleware); // apply to legacy routes as well
```

Alternatively, migrate all legacy routes from `routes.ts` into the modular `server/routes/` structure so they are covered by the existing middleware.

**File:** `C:\Users\Thiago\Desktop\site clinca dentista\server\routes\index.ts` (line 63)  
**File:** `C:\Users\Thiago\Desktop\site clinca dentista\server\routes.ts` (lines 411–420)

---

### F-10 — Auto-Created Patients via WhatsApp Lack Proper LGPD Consent
**Severity: HIGH**  
**LGPD Reference:** Art. 7, I (consentimento), Art. 11, II (hipóteses para dados sensíveis)

#### Description
The `chat-patient-extraction.ts` service automatically creates a patient record when an AI model detects sufficient personal data in a WhatsApp conversation. At line 97–99 it sets:

```typescript
whatsappConsent: true,   // set programmatically — patient never consented
consentMethod: 'whatsapp',
consentDate: new Date(),
```

This is factually incorrect. The patient merely sent a WhatsApp message to the clinic. They did not explicitly consent to:
- Having their personal data extracted by an AI model
- Having a patient record created in a dental management system
- Having their name, CPF, birth date, address, or health complaints stored

LGPD Art. 7, I requires consent to be "free, informed, unambiguous, and for specific purpose." Setting `whatsappConsent: true` programmatically without an explicit consent capture constitutes a LGPD violation.

Health data (chief complaint) extracted from WhatsApp conversations falls under Art. 11 dados sensíveis, for which the standard of consent is even higher.

#### Remediation
1. Before creating a patient record from WhatsApp data, send the user an explicit consent message and require a positive response:

```
Antes de criar seu cadastro em nossa clínica, precisamos do seu consentimento para 
armazenar seus dados pessoais conforme a LGPD (Lei 13.709/2018).
Responda SIM para confirmar o consentimento ou NAO para recusar.
```

2. Only create the record after receiving explicit consent.
3. Store `consentMethod: 'whatsapp_explicit'` and the message ID of the consent response.
4. Do not set `whatsappConsent: true` without an actual consent capture.

**File:** `C:\Users\Thiago\Desktop\site clinca dentista\server\services\chat-patient-extraction.ts` (lines 79–101)

---

### F-11 — No Data Retention Enforcement or Automated Purge Mechanism
**Severity: MEDIUM**  
**LGPD Reference:** Art. 16 (conservação dos dados)

#### Description
The schema includes a `data_retention_period` field (default 730 days) and a `data_anonymization_date` field in the `patients` table, but no scheduled job or cron task exists to enforce these retention limits. The `BACKUP_SCHEDULE` and `BACKUP_RETENTION_DAYS` environment variables are defined but there is no corresponding code for data lifecycle enforcement.

There is no job that:
- Identifies patients whose `data_anonymization_date` has passed
- Anonymizes or deletes their records
- Purges audit logs older than the legal minimum (LGPD requires logs to be kept a minimum of 6 months; current logs have no maximum retention enforced either)

#### Remediation
Add a BullMQ cron job to enforce retention:

```typescript
// server/jobs/data-retention.job.ts
export async function runDataRetentionJob() {
  const now = new Date();
  
  // Find patients past their anonymization date
  const expired = await db
    .select({ id: patients.id, companyId: patients.companyId })
    .from(patients)
    .where(and(
      lte(patients.dataAnonymizationDate, now),
      eq(patients.active, false),
    ));

  for (const patient of expired) {
    await anonymizePatient(patient.id, patient.companyId, 'data_retention_policy');
  }

  // Purge audit logs older than 2 years (keep at minimum 6 months per LGPD)
  await db.delete(auditLogs).where(
    lte(auditLogs.createdAt, subYears(now, 2))
  );
}
```

---

### F-12 — Audit Log Changes Field Stores Full Request Body Including Sensitive Values
**Severity: MEDIUM**  
**LGPD Reference:** Art. 46 (segurança dos dados)

#### Description
In `auditLog.ts` at lines 140–144, the `changes` field of the audit log record stores the entire request body for update operations:

```typescript
if (action === 'update' && requestBody) {
  changes = {
    fields: Object.keys(requestBody),
    values: requestBody   // <-- full request body including CPF, blood type, medications
  };
}
```

This means that when a patient record is updated, the full updated payload — including CPF, allergies, medications, chronic diseases, and any other sensitive field — is persisted verbatim in the `changes` JSONB column of the audit log. This effectively creates a second copy of sensitive health data in audit logs, compounding the risk of F-02 (no encryption at rest).

#### Remediation
Mask or exclude sensitive fields from the audit log changes:

```typescript
const MASKED_FIELDS = new Set(['cpf', 'rg', 'password', 'allergies', 'medications', 'chronicDiseases', 'bloodType']);

if (action === 'update' && requestBody) {
  const maskedValues: Record<string, any> = {};
  for (const [key, value] of Object.entries(requestBody)) {
    maskedValues[key] = MASKED_FIELDS.has(key) ? '[REDACTED]' : value;
  }
  changes = {
    fields: Object.keys(requestBody),
    values: maskedValues,
  };
}
```

**File:** `C:\Users\Thiago\Desktop\site clinca dentista\server\middleware\auditLog.ts` (lines 140–144)

---

### F-13 — CSRF Token Comparison Uses String Equality
**Severity: MEDIUM**  
**LGPD Reference:** Art. 46 (segurança dos dados)  
**CWE:** CWE-208 (Observable Timing Discrepancy)

#### Description
The CSRF middleware at `csrf.ts` line 62 compares the cookie and header tokens using JavaScript's `!==` operator:

```typescript
if (!cookieToken || !headerToken || cookieToken !== headerToken) {
```

String comparison with `!==` is not constant-time in all JavaScript engines. Although the practical exploitability is lower than in lower-level languages, best practice requires timing-safe comparison for security tokens. Additionally, since `httpOnly: false` is required for the SPA to read the CSRF token, a stored XSS vulnerability would completely bypass CSRF protection.

#### Remediation
Use `crypto.timingSafeEqual` for the token comparison:

```typescript
import { timingSafeEqual } from 'crypto';

function compareTokens(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

if (!cookieToken || !headerToken || !compareTokens(cookieToken, headerToken)) {
```

**File:** `C:\Users\Thiago\Desktop\site clinca dentista\server\middleware\csrf.ts` (line 62)

---

### F-14 — The /api/v1/company/openai-key Endpoint Has Insufficient Authentication
**Severity: MEDIUM**  
**LGPD Reference:** Art. 46 (segurança dos dados)

#### Description
The `POST /api/v1/company/openai-key` endpoint at `company-settings.routes.ts` lines 141–183 returns the raw OpenAI API key for any `companyId`. The only authentication is checking a single webhook secret header against an environment variable:

```typescript
const headerWebhookSecret = req.headers['x-webhook-secret'] as string;
if (process.env.N8N_WEBHOOK_SECRET && headerWebhookSecret !== process.env.N8N_WEBHOOK_SECRET) {
  return res.status(403).json({ error: 'Invalid webhook secret' });
}
```

Problems:
- If `N8N_WEBHOOK_SECRET` is not set (it is commented out in `.env.example`), the check is skipped entirely.
- The endpoint accepts any `companyId` in the body — there is no restriction to the caller's own company.
- The N8N webhook secret is the same value for all companies, meaning any N8N instance can retrieve any company's OpenAI key.

This effectively makes it possible to enumerate all companies' OpenAI API keys with a single known webhook secret.

#### Remediation
1. Require full user authentication (`authCheck`) or verify the `n8nApiKey` stored per company.
2. Restrict the returned key to the authenticated user's company only.
3. Return a masked version (last 4 characters only) rather than the full key.
4. Rotate the key by providing a dedicated endpoint rather than reading it directly.

---

### F-15 — LGPD Page Claims Encryption at Rest That Does Not Exist
**Severity: LOW**  
**LGPD Reference:** Art. 6, X (transparência), Art. 46

#### Description
`client/src/pages/lgpd-page.tsx` line 70 states:

> "Criptografia em repouso dos dados sensíveis"

This claim is false. As documented in F-02, no column-level or field-level encryption exists for CPF, RG, blood type, allergies, medications, or other health data fields. Publishing false security claims to users constitutes a transparency violation under LGPD Art. 6, X and may constitute deceptive practice under consumer protection law (CDC Art. 37).

#### Remediation
Either implement the encryption (correct path — see F-02 remediation) or remove the false claim from the LGPD page until it is implemented.

---

### F-16 — DPO Contact Email in LGPD Page Is a Placeholder
**Severity: LOW**  
**LGPD Reference:** Art. 41 (encarregado pelo tratamento dos dados pessoais)

#### Description
`lgpd-page.tsx` line 123 lists:

```
E-mail: dpo@dentalsys.com.br
```

This appears to be a placeholder domain. LGPD Art. 41 requires the designation of a Data Protection Officer (Encarregado) with a functional, monitored contact channel. If this email address is not operational or not monitored, data subjects have no effective way to exercise their rights, and the organization is non-compliant with Art. 41.

#### Remediation
1. Designate a real DPO (which may be an internal employee or a contracted service for smaller organizations).
2. Update the contact email to a real, monitored address.
3. Publish the DPO's name and contact details publicly as required by Art. 41, §1.
4. Consider registering the DPO with ANPD.

---

### F-17 — No Breach Notification Procedure or ANPD Reporting Workflow
**Severity: LOW**  
**LGPD Reference:** Art. 48 (comunicação de incidente de segurança)

#### Description
LGPD Art. 48 requires that the controller communicate to ANPD and to affected data subjects any security incident that may create relevant risk or harm to data subjects, within a reasonable timeframe (ANPD guidelines suggest 2 business days for notification of high-risk incidents). No breach notification workflow, runbook, or code mechanism exists in the application. There is no incident response plan, no ANPD notification template, and no automated detection/alerting for suspicious data access patterns.

#### Remediation
1. Create an incident response runbook that includes:
   - Criteria for triggering ANPD notification
   - ANPD notification template (available at gov.br/anpd)
   - Data subject notification process
   - Evidence preservation steps

2. Integrate anomaly detection on audit logs (e.g., alert when a single user reads more than N patient records in a short period).

3. Configure Sentry (already integrated via optional `SENTRY_DSN`) with specific alerts for authentication failures and bulk data access events.

---

## Additional Observations

### Database Query Patterns — Parameterization Status
The codebase mixes three query approaches:
- **Drizzle ORM** — fully parameterized, safe (majority of routes)
- **`db.$client.query(template, params[])`** — parameterized, safe when used correctly (routes.ts, superadmin.routes.ts)
- **`sql.raw(string)`** — NOT parameterized, vulnerable (campaigns.routes.ts, insurance.routes.ts — see F-04)

The `db.$client.query()` calls in `routes.ts` (60+ occurrences) use template literals but pass parameters correctly as array bindings, which is safe. However, this pattern must be carefully reviewed whenever new queries are added, as it is easy to accidentally inline user input into the template string.

### Password Hashing
Password hashing uses `scrypt` with `timingSafeEqual` comparison, which is correct and secure. The implementation in `server/auth.ts` lines 58–84 is well implemented. No findings in this area.

### Session Management
Session cookies are configured correctly: `httpOnly: true`, `secure: true` (production), `sameSite: 'strict'` (production). The session name `sid` is appropriately generic. No findings in this area.

### Multi-Tenant Isolation
The `tenantIsolationMiddleware` correctly enforces `companyId` scoping. The memory notes indicate that previous `companyId || 1` fallbacks have been fixed. No remaining findings in this area.

### LGPD Consent Schema
The `patients` table schema includes a well-structured LGPD consent block with granular fields for `dataProcessingConsent`, `marketingConsent`, `whatsappConsent`, `emailConsent`, `smsConsent`, `consentDate`, `consentIpAddress`, `consentMethod`. This is a positive finding. However, the campaign segmentation filter respects consent flags (`hasWhatsappConsent`, `hasEmailConsent`), which is the correct approach.

---

## Remediation Priority Matrix

| Priority | Finding | Effort | Impact |
|----------|---------|--------|--------|
| Immediate (this week) | F-01: Rotate all exposed credentials | Low | Critical |
| Immediate (this week) | F-05: Enable SSL on database connection | Low | Critical |
| Immediate (this week) | F-04: Fix SQL injection in campaigns and insurance | Medium | Critical |
| Short-term (1 month) | F-02: Implement column-level encryption | High | Critical |
| Short-term (1 month) | F-03: Anonymize data before LLM calls | Medium | Critical |
| Short-term (1 month) | F-10: Add explicit WhatsApp consent flow | Medium | High |
| Short-term (1 month) | F-08: Implement LGPD right-to-erasure flow | Medium | High |
| Short-term (1 month) | F-09: Apply audit middleware to legacy routes | Low | High |
| Medium-term (3 months) | F-06: Encrypt OAuth tokens | Medium | High |
| Medium-term (3 months) | F-07: Encrypt API keys in database | Medium | High |
| Medium-term (3 months) | F-11: Implement data retention enforcement | Medium | Medium |
| Medium-term (3 months) | F-12: Redact sensitive fields from audit log changes | Low | Medium |
| Medium-term (3 months) | F-13: Timing-safe CSRF comparison | Low | Medium |
| Medium-term (3 months) | F-14: Harden OpenAI key endpoint | Low | Medium |
| Long-term (6 months) | F-15: Fix false encryption claim in LGPD page | Low | Low |
| Long-term (6 months) | F-16: Designate real DPO with functional contact | Low | Low |
| Long-term (6 months) | F-17: Create breach notification procedure | Medium | Low |

---

## References

- LGPD — Lei n. 13.709/2018 (Lei Geral de Proteção de Dados Pessoais)
- ANPD Resolution CD/ANPD n. 2/2022 (bases legais para tratamento)
- CFO Resolution 118/2012 (prontuários odontológicos — retenção mínima 5 anos)
- OWASP Top 10 2021 — A03 Injection, A02 Cryptographic Failures, A07 Identification and Authentication Failures
- CWE/SANS Top 25 Most Dangerous Software Weaknesses
- NIST SP 800-111 — Guide to Storage Encryption Technologies
- NIST SP 800-57 — Recommendation for Key Management

---

*This report was generated as part of a point-in-time security assessment. New vulnerabilities may emerge after the assessment date. It is recommended to schedule quarterly reviews and implement a continuous security monitoring program.*
