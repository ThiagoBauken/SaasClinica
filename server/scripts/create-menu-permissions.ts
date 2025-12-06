#!/usr/bin/env tsx

import { db } from "../db";
import { sql } from "drizzle-orm";

async function createMenuPermissionsTable() {
  console.log("🔧 Criando tabela menu_permissions...\n");

  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS menu_permissions (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id),
        role TEXT NOT NULL,
        menu_item TEXT NOT NULL,
        label TEXT NOT NULL,
        path TEXT NOT NULL,
        icon TEXT NOT NULL,
        can_view BOOLEAN NOT NULL DEFAULT true,
        can_create BOOLEAN NOT NULL DEFAULT false,
        can_edit BOOLEAN NOT NULL DEFAULT false,
        can_delete BOOLEAN NOT NULL DEFAULT false,
        "order" INTEGER NOT NULL DEFAULT 0,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("✅ Tabela menu_permissions criada com sucesso!");

    console.log("\n✅ Concluído!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Erro ao criar tabela:", error);
    process.exit(1);
  }
}

createMenuPermissionsTable();
