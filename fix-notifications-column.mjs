import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: 'postgres://odonto:9297c681978872468528@185.215.165.19:190/odontobase',
  ssl: false
});

async function fixNotificationsTable() {
  try {
    await client.connect();
    console.log('✅ Conectado ao banco de dados\n');

    // Check if column exists
    const checkColumn = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'notifications'
        AND column_name = 'related_resource'
    `);

    if (checkColumn.rows.length === 0) {
      console.log('➕ Adicionando coluna related_resource...');

      await client.query(`
        ALTER TABLE notifications
        ADD COLUMN IF NOT EXISTS related_resource TEXT
      `);

      console.log('✅ Coluna related_resource adicionada com sucesso!\n');
    } else {
      console.log('ℹ️  Coluna related_resource já existe\n');
    }

    // Check current columns
    const columns = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'notifications'
      ORDER BY ordinal_position
    `);

    console.log('📋 Colunas atuais da tabela notifications:');
    columns.rows.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type})`);
    });

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await client.end();
  }
}

console.log('🔧 Corrigindo tabela notifications...\n');
fixNotificationsTable();
