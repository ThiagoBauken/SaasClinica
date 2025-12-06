import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function updateToken() {
  const client = await pool.connect();

  try {
    console.log('🔄 Atualizando token Wuzapi no banco...');

    // Atualizar o token da clinica 1 com o token que criamos
    const result = await client.query(`
      UPDATE clinic_settings
      SET
        wuzapi_api_key = 'OdontoBot2024SecureToken',
        wuzapi_base_url = 'https://private-wuzapi.pbzgje.easypanel.host',
        wuzapi_instance_id = 'odontobot-clinic-1',
        wuzapi_webhook_url = 'https://odontobot-clinicasite.pbzgje.easypanel.host/api/webhooks/wuzapi/1',
        wuzapi_status = 'disconnected',
        updated_at = NOW()
      WHERE company_id = 1
      RETURNING id, company_id, wuzapi_api_key
    `);

    console.log('✅ Token atualizado:', result.rows);

    // Verificar configuração
    const check = await client.query(`
      SELECT company_id, wuzapi_api_key, wuzapi_base_url, wuzapi_instance_id, wuzapi_status
      FROM clinic_settings
      WHERE company_id = 1
    `);
    console.log('\n📊 Configuração atual:');
    console.log(check.rows[0]);

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

updateToken();
