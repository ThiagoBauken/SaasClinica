#!/usr/bin/env tsx

import { db } from "../db";
import { sql } from "drizzle-orm";

async function fixDatabase() {
  console.log("🔧 Adicionando colunas faltantes...\n");

  try {
    // Adicionar colunas LGPD faltantes
    await db.execute(sql`
      ALTER TABLE patients
      ADD COLUMN IF NOT EXISTS data_processing_consent boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS marketing_consent boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS whatsapp_consent boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS email_consent boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS sms_consent boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS consent_date timestamp,
      ADD COLUMN IF NOT EXISTS consent_ip_address text,
      ADD COLUMN IF NOT EXISTS consent_method text,
      ADD COLUMN IF NOT EXISTS data_retention_period integer DEFAULT 730,
      ADD COLUMN IF NOT EXISTS data_anonymization_date timestamp
    `);
    console.log("✅ Colunas LGPD adicionadas");

    console.log("\n✅ Banco de dados corrigido com sucesso!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Erro ao corrigir banco:", error);
    process.exit(1);
  }
}

fixDatabase();
