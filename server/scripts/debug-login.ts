import 'dotenv/config';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { scrypt, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString('hex')}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split('.');
  if (!salt) {
    console.log('  ERROR: No salt found in stored password');
    return false;
  }
  const hashedBuf = Buffer.from(hashed, 'hex');
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

async function main() {
  // Find superadmin
  const [u] = await db
    .select()
    .from(users)
    .where(eq(users.username, 'superadmin'))
    .limit(1);

  if (!u) {
    console.log('ERROR: superadmin user NOT FOUND in database');

    // List all users
    const allUsers = await db.select({ id: users.id, username: users.username, role: users.role }).from(users).limit(10);
    console.log('\nAll users:');
    allUsers.forEach((u: any) => console.log(`  ${u.id}: ${u.username} (${u.role})`));
    process.exit(1);
  }

  console.log('User found:');
  console.log(`  ID: ${u.id}`);
  console.log(`  Username: ${u.username}`);
  console.log(`  Email: ${u.email}`);
  console.log(`  Role: ${u.role}`);
  console.log(`  Active: ${u.active}`);
  console.log(`  Has password: ${!!u.password}`);

  if (u.password) {
    console.log(`  Password length: ${u.password.length}`);
    console.log(`  Has salt separator: ${u.password.includes('.')}`);

    // Test password
    const testPassword = 'Super@2026';
    console.log(`\nTesting password "${testPassword}"...`);
    const matches = await comparePasswords(testPassword, u.password);
    console.log(`  Result: ${matches ? 'MATCH' : 'NO MATCH'}`);

    if (!matches) {
      // Reset password
      console.log('\nResetting password...');
      const newHash = await hashPassword(testPassword);
      await db.update(users).set({ password: newHash }).where(eq(users.id, u.id));

      // Verify
      const [updated] = await db.select({ password: users.password }).from(users).where(eq(users.id, u.id)).limit(1);
      const verify = await comparePasswords(testPassword, updated!.password);
      console.log(`  Verification after reset: ${verify ? 'OK' : 'FAILED'}`);
    }
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
