import { db } from '../db';

(async () => {
  console.log('🔧 Sincronizando TODAS as colunas da tabela patients...\n');

  const columnsToAdd = [
    // Recurring appointments
    { name: 'next_recurring_appointment', type: 'TIMESTAMP', default: null },
    { name: 'recurring_interval_days', type: 'INTEGER', default: '30' },
    { name: 'preferred_day_of_week', type: 'INTEGER', default: null },
    { name: 'preferred_time_slot', type: 'TEXT', default: null },

    // LGPD - Consentimentos
    { name: 'data_processing_consent', type: 'BOOLEAN', default: 'false' },
    { name: 'marketing_consent', type: 'BOOLEAN', default: 'false' },
    { name: 'whatsapp_consent', type: 'BOOLEAN', default: 'false' },
    { name: 'email_consent', type: 'BOOLEAN', default: 'false' },
    { name: 'sms_consent', type: 'BOOLEAN', default: 'false' },
    { name: 'consent_date', type: 'TIMESTAMP', default: null },
    { name: 'consent_ip_address', type: 'TEXT', default: null },
    { name: 'consent_method', type: 'TEXT', default: null },
    { name: 'data_retention_period', type: 'INTEGER', default: '730' },
    { name: 'data_anonymization_date', type: 'TIMESTAMP', default: null },

    // Follow-up
    { name: 'last_review_requested_at', type: 'TIMESTAMP', default: null },
    { name: 'total_appointments', type: 'INTEGER', default: '0' },

    // Tags e Tratamentos
    { name: 'tags', type: 'JSONB', default: "'[]'::jsonb" },
    { name: 'treatment_type', type: 'TEXT', default: null },
    { name: 'is_orthodontic_patient', type: 'BOOLEAN', default: 'false' },
    { name: 'orthodontic_start_date', type: 'TIMESTAMP', default: null },
    { name: 'orthodontic_expected_end_date', type: 'TIMESTAMP', default: null },

    // Sistema
    { name: 'patient_number', type: 'TEXT', default: null },
    { name: 'status', type: 'TEXT', default: "'active'" },
    { name: 'notes', type: 'TEXT', default: null },
    { name: 'profile_photo', type: 'TEXT', default: null },
    { name: 'last_visit', type: 'TIMESTAMP', default: null },
    { name: 'insurance_info', type: 'JSONB', default: null },
  ];

  let added = 0;
  let skipped = 0;
  let errors = 0;

  for (const col of columnsToAdd) {
    try {
      const defaultClause = col.default ? `DEFAULT ${col.default}` : '';
      const sql = `ALTER TABLE patients ADD COLUMN IF NOT EXISTS ${col.name} ${col.type} ${defaultClause};`;

      await db.execute(sql);
      console.log(`✅ ${col.name}`);
      added++;
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        console.log(`⏭️  ${col.name} (já existe)`);
        skipped++;
      } else {
        console.log(`❌ ${col.name}: ${error.message}`);
        errors++;
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`\n📊 Resumo: ${added} adicionadas, ${skipped} já existiam, ${errors} erros\n`);

  if (errors === 0) {
    console.log('✅ Todas as colunas sincronizadas com sucesso!\n');
    process.exit(0);
  } else {
    console.log('⚠️  Algumas colunas falharam. Verifique os erros acima.\n');
    process.exit(1);
  }
})();
