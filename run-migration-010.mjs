import pg from 'pg';
import { config } from 'dotenv';

config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL não configurada');
  process.exit(1);
}

console.log('🔄 Conectando ao banco de dados...');

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('sslmode=require') ? { rejectUnauthorized: false } : false,
});

const migrations = [
  // Patients table
  `ALTER TABLE patients ADD COLUMN IF NOT EXISTS treatment_type TEXT`,
  `ALTER TABLE patients ADD COLUMN IF NOT EXISTS is_orthodontic_patient BOOLEAN DEFAULT FALSE`,
  `ALTER TABLE patients ADD COLUMN IF NOT EXISTS orthodontic_start_date TIMESTAMP`,
  `ALTER TABLE patients ADD COLUMN IF NOT EXISTS orthodontic_expected_end_date TIMESTAMP`,
  `ALTER TABLE patients ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'`,

  // Procedures table
  `ALTER TABLE procedures ADD COLUMN IF NOT EXISTS auto_schedule_next BOOLEAN DEFAULT FALSE`,
  `ALTER TABLE procedures ADD COLUMN IF NOT EXISTS send_reminder BOOLEAN DEFAULT TRUE`,
  `ALTER TABLE procedures ADD COLUMN IF NOT EXISTS reminder_hours_before INTEGER DEFAULT 24`,
  `ALTER TABLE procedures ADD COLUMN IF NOT EXISTS follow_up_interval_days INTEGER`,

  // Indexes
  `CREATE INDEX IF NOT EXISTS idx_patients_treatment_type ON patients(treatment_type)`,
  `CREATE INDEX IF NOT EXISTS idx_patients_is_orthodontic ON patients(is_orthodontic_patient) WHERE is_orthodontic_patient = true`,
];

async function runMigrations() {
  const client = await pool.connect();

  try {
    console.log('✅ Conectado ao banco de dados');

    for (const sql of migrations) {
      try {
        await client.query(sql);
        console.log(`✅ ${sql.substring(0, 60)}...`);
      } catch (err) {
        // Ignore errors for IF NOT EXISTS statements
        if (err.message.includes('already exists')) {
          console.log(`⏭️  Já existe: ${sql.substring(0, 50)}...`);
        } else {
          console.error(`❌ Erro: ${err.message}`);
        }
      }
    }

    console.log('\n✅ Migração 010 concluída com sucesso!');
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations().catch(err => {
  console.error('❌ Erro fatal:', err);
  process.exit(1);
});
