# Google Calendar Integration - Complete Implementation

## ✅ Status: FULLY IMPLEMENTED

The Google Calendar integration is now 100% functional with complete OAuth 2.0 flow and token storage.

---

## 📋 Changes Made

### 1. Database Schema Updates

**File:** `shared/schema.ts`

Added three new fields to the `users` table to store Google Calendar OAuth tokens:

```typescript
// New fields in users table
googleAccessToken: text("google_access_token"),     // OAuth 2.0 access token
googleRefreshToken: text("google_refresh_token"),   // OAuth 2.0 refresh token
googleTokenExpiry: timestamp("google_token_expiry"), // Access token expiration date
```

### 2. Database Migration

**Generated:** `migrations/0000_dark_jean_grey.sql`
**Manual Migration:** `server/migrations/add_google_calendar_tokens.sql`

The migration adds the necessary columns to the `users` table:

```sql
ALTER TABLE users
ADD COLUMN IF NOT EXISTS google_access_token TEXT,
ADD COLUMN IF NOT EXISTS google_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS google_token_expiry TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_users_google_calendar
ON users(google_calendar_id)
WHERE google_calendar_id IS NOT NULL;
```

### 3. Google Calendar Routes - Token Storage Implemented

**File:** `server/routes/google-calendar.routes.ts`

#### OAuth Callback - Now Saves Tokens
```typescript
// ✅ IMPLEMENTED: Saves tokens to database
await db
  .update(users)
  .set({
    googleAccessToken: tokens.accessToken,
    googleRefreshToken: tokens.refreshToken,
    googleTokenExpiry: new Date(tokens.expiryDate),
    googleCalendarId: 'primary',
  })
  .where(eq(users.id, userId));
```

#### Disconnect - Removes Tokens
```typescript
// ✅ IMPLEMENTED: Removes tokens from database
await db
  .update(users)
  .set({
    googleAccessToken: null,
    googleRefreshToken: null,
    googleTokenExpiry: null,
    googleCalendarId: null,
  })
  .where(eq(users.id, user.id));
```

#### Manual Sync - Uses Stored Tokens
```typescript
// ✅ IMPLEMENTED: Uses stored tokens to sync individual appointments
POST /api/v1/google/sync-appointment/:id
```

#### Test Connection - Uses Real Tokens
```typescript
// ✅ IMPLEMENTED: Tests connection with stored tokens
POST /api/v1/google/test-connection
```

### 4. Google Calendar Service - Helper Functions Implemented

**File:** `server/services/google-calendar.service.ts`

All three helper functions now use stored tokens from database:

#### ✅ `syncAppointmentToGoogle()`
- Fetches professional's tokens from database
- Creates event in Google Calendar
- Saves event ID back to appointment
- Fully functional

#### ✅ `updateGoogleCalendarEvent()`
- Fetches professional's tokens from database
- Updates event in Google Calendar
- Falls back to creating new event if needed
- Fully functional

#### ✅ `deleteGoogleCalendarEvent()`
- Fetches professional's tokens from database
- Deletes event from Google Calendar
- Handles already-deleted events gracefully
- Fully functional

### 5. Automatic Sync in Appointments

**File:** `server/routes/appointments.routes.ts`

All appointment operations now automatically sync with Google Calendar:

```typescript
// POST /api/v1/appointments - Create appointment
syncAppointmentToGoogle(appointment.id, appointment.professionalId, companyId)
  .catch(error => console.error('Error syncing to Google Calendar:', error));

// PATCH /api/v1/appointments/:id - Update appointment
updateGoogleCalendarEvent(parseInt(id), updatedAppointment.professionalId, companyId)
  .catch(error => console.error('Error updating Google Calendar event:', error));

// DELETE /api/v1/appointments/:id - Delete appointment
deleteGoogleCalendarEvent(appointment.googleCalendarEventId, appointment.professionalId, companyId)
  .catch(error => console.error('Error deleting Google Calendar event:', error));
```

---

## 🚀 How to Use

### Step 1: Run Database Migration

**Option A - Using Drizzle Kit (Recommended):**
```bash
npm run db:push
```

**Option B - Using psql (Manual):**
```bash
psql "$DATABASE_URL" -f server/migrations/add_google_calendar_tokens.sql
```

**Option C - Using Database Client:**
Execute the SQL from `server/migrations/add_google_calendar_tokens.sql` in your PostgreSQL client.

### Step 2: Configure Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable **Google Calendar API**
4. Create OAuth 2.0 credentials:
   - Go to APIs & Services → Credentials
   - Create OAuth 2.0 Client ID
   - Application type: Web application
   - Authorized redirect URIs:
     - Development: `http://localhost:5000/api/v1/google/callback`
     - Production: `https://yourdomain.com/api/v1/google/callback`

5. Copy Client ID and Client Secret to `.env`:
```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:5000/api/v1/google/callback
```

### Step 3: Connect Google Calendar

1. **Frontend:** Navigate to Settings → Integrations
2. Click "Connect Google Calendar"
3. User is redirected to Google OAuth consent screen
4. After authorization, tokens are saved to database
5. ✅ Google Calendar is now connected!

---

## 📡 API Endpoints

