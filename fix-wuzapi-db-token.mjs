// Script para salvar o token do Wuzapi existente no banco de dados
import pg from 'pg';

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/dental_clinic';

const pool = new Pool({
  connectionString: DATABASE_URL,
});

async function fixWuzapiToken() {
  const client = await pool.connect();

  try {
    console.log('Conectando ao banco...');

    // Token da instância existente no Wuzapi
    const WUZAPI_TOKEN = 'OdontoBot2024SecureToken';
    const WUZAPI_BASE_URL = process.env.WUZAPI_BASE_URL || 'https://private-wuzapi.pbzgje.easypanel.host';
    const companyId = 1;

    // Verificar se clinic_settings existe para companyId
    const checkResult = await client.query(
      'SELECT id, wuzapi_api_key FROM clinic_settings WHERE company_id = $1',
      [companyId]
    );

    if (checkResult.rows.length === 0) {
      console.log('Criando registro em clinic_settings...');
      await client.query(
        `INSERT INTO clinic_settings (company_id, wuzapi_api_key, wuzapi_base_url, wuzapi_status, created_at, updated_at)
         VALUES ($1, $2, $3, 'connected', NOW(), NOW())`,
        [companyId, WUZAPI_TOKEN, WUZAPI_BASE_URL]
      );
      console.log('✅ Registro criado com token do Wuzapi');
    } else {
      console.log('Atualizando token existente...');
      console.log('Token atual:', checkResult.rows[0].wuzapi_api_key || 'NULL');

      await client.query(
        `UPDATE clinic_settings
         SET wuzapi_api_key = $1,
             wuzapi_base_url = $2,
             wuzapi_status = 'connected',
             updated_at = NOW()
         WHERE company_id = $3`,
        [WUZAPI_TOKEN, WUZAPI_BASE_URL, companyId]
      );
      console.log('✅ Token atualizado para:', WUZAPI_TOKEN);
    }

    // Verificar se funcionou
    const verifyResult = await client.query(
      'SELECT wuzapi_api_key, wuzapi_base_url, wuzapi_status FROM clinic_settings WHERE company_id = $1',
      [companyId]
    );

    console.log('\n📋 Configuração atual:');
    console.log(verifyResult.rows[0]);

    console.log('\n✅ Pronto! Agora o botão "Reconfigurar" deve funcionar.');

  } catch (error) {
    console.error('Erro:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

fixWuzapiToken();
