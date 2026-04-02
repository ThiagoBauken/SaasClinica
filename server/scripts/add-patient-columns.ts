import { db } from '../db';

(async () => {
  console.log('🔧 Adicionando colunas faltantes na tabela patients...\n');

  try {
    // Add next_recurring_appointment column
    console.log('Adicionando next_recurring_appointment...');
    await db.execute(`
      ALTER TABLE patients
      ADD COLUMN IF NOT EXISTS next_recurring_appointment TIMESTAMP;
    `);
    console.log('✅ Coluna next_recurring_appointment adicionada\n');

    // Add recurring_interval_days column
    console.log('Adicionando recurring_interval_days...');
    await db.execute(`
      ALTER TABLE patients
      ADD COLUMN IF NOT EXISTS recurring_interval_days INTEGER DEFAULT 30;
    `);
    console.log('✅ Coluna recurring_interval_days adicionada\n');

    console.log('✅ Todas as colunas foram adicionadas com sucesso!\n');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Erro ao adicionar colunas:', error.message);
    process.exit(1);
  }
})();
