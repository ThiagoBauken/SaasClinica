/**
 * Fix stage ordering so WhatsApp pipeline flows correctly
 */
const { Client } = require('pg');
require('dotenv').config();

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const { rows: companies } = await client.query('SELECT DISTINCT company_id FROM sales_funnel_stages');

  // Desired order
  const orderMap = {
    'new_lead': 1,
    'first_contact': 2,
    'scheduling': 3,
    'quote_sent': 4,
    'confirmation': 5,
    'negotiation': 6,
    'consultation_done': 7,
    'payment': 8,
    'won': 9,
    'lost': 10,
  };

  for (const comp of companies) {
    const { rows: stages } = await client.query(
      'SELECT id, code FROM sales_funnel_stages WHERE company_id = $1',
      [comp.company_id]
    );

    for (const stage of stages) {
      const newOrder = orderMap[stage.code] || 99;
      await client.query(
        'UPDATE sales_funnel_stages SET "order" = $1 WHERE id = $2',
        [newOrder, stage.id]
      );
    }
  }

  console.log(`Fixed ordering for ${companies.length} companies`);

  // Verify
  const { rows: sample } = await client.query(
    `SELECT name, code, "order", automation_trigger
     FROM sales_funnel_stages
     WHERE company_id = 1
     ORDER BY "order"`
  );
  console.log('\nCompany 1 stages (ordered):');
  sample.forEach(s => console.log(`  ${s.order}. ${s.name} (${s.code}) trigger=${s.automation_trigger || '-'}`));

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
