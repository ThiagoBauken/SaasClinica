#!/usr/bin/env tsx

/**
 * Script completo: roda migrations faltantes + seed de teste
 *
 * Executar: npx tsx server/scripts/seed-test-complete.ts
 *
 * Credenciais:
 *   Usuário: admin
 *   Senha: admin123
 */

import { config } from 'dotenv';
config({ override: true });

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  console.log("🚀 Setup completo: migrations + seed de teste\n");

  // 1. Conectar ao banco
  const pgModule = await import('pg');
  const PgPool = pgModule.default.Pool;

  const pool = new PgPool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
  });

  try {
    // Testar conexão
    const client = await pool.connect();
    console.log("✅ Conectado ao banco de dados\n");

    // 2. Rodar migration 014 (tabelas faltantes)
    console.log("📦 Rodando migration 014 (tabelas faltantes)...");
    try {
      const migration014 = readFileSync(
        join(__dirname, "..", "migrations", "014_missing_tables.sql"),
        "utf-8"
      );
      await client.query(migration014);
      console.log("  ✅ Migration 014 executada com sucesso");
    } catch (err: any) {
      if (err.message?.includes("already exists")) {
        console.log("  ℹ️  Tabelas já existem, pulando...");
      } else {
        console.error("  ⚠️  Aviso na migration 014:", err.message?.substring(0, 200));
      }
    }

    // 3. Rodar migration 015 (colunas faltantes na tabela patients)
    console.log("📦 Rodando migration 015 (colunas faltantes em patients)...");
    try {
      const migration015 = readFileSync(
        join(__dirname, "..", "migrations", "015_add_missing_patient_columns.sql"),
        "utf-8"
      );
      await client.query(migration015);
      console.log("  ✅ Migration 015 executada com sucesso\n");
    } catch (err: any) {
      console.error("  ⚠️  Aviso na migration 015:", err.message?.substring(0, 200));
      console.log("");
    }

    client.release();

    // 3. Rodar seed via Drizzle
    console.log("🌱 Iniciando seed de dados de teste...\n");

    // Importar db e schema depois de migrations
    const { db } = await import("../db");
    const {
      companies,
      users,
      patients,
      plans,
      subscriptions,
      subscriptionHistory,
      modules,
      companyModules,
      rooms,
      procedures,
      salesFunnelStages,
    } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    const { scrypt, randomBytes } = await import("crypto");
    const { promisify } = await import("util");
    const { addDays } = await import("date-fns");

    const scryptAsync = promisify(scrypt);

    async function hashPassword(password: string) {
      const salt = randomBytes(16).toString("hex");
      const buf = (await scryptAsync(password, salt, 64)) as Buffer;
      return `${buf.toString("hex")}.${salt}`;
    }

    // ========== PLANS ==========
    console.log("📋 Verificando planos...");
    const existingPlans = await db.select().from(plans).limit(1);

    if (existingPlans.length === 0) {
      await db.insert(plans).values([
        {
          name: "basic",
          displayName: "Básico",
          description: "Ideal para clínicas pequenas",
          monthlyPrice: "97.00",
          yearlyPrice: "970.00",
          trialDays: 14,
          maxUsers: 3,
          maxPatients: 100,
          maxAppointmentsPerMonth: 300,
          maxAutomations: 3,
          maxStorageGB: 5,
          features: ["agenda", "pacientes", "financeiro_basico", "relatorios_basicos"],
          isActive: true,
          isPopular: false,
          sortOrder: 1,
        },
        {
          name: "professional",
          displayName: "Profissional",
          description: "Para clínicas em crescimento",
          monthlyPrice: "197.00",
          yearlyPrice: "1970.00",
          trialDays: 14,
          maxUsers: 10,
          maxPatients: 500,
          maxAppointmentsPerMonth: 1000,
          maxAutomations: 10,
          maxStorageGB: 20,
          features: ["agenda", "pacientes", "financeiro_completo", "relatorios_avancados", "whatsapp", "automacoes", "estoque", "proteses", "api_acesso"],
          isActive: true,
          isPopular: true,
          sortOrder: 2,
        },
        {
          name: "enterprise",
          displayName: "Empresarial",
          description: "Solução completa para redes",
          monthlyPrice: "497.00",
          yearlyPrice: "4970.00",
          trialDays: 30,
          maxUsers: 999,
          maxPatients: 999999,
          maxAppointmentsPerMonth: 999999,
          maxAutomations: 999,
          maxStorageGB: 200,
          features: ["agenda", "pacientes", "financeiro_completo", "relatorios_avancados", "whatsapp", "automacoes", "estoque", "proteses", "api_acesso", "multi_clinicas", "suporte_prioritario"],
          isActive: true,
          isPopular: false,
          sortOrder: 3,
        },
      ]).onConflictDoNothing();
      console.log("  ✅ 3 planos criados");
    } else {
      console.log("  ℹ️  Planos já existem");
    }

    // ========== COMPANY ==========
    console.log("🏢 Criando empresa...");
    let company;
    const existingCompany = await db.select().from(companies).where(eq(companies.email, "contato@clinicateste.com")).limit(1);

    if (existingCompany.length > 0) {
      company = existingCompany[0];
      console.log(`  ℹ️  Empresa já existe (ID: ${company.id})`);
    } else {
      const [newCompany] = await db.insert(companies).values({
        name: "Clínica Teste",
        email: "contato@clinicateste.com",
        phone: "(11) 99999-0000",
        address: "Rua Teste, 123 - Centro, São Paulo - SP",
        cnpj: "12.345.678/0001-99",
        active: true,
        trialEndsAt: addDays(new Date(), 30),
      }).returning();
      company = newCompany;
      console.log(`  ✅ Empresa criada (ID: ${company.id})`);
    }

    const companyId = company.id;

    // ========== MODULES ==========
    console.log("📦 Configurando módulos...");
    const moduleData = [
      { name: "clinic", displayName: "Gestão Clínica", description: "Agendamentos e pacientes" },
      { name: "financial", displayName: "Financeiro", description: "Controle financeiro" },
      { name: "inventory", displayName: "Estoque", description: "Controle de estoque" },
      { name: "automation", displayName: "Automações", description: "N8N e WhatsApp" },
      { name: "crm", displayName: "CRM", description: "Funil de vendas" },
    ];

    for (const mod of moduleData) {
      const [inserted] = await db.insert(modules).values({
        ...mod,
        version: "1.0.0",
        isActive: true,
      }).onConflictDoNothing().returning();

      const modId = inserted?.id || (await db.select().from(modules).where(eq(modules.name, mod.name)).limit(1))[0]?.id;
      if (modId) {
        await db.insert(companyModules).values({
          companyId,
          moduleId: modId,
          isEnabled: true,
        }).onConflictDoNothing();
      }
    }
    console.log("  ✅ Módulos configurados");

    // ========== SUBSCRIPTION ==========
    console.log("💳 Criando subscription...");
    const existingSub = await db.select().from(subscriptions).where(eq(subscriptions.companyId, companyId)).limit(1);

    if (existingSub.length === 0) {
      const [proPlan] = await db.select().from(plans).where(eq(plans.name, "professional")).limit(1);
      if (proPlan) {
        const now = new Date();
        const trialEndsAt = addDays(now, 14);
        const periodEnd = addDays(trialEndsAt, 30);

        const [sub] = await db.insert(subscriptions).values({
          companyId,
          planId: proPlan.id,
          status: "trial",
          billingCycle: "monthly",
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          trialEndsAt,
        }).returning();

        await db.insert(subscriptionHistory).values({
          subscriptionId: sub.id,
          companyId,
          fromPlanId: null,
          toPlanId: proPlan.id,
          reason: "initial_subscription",
        });
        console.log("  ✅ Subscription criada (Profissional - Trial 14 dias)");
      }
    } else {
      console.log("  ℹ️  Subscription já existe");
    }

    // ========== USER ==========
    console.log("👤 Criando usuário admin...");
    const existingUser = await db.select().from(users).where(eq(users.username, "admin")).limit(1);

    if (existingUser.length > 0) {
      // Atualizar senha para garantir que funcione
      const hashedPassword = await hashPassword("admin123");
      await db.update(users).set({ password: hashedPassword }).where(eq(users.username, "admin"));
      console.log(`  ℹ️  Usuário 'admin' já existe (ID: ${existingUser[0].id}) - senha atualizada para admin123`);
    } else {
      const hashedPassword = await hashPassword("admin123");
      const [user] = await db.insert(users).values({
        companyId,
        username: "admin",
        password: hashedPassword,
        fullName: "Dr. Admin Teste",
        role: "admin",
        email: "admin@clinicateste.com",
        phone: "(11) 98765-4321",
        speciality: "Administração",
        active: true,
        trialEndsAt: addDays(new Date(), 30),
      }).returning();
      console.log(`  ✅ Usuário admin criado (ID: ${user.id})`);
    }

    // ========== PATIENT ==========
    console.log("🏥 Criando paciente...");
    const existingPatient = await db.select().from(patients).where(eq(patients.cpf, "123.456.789-00")).limit(1);

    if (existingPatient.length > 0) {
      console.log(`  ℹ️  Paciente já existe (ID: ${existingPatient[0].id})`);
    } else {
      const [patient] = await db.insert(patients).values({
        companyId,
        fullName: "Maria da Silva Santos",
        birthDate: new Date("1985-06-15"),
        cpf: "123.456.789-00",
        gender: "feminino",
        email: "maria.santos@email.com",
        phone: "(11) 3456-7890",
        cellphone: "(11) 99876-5432",
        whatsappPhone: "5511998765432",
        address: "Rua das Flores, 456",
        neighborhood: "Jardim Primavera",
        city: "São Paulo",
        state: "SP",
        cep: "01234-567",
        healthInsurance: "Unimed",
        healthInsuranceNumber: "UNI00012345",
        bloodType: "O+",
        allergies: "Penicilina",
        status: "active",
        active: true,
        dataProcessingConsent: true,
        consentDate: new Date(),
        consentMethod: "online",
        tags: ["geral"],
        referralSource: "indicacao",
      }).returning();
      console.log(`  ✅ Paciente criado (ID: ${patient.id})`);
    }

    // ========== ROOM ==========
    console.log("🚪 Criando sala...");
    await db.insert(rooms).values({
      companyId,
      name: "Sala 01",
      description: "Consultório principal",
      active: true,
    }).onConflictDoNothing();
    console.log("  ✅ Sala criada");

    // ========== PROCEDURES ==========
    console.log("🦷 Criando procedimentos...");
    const procsData = [
      { name: "Consulta Avaliação", duration: 30, price: 10000, description: "Primeira consulta e avaliação", color: "#3B82F6", category: "geral" },
      { name: "Limpeza e Profilaxia", duration: 30, price: 15000, description: "Limpeza profissional", color: "#10B981", category: "prevencao" },
      { name: "Restauração Resina", duration: 45, price: 25000, description: "Restauração com resina composta", color: "#8B5CF6", category: "geral" },
      { name: "Extração Simples", duration: 30, price: 20000, description: "Extração dentária simples", color: "#EF4444", category: "cirurgia" },
      { name: "Clareamento Dental", duration: 60, price: 80000, description: "Clareamento a laser", color: "#F59E0B", category: "estetica" },
    ];

    for (const proc of procsData) {
      await db.insert(procedures).values({
        companyId,
        ...proc,
        active: true,
      }).onConflictDoNothing();
    }
    console.log("  ✅ 5 procedimentos criados");

    // ========== SALES FUNNEL ==========
    console.log("📊 Criando funil de vendas...");
    const existingStages = await db.select().from(salesFunnelStages).where(eq(salesFunnelStages.companyId, companyId)).limit(1);

    if (existingStages.length === 0) {
      const stages = [
        { name: "Lead Novo", code: "new_lead", color: "#6B7280", order: 1, isDefault: true },
        { name: "Contato Realizado", code: "contacted", color: "#3B82F6", order: 2 },
        { name: "Avaliação Agendada", code: "evaluation_scheduled", color: "#8B5CF6", order: 3 },
        { name: "Orçamento Enviado", code: "quote_sent", color: "#F59E0B", order: 4 },
        { name: "Fechado - Ganho", code: "won", color: "#10B981", order: 6, isWon: true },
        { name: "Fechado - Perdido", code: "lost", color: "#EF4444", order: 7, isLost: true },
      ];

      for (const stage of stages) {
        await db.insert(salesFunnelStages).values({
          companyId,
          ...stage,
        }).onConflictDoNothing();
      }
      console.log("  ✅ 6 etapas do funil criadas");
    } else {
      console.log("  ℹ️  Funil já existe");
    }

    // ========== RESUMO ==========
    console.log("\n" + "=".repeat(50));
    console.log("🎉 TUDO PRONTO!");
    console.log("=".repeat(50));
    console.log(`\n📍 Empresa: Clínica Teste (ID: ${companyId})`);
    console.log("📍 Plano: Profissional (Trial 14 dias)");
    console.log("\n🔑 Login:");
    console.log("   Usuário: admin");
    console.log("   Senha:   admin123");
    console.log("\n👩 Paciente: Maria da Silva Santos");
    console.log("   CPF: 123.456.789-00");
    console.log("   Tel: (11) 99876-5432\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ Erro:", error);
    process.exit(1);
  }
}

main();
