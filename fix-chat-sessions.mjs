import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  const client = await pool.connect();
  try {
    console.log('Adicionando colunas faltantes em chat_sessions...');

    await client.query(`ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS current_state VARCHAR(50)`);
    console.log('✓ current_state');

    await client.query(`ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS state_data JSONB`);
    console.log('✓ state_data');

    await client.query(`ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS context JSONB`);
    console.log('✓ context');

    await client.query(`ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`);
    console.log('✓ updated_at');

    console.log('\n✅ Tabela chat_sessions atualizada com sucesso!');
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
