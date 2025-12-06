import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

async function migrate() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const client = await pool.connect();

  try {
    console.log('Conectado ao banco de dados...');
    console.log('Executando migração completa de colunas faltantes...\n');

    const queries = [
      // ========== NOTIFICATIONS ==========
      `ALTER TABLE notifications ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal'`,
      `ALTER TABLE notifications ADD COLUMN IF NOT EXISTS category TEXT`,
      `ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_url TEXT`,
      `ALTER TABLE notifications ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP`,

      // ========== PATIENTS ==========
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS last_review_requested_at TIMESTAMP`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS average_rating NUMERIC(3,2)`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS source TEXT`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS marketing_consent BOOLEAN DEFAULT false`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS sms_consent BOOLEAN DEFAULT true`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS email_consent BOOLEAN DEFAULT true`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS whatsapp_consent BOOLEAN DEFAULT true`,

      // ========== PROCEDURES ==========
      `ALTER TABLE procedures ADD COLUMN IF NOT EXISTS category TEXT`,
      `ALTER TABLE procedures ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`,
      `ALTER TABLE procedures ADD COLUMN IF NOT EXISTS average_duration INTEGER`,
      `ALTER TABLE procedures ADD COLUMN IF NOT EXISTS color TEXT`,
      `ALTER TABLE procedures ADD COLUMN IF NOT EXISTS requires_anesthesia BOOLEAN DEFAULT false`,

      // ========== APPOINTMENTS ==========
      `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS category TEXT`,
      `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT false`,
      `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS confirmation_sent BOOLEAN DEFAULT false`,
      `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS feedback_requested BOOLEAN DEFAULT false`,
      `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS google_event_id TEXT`,
      `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual'`,

      // ========== COMPANIES ==========
      `ALTER TABLE companies ADD COLUMN IF NOT EXISTS n8n_api_key TEXT`,
      `ALTER TABLE companies ADD COLUMN IF NOT EXISTS n8n_api_key_created_at TIMESTAMP`,
      `ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo TEXT`,
      `ALTER TABLE companies ADD COLUMN IF NOT EXISTS theme_color TEXT`,
      `ALTER TABLE companies ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trial'`,
      `ALTER TABLE companies ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP`,
      `ALTER TABLE companies ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT`,
      `ALTER TABLE companies ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT`,

      // ========== CLINIC_SETTINGS (já migrado mas garantindo) ==========
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS wuzapi_instance_id TEXT`,
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS wuzapi_api_key TEXT`,
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS wuzapi_base_url TEXT DEFAULT 'https://private-wuzapi.pbzgje.easypanel.host'`,
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS wuzapi_webhook_url TEXT`,
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS wuzapi_webhook_secret TEXT`,
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS wuzapi_connected_phone TEXT`,
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS wuzapi_status TEXT DEFAULT 'disconnected'`,
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS wuzapi_last_sync_at TIMESTAMP`,
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS chat_enabled BOOLEAN DEFAULT true`,
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS chat_welcome_message TEXT`,
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS emergency_phone TEXT`,

      // ========== USERS ==========
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{}'::jsonb`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT false`,

      // ========== CHAT SESSIONS ==========
      `CREATE TABLE IF NOT EXISTS chat_sessions (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id),
        patient_id INTEGER REFERENCES patients(id),
        phone TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        last_message_at TIMESTAMP DEFAULT NOW(),
        assigned_to INTEGER REFERENCES users(id),
        tags JSONB DEFAULT '[]'::jsonb,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )`,

      // ========== CHAT MESSAGES ==========
      `CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        session_id INTEGER REFERENCES chat_sessions(id) ON DELETE CASCADE,
        company_id INTEGER REFERENCES companies(id),
        sender_type TEXT NOT NULL,
        sender_id INTEGER,
        content TEXT,
        message_type TEXT DEFAULT 'text',
        media_url TEXT,
        wuzapi_message_id TEXT,
        status TEXT DEFAULT 'sent',
        read_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )`,

      // ========== CANNED RESPONSES ==========
      `CREATE TABLE IF NOT EXISTS canned_responses (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id),
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        shortcut TEXT,
        category TEXT,
        is_active BOOLEAN DEFAULT true,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )`,
    ];

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const query of queries) {
      try {
        await client.query(query);
        successCount++;
        // Extract meaningful part for logging
        const match = query.match(/(?:ADD COLUMN IF NOT EXISTS|CREATE TABLE IF NOT EXISTS)\s+(\w+)/i);
        const name = match ? match[1] : query.substring(0, 50);
        console.log('✅', name);
      } catch (e) {
        if (e.message.includes('already exists') || e.message.includes('duplicate')) {
          skipCount++;
        } else {
          errorCount++;
          console.log('❌ ERRO:', e.message.substring(0, 80));
        }
      }
    }

    console.log(`\n========== RESUMO ==========`);
    console.log(`✅ Sucesso: ${successCount}`);
    console.log(`⏭️  Já existentes: ${skipCount}`);
    console.log(`❌ Erros: ${errorCount}`);
    console.log(`📊 Total: ${queries.length}`);
    console.log(`\n✅ Migração concluída!`);

  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(console.error);
