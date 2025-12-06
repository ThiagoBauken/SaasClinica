import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function fixWuzapiToken() {
  const client = await pool.connect();

  try {
    console.log('Verificando configuracoes atuais...');

    // Verificar configurações atuais
    const result = await client.query(`
      SELECT id, company_id, wuzapi_api_key, wuzapi_base_url
      FROM clinic_settings
      WHERE wuzapi_api_key IS NOT NULL
    `);

    console.log('Configuracoes encontradas:', result.rows);

    // Limpar tokens antigos para forçar novo provisionamento
    const updateResult = await client.query(`
      UPDATE clinic_settings
      SET wuzapi_api_key = NULL,
          wuzapi_base_url = 'https://private-wuzapi.pbzgje.easypanel.host'
      WHERE wuzapi_api_key IS NOT NULL
      RETURNING id, company_id
    `);

    console.log('Tokens limpos para:', updateResult.rows);
    console.log('Proximo acesso vai criar novas instancias automaticamente!');

  } catch (error) {
    console.error('Erro:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

fixWuzapiToken();
