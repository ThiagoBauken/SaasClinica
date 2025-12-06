import pg from 'pg';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false,
  });

  try {
    console.log('Conectando ao banco de dados...');
    const client = await pool.connect();
    console.log('Conexão estabelecida!');

    const sql = fs.readFileSync('./fix-missing-columns.sql', 'utf8');

    console.log('Executando migração...');
    const result = await client.query(sql);
    console.log('Migração executada com sucesso!');
    console.log(result);

    client.release();
  } catch (error) {
    console.error('Erro ao executar migração:', error);
  } finally {
    await pool.end();
  }
}

runMigration();
