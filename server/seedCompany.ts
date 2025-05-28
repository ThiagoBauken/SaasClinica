import { db } from "./db";
import { companies, users, modules, companyModules } from "@shared/schema";
import { eq } from "drizzle-orm";

/**
 * Cria uma empresa padrão para desenvolvimento e migração
 */
export async function createDefaultCompany() {
  try {
    // Verificar se já existe uma empresa padrão
    const existingCompany = await db.select().from(companies).limit(1);
    
    if (existingCompany.length > 0) {
      return existingCompany[0];
    }

    // Criar empresa padrão
    const [defaultCompany] = await db
      .insert(companies)
      .values({
        name: "Clínica Odontológica Demo",
        email: "contato@clinicademo.com",
        phone: "(11) 99999-9999",
        address: "Rua Demo, 123 - Centro",
        cnpj: "00.000.000/0001-00",
        active: true,
        trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 dias
      })
      .returning();

    // Criar módulos básicos
    const moduleNames = [
      { name: "clinic", displayName: "Gestão Clínica", description: "Agendamentos e pacientes" },
      { name: "financial", displayName: "Financeiro", description: "Controle financeiro" },
      { name: "inventory", displayName: "Estoque", description: "Controle de estoque" },
      { name: "automation", displayName: "Automações", description: "N8N e WhatsApp" },
    ];

    for (const moduleData of moduleNames) {
      const [module] = await db
        .insert(modules)
        .values({
          ...moduleData,
          version: "1.0.0",
          isActive: true,
          requiredPermissions: ["read", "write"],
        })
        .onConflictDoNothing()
        .returning();

      if (module) {
        // Ativar módulo para a empresa
        await db
          .insert(companyModules)
          .values({
            companyId: defaultCompany.id,
            moduleId: module.id,
            isEnabled: true,
            settings: {},
          })
          .onConflictDoNothing();
      }
    }

    console.log(`✅ Empresa padrão criada: ${defaultCompany.name} (ID: ${defaultCompany.id})`);
    return defaultCompany;
  } catch (error) {
    console.error("❌ Erro ao criar empresa padrão:", error);
    throw error;
  }
}

/**
 * Atualiza usuários existentes para pertencerem à empresa padrão
 */
export async function migrateUsersToDefaultCompany() {
  try {
    const defaultCompany = await createDefaultCompany();
    
    // Buscar usuários sem companyId
    const usersWithoutCompany = await db
      .select()
      .from(users)
      .where(eq(users.companyId, 0)); // Assumindo que 0 significa sem empresa
    
    if (usersWithoutCompany.length > 0) {
      // Atualizar usuários para pertencerem à empresa padrão
      await db
        .update(users)
        .set({ companyId: defaultCompany.id })
        .where(eq(users.companyId, 0));
      
      console.log(`✅ ${usersWithoutCompany.length} usuários migrados para empresa padrão`);
    }

    return defaultCompany;
  } catch (error) {
    console.error("❌ Erro na migração de usuários:", error);
    throw error;
  }
}