import { db } from '../db';
import { users, companies } from '@shared/schema';
import { eq } from 'drizzle-orm';

(async () => {
  console.log('\n📊 Verificando permissões no banco de dados...\n');

  // Check superadmin user
  const [superadmin] = await db
    .select()
    .from(users)
    .where(eq(users.username, 'superadmin'))
    .limit(1);

  if (superadmin) {
    console.log('✅ Usuário Superadmin:');
    console.log('  - ID:', superadmin.id);
    console.log('  - Username:', superadmin.username);
    console.log('  - Role:', superadmin.role);
    console.log('  - Active:', superadmin.active);
    console.log('  - Company ID:', superadmin.companyId);
    console.log('  - Email:', superadmin.email || '(não definido)');
    console.log('');
  } else {
    console.log('❌ Superadmin não encontrado!\n');
  }

  // Check all roles in the system
  const allUsers = await db.select({ id: users.id, username: users.username, role: users.role, active: users.active }).from(users);
  const roles = [...new Set(allUsers.map((u: any) => u.role))];
  console.log('📋 Roles disponíveis no sistema:', roles.join(', '));
  console.log('');

  // Count users by role
  const roleCounts = allUsers.reduce((acc: Record<string, number>, u: any) => {
    acc[u.role] = (acc[u.role] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('👥 Usuários por role:');
  Object.entries(roleCounts).forEach(([role, count]) => {
    console.log(`  - ${role}: ${count} usuário(s)`);
  });
  console.log('');

  // List all users with their roles
  console.log('📝 Lista de usuários:');
  allUsers.slice(0, 10).forEach((u: any) => {
    const status = u.active ? '✓' : '✗';
    console.log(`  ${status} [${u.role.padEnd(12)}] ${u.username} (ID: ${u.id})`);
  });
  if (allUsers.length > 10) {
    console.log(`  ... e mais ${allUsers.length - 10} usuário(s)`);
  }
  console.log('');

  // Check companies
  const companiesList = await db.select().from(companies);
  console.log('🏢 Empresas cadastradas:', companiesList.length);
  if (companiesList.length > 0) {
    companiesList.slice(0, 5).forEach((c: any) => {
      console.log(`  - ${c.name} (ID: ${c.id})`);
    });
    if (companiesList.length > 5) {
      console.log(`  ... e mais ${companiesList.length - 5} empresa(s)`);
    }
  }
  console.log('');

  process.exit(0);
})();
