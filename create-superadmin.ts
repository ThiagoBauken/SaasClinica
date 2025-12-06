import { config } from 'dotenv';
config({ override: true });

import { storage } from './server/storage';
import { hashPassword } from './server/auth';

async function createSuperAdmin() {
  try {
    // Verificar se já existe
    const existing = await storage.getUserByUsername('superadmin');
    if (existing) {
      console.log('✅ Superadmin já existe! Username: superadmin');
      console.log(`   ID: ${existing.id}, Email: ${existing.email}`);
      process.exit(0);
    }

    // Criar superadmin
    const hashedPassword = await hashPassword('super123');
    const superAdmin = await storage.createUser({
      username: 'superadmin',
      password: hashedPassword,
      fullName: 'Super Administrador',
      email: 'superadmin@system.com',
      role: 'superadmin',
      companyId: 1, // Empresa padrão
      active: true,
    });

    console.log('✅ Superadmin criado com sucesso!');
    console.log(`   Username: superadmin`);
    console.log(`   Password: super123`);
    console.log(`   Email: ${superAdmin.email}`);
    console.log(`   ID: ${superAdmin.id}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao criar superadmin:', error);
    process.exit(1);
  }
}

createSuperAdmin();
