import 'dotenv/config';
import { db } from '../db';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('Syncing missing tables...\n');

  // Create admin_phones if not exists
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS admin_phones (
      id SERIAL PRIMARY KEY,
      company_id INTEGER NOT NULL REFERENCES companies(id),
      name TEXT,
      phone TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      receive_urgencies BOOLEAN DEFAULT true,
      receive_daily_report BOOLEAN DEFAULT false,
      receive_new_appointments BOOLEAN DEFAULT false,
      receive_cancellations BOOLEAN DEFAULT false,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('  admin_phones: OK');

  // Create risk_alert_types if not exists
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS risk_alert_types (
      id SERIAL PRIMARY KEY,
      company_id INTEGER NOT NULL REFERENCES companies(id),
      name TEXT NOT NULL,
      description TEXT,
      severity TEXT DEFAULT 'medium',
      color TEXT DEFAULT '#EF4444',
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('  risk_alert_types: OK');

  // Create appointment_confirmation_links if not exists (for Phase 3)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS appointment_confirmation_links (
      id SERIAL PRIMARY KEY,
      company_id INTEGER NOT NULL REFERENCES companies(id),
      appointment_id INTEGER NOT NULL REFERENCES appointments(id),
      token TEXT NOT NULL UNIQUE,
      action TEXT DEFAULT 'confirm',
      expires_at TIMESTAMP NOT NULL,
      used_at TIMESTAMP,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('  appointment_confirmation_links: OK');

  // Ensure sales_opportunity_history has all needed columns
  await db.execute(sql`
    ALTER TABLE sales_opportunity_history
    ADD COLUMN IF NOT EXISTS metadata JSONB
  `);
  console.log('  sales_opportunity_history.metadata: OK');

  // Ensure CRM tables have chat_session_id
  await db.execute(sql`
    ALTER TABLE sales_opportunities
    ADD COLUMN IF NOT EXISTS chat_session_id INTEGER REFERENCES chat_sessions(id)
  `);
  console.log('  sales_opportunities.chat_session_id: OK');

  // Ensure sales_funnel_stages has automation_trigger
  await db.execute(sql`
    ALTER TABLE sales_funnel_stages
    ADD COLUMN IF NOT EXISTS automation_trigger TEXT
  `);
  console.log('  sales_funnel_stages.automation_trigger: OK');

  console.log('\nAll tables synced successfully!');
  process.exit(0);
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
