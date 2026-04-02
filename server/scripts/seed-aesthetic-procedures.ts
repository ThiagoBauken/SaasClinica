#!/usr/bin/env tsx
/**
 * Seed script: Procedimentos Estéticos e Clínicos Padrão
 *
 * Insere procedimentos estéticos e clínicos básicos para companyId=1.
 * Verifica primeiro se já existem procedimentos antes de inserir.
 */

import { db } from '../db';
import { procedures } from '../../shared/schema';
import { eq } from 'drizzle-orm';

const COMPANY_ID = 1;

// Procedimentos estéticos
const aestheticProcedures = [
  { name: 'Clareamento Dental a Laser', category: 'Estética', duration: 60, price: 80000 },
  { name: 'Clareamento Dental Caseiro', category: 'Estética', duration: 30, price: 40000 },
  { name: 'Clareamento Combinado', category: 'Estética', duration: 60, price: 100000 },
  { name: 'Faceta de Porcelana', category: 'Estética', duration: 90, price: 250000 },
  { name: 'Faceta de Resina', category: 'Estética', duration: 60, price: 80000 },
  { name: 'Lente de Contato Dental', category: 'Estética', duration: 90, price: 300000 },
  { name: 'Restauração Estética (Resina)', category: 'Estética', duration: 45, price: 35000 },
  { name: 'Gengivoplastia', category: 'Estética', duration: 60, price: 60000 },
  { name: 'Gengivectomia', category: 'Estética', duration: 90, price: 90000 },
  { name: 'Bichectomia', category: 'Estética', duration: 60, price: 200000 },
  { name: 'Harmonização Orofacial - Botox', category: 'Estética', duration: 45, price: 150000 },
  { name: 'Harmonização Orofacial - Preenchimento Labial', category: 'Estética', duration: 45, price: 180000 },
  { name: 'Design de Sorriso Digital (DSD)', category: 'Estética', duration: 60, price: 50000 },
  { name: 'Plástica Gengival', category: 'Estética', duration: 60, price: 70000 },
];

// Procedimentos clínicos padrão
const standardProcedures = [
  { name: 'Consulta Inicial', category: 'Geral', duration: 30, price: 15000 },
  { name: 'Consulta de Retorno', category: 'Geral', duration: 20, price: 8000 },
  { name: 'Limpeza Dental (Profilaxia)', category: 'Prevenção', duration: 45, price: 20000 },
  { name: 'Obturação (Restauração)', category: 'Geral', duration: 45, price: 25000 },
  { name: 'Tratamento de Canal (Endodontia)', category: 'Endodontia', duration: 90, price: 80000 },
  { name: 'Extração Simples', category: 'Cirurgia', duration: 30, price: 20000 },
  { name: 'Extração de Siso', category: 'Cirurgia', duration: 60, price: 50000 },
  { name: 'Implante Dentário', category: 'Implante', duration: 120, price: 250000 },
  { name: 'Aparelho Ortodôntico (Instalação)', category: 'Ortodontia', duration: 90, price: 350000 },
  { name: 'Manutenção de Ortodontia', category: 'Ortodontia', duration: 30, price: 18000 },
  { name: 'Prótese Total (Dentadura)', category: 'Prótese', duration: 60, price: 200000 },
  { name: 'Prótese Parcial Removível', category: 'Prótese', duration: 60, price: 150000 },
  { name: 'Radiografia Periapical', category: 'Radiologia', duration: 10, price: 5000 },
  { name: 'Radiografia Panorâmica', category: 'Radiologia', duration: 15, price: 15000 },
  { name: 'Selante de Fissura', category: 'Prevenção', duration: 30, price: 12000 },
  { name: 'Aplicação de Flúor', category: 'Prevenção', duration: 20, price: 8000 },
  { name: 'Raspagem (Periodontia)', category: 'Periodontia', duration: 60, price: 35000 },
];

async function main() {
  console.log('Iniciando seed de procedimentos para companyId=' + COMPANY_ID + '...\n');

  try {
    // Check how many procedures already exist for this company
    const existing = await db
      .select()
      .from(procedures)
      .where(eq(procedures.companyId, COMPANY_ID));

    console.log('Procedimentos existentes: ' + existing.length);

    const existingNames = new Set(existing.map((p: any) => p.name));

    // Filter out already existing procedures
    const aestheticToInsert = aestheticProcedures.filter(p => !existingNames.has(p.name));
    const standardToInsert = standardProcedures.filter(p => !existingNames.has(p.name));

    let insertedCount = 0;

    if (standardToInsert.length > 0) {
      console.log('\nInserindo ' + standardToInsert.length + ' procedimentos clinicos padrao...');
      await db.insert(procedures).values(
        standardToInsert.map(p => ({
          companyId: COMPANY_ID,
          name: p.name,
          category: p.category,
          duration: p.duration,
          price: p.price,
          active: true,
          sendReminder: true,
          reminderHoursBefore: 24,
        }))
      );
      insertedCount += standardToInsert.length;
      for (const p of standardToInsert) {
        console.log('  + ' + p.name + ' (' + p.category + ')');
      }
    } else {
      console.log('Procedimentos clinicos padrao ja existem, pulando...');
    }

    if (aestheticToInsert.length > 0) {
      console.log('\nInserindo ' + aestheticToInsert.length + ' procedimentos esteticos...');
      await db.insert(procedures).values(
        aestheticToInsert.map(p => ({
          companyId: COMPANY_ID,
          name: p.name,
          category: p.category,
          duration: p.duration,
          price: p.price,
          active: true,
          sendReminder: true,
          reminderHoursBefore: 24,
        }))
      );
      insertedCount += aestheticToInsert.length;
      for (const p of aestheticToInsert) {
        console.log('  + ' + p.name + ' (' + p.category + ')');
      }
    } else {
      console.log('Procedimentos esteticos ja existem, pulando...');
    }

    console.log('\nTotal inserido: ' + insertedCount + ' procedimentos.');
    console.log('Seed concluido com sucesso!');
    process.exit(0);
  } catch (error) {
    console.error('Erro ao executar seed:', error);
    process.exit(1);
  }
}

main();
