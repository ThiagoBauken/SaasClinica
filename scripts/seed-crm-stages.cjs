/**
 * Seed missing WhatsApp CRM pipeline stages for all companies
 * Run: node scripts/seed-crm-stages.js
 */
const { Client } = require('pg');
require('dotenv').config();

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  console.log('Connected to database');

  // Set automation triggers on existing stages by code
  const triggers = {
    first_contact: 'first_contact',
    new_lead: 'first_contact', // map old new_lead to first_contact
  };

  for (const [code, trigger] of Object.entries(triggers)) {
    const res = await client.query(
      'UPDATE sales_funnel_stages SET automation_trigger = $1 WHERE code = $2 AND automation_trigger IS NULL',
      [trigger, code]
    );
    if (res.rowCount > 0) {
      console.log(`Updated ${res.rowCount} stages: code=${code} -> trigger=${trigger}`);
    }
  }

  // For each company, add missing WhatsApp pipeline stages
  const { rows: companies } = await client.query('SELECT DISTINCT company_id FROM sales_funnel_stages');

  const stagesToAdd = [
    { name: 'Agendamento', code: 'scheduling', color: '#3B82F6', trigger: 'scheduling' },
    { name: 'Confirmado', code: 'confirmation', color: '#F59E0B', trigger: 'confirmation' },
    { name: 'Consulta Realizada', code: 'consultation_done', color: '#10B981', trigger: 'consultation_done' },
    { name: 'Pagamento', code: 'payment', color: '#8B5CF6', trigger: 'payment_done' },
  ];

  let addedCount = 0;

  for (const comp of companies) {
    const cid = comp.company_id;

    // Get max order for this company
    const { rows } = await client.query('SELECT MAX("order") as max_order FROM sales_funnel_stages WHERE company_id = $1', [cid]);
    let order = (rows[0]?.max_order || 6) + 1;

    for (const stage of stagesToAdd) {
      // Check if already exists
      const { rows: existing } = await client.query(
        'SELECT id FROM sales_funnel_stages WHERE company_id = $1 AND code = $2',
        [cid, stage.code]
      );

      if (existing.length === 0) {
        await client.query(
          `INSERT INTO sales_funnel_stages (company_id, name, code, color, "order", is_default, is_won, is_lost, is_active, automation_trigger)
           VALUES ($1, $2, $3, $4, $5, false, false, false, true, $6)`,
          [cid, stage.name, stage.code, stage.color, order++, stage.trigger]
        );
        addedCount++;
      }
    }
  }

  console.log(`Added ${addedCount} new stages across ${companies.length} companies`);

  // Verify final state
  const { rows: sample } = await client.query(
    `SELECT company_id, name, code, "order", automation_trigger
     FROM sales_funnel_stages
     WHERE company_id = 1
     ORDER BY "order"`
  );
  console.log('\nCompany 1 stages:');
  sample.forEach(s => console.log(`  ${s.order}. ${s.name} (${s.code}) -> trigger: ${s.automation_trigger || 'none'}`));

  await client.end();
  console.log('\nDone!');
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
