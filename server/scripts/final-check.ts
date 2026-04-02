import { db } from '../db';
import { users, companies, patients, appointments, clinicSettings } from '@shared/schema';
import { eq } from 'drizzle-orm';

console.log('\n🔍 VERIFICAÇÃO FINAL DO SISTEMA\n');
console.log('='.repeat(60));

(async () => {
  const checks: { name: string; status: 'ok' | 'warning' | 'error'; message: string }[] = [];

  try {
    // 1. Database Connection
    console.log('\n📊 1. Verificando conexão com banco de dados...');
    await db.select().from(users).limit(1);
    checks.push({ name: 'Database Connection', status: 'ok', message: 'Conectado com sucesso' });
    console.log('   ✅ Banco de dados conectado');

    // 2. Superadmin User
    console.log('\n👤 2. Verificando usuário superadmin...');
    const [superadmin] = await db.select().from(users).where(eq(users.username, 'superadmin')).limit(1);
    if (superadmin && superadmin.active && superadmin.role === 'superadmin') {
      checks.push({ name: 'Superadmin User', status: 'ok', message: `Ativo (ID: ${superadmin.id})` });
      console.log(`   ✅ Superadmin ativo (ID: ${superadmin.id})`);
    } else {
      checks.push({ name: 'Superadmin User', status: 'error', message: 'Não encontrado ou inativo' });
      console.log('   ❌ Superadmin não encontrado ou inativo');
    }

    // 3. User Roles
    console.log('\n🎭 3. Verificando roles dos usuários...');
    const allUsers = await db.select({ role: users.role, active: users.active }).from(users);
    const activeUsers = allUsers.filter((u: any) => u.active);
    const roles = [...new Set(allUsers.map((u: any) => u.role))];
    checks.push({ name: 'User Roles', status: 'ok', message: `${roles.length} roles, ${activeUsers.length} usuários ativos` });
    console.log(`   ✅ ${roles.length} roles encontrados: ${roles.join(', ')}`);
    console.log(`   ✅ ${activeUsers.length} usuários ativos de ${allUsers.length} totais`);

    // 4. Companies (Multi-tenant)
    console.log('\n🏢 4. Verificando empresas (multi-tenant)...');
    const companiesList = await db.select().from(companies);
    checks.push({ name: 'Companies', status: companiesList.length > 0 ? 'ok' : 'warning', message: `${companiesList.length} empresas cadastradas` });
    console.log(`   ${companiesList.length > 0 ? '✅' : '⚠️'} ${companiesList.length} empresas cadastradas`);

    // 5. Patients
    console.log('\n🦷 5. Verificando pacientes...');
    const patientsCount = await db.select().from(patients);
    checks.push({ name: 'Patients', status: patientsCount.length > 0 ? 'ok' : 'warning', message: `${patientsCount.length} pacientes cadastrados` });
    console.log(`   ${patientsCount.length > 0 ? '✅' : '⚠️'} ${patientsCount.length} pacientes cadastrados`);

    // 6. Appointments
    console.log('\n📅 6. Verificando agendamentos...');
    const appointmentsCount = await db.select().from(appointments);
    checks.push({ name: 'Appointments', status: 'ok', message: `${appointmentsCount.length} agendamentos` });
    console.log(`   ✅ ${appointmentsCount.length} agendamentos no sistema`);

    // 7. Clinic Settings (WhatsApp integration)
    console.log('\n⚙️  7. Verificando configurações de clínicas...');
    const settings = await db.select().from(clinicSettings);
    const settingsWithWhatsApp = settings.filter((s: any) => s.wuzapiApiKey);
    checks.push({ name: 'Clinic Settings', status: 'ok', message: `${settings.length} configurações, ${settingsWithWhatsApp.length} com WhatsApp` });
    console.log(`   ✅ ${settings.length} configurações de clínicas`);
    console.log(`   ✅ ${settingsWithWhatsApp.length} clínicas com WhatsApp configurado`);

    // 8. Critical Tables Exist
    console.log('\n📋 8. Verificando tabelas críticas...');
    const criticalTables = [
      'users', 'companies', 'patients', 'appointments', 'procedures',
      'rooms', 'clinic_settings', 'sales_opportunities', 'sales_funnel_stages',
      'odontogram_entries', 'admin_phones', 'appointment_confirmation_links'
    ];

    let missingTables = 0;
    for (const table of criticalTables) {
      try {
        const result = await db.execute(`SELECT COUNT(*) FROM ${table} LIMIT 1`);
        console.log(`   ✅ Tabela ${table} existe`);
      } catch (err) {
        console.log(`   ❌ Tabela ${table} FALTANDO`);
        missingTables++;
      }
    }

    if (missingTables === 0) {
      checks.push({ name: 'Critical Tables', status: 'ok', message: `${criticalTables.length} tabelas verificadas` });
    } else {
      checks.push({ name: 'Critical Tables', status: 'error', message: `${missingTables} tabelas faltando` });
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('\n📊 RESUMO DA VERIFICAÇÃO:\n');

    const okCount = checks.filter(c => c.status === 'ok').length;
    const warningCount = checks.filter(c => c.status === 'warning').length;
    const errorCount = checks.filter(c => c.status === 'error').length;

    checks.forEach(check => {
      const icon = check.status === 'ok' ? '✅' : check.status === 'warning' ? '⚠️' : '❌';
      console.log(`${icon} ${check.name}: ${check.message}`);
    });

    console.log('\n' + '-'.repeat(60));
    console.log(`Total: ${okCount} OK, ${warningCount} Avisos, ${errorCount} Erros`);
    console.log('='.repeat(60));

    if (errorCount === 0) {
      console.log('\n🎉 SISTEMA PRONTO PARA USO!\n');
    } else {
      console.log('\n⚠️  ATENÇÃO: Corrigir erros antes de usar em produção\n');
    }

    process.exit(errorCount > 0 ? 1 : 0);

  } catch (error) {
    console.error('\n❌ ERRO FATAL na verificação:', error);
    process.exit(1);
  }
})();
