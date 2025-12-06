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

    // Adicionar colunas na tabela companies
    const companiesQueries = [
      `ALTER TABLE companies ADD COLUMN IF NOT EXISTS n8n_api_key TEXT`,
      `ALTER TABLE companies ADD COLUMN IF NOT EXISTS n8n_api_key_created_at TIMESTAMP`,
    ];

    for (const query of companiesQueries) {
      try {
        await client.query(query);
        console.log('OK:', query.substring(0, 60) + '...');
      } catch (e) {
        if (!e.message.includes('already exists')) {
          console.log('Aviso:', e.message);
        }
      }
    }

    // Adicionar colunas na tabela clinic_settings
    const clinicQueries = [
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS wuzapi_base_url TEXT`,
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS wuzapi_webhook_url TEXT`,
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS wuzapi_webhook_secret TEXT`,
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS wuzapi_connected_phone TEXT`,
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS wuzapi_status TEXT`,
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS wuzapi_last_sync_at TIMESTAMP`,
    ];

    for (const query of clinicQueries) {
      try {
        await client.query(query);
        console.log('OK:', query.substring(0, 60) + '...');
      } catch (e) {
        if (!e.message.includes('already exists')) {
          console.log('Aviso:', e.message);
        }
      }
    }

    console.log('\nMigracao SaaS concluida com sucesso!');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(console.error);
