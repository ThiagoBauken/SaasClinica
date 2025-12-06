import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

async function migrate() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const client = await pool.connect();

  try {
    console.log('Conectado ao banco de dados...');
    console.log('Iniciando migração completa SaaS...\n');

    // Adicionar colunas na tabela companies
    const companiesQueries = [
      `ALTER TABLE companies ADD COLUMN IF NOT EXISTS n8n_api_key TEXT`,
      `ALTER TABLE companies ADD COLUMN IF NOT EXISTS n8n_api_key_created_at TIMESTAMP`,
    ];

    console.log('=== Atualizando tabela COMPANIES ===');
    for (const query of companiesQueries) {
      try {
        await client.query(query);
        console.log('OK:', query.substring(0, 70) + '...');
      } catch (e) {
        if (!e.message.includes('already exists')) {
          console.log('Aviso:', e.message);
        }
      }
    }

    // Adicionar TODAS as colunas novas na tabela clinic_settings
    const clinicQueries = [
      // Wuzapi fields
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS wuzapi_instance_id TEXT`,
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS wuzapi_api_key TEXT`,
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS wuzapi_base_url TEXT DEFAULT 'https://private-wuzapi.pbzgje.easypanel.host'`,
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS wuzapi_webhook_url TEXT`,
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS wuzapi_webhook_secret TEXT`,
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS wuzapi_connected_phone TEXT`,
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS wuzapi_status TEXT DEFAULT 'disconnected'`,
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS wuzapi_last_sync_at TIMESTAMP`,

      // Evolution API fields
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS evolution_api_base_url TEXT`,
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS evolution_instance_name TEXT`,
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS evolution_api_key TEXT`,
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS admin_whatsapp_phone TEXT`,

      // Google Calendar
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS default_google_calendar_id TEXT`,

      // N8N/Automation
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS n8n_webhook_base_url TEXT`,

      // Flowise/AI
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS flowise_base_url TEXT`,
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS flowise_chatflow_id TEXT`,

      // Baserow
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS baserow_api_key TEXT`,
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS baserow_database_id INTEGER`,
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS baserow_patients_table_id INTEGER`,
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS baserow_appointments_table_id INTEGER`,

      // Chat e Automação - SaaS
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS chat_enabled BOOLEAN DEFAULT true`,
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS chat_welcome_message TEXT`,
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS chat_fallback_message TEXT`,
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS emergency_phone TEXT`,
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS google_review_link TEXT`,
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS google_maps_link TEXT`,
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS working_hours_json JSONB`,
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS slot_duration_minutes INTEGER DEFAULT 30`,
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS appointment_buffer_minutes INTEGER DEFAULT 0`,

      // Templates de mensagens
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS confirmation_message_template TEXT`,
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS reminder_message_template TEXT`,
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS cancellation_message_template TEXT`,
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS birthday_message_template TEXT`,
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS review_request_template TEXT`,

      // Estilo de Conversa do Bot
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS conversation_style TEXT DEFAULT 'menu'`,
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS bot_personality TEXT DEFAULT 'professional'`,
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS bot_name TEXT DEFAULT 'Assistente'`,
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS use_emojis BOOLEAN DEFAULT true`,
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS greeting_style TEXT DEFAULT 'time_based'`,
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS custom_greeting_morning TEXT`,
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS custom_greeting_afternoon TEXT`,
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS custom_greeting_evening TEXT`,
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS humanized_prompt_context TEXT`,

      // Regras de Negócio do Bot
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS price_disclosure_policy TEXT DEFAULT 'always'`,
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS scheduling_policy TEXT DEFAULT 'immediate'`,
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS payment_methods JSONB DEFAULT '["pix", "credit_card", "debit_card", "cash"]'::jsonb`,

      // Especialidades e Serviços
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS clinic_type TEXT DEFAULT 'consultorio_individual'`,
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS services_offered JSONB DEFAULT '[]'::jsonb`,
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS clinic_context_for_bot TEXT`,

      // Reativação de Pacientes
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS reactivation_enabled BOOLEAN DEFAULT true`,
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS reactivation_3_months_template TEXT`,
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS reactivation_6_months_template TEXT`,
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS reactivation_9_months_template TEXT`,
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS reactivation_12_months_template TEXT`,
      `ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS reactivation_hour_to_send INTEGER DEFAULT 10`,
    ];

    console.log('\n=== Atualizando tabela CLINIC_SETTINGS ===');
    let successCount = 0;
    let skipCount = 0;

    for (const query of clinicQueries) {
      try {
        await client.query(query);
        successCount++;
        // Extract column name for logging
        const match = query.match(/ADD COLUMN IF NOT EXISTS (\w+)/);
        const columnName = match ? match[1] : query.substring(0, 50);
        console.log('OK:', columnName);
      } catch (e) {
        if (e.message.includes('already exists')) {
          skipCount++;
        } else {
          console.log('ERRO:', e.message);
        }
      }
    }

    console.log(`\n=== Resumo ===`);
    console.log(`Colunas adicionadas: ${successCount}`);
    console.log(`Colunas já existentes: ${skipCount}`);
    console.log(`Total de colunas verificadas: ${clinicQueries.length}`);

    console.log('\n✅ Migração SaaS completa finalizada com sucesso!');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(console.error);
