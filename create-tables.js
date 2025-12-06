const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function createTables() {
  // Read database URL from environment or use direct connection
  const connectionString = process.env.DATABASE_URL || 'postgres://odonto:9297c681978872468528@185.215.165.19:190/odontobase';

  const client = new Client({
    connectionString,
    ssl: false
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected successfully!');

    // Read SQL file
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
