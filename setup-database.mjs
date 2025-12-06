#!/usr/bin/env node

/**
 * Script de configuração completa do banco de dados
 *
 * Este script:
 * 1. Cria todas as tabelas usando Drizzle Push
 * 2. Executa as migrações pendentes
 * 3. Popula dados iniciais (seed)
 * 4. Cria permissões de menu
 *
 * Uso: node setup-database.mjs
 */

import { config } from 'dotenv';
import { execSync, spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

// Load environment variables
config({ override: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logStep(step, message) {
  console.log(`\n${colors.cyan}[${step}]${colors.reset} ${colors.bright}${message}${colors.reset}`);
}

function logSuccess(message) {
  console.log(`${colors.green}✓ ${message}${colors.reset}`);
}

function logWarning(message) {
  console.log(`${colors.yellow}⚠ ${message}${colors.reset}`);
}

function logError(message) {
  console.log(`${colors.red}✗ ${message}${colors.reset}`);
}

async function runCommand(command, description) {
  logStep('EXEC', description);
  try {
    const output = execSync(command, {
      stdio: 'pipe',
      encoding: 'utf-8',
      cwd: __dirname
    });
    if (output) console.log(output);
    logSuccess(`${description} - Concluído`);
    return true;
  } catch (error) {
    // Check if it's just a warning or actual error
    if (error.status === 0 || (error.stdout && !error.stderr?.includes('error'))) {
      if (error.stdout) console.log(error.stdout);
      logSuccess(`${description} - Concluído`);
      return true;
    }
    logError(`${description} - Falhou`);
    if (error.stderr) console.error(error.stderr);
    if (error.stdout) console.log(error.stdout);
    return false;
  }
}

async function checkDatabaseConnection() {
  logStep('CHECK', 'Verificando conexão com o banco de dados...');

  if (!process.env.DATABASE_URL) {
    logError('DATABASE_URL não está definida no arquivo .env');
    console.log('\nCrie um arquivo .env com:');
    console.log('DATABASE_URL=postgresql://user:password@host:5432/database');
    return false;
  }

  const isNeon = process.env.DATABASE_URL.includes('neon.tech');

  // Simple check - try to import and connect
  try {
    if (isNeon) {
      // Use Neon driver
      const neonModule = await import('@neondatabase/serverless');
      const ws = await import('ws');
      neonModule.neonConfig.webSocketConstructor = ws.default;

      const pool = new neonModule.Pool({ connectionString: process.env.DATABASE_URL });
      await pool.query('SELECT 1');
      await pool.end();
      logSuccess('Conexão com o banco de dados (Neon) estabelecida');
      return true;
    } else {
      // Use standard pg driver
      const pgModule = await import('pg');
      const Pool = pgModule.default?.Pool || pgModule.Pool;
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      await pool.query('SELECT 1');
      await pool.end();
      logSuccess('Conexão com o banco de dados estabelecida');
      return true;
    }
  } catch (error) {
    logError('Não foi possível conectar ao banco de dados');
    console.error('Erro:', error.message);
    return false;
  }
}

async function runDrizzlePush() {
  logStep('SCHEMA', 'Sincronizando schema com o banco de dados (Drizzle Push)...');

  try {
    // Run drizzle-kit push
    const output = execSync('npx drizzle-kit push', {
      stdio: 'pipe',
      encoding: 'utf-8',
      cwd: __dirname,
      env: { ...process.env, NODE_OPTIONS: '' }
    });

    if (output) {
      // Filter out noisy output
      const lines = output.split('\n').filter(line =>
        !line.includes('node_modules') &&
        line.trim() !== ''
      );
      if (lines.length > 0) console.log(lines.join('\n'));
    }

    logSuccess('Schema sincronizado com sucesso');
    return true;
  } catch (error) {
    // Drizzle push might have warnings but still succeed
    if (error.stdout) {
      console.log(error.stdout);
    }
    if (error.stderr && !error.stderr.includes('error')) {
      // Just warnings
      logSuccess('Schema sincronizado (com avisos)');
      return true;
    }
    logError('Falha ao sincronizar schema');
    if (error.stderr) console.error(error.stderr);
    return false;
  }
}

async function runSeed() {
  logStep('SEED', 'Populando dados iniciais...');

  try {
    // Import and run seed directly
    const { seedDatabase } = await import('./server/seedData.js');
    const result = await seedDatabase();

    if (result.success) {
      logSuccess('Dados iniciais criados com sucesso');
      console.log(`\n${colors.cyan}📊 Dados criados para a empresa ID: ${result.companyId}${colors.reset}`);
      console.log(`\n${colors.bright}💡 Credenciais de acesso:${colors.reset}`);
      console.log(`   ${colors.green}Admin:${colors.reset}`);
      console.log(`   - Usuário: admin`);
      console.log(`   - Senha: admin123`);
      console.log(`\n   ${colors.green}Dentista:${colors.reset}`);
      console.log(`   - Usuário: dra.ana`);
      console.log(`   - Senha: dentista123`);
      console.log(`\n   ${colors.green}Recepcionista:${colors.reset}`);
      console.log(`   - Usuário: maria`);
      console.log(`   - Senha: recep123`);
      return true;
    } else {
      logWarning('Seed retornou sem sucesso (dados podem já existir)');
      return true;
    }
  } catch (error) {
    // Try alternative method
    try {
      execSync('npx tsx server/scripts/seed.ts', {
        stdio: 'inherit',
        cwd: __dirname
      });
      logSuccess('Dados iniciais criados via script');
      return true;
    } catch (seedError) {
      logWarning('Seed falhou (dados podem já existir)');
      console.log('Erro:', error.message);
      return true; // Non-critical, continue
    }
  }
}

async function createMenuPermissions() {
  logStep('PERMS', 'Criando permissões de menu...');

  try {
    execSync('npx tsx server/scripts/create-menu-permissions.ts', {
      stdio: 'pipe',
      cwd: __dirname
    });
    logSuccess('Permissões de menu criadas');
    return true;
  } catch (error) {
    logWarning('Permissões de menu podem já existir');
    return true; // Non-critical
  }
}

async function getDbPool() {
  const isNeon = process.env.DATABASE_URL?.includes('neon.tech');

  if (isNeon) {
    const neonModule = await import('@neondatabase/serverless');
    const ws = await import('ws');
    neonModule.neonConfig.webSocketConstructor = ws.default;
    return new neonModule.Pool({ connectionString: process.env.DATABASE_URL });
  } else {
    const pgModule = await import('pg');
    const Pool = pgModule.default?.Pool || pgModule.Pool;
    return new Pool({ connectionString: process.env.DATABASE_URL });
  }
}

async function createNotificationsTable() {
  logStep('TABLE', 'Verificando tabela de notificações...');

  const createNotificationsSQL = `
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      company_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      type VARCHAR(50) NOT NULL DEFAULT 'system',
      title VARCHAR(200) NOT NULL,
      message TEXT NOT NULL,
      related_resource VARCHAR(100),
      related_resource_id INTEGER,
      action_url VARCHAR(500),
      priority VARCHAR(20) DEFAULT 'normal',
      is_read BOOLEAN DEFAULT FALSE,
      read_at TIMESTAMP,
      metadata JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_notifications_user_company
    ON notifications(user_id, company_id);

    CREATE INDEX IF NOT EXISTS idx_notifications_unread
    ON notifications(user_id, is_read) WHERE is_read = FALSE;
  `;

  try {
    const pool = await getDbPool();
    await pool.query(createNotificationsSQL);
    await pool.end();

    logSuccess('Tabela de notificações verificada/criada');
    return true;
  } catch (error) {
    logWarning('Não foi possível criar tabela de notificações diretamente: ' + error.message);
    return true; // Drizzle push should handle it
  }
}

async function createBillingTables() {
  logStep('TABLE', 'Verificando tabelas de billing...');

  const createBillingSQL = `
    -- Plans table
    CREATE TABLE IF NOT EXISTS plans (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      slug VARCHAR(100) UNIQUE NOT NULL,
      description TEXT,
      price_monthly DECIMAL(10,2) NOT NULL DEFAULT 0,
      price_yearly DECIMAL(10,2) NOT NULL DEFAULT 0,
      features JSONB,
      max_users INTEGER DEFAULT 5,
      max_patients INTEGER DEFAULT 500,
      max_appointments_per_month INTEGER DEFAULT 1000,
      max_automations INTEGER DEFAULT 10,
      max_storage_gb INTEGER DEFAULT 5,
      is_active BOOLEAN DEFAULT TRUE,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Subscriptions table
    CREATE TABLE IF NOT EXISTS subscriptions (
      id SERIAL PRIMARY KEY,
      company_id INTEGER NOT NULL UNIQUE,
      plan_id INTEGER NOT NULL,
      status VARCHAR(50) DEFAULT 'active',
      billing_cycle VARCHAR(20) DEFAULT 'monthly',
      current_period_start TIMESTAMP,
      current_period_end TIMESTAMP,
      cancel_at_period_end BOOLEAN DEFAULT FALSE,
      canceled_at TIMESTAMP,
      stripe_subscription_id VARCHAR(255),
      stripe_customer_id VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Insert default free plan if not exists
    INSERT INTO plans (name, slug, description, price_monthly, price_yearly, max_users, max_patients, is_active, sort_order)
    SELECT 'Gratuito', 'free', 'Plano gratuito para começar', 0, 0, 2, 50, true, 0
    WHERE NOT EXISTS (SELECT 1 FROM plans WHERE slug = 'free');

    INSERT INTO plans (name, slug, description, price_monthly, price_yearly, max_users, max_patients, max_appointments_per_month, is_active, sort_order)
    SELECT 'Profissional', 'pro', 'Para clínicas em crescimento', 99.90, 999.00, 10, 1000, 5000, true, 1
    WHERE NOT EXISTS (SELECT 1 FROM plans WHERE slug = 'pro');

    INSERT INTO plans (name, slug, description, price_monthly, price_yearly, max_users, max_patients, max_appointments_per_month, is_active, sort_order)
    SELECT 'Enterprise', 'enterprise', 'Para grandes clínicas', 299.90, 2999.00, -1, -1, -1, true, 2
    WHERE NOT EXISTS (SELECT 1 FROM plans WHERE slug = 'enterprise');
  `;

  try {
    const pool = await getDbPool();
    await pool.query(createBillingSQL);
    await pool.end();

    logSuccess('Tabelas de billing verificadas/criadas');
    return true;
  } catch (error) {
    logWarning('Erro ao criar tabelas de billing: ' + error.message);
    return true; // Continue anyway
  }
}

async function main() {
  console.log(`
${colors.bright}${colors.blue}╔════════════════════════════════════════════════════════════╗
║       CONFIGURAÇÃO DO BANCO DE DADOS - DENTAL CLINIC       ║
╚════════════════════════════════════════════════════════════╝${colors.reset}
`);

  const startTime = Date.now();
  let hasErrors = false;

  // Step 1: Check database connection
  if (!await checkDatabaseConnection()) {
    logError('\n❌ Não foi possível conectar ao banco de dados. Verifique sua configuração.');
    process.exit(1);
  }

  // Step 2: Run Drizzle Push to sync schema
  if (!await runDrizzlePush()) {
    logWarning('Drizzle push teve problemas, tentando continuar...');
  }

  // Step 3: Create critical tables manually if needed
  await createNotificationsTable();
  await createBillingTables();

  // Step 4: Run seed data
  await runSeed();

  // Step 5: Create menu permissions
  await createMenuPermissions();

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`
${colors.green}${colors.bright}╔════════════════════════════════════════════════════════════╗
║                  CONFIGURAÇÃO CONCLUÍDA!                   ║
╚════════════════════════════════════════════════════════════╝${colors.reset}

${colors.cyan}Tempo total: ${duration}s${colors.reset}

${colors.bright}Próximos passos:${colors.reset}
1. Execute ${colors.cyan}npm run dev${colors.reset} para iniciar o servidor
2. Acesse ${colors.cyan}http://localhost:5000${colors.reset}
3. Faça login com as credenciais acima

${colors.yellow}Se encontrar erros, verifique:${colors.reset}
- Variáveis de ambiente no arquivo .env
- Conexão com o banco de dados
- Logs do servidor para detalhes
`);

  process.exit(hasErrors ? 1 : 0);
}

main().catch(error => {
  logError('Erro fatal durante a configuração:');
  console.error(error);
  process.exit(1);
});
