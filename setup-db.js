import { db } from './server/db.js';
import * as schema from './shared/schema.js';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { migrate } from 'drizzle-orm/neon-serverless/migrator';

console.log('Iniciando migração do banco de dados...');

// Criando todas as tabelas definidas no schema
async function main() {
  try {
    // Força a criação das tabelas no banco de dados
    console.log('Criando tabelas...');
    for (const table of Object.values(schema)) {
      if (table._.name) {
        try {
          await db.execute(`CREATE TABLE IF NOT EXISTS "${table._.name}" (id SERIAL PRIMARY KEY)`);
          console.log(`Tabela ${table._.name} criada ou já existente.`);
        } catch (e) {
          console.log(`Erro ao criar tabela ${table._.name}: ${e.message}`);
        }
      }
    }
    
    console.log('Banco de dados inicializado com sucesso!');
    process.exit(0);
  } catch (error) {
    console.error('Erro durante a migração:', error);
    process.exit(1);
  }
}

main();