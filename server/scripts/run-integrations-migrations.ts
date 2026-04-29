/**
 * Script para rodar migrations de integrações N8N
 *
 * Executa:
 * - 002_n8n_integration.sql
 * - 004b_clinic_settings_and_automation_logs.sql
 *
 * Uso:
 * npm run db:migrate-integrations
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';

const execAsync = promisify(exec);

// Configuração do banco de dados
const DB_CONFIG = {
  user: process.env.DB_USER || 'dental',
  database: process.env.DB_NAME || 'dental_clinic',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || '5432',
};

const MIGRATIONS_DIR = path.join(__dirname, '../migrations');

const INTEGRATION_MIGRATIONS = [
  '002_n8n_integration.sql',
  '004b_clinic_settings_and_automation_logs.sql',
];

async function runMigration(filename: string): Promise<void> {
  const filePath = path.join(MIGRATIONS_DIR, filename);

  if (!fs.existsSync(filePath)) {
    console.error(`❌ Migration file not found: ${filename}`);
    throw new Error(`Migration file not found: ${filename}`);
  }

  console.log(`\n🔄 Running migration: ${filename}`);
  console.log(`   File: ${filePath}`);

  try {
    const command = `psql -U ${DB_CONFIG.user} -d ${DB_CONFIG.database} -h ${DB_CONFIG.host} -p ${DB_CONFIG.port} -f "${filePath}"`;

    const { stdout, stderr } = await execAsync(command);

    if (stderr && !stderr.includes('NOTICE')) {
      console.warn(`⚠️  Warnings:`, stderr);
    }

    if (stdout) {
      console.log(`✅ Migration completed successfully`);
      if (stdout.trim()) {
        console.log(`   Output:`, stdout.substring(0, 200));
      }
    }
  } catch (error: any) {
    console.error(`❌ Migration failed: ${filename}`);
    console.error(`   Error:`, error.message);
    throw error;
  }
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║                                                           ║');
  console.log('║        MIGRATION - INTEGRAÇÕES N8N / WUZAPI              ║');
  console.log('║                                                           ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');

  console.log('\n📊 Database Configuration:');
  console.log(`   Host: ${DB_CONFIG.host}:${DB_CONFIG.port}`);
  console.log(`   Database: ${DB_CONFIG.database}`);
  console.log(`   User: ${DB_CONFIG.user}`);

  console.log(`\n📁 Migrations directory: ${MIGRATIONS_DIR}`);
  console.log(`\n📋 Migrations to run: ${INTEGRATION_MIGRATIONS.length}`);

  let successCount = 0;
  let failCount = 0;

  for (const migration of INTEGRATION_MIGRATIONS) {
    try {
      await runMigration(migration);
      successCount++;
    } catch (error) {
      failCount++;
      console.error(`\n❌ Failed to run migration: ${migration}`);
      // Continue with next migration instead of stopping
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 MIGRATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`📋 Total: ${INTEGRATION_MIGRATIONS.length}`);

  if (failCount > 0) {
    console.log('\n⚠️  Some migrations failed. Please check the errors above.');
    process.exit(1);
  } else {
    console.log('\n🎉 All integration migrations completed successfully!');
    console.log('\n📌 Next steps:');
    console.log('   1. Configure Wuzapi credentials in /configuracoes/integracoes');
    console.log('   2. Test WhatsApp connection');
    console.log('   3. Import N8N workflows from fluxosn8n ea banco/N8N/');
    console.log('   4. Configure N8N webhooks');
    console.log('   5. Test end-to-end automation');
    process.exit(0);
  }
}

// Execute
main().catch((error) => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});
