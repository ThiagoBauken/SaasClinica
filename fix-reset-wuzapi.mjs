/**
 * Script para resetar a instância Wuzapi no banco de dados
 *
 * Uso: node fix-reset-wuzapi.mjs
 *
 * Isso limpa todos os campos Wuzapi da tabela clinic_settings
 * para a empresa ID 1 (ou altere abaixo)
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const COMPANY_ID = 1; // Altere se necessário

async function resetWuzapi() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL não configurada');
    process.exit(1);
  }

  console.log('🔄 Conectando ao banco de dados...');

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    console.log(`🗑️  Limpando dados Wuzapi para companyId ${COMPANY_ID}...`);

    const result = await client.query(`
      UPDATE clinic_settings
      SET
        wuzapi_api_key = NULL,
        wuzapi_base_url = NULL,
        wuzapi_instance_id = NULL,
        wuzapi_status = 'disconnected',
        wuzapi_connected_phone = NULL,
        wuzapi_webhook_url = NULL,
        updated_at = NOW()
      WHERE company_id = $1
      RETURNING id, name
    `, [COMPANY_ID]);

    if (result.rowCount > 0) {
      console.log('✅ Instância resetada com sucesso!');
      console.log(`   Clínica: ${result.rows[0].name}`);
      console.log('');
      console.log('📱 Agora você pode:');
      console.log('   1. Ir em Integrações → WhatsApp');
      console.log('   2. Clicar em "Conectar"');
      console.log('   3. Escanear o novo QR Code');
    } else {
      console.log('⚠️  Nenhum registro encontrado para companyId', COMPANY_ID);
    }
  } finally {
    await client.end();
  }
}

resetWuzapi().catch(console.error);
