/**
 * Teste direto de conexao com WuzAPI
 * Verifica se o token no banco ainda e valido
 */

import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const WUZAPI_BASE_URL = process.env.WUZAPI_BASE_URL || 'https://private-wuzapi.pbzgje.easypanel.host';
const WUZAPI_ADMIN_TOKEN = process.env.WUZAPI_ADMIN_TOKEN || '';

async function testConnection() {
  console.log('\n========================================');
  console.log('   TESTE DE CONEXAO WUZAPI');
  console.log('========================================\n');

  console.log(`Base URL: ${WUZAPI_BASE_URL}\n`);

  try {
    // 1. Buscar token do banco
    console.log('1. Buscando token da empresa 1 no banco...');
    const result = await pool.query('SELECT wuzapi_api_key FROM clinic_settings WHERE company_id = 1');

    if (!result.rows[0]?.wuzapi_api_key) {
      console.log('   [ERRO] Nenhum token encontrado!\n');
      return;
    }

    const token = result.rows[0].wuzapi_api_key;
    console.log(`   Token encontrado: ${token.substring(0, 10)}...\n`);

    // 2. Testar status da sessao
    console.log('2. Testando STATUS da sessao...');
    try {
      const statusResponse = await fetch(`${WUZAPI_BASE_URL}/session/status`, {
        method: 'GET',
        headers: {
          'Token': token,
        },
      });

      const statusData = await statusResponse.json();
      console.log(`   HTTP Status: ${statusResponse.status}`);
      console.log(`   Response: ${JSON.stringify(statusData, null, 2)}\n`);

      if (statusResponse.status === 401 || statusResponse.status === 403) {
        console.log('   [ERRO] Token INVALIDO ou EXPIRADO no servidor WuzAPI!');
        console.log('   O usuario pode ter sido deletado do WuzAPI.\n');
        console.log('   SOLUCAO: Limpar o token e criar nova instancia.\n');

        // Oferecer limpar
        console.log('Limpando token antigo e permitindo nova criacao...');
        await pool.query(`
          UPDATE clinic_settings
          SET wuzapi_api_key = NULL, wuzapi_status = 'disconnected', wuzapi_connected_phone = NULL
          WHERE company_id = 1
        `);
        console.log('[OK] Token limpo! Agora tente conectar novamente pelo site.\n');
      }
    } catch (error) {
      console.log(`   [ERRO] Falha ao conectar: ${error.message}\n`);
    }

    // 3. Testar ADMIN API (listar usuarios)
    console.log('3. Testando ADMIN API (listar usuarios WuzAPI)...');
    if (!WUZAPI_ADMIN_TOKEN) {
      console.log('   [AVISO] WUZAPI_ADMIN_TOKEN nao definido\n');
    } else {
      try {
        const adminResponse = await fetch(`${WUZAPI_BASE_URL}/admin/users`, {
          method: 'GET',
          headers: {
            'Authorization': WUZAPI_ADMIN_TOKEN,
          },
        });

        console.log(`   HTTP Status: ${adminResponse.status}`);

        if (adminResponse.ok) {
          const users = await adminResponse.json();
          console.log(`   Usuarios cadastrados: ${JSON.stringify(users, null, 2)}\n`);

          // Verificar se clinica-1 existe
          const clinica1 = users.find(u => u.name === 'clinica-1');
          if (clinica1) {
            console.log('   [OK] Usuario "clinica-1" existe no WuzAPI');
          } else {
            console.log('   [AVISO] Usuario "clinica-1" NAO existe no WuzAPI');
            console.log('   Sera criado automaticamente ao tentar conectar.\n');
          }
        } else {
          const errorData = await adminResponse.json().catch(() => ({}));
          console.log(`   [ERRO] ${errorData.error || 'Acesso negado'}\n`);
        }
      } catch (error) {
        console.log(`   [ERRO] ${error.message}\n`);
      }
    }

    // 4. Tentar iniciar sessao
    console.log('4. Tentando iniciar sessao (session/connect)...');
    try {
      const connectResponse = await fetch(`${WUZAPI_BASE_URL}/session/connect`, {
        method: 'POST',
        headers: {
          'Token': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          Subscribe: ['Message', 'ReadReceipt', 'Presence', 'HistorySync', 'Call'],
          Immediate: true,
        }),
      });

      const connectData = await connectResponse.json();
      console.log(`   HTTP Status: ${connectResponse.status}`);
      console.log(`   Response: ${JSON.stringify(connectData, null, 2)}\n`);

      if (connectData.data?.QRCode) {
        console.log('   [OK] QR Code gerado com sucesso!');
        console.log('   O sistema esta funcionando. Tente novamente pelo site.\n');
      } else if (connectData.data?.LoggedIn) {
        console.log('   [OK] WhatsApp ja esta conectado!\n');
      } else if (connectResponse.status === 401 || connectResponse.status === 403) {
        console.log('   [ERRO] Token invalido. Precisa recriar a instancia.\n');
      }
    } catch (error) {
      console.log(`   [ERRO] ${error.message}\n`);
    }

  } catch (error) {
    console.error('ERRO GERAL:', error.message);
  } finally {
    await pool.end();
  }
}

testConnection();
