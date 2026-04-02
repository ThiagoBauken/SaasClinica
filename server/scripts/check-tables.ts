import 'dotenv/config';
import { db } from '../db';
import { sql } from 'drizzle-orm';

async function main() {
  const result = await db.execute(sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`);
  const tables = (result as any).rows.map((r: any) => r.tablename);
  console.log(`Found ${tables.length} tables:`);
  tables.forEach((t: string) => console.log(`  - ${t}`));
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
