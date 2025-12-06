import pg from 'pg';
import crypto from 'crypto';
import { config } from 'dotenv';

config();

const DATABASE_URL = process.env.DATABASE_URL;
// Usar valores fixos para garantir URL correta
const WUZAPI_BASE_URL = 'https://private-wuzapi.pbzgje.easypanel.host';
// Token admin correto do Wuzapi (do .env do Wuzapi)
const WUZAPI_ADMIN_TOKEN = process.env.WUZAPI_ADMIN_TOKEN || 'fOMKUgbYd5ga1rGFn8xLygSPcmHzdEo4';

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL não configurada');
  process.exit(1);
}

if (!WUZAPI_ADMIN_TOKEN) {
  console.error('❌ WUZAPI_ADMIN_TOKEN não configurada');
  process.exit(1);
}

console.log('🔄 Verificando configuração Wuzapi...');
console.log(`📍 Wuzapi URL: ${WUZAPI_BASE_URL}`);
console.log(`🔑 Admin Token: ${WUZAPI_ADMIN_TOKEN.substring(0, 8)}...`);

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('sslmode=require') ? { rejectUnauthorized: false } : false,
});

async function main() {
  const client = await pool.connect();

  try {
    // 1. Listar usuários existentes no Wuzapi
    console.log('\n📋 Listando usuários no Wuzapi...');
    const listResponse = await fetch(`${WUZAPI_BASE_URL}/admin/users`, {
      method: 'GET',
      headers: {
        'Authorization': WUZAPI_ADMIN_TOKEN,
      },
    });

    const listData = await listResponse.json();
    console.log('Resposta Wuzapi /admin/users:', JSON.stringify(listData, null, 2));

    // 2. Verificar configurações no banco
    console.log('\n📊 Verificando configurações no banco...');
    const { rows: settings } = await client.query(`
      SELECT id, company_id, name, wuzapi_base_url, wuzapi_api_key, wuzapi_instance_id, wuzapi_status
      FROM clinic_settings
      LIMIT 5
    `);

    console.log('Configurações encontradas:');
    settings.forEach(s => {
      console.log(`  Company ${s.company_id}: token=${s.wuzapi_api_key?.substring(0, 8)}... status=${s.wuzapi_status}`);
    });

    // 3. Verificar empresas
    const { rows: companies } = await client.query(`
      SELECT id, name FROM companies LIMIT 5
    `);
    console.log('\nEmpresas:');
    companies.forEach(c => {
      console.log(`  ID ${c.id}: ${c.name}`);
    });

    // 4. Para cada empresa sem instância válida, criar uma nova
    for (const company of companies) {
      const setting = settings.find(s => s.company_id === company.id);

      // Testar se o token atual funciona
      if (setting?.wuzapi_api_key) {
        console.log(`\n🔍 Testando token da empresa ${company.id}...`);
        const testResponse = await fetch(`${WUZAPI_BASE_URL}/session/status`, {
          method: 'GET',
          headers: {
            'Token': setting.wuzapi_api_key,
          },
        });
        const testData = await testResponse.json();

        if (testResponse.ok) {
          console.log(`✅ Token válido para empresa ${company.id}`);
          continue;
        } else {
          console.log(`❌ Token inválido: ${testData.error}`);
        }
      }

      // Criar nova instância
      console.log(`\n🔄 Criando nova instância para empresa ${company.id} (${company.name})...`);

      const slug = company.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 25);

      const instanceName = `${slug}-${company.id}`;
      const instanceToken = crypto.randomBytes(24).toString('base64url');
      const webhookUrl = `${process.env.BASE_URL || 'https://odontobot-clinicasite.pbzgje.easypanel.host'}/api/webhooks/wuzapi/${company.id}`;

      console.log(`  Nome: ${instanceName}`);
      console.log(`  Token: ${instanceToken.substring(0, 8)}...`);
      console.log(`  Webhook: ${webhookUrl}`);

      const createResponse = await fetch(`${WUZAPI_BASE_URL}/admin/users`, {
        method: 'POST',
        headers: {
          'Authorization': WUZAPI_ADMIN_TOKEN,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: instanceName,
          token: instanceToken,
          webhook: webhookUrl,
          events: ['Message', 'ReadReceipt', 'Presence', 'HistorySync', 'Call'],
        }),
      });

      const createData = await createResponse.json();
      console.log('  Resposta:', JSON.stringify(createData));

      if (createResponse.ok || createData.error?.includes('already exists')) {
        // Se já existe, precisamos usar o token existente ou deletar e recriar
        if (createData.error?.includes('already exists')) {
          console.log('  ⚠️  Usuário já existe. Tentando atualizar token no banco...');
          // Precisamos buscar o token existente ou deletar e recriar
        } else {
          // Atualizar banco
          await client.query(`
            UPDATE clinic_settings
            SET wuzapi_base_url = $1, wuzapi_api_key = $2, wuzapi_webhook_url = $3, updated_at = NOW()
            WHERE company_id = $4
          `, [WUZAPI_BASE_URL, instanceToken, webhookUrl, company.id]);
          console.log(`  ✅ Instância criada e banco atualizado!`);
        }
      } else {
        console.log(`  ❌ Erro ao criar: ${createData.error}`);
      }
    }

    console.log('\n✅ Verificação concluída!');

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('❌ Erro fatal:', err);
  process.exit(1);
});
