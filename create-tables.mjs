import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function createTables() {
  const connectionString = process.env.DATABASE_URL || 'postgres://odonto:9297c681978872468528@185.215.165.19:190/odontobase';

  const client = new Client({
    connectionString,
    ssl: false
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected successfully!');

    const sqlFile = path.join(__dirname, 'fix-tables.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    console.log('Executing SQL statements...');
    await client.query(sql);

    console.log('✅ Tables created successfully!');
    console.log('   - notifications');
    console.log('   - digitization_history');
    console.log('   - All indexes created');

  } catch (error) {
    console.error('❌ Error creating tables:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('Database connection closed.');
  }
}

createTables();
