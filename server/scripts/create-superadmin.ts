#!/usr/bin/env tsx
/**
 * Creates a superadmin user if one doesn't exist.
 * Usage: npx tsx server/scripts/create-superadmin.ts
 */
import 'dotenv/config';
import { db } from '../db';
import { users, companies } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString('hex')}.${salt}`;
}

async function main() {
  console.log('Creating superadmin user...\n');

  // Check if superadmin already exists
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.role, 'superadmin'))
    .limit(1);

  if (existing) {
    console.log(`Superadmin already exists: ${existing.username} (ID: ${existing.id})`);
    process.exit(0);
  }

  // Get or create a company
  let companyId: number;
  const [existingCompany] = await db.select().from(companies).limit(1);
  if (existingCompany) {
    companyId = existingCompany.id;
  } else {
    const [newCompany] = await db
      .insert(companies)
      .values({
        name: 'Admin Company',
        email: 'admin@clinic.com',
        active: true,
      })
      .returning();
    companyId = newCompany.id;
  }

  const password = 'Super@2026';
  const hashedPassword = await hashPassword(password);

  const [superadmin] = await db
    .insert(users)
    .values({
      username: 'superadmin',
      password: hashedPassword,
      fullName: 'Super Administrador',
      email: 'superadmin@dentclinic.com',
      role: 'superadmin',
      companyId,
      active: true,
    })
    .returning();

  console.log('Superadmin created successfully!');
  console.log(`  Username: superadmin`);
  console.log(`  Password: ${password}`);
  console.log(`  Company ID: ${companyId}`);
  console.log(`  User ID: ${superadmin.id}`);

  process.exit(0);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
