import { db } from '../db';

(async () => {
  console.log('🔧 Sincronizando TODAS as colunas faltantes...\n');

  const alterations = [
    // clinic_settings - AI columns
    'ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS anthropic_api_key TEXT',
    'ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS openai_model TEXT',
    'ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS local_ai_gpu_count INTEGER DEFAULT 0',
    'ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS ollama_base_url TEXT',
    'ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS local_ai_model TEXT',
    'ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS groq_api_key TEXT',
    'ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS lm_studio_base_url TEXT',
    'ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS preferred_ai_provider TEXT',

    // companies - extra columns that may be missing
    'ALTER TABLE companies ADD COLUMN IF NOT EXISTS openai_api_key TEXT',
    'ALTER TABLE companies ADD COLUMN IF NOT EXISTS anthropic_api_key TEXT',
    'ALTER TABLE companies ADD COLUMN IF NOT EXISTS plan_id INTEGER',
    'ALTER TABLE companies ADD COLUMN IF NOT EXISTS subscription_status TEXT',
    'ALTER TABLE companies ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT',
    'ALTER TABLE companies ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT',

    // appointments - confirmation columns
    'ALTER TABLE appointments ADD COLUMN IF NOT EXISTS confirmed_by_patient BOOLEAN DEFAULT false',
    'ALTER TABLE appointments ADD COLUMN IF NOT EXISTS confirmation_date TIMESTAMP',
    'ALTER TABLE appointments ADD COLUMN IF NOT EXISTS confirmation_method TEXT',
    'ALTER TABLE appointments ADD COLUMN IF NOT EXISTS payment_status TEXT',
    'ALTER TABLE appointments ADD COLUMN IF NOT EXISTS payment_amount INTEGER DEFAULT 0',
    'ALTER TABLE appointments ADD COLUMN IF NOT EXISTS paid_amount INTEGER DEFAULT 0',

    // users - extra columns
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS google_access_token TEXT',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS google_refresh_token TEXT',
  ];

  let ok = 0, skip = 0, err = 0;

  for (const sql of alterations) {
    const colName = sql.match(/ADD COLUMN IF NOT EXISTS (\w+)/)?.[1] || 'unknown';
    const tableName = sql.match(/ALTER TABLE (\w+)/)?.[1] || 'unknown';
    try {
      await db.execute(sql);
      console.log(`✅ ${tableName}.${colName}`);
      ok++;
    } catch (e: any) {
      if (e.message?.includes('already exists')) {
        console.log(`⏭️  ${tableName}.${colName} (exists)`);
        skip++;
      } else {
        console.log(`❌ ${tableName}.${colName}: ${e.message}`);
        err++;
      }
    }
  }

  console.log(`\n📊 ${ok} added, ${skip} skipped, ${err} errors\n`);
  process.exit(err > 0 ? 1 : 0);
})();
