#!/usr/bin/env tsx

import { seedDatabase } from "../seedData";

async function main() {
  console.log("🚀 Executando seed do banco de dados...\n");

  try {
    const result = await seedDatabase();

    if (result.success) {
      console.log("✅ Seed executado com sucesso!");
      console.log(`\n📊 Dados criados para a empresa ID: ${result.companyId}`);
      console.log("\n💡 Credenciais de acesso:");
      console.log("   Admin:");
      console.log("   - Usuário: admin");
      console.log("   - Senha: admin123");
      console.log("\n   Dentista:");
      console.log("   - Usuário: dra.ana");
      console.log("   - Senha: dentista123");
      console.log("\n   Recepcionista:");
      console.log("   - Usuário: maria");
      console.log("   - Senha: recep123");
      process.exit(0);
    }
  } catch (error) {
    console.error("❌ Erro ao executar seed:", error);
    process.exit(1);
  }
}

main();
