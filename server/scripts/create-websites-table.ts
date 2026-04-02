import { db } from '../db';

(async () => {
  console.log('Creating websites table...');

  await db.execute(`
    CREATE TABLE IF NOT EXISTS websites (
      id SERIAL PRIMARY KEY,
      company_id INTEGER NOT NULL REFERENCES companies(id),
      clinic_name TEXT NOT NULL,
      domain TEXT UNIQUE,
      custom_domain TEXT,
      template TEXT NOT NULL DEFAULT 'modern',
      colors JSONB,
      content JSONB,
      social JSONB,
      seo JSONB,
      gallery JSONB DEFAULT '[]'::jsonb,
      published BOOLEAN NOT NULL DEFAULT false,
      published_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  console.log('✅ Table websites created');

  // Create unique index on company_id (one website per company)
  await db.execute(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_websites_company_id ON websites(company_id);
  `);

  console.log('✅ Index created');
  process.exit(0);
})();