### OAuth Flow

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/google/auth` | Initiate OAuth flow |
| GET | `/api/v1/google/callback` | OAuth callback (handles code exchange) |
| POST | `/api/v1/google/disconnect` | Disconnect Google Calendar |
| GET | `/api/v1/google/status` | Check connection status |

### Manual Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/google/sync-appointment/:id` | Manually sync specific appointment |
| POST | `/api/v1/google/test-connection` | Test connection with real API call |

---

## 🔄 Automatic Sync Behavior

### Create Appointment
- **Trigger:** `POST /api/v1/appointments`
- **Action:** Creates event in Google Calendar
- **Stores:** `googleCalendarEventId` in appointment record

### Update Appointment
- **Trigger:** `PATCH /api/v1/appointments/:id`
- **Condition:** Only if `startTime`, `endTime`, or `professionalId` changed
- **Action:** Updates event in Google Calendar

### Delete Appointment
- **Trigger:** `DELETE /api/v1/appointments/:id`
- **Action:** Deletes event from Google Calendar

### Professional-Specific
- ✅ Each professional has their own Google Calendar connection
- ✅ Appointments sync to the professional's calendar
- ✅ Tokens are stored per-user (multi-tenant safe)

---

## 🔐 Security Considerations

### Token Storage
- ✅ Tokens stored in database (encrypted in transit via SSL)
- ⚠️ **IMPORTANT:** Enable PostgreSQL SSL in production
- ⚠️ **RECOMMENDATION:** Consider encrypting tokens at rest

### Token Refresh
- ✅ OAuth 2.0 refresh tokens are stored
- ✅ Service automatically refreshes expired access tokens
- ✅ `GoogleCalendarService.refreshAccessToken()` handles renewal

### Multi-Tenancy
- ✅ All queries filter by `companyId`
- ✅ Each professional can have separate Google Calendar
- ✅ Tokens are isolated per user

---

## 🧪 Testing

### Test OAuth Flow
```bash
# 1. Get auth URL
curl -H "Cookie: session=..." http://localhost:5000/api/v1/google/auth

# 2. Visit authUrl in browser, authorize, get redirected back

# 3. Check status
curl -H "Cookie: session=..." http://localhost:5000/api/v1/google/status
```

### Test Connection
```bash
curl -X POST \
  -H "Cookie: session=..." \
  http://localhost:5000/api/v1/google/test-connection
```

### Test Manual Sync
```bash
curl -X POST \
  -H "Cookie: session=..." \
  http://localhost:5000/api/v1/google/sync-appointment/123
```

---

## 📊 Database Schema

```sql
-- users table now includes:
CREATE TABLE users (
  -- ... existing fields ...
  google_calendar_id TEXT,           -- 'primary' or specific calendar ID
  google_access_token TEXT,          -- OAuth 2.0 access token
  google_refresh_token TEXT,         -- OAuth 2.0 refresh token
  google_token_expiry TIMESTAMP,     -- Token expiration timestamp
  -- ... other fields ...
);

-- Index for performance
CREATE INDEX idx_users_google_calendar
ON users(google_calendar_id)
WHERE google_calendar_id IS NOT NULL;
```

---

## ✅ Implementation Checklist

- [x] Added token fields to schema
- [x] Generated database migration
- [x] Implemented token storage in OAuth callback
- [x] Implemented token removal in disconnect
- [x] Updated `syncAppointmentToGoogle()` to use stored tokens
- [x] Updated `updateGoogleCalendarEvent()` to use stored tokens
- [x] Updated `deleteGoogleCalendarEvent()` to use stored tokens
- [x] Implemented manual sync endpoint
- [x] Implemented test connection endpoint
- [x] Automatic sync on create appointment
- [x] Automatic sync on update appointment
- [x] Automatic sync on delete appointment
- [x] Multi-tenant isolation (companyId filtering)
- [x] Error handling and logging
- [x] OAuth 2.0 refresh token support

---

## 🎯 What's Next (Optional Enhancements)

### Token Encryption at Rest
```typescript
// encrypt tokens before saving
const encryptedToken = encrypt(tokens.accessToken, SECRET_KEY);
await db.update(users).set({ googleAccessToken: encryptedToken });
```

### Bidirectional Sync (Webhooks)
```typescript
// Receive updates when events change in Google Calendar
POST /api/webhooks/google-calendar
```

### Batch Sync
```typescript
// Sync all pending appointments at once
POST /api/v1/google/sync-all-appointments
```

### Calendar Selection
```typescript
// Let users choose which calendar to sync to
GET /api/v1/google/calendars
POST /api/v1/google/select-calendar
```

---

## 📝 Notes

- The migration is **backward compatible** - existing users without tokens will work normally
- Google Calendar sync is **optional** - appointments work fine without it
- Token refresh is **automatic** - no manual intervention needed
- All sync operations are **async/non-blocking** - don't slow down API responses

---

## 🆘 Troubleshooting

### "Google Calendar not connected"
- Check that professional completed OAuth flow
- Verify tokens exist in database: `SELECT google_access_token FROM users WHERE id = X`

### "Failed to create event"
- Check Google Calendar API is enabled in Google Cloud Console
- Verify GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are correct
- Check if access token expired (should auto-refresh)

### "Connection test failed"
- Tokens may be invalid or expired
- Professional needs to reconnect via OAuth flow
- Check error logs for specific Google API error

---

**Implementation Date:** 2025-11-16
**Status:** ✅ Production Ready
**Version:** 1.0.0
