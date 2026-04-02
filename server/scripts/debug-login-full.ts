import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { storage } from '../storage';

const scryptAsync = promisify(scrypt);

async function comparePasswords(supplied: string, stored: string) {
  try {
    if (!stored || !stored.includes('.')) {
      console.log('  ❌ Password format invalid (no dot separator)');
      return false;
    }

    const [hashed, salt] = stored.split('.');
    console.log(`  Salt: ${salt.substring(0, 10)}...`);
    console.log(`  Stored hash: ${hashed.substring(0, 20)}...`);

    const hashedBuf = Buffer.from(hashed, 'hex');
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;

    console.log(`  Supplied hash: ${suppliedBuf.toString('hex').substring(0, 20)}...`);
    console.log(`  Buffer lengths: stored=${hashedBuf.length}, supplied=${suppliedBuf.length}`);

    if (hashedBuf.length !== suppliedBuf.length) {
      console.log('  ❌ Buffer length mismatch');
      return false;
    }

    const matches = timingSafeEqual(hashedBuf, suppliedBuf);
    console.log(`  Match result: ${matches ? '✅ YES' : '❌ NO'}`);
    return matches;
  } catch (error) {
    console.error('  ❌ Error comparing passwords:', error);
    return false;
  }
}

async function main() {
  console.log('\n🔍 Testing full login flow for superadmin\n');

  const testUsername = 'superadmin';
  const testPassword = 'Super@2026';

  console.log('1. Using storage.getUserByUsername()...');
  const storageUser = await storage.getUserByUsername(testUsername);

  if (!storageUser) {
    console.log('  ❌ No user found via storage.getUserByUsername()');
  } else {
    console.log('  ✅ User found via storage.getUserByUsername()');
    console.log(`  - ID: ${storageUser.id}`);
    console.log(`  - Username: ${storageUser.username}`);
    console.log(`  - Full Name: ${storageUser.fullName}`);
    console.log(`  - Role: ${storageUser.role}`);
    console.log(`  - Active: ${storageUser.active}`);
    console.log(`  - Password hash: ${storageUser.password.substring(0, 30)}...`);

    console.log('\n2. Testing password comparison...');
    const passwordMatches = await comparePasswords(testPassword, storageUser.password);

    if (passwordMatches) {
      console.log('\n✅ LOGIN WOULD SUCCEED');
      console.log('   The user exists and password matches.');
    } else {
      console.log('\n❌ LOGIN WOULD FAIL');
      console.log('   Password does not match.');
    }
  }

  console.log('\n3. Double-checking with direct DB query...');
  const [dbUser] = await db
    .select()
    .from(users)
    .where(eq(users.username, testUsername))
    .limit(1);

  if (!dbUser) {
    console.log('  ❌ No user found via direct DB query');
  } else {
    console.log('  ✅ User found via direct DB query');
    console.log(`  - ID: ${dbUser.id}`);
    console.log(`  - Username: ${dbUser.username}`);
    console.log(`  - Password hash matches storage result: ${dbUser.password === storageUser?.password}`);

    if (storageUser && dbUser.password !== storageUser.password) {
      console.log('  ⚠️  WARNING: Password hashes differ between storage and direct DB query!');
      console.log(`  Storage: ${storageUser.password.substring(0, 50)}...`);
      console.log(`  DB:      ${dbUser.password.substring(0, 50)}...`);
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
