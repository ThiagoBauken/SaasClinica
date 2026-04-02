#!/usr/bin/env tsx
import 'dotenv/config';
import { db } from '../db';
import { users } from '@shared/schema';
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
  const newPassword = 'Super@2026';
  const hashedPassword = await hashPassword(newPassword);

  const [updated] = await db
    .update(users)
    .set({ password: hashedPassword })
    .where(eq(users.username, 'superadmin'))
    .returning({ id: users.id, username: users.username, email: users.email });

  if (updated) {
    console.log(`Password reset for: ${updated.username} (ID: ${updated.id})`);
    console.log(`New password: ${newPassword}`);
  } else {
    console.log('superadmin user not found');
  }
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
