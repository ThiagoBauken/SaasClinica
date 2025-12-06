/**
 * Script de Diagnostico e Correcao do WuzAPI para SuperAdmin
 *
 * Verifica:
 * 1. Se a empresa 1 existe
 * 2. Se o clinicSettings existe para empresa 1
 * 3. Se o superadmin tem companyId
 * 4. Se o WuzAPI esta configurado
 */

import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

// Conectar ao banco
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function diagnose() {
  console.log('\n========================================');
  console.log('   DIAGNOSTICO WUZAPI - SUPERADMIN');
  console.log('========================================\n');

  try {
    // 1. Verificar empresa 1
    console.log('1. Verificando EMPRESA 1...');
    const companyResult = await pool.query('SELECT * FROM companies WHERE id = 1');

    if (companyResult.rows.length === 0) {
      console.log('   [ERRO] Empresa 1 NAO EXISTE!\n');
      console.log('   Criando empresa 1...');

      await pool.query(`
        INSERT INTO companies (id, name, email, phone, active, "createdAt", "updatedAt")
        VALUES (1, 'Clinica Principal (Sistema)', 'admin@sistema.local', '(00) 0000-0000', true, NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
      `);
      console.log('   [OK] Empresa 1 criada!\n');
    } else {
      console.log(`   [OK] Empresa 1 existe: ${companyResult.rows[0].name}\n`);
    }

    // 2. Verificar clinic_settings para empresa 1
    console.log('2. Verificando CLINIC_SETTINGS para empresa 1...');
    const settingsResult = await pool.query('SELECT * FROM clinic_settings WHERE company_id = 1');

    if (settingsResult.rows.length === 0) {
      console.log('   [ERRO] clinic_settings NAO EXISTE para empresa 1!\n');
      console.log('   Criando clinic_settings...');

      await pool.query(`
        INSERT INTO clinic_settings (company_id, name, wuzapi_status, created_at, updated_at)
        VALUES (1, 'Clinica Principal', 'disconnected', NOW(), NOW())
        ON CONFLICT (company_id) DO NOTHING
      `);
      console.log('   [OK] clinic_settings criado!\n');
    } else {
      const settings = settingsResult.rows[0];
      console.log(`   [OK] clinic_settings existe`);
      console.log(`   - wuzapi_status: ${settings.wuzapi_status || 'null'}`);
      console.log(`   - wuzapi_api_key: ${settings.wuzapi_api_key ? 'CONFIGURADO' : 'NAO CONFIGURADO'}`);
      console.log(`   - wuzapi_connected_phone: ${settings.wuzapi_connected_phone || 'Nenhum'}\n`);
    }

    // 3. Verificar superadmin
    console.log('3. Verificando SUPERADMIN...');
    const adminResult = await pool.query("SELECT * FROM users WHERE username = 'superadmin'");

    if (adminResult.rows.length === 0) {
      console.log('   [ERRO] SuperAdmin NAO EXISTE!\n');
      console.log('   Execute: npx tsx create-superadmin.ts\n');
    } else {
      const admin = adminResult.rows[0];
      console.log(`   [OK] SuperAdmin existe`);
      console.log(`   - ID: ${admin.id}`);
      console.log(`   - company_id: ${admin.company_id || 'NULL (PROBLEMA!)'}`);
      console.log(`   - role: ${admin.role}\n`);

      if (!admin.company_id) {
        console.log('   [CORRIGINDO] Atualizando company_id do superadmin para 1...');
        await pool.query("UPDATE users SET company_id = 1 WHERE username = 'superadmin'");
        console.log('   [OK] SuperAdmin agora tem company_id = 1\n');
      }
    }

    // 4. Verificar variaveis de ambiente WuzAPI
    console.log('4. Verificando VARIAVEIS DE AMBIENTE...');
    console.log(`   - WUZAPI_BASE_URL: ${process.env.WUZAPI_BASE_URL || 'NAO DEFINIDO'}`);
    console.log(`   - WUZAPI_ADMIN_TOKEN: ${process.env.WUZAPI_ADMIN_TOKEN ? 'DEFINIDO' : 'NAO DEFINIDO'}`);
    console.log(`   - BASE_URL: ${process.env.BASE_URL || process.env.PUBLIC_URL || 'NAO DEFINIDO'}\n`);

    if (!process.env.WUZAPI_ADMIN_TOKEN) {
      console.log('   [AVISO] WUZAPI_ADMIN_TOKEN nao esta definido no .env');
      console.log('   Adicione: WUZAPI_ADMIN_TOKEN=seu_token_admin_aqui\n');
    }

    // 5. Resumo
    console.log('========================================');
    console.log('   RESUMO');
    console.log('========================================');

    const finalCheck = await pool.query(`
      SELECT
        c.id as company_id,
        c.name as company_name,
        cs.wuzapi_status,
        cs.wuzapi_api_key,
        u.username,
        u.company_id as user_company_id
      FROM companies c
      LEFT JOIN clinic_settings cs ON cs.company_id = c.id
      LEFT JOIN users u ON u.company_id = c.id AND u.username = 'superadmin'
      WHERE c.id = 1
    `);

    if (finalCheck.rows.length > 0) {
      const row = finalCheck.rows[0];
      console.log(`\nEmpresa: ${row.company_name} (ID: ${row.company_id})`);
      console.log(`WuzAPI Status: ${row.wuzapi_status || 'disconnected'}`);
      console.log(`WuzAPI Token: ${row.wuzapi_api_key ? 'OK' : 'Pendente (sera criado ao conectar)'}`);
      console.log(`SuperAdmin vinculado: ${row.username ? 'SIM' : 'NAO'}`);
    }

    console.log('\n========================================');
    console.log('Agora voce pode acessar a pagina de Automacoes');
    console.log('e clicar em "Conectar via QR Code"');
    console.log('========================================\n');

  } catch (error) {
    console.error('ERRO:', error.message);
  } finally {
    await pool.end();
  }
}

diagnose();
