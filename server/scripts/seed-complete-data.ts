// @ts-nocheck
/**
 * Seed Completo - Popula TODAS as seções do sistema com dados realistas
 *
 * Uso: npx tsx server/scripts/seed-complete-data.ts
 * Ou via API: POST /api/v1/admin/seed-complete-data
 *
 * Cria dados para: Dashboard, Agenda, Pacientes, Financeiro, CRM,
 * Próteses, Estoque, Automações, e mais.
 */

import { db } from "../db";
import {
  companies, users, patients, appointments, procedures, appointmentProcedures,
  payments, inventoryItems, inventoryCategories, inventoryTransactions,
  riskAlertTypes, patientRiskAlerts, salesFunnelStages, salesOpportunities,
  salesOpportunityHistory, salesTasks, prosthesis, laboratories,
  prosthesisLabels, rooms, workingHours, automations, automationLogs,
  financialTransactions, anamnesis, patientRecords, patientExams,
  treatmentPlans, treatmentPlanProcedures, odontogramEntries, notifications,
  plans, subscriptions, modules, companyModules,
} from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

function randomDate(start: Date, end: Date) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function subDays(date: Date, days: number) {
  return addDays(date, -days);
}

function setTime(date: Date, hours: number, minutes: number) {
  const d = new Date(date);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

export async function seedCompleteData(targetCompanyId?: number) {
  const stats: Record<string, number> = {};

  console.log("🌱 Seed completo - populando todas as seções...\n");

  // ==================== EMPRESA E USUÁRIOS ====================
  let companyId = targetCompanyId;
  let adminId: number;
  let dentist1Id: number;
  let dentist2Id: number;
  let receptionistId: number;

  if (!companyId) {
    // Buscar empresa existente
    const [existing] = await db.select().from(companies).limit(1);
    if (existing) {
      companyId = existing.id;
    } else {
      const [comp] = await db.insert(companies).values({
        name: "Clínica Odontológica Sorriso Perfeito",
        email: "contato@sorrisoperfeito.com.br",
        phone: "(11) 3456-7890",
        address: "Av. Paulista, 1234 - Bela Vista, São Paulo - SP",
        cnpj: "12.345.678/0001-90",
        active: true,
        trialEndsAt: addDays(new Date(), 30),
      }).returning();
      companyId = comp.id;
    }
  }

  console.log(`📌 Empresa ID: ${companyId}`);

  // Buscar ou criar usuários
  const existingUsers = await db.select().from(users).where(eq(users.companyId, companyId));

  if (existingUsers.length > 0) {
    const admin = existingUsers.find(u => u.role === 'admin' || u.role === 'superadmin');
    const d1 = existingUsers.find(u => u.username === 'dra.ana');
    const d2 = existingUsers.find(u => u.username === 'dr.pedro');
    const recep = existingUsers.find(u => u.role === 'receptionist');

    adminId = admin?.id || existingUsers[0].id;
    dentist1Id = d1?.id || adminId;
    dentist2Id = d2?.id || adminId;
    receptionistId = recep?.id || adminId;
  } else {
    const usersResult = await db.insert(users).values([
      { username: "admin", password: await hashPassword("admin123"), fullName: "Dr. Carlos Mendes", email: "admin@sorrisoperfeito.com.br", role: "admin", phone: "(11) 98765-4321", speciality: "Gestão Clínica", active: true, companyId },
      { username: "dra.ana", password: await hashPassword("dentista123"), fullName: "Dra. Ana Paula Silva", email: "ana@sorrisoperfeito.com.br", role: "dentist", phone: "(11) 98765-1111", speciality: "Ortodontia", active: true, companyId },
      { username: "dr.pedro", password: await hashPassword("dentista123"), fullName: "Dr. Pedro Henrique Costa", email: "pedro@sorrisoperfeito.com.br", role: "dentist", phone: "(11) 98765-2222", speciality: "Implantodontia", active: true, companyId },
      { username: "maria", password: await hashPassword("recep123"), fullName: "Maria Santos", email: "maria@sorrisoperfeito.com.br", role: "receptionist", phone: "(11) 98765-3333", active: true, companyId },
    ]).returning();

    adminId = usersResult[0].id;
    dentist1Id = usersResult[1].id;
    dentist2Id = usersResult[2].id;
    receptionistId = usersResult[3].id;
    stats.users = 4;
  }

  const dentistIds = [dentist1Id, dentist2Id];

  // ==================== PLANOS E ASSINATURA ====================
  console.log("💳 Criando planos e assinatura...");
  const existingPlans = await db.select().from(plans).limit(1);
  let proplanId: number;

  if (existingPlans.length === 0) {
    const createdPlans = await db.insert(plans).values([
      { name: "basic", displayName: "Básico", description: "Para clínicas iniciantes", monthlyPrice: "97.00", yearlyPrice: "970.00", trialDays: 14, maxUsers: 3, maxPatients: 200, maxAppointmentsPerMonth: 300, maxAutomations: 3, maxStorageGB: 5, features: ["agenda", "pacientes", "financeiro_basico"], sortOrder: 1 },
      { name: "professional", displayName: "Profissional", description: "Para clínicas em crescimento", monthlyPrice: "197.00", yearlyPrice: "1970.00", trialDays: 14, maxUsers: 10, maxPatients: 1000, maxAppointmentsPerMonth: 1000, maxAutomations: 15, maxStorageGB: 20, features: ["agenda", "pacientes", "financeiro", "whatsapp", "crm", "estoque", "automacoes"], isPopular: true, sortOrder: 2 },
      { name: "enterprise", displayName: "Empresarial", description: "Para redes de clínicas", monthlyPrice: "497.00", yearlyPrice: "4970.00", trialDays: 14, maxUsers: 50, maxPatients: 10000, maxAppointmentsPerMonth: 10000, maxAutomations: 100, maxStorageGB: 100, features: ["agenda", "pacientes", "financeiro", "whatsapp", "crm", "estoque", "automacoes", "multi_unidade", "api", "relatorios_avancados"], sortOrder: 3 },
    ]).returning();
    proplanId = createdPlans[1].id;
    stats.plans = 3;
  } else {
    proplanId = existingPlans[0].id;
  }

  // Criar assinatura se não existir
  const existingSub = await db.select().from(subscriptions).where(eq(subscriptions.companyId, companyId)).limit(1);
  if (existingSub.length === 0) {
    await db.insert(subscriptions).values({
      companyId,
      planId: proplanId,
      status: "active",
      billingCycle: "monthly",
      currentPeriodStart: new Date(),
      currentPeriodEnd: addDays(new Date(), 30),
      trialEndsAt: addDays(new Date(), 14),
    });
    stats.subscriptions = 1;
  }

  // ==================== MÓDULOS ====================
  console.log("📦 Ativando módulos...");
  const existingModules = await db.select().from(modules).limit(1);
  if (existingModules.length === 0) {
    const mods = await db.insert(modules).values([
      { name: "clinic", displayName: "Clínica", description: "Agenda e pacientes", icon: "Calendar", isCore: true },
      { name: "financial", displayName: "Financeiro", description: "Controle financeiro", icon: "DollarSign" },
      { name: "inventory", displayName: "Estoque", description: "Gestão de estoque", icon: "Package" },
      { name: "automation", displayName: "Automações", description: "Automação via WhatsApp e email", icon: "Bot" },
      { name: "crm", displayName: "CRM", description: "Funil de vendas", icon: "Target" },
    ]).returning();

    for (const mod of mods) {
      await db.insert(companyModules).values({ companyId, moduleId: mod.id, isActive: true }).onConflictDoNothing();
    }
    stats.modules = 5;
  }

  // ==================== SALAS ====================
  console.log("🏠 Criando salas...");
  const existingRooms = await db.select().from(rooms).where(eq(rooms.companyId, companyId)).limit(1);
  let roomIds: number[] = [];

  if (existingRooms.length === 0) {
    const createdRooms = await db.insert(rooms).values([
      { companyId, name: "Consultório 01", description: "Consultório principal - cadeira Gnatus", active: true },
      { companyId, name: "Consultório 02", description: "Consultório de ortodontia", active: true },
      { companyId, name: "Consultório 03", description: "Consultório cirúrgico", active: true },
      { companyId, name: "Sala de Raio-X", description: "Equipamento panorâmico digital", active: true },
    ]).returning();
    roomIds = createdRooms.map(r => r.id);
    stats.rooms = 4;
  } else {
    const allRooms = await db.select().from(rooms).where(eq(rooms.companyId, companyId));
    roomIds = allRooms.map(r => r.id);
  }

  // ==================== HORÁRIOS DE TRABALHO ====================
  console.log("⏰ Criando horários de trabalho...");
  const existingWH = await db.select().from(workingHours).where(eq(workingHours.userId, dentistIds[0])).limit(1);
  if (existingWH.length === 0) {
    const whData = [];
    for (const uid of dentistIds) {
      for (let day = 1; day <= 5; day++) { // seg-sex
        whData.push({ userId: uid, dayOfWeek: day, startTime: "08:00", endTime: "12:00" });
        whData.push({ userId: uid, dayOfWeek: day, startTime: "13:00", endTime: "18:00" });
      }
      // sábado de manhã
      whData.push({ userId: uid, dayOfWeek: 6, startTime: "08:00", endTime: "12:00" });
    }
    await db.insert(workingHours).values(whData);
    stats.workingHours = whData.length;
  }

  // ==================== PROCEDIMENTOS ====================
  console.log("🦷 Criando procedimentos...");
  const existingProcs = await db.select().from(procedures).where(eq(procedures.companyId, companyId)).limit(1);
  let procIds: { id: number; price: number; duration: number; name: string }[] = [];

  if (existingProcs.length === 0) {
    const procsData = [
      { name: "Consulta de Avaliação", description: "Primeira consulta e plano de tratamento", price: 120.00, duration: 30, companyId, category: "consulta", color: "#3B82F6" },
      { name: "Limpeza e Profilaxia", description: "Limpeza profissional com ultrassom", price: 180.00, duration: 40, companyId, category: "prevenção", color: "#10B981" },
      { name: "Restauração em Resina", description: "Obturação com resina composta fotopolimerizável", price: 280.00, duration: 45, companyId, category: "restauração", color: "#6366F1" },
      { name: "Extração Simples", description: "Exodontia de dente erupcionado", price: 220.00, duration: 30, companyId, category: "cirurgia", color: "#EF4444" },
      { name: "Extração de Siso", description: "Extração de terceiro molar incluso", price: 650.00, duration: 60, companyId, category: "cirurgia", color: "#DC2626" },
      { name: "Tratamento de Canal", description: "Endodontia - tratamento endodôntico", price: 750.00, duration: 90, companyId, category: "endodontia", color: "#F59E0B" },
      { name: "Clareamento Dental", description: "Clareamento a laser em consultório", price: 900.00, duration: 60, companyId, category: "estética", color: "#EC4899" },
      { name: "Faceta de Porcelana", description: "Lente de contato dental em porcelana", price: 1800.00, duration: 60, companyId, category: "estética", color: "#D946EF" },
      { name: "Implante Dentário", description: "Colocação de implante osseointegrado", price: 3200.00, duration: 120, companyId, category: "implante", color: "#8B5CF6" },
      { name: "Coroa de Porcelana", description: "Prótese fixa unitária em porcelana", price: 1500.00, duration: 60, companyId, category: "prótese", color: "#F97316" },
      { name: "Manutenção Ortodôntica", description: "Ajuste mensal de aparelho fixo", price: 200.00, duration: 30, companyId, category: "ortodontia", color: "#14B8A6" },
      { name: "Instalação de Aparelho", description: "Instalação de aparelho ortodôntico fixo", price: 3800.00, duration: 90, companyId, category: "ortodontia", color: "#0EA5E9" },
      { name: "Aplicação de Flúor", description: "Aplicação tópica de flúor", price: 80.00, duration: 15, companyId, category: "prevenção", color: "#22C55E" },
      { name: "Radiografia Panorâmica", description: "Raio-X panorâmico digital", price: 100.00, duration: 15, companyId, category: "diagnóstico", color: "#64748B" },
      { name: "Prótese Total", description: "Dentadura completa superior ou inferior", price: 2200.00, duration: 60, companyId, category: "prótese", color: "#A855F7" },
    ];

    const created = await db.insert(procedures).values(procsData).returning();
    procIds = created.map(p => ({ id: p.id, price: p.price ?? 0, duration: p.duration ?? 30, name: p.name }));
    stats.procedures = created.length;
  } else {
    const allProcs = await db.select().from(procedures).where(eq(procedures.companyId, companyId));
    procIds = allProcs.map(p => ({ id: p.id, price: p.price ?? 0, duration: p.duration ?? 30, name: p.name }));
  }

  // ==================== PACIENTES ====================
  console.log("👥 Criando pacientes...");
  const existingPatients = await db.select().from(patients).where(eq(patients.companyId, companyId)).limit(1);
  let patientIds: number[] = [];

  if (existingPatients.length === 0) {
    const patientData = [
      { fullName: "Maria Clara Oliveira", email: "maria.clara@email.com", phone: "(11) 99123-4567", cpf: "123.456.789-00", birthDate: new Date(1985, 2, 15), gender: "female", address: "Rua Augusta, 1200 - Consolação, São Paulo - SP", zipCode: "01304-001" },
      { fullName: "João Pedro Santos", email: "joao.pedro@email.com", phone: "(11) 99234-5678", cpf: "234.567.890-11", birthDate: new Date(1978, 7, 22), gender: "male", address: "Av. Brigadeiro Faria Lima, 3000 - Itaim Bibi, SP", zipCode: "04538-132" },
      { fullName: "Ana Beatriz Lima", email: "ana.lima@email.com", phone: "(11) 99345-6789", cpf: "345.678.901-22", birthDate: new Date(1992, 0, 10), gender: "female", address: "Rua Oscar Freire, 800 - Jardins, São Paulo - SP", zipCode: "01426-001" },
      { fullName: "Carlos Eduardo Ferreira", email: "carlos.f@email.com", phone: "(11) 99456-7890", cpf: "456.789.012-33", birthDate: new Date(1965, 4, 30), gender: "male", address: "Rua Haddock Lobo, 595 - Cerqueira César, SP", zipCode: "01414-001" },
      { fullName: "Fernanda Costa Silva", email: "fernanda.cs@email.com", phone: "(11) 99567-8901", cpf: "567.890.123-44", birthDate: new Date(1990, 11, 5), gender: "female", address: "Al. Santos, 1500 - Jardim Paulista, SP", zipCode: "01418-100" },
      { fullName: "Ricardo Almeida Souza", email: "ricardo.as@email.com", phone: "(11) 99678-9012", cpf: "678.901.234-55", birthDate: new Date(1972, 8, 18), gender: "male", address: "Rua da Consolação, 2000 - Consolação, SP", zipCode: "01302-100" },
      { fullName: "Juliana Martins Rocha", email: "juliana.mr@email.com", phone: "(11) 99789-0123", cpf: "789.012.345-66", birthDate: new Date(1988, 3, 25), gender: "female", address: "Av. Paulista, 900 - Bela Vista, SP", zipCode: "01310-100" },
      { fullName: "Paulo Roberto Gomes", email: "paulo.rg@email.com", phone: "(11) 99890-1234", cpf: "890.123.456-77", birthDate: new Date(1955, 6, 12), gender: "male", address: "Rua Bela Cintra, 450 - Consolação, SP", zipCode: "01415-000" },
      { fullName: "Camila Rodrigues Dias", email: "camila.rd@email.com", phone: "(11) 99901-2345", cpf: "901.234.567-88", birthDate: new Date(1995, 1, 28), gender: "female", address: "Rua dos Pinheiros, 1300 - Pinheiros, SP", zipCode: "05422-001" },
      { fullName: "Lucas Henrique Pereira", email: "lucas.hp@email.com", phone: "(11) 99012-3456", cpf: "012.345.678-99", birthDate: new Date(2000, 9, 8), gender: "male", address: "Av. Rebouças, 2500 - Pinheiros, SP", zipCode: "05402-300" },
      { fullName: "Beatriz Alves Carvalho", email: "beatriz.ac@email.com", phone: "(21) 99111-2233", cpf: "111.222.333-44", birthDate: new Date(1982, 5, 3), gender: "female", address: "Rua Voluntários da Pátria, 200 - Botafogo, RJ", zipCode: "22270-010" },
      { fullName: "Gabriel Souza Nascimento", email: "gabriel.sn@email.com", phone: "(21) 99222-3344", cpf: "222.333.444-55", birthDate: new Date(1975, 10, 20), gender: "male", address: "Av. N. S. Copacabana, 800 - Copacabana, RJ", zipCode: "22050-000" },
      { fullName: "Amanda Costa Ribeiro", email: "amanda.cr@email.com", phone: "(11) 98111-4455", cpf: "333.444.555-66", birthDate: new Date(1998, 7, 14), gender: "female", address: "Rua Cardeal Arcoverde, 1800 - Pinheiros, SP", zipCode: "05407-002" },
      { fullName: "Rafael Lima Teixeira", email: "rafael.lt@email.com", phone: "(11) 98222-5566", cpf: "444.555.666-77", birthDate: new Date(1968, 2, 9), gender: "male", address: "Rua Teodoro Sampaio, 1500 - Pinheiros, SP", zipCode: "05405-150" },
      { fullName: "Isabela Fernandes Moreira", email: "isabela.fm@email.com", phone: "(11) 98333-6677", cpf: "555.666.777-88", birthDate: new Date(2002, 0, 22), gender: "female", address: "Rua Artur de Azevedo, 600 - Pinheiros, SP", zipCode: "05404-050" },
      { fullName: "Marcos Vinícius Barros", email: "marcos.vb@email.com", phone: "(11) 98444-7788", cpf: "666.777.888-99", birthDate: new Date(1960, 11, 1), gender: "male", address: "Al. Lorena, 1200 - Jardim Paulista, SP", zipCode: "01424-001" },
      { fullName: "Letícia Aparecida Santos", email: "leticia.as@email.com", phone: "(11) 98555-8899", cpf: "777.888.999-00", birthDate: new Date(1993, 4, 17), gender: "female", address: "Rua Pamplona, 300 - Jardim Paulista, SP", zipCode: "01405-000" },
      { fullName: "Thiago Oliveira Martins", email: "thiago.om@email.com", phone: "(11) 98666-9900", cpf: "888.999.000-11", birthDate: new Date(1987, 8, 6), gender: "male", address: "Av. Angélica, 900 - Higienópolis, SP", zipCode: "01228-000" },
      { fullName: "Larissa Gomes Pinto", email: "larissa.gp@email.com", phone: "(11) 98777-0011", cpf: "999.000.111-22", birthDate: new Date(1979, 6, 29), gender: "female", address: "Rua Maranhão, 400 - Higienópolis, SP", zipCode: "01240-000" },
      { fullName: "Diego Ramos Souza", email: "diego.rs@email.com", phone: "(11) 98888-1122", cpf: "000.111.222-33", birthDate: new Date(1996, 3, 11), gender: "male", address: "Rua Maria Antônia, 200 - Vila Buarque, SP", zipCode: "01222-010" },
    ].map(p => ({
      ...p,
      companyId,
      active: true,
      healthInsurance: Math.random() > 0.6 ? randomItem(["Unimed", "Bradesco Saúde", "Amil", "SulAmérica"]) : null,
      emergencyContact: `(11) 9${Math.floor(Math.random() * 9000 + 1000)}-${Math.floor(Math.random() * 9000 + 1000)}`,
      createdAt: subDays(new Date(), Math.floor(Math.random() * 180)),
    }));

    const created = await db.insert(patients).values(patientData).returning();
    patientIds = created.map(p => p.id);
    stats.patients = created.length;
  } else {
    const allPats = await db.select({ id: patients.id }).from(patients).where(eq(patients.companyId, companyId));
    patientIds = allPats.map(p => p.id);
  }

  // ==================== ANAMNESE ====================
  console.log("📋 Criando anamneses...");
  try {
    const existingAnamnesis = await db.select().from(anamnesis).where(eq(anamnesis.companyId, companyId)).limit(1);
    if (existingAnamnesis.length === 0 && patientIds.length > 0) {
      const anamData = patientIds.slice(0, 12).map((pid, i) => ({
        companyId,
        patientId: pid,
        chiefComplaint: randomItem(["Dor de dente", "Quero clarear os dentes", "Checkup semestral", "Sensibilidade ao frio", "Sangramento na gengiva", "Quero colocar aparelho", "Dente quebrado"]),
        medicalHistory: i % 4 === 0 ? "Hipertensão controlada com Losartana 50mg" : i % 3 === 0 ? "Diabetes tipo 2" : null,
        currentMedications: i % 4 === 0 ? "Losartana 50mg, AAS 100mg" : i % 5 === 0 ? "Metformina 850mg" : null,
        allergiesDetail: i % 6 === 0 ? "Alergia a Penicilina e derivados" : null,
        dentalHistory: "Última visita ao dentista há " + randomItem(["3 meses", "6 meses", "1 ano", "2 anos"]),
        oralHygieneFequency: randomItem(["3x ao dia", "2x ao dia", "1x ao dia"]),
        smoking: i % 8 === 0,
        alcohol: i % 5 === 0,
        bruxism: i % 4 === 0,
        heartDisease: i % 7 === 0,
        highBloodPressure: i % 4 === 0,
        diabetes: i % 5 === 0,
        dentalAnxietyLevel: Math.floor(Math.random() * 6),
        weight: String(55 + Math.floor(Math.random() * 40)),
        height: String(155 + Math.floor(Math.random() * 30)),
        createdBy: randomItem(dentistIds),
      }));
      await db.insert(anamnesis).values(anamData);
      stats.anamnesis = anamData.length;
    }
  } catch (e: any) {
    console.log("⚠️  Anamnese pulada (colunas faltando no banco):", e.message?.slice(0, 80));
  }

  // ==================== ALERTAS DE RISCO ====================
  console.log("⚠️ Criando alertas de risco...");
  try {
  const existingRiskTypes = await db.select().from(riskAlertTypes).limit(1);
  if (existingRiskTypes.length === 0) {
    await db.insert(riskAlertTypes).values([
      { companyId: null, code: "allergy", name: "Alergia", color: "#EF4444", icon: "pill", severity: "critical", description: "Alergia a medicamentos ou materiais", clinicalWarning: "ATENÇÃO: Verificar histórico de alergias antes de administrar medicamento." },
      { companyId: null, code: "cardiac", name: "Cardiopatia", color: "#DC2626", icon: "heart", severity: "high", description: "Condição cardíaca", clinicalWarning: "Evitar anestésicos com vasoconstritor em doses altas." },
      { companyId: null, code: "diabetes", name: "Diabetes", color: "#F59E0B", icon: "droplet", severity: "high", description: "Paciente diabético", clinicalWarning: "Agendar consultas pela manhã. Verificar glicemia." },
      { companyId: null, code: "anticoagulant", name: "Anticoagulante", color: "#EF4444", icon: "syringe", severity: "critical", description: "Uso de anticoagulantes", clinicalWarning: "SUSPENDER medicação 5-7 dias antes de procedimentos invasivos." },
      { companyId: null, code: "pregnancy", name: "Gestante", color: "#EC4899", icon: "baby", severity: "high", description: "Paciente gestante", clinicalWarning: "Evitar radiografias no 1o trimestre. Usar apenas anestésicos seguros." },
      { companyId: null, code: "hypertension", name: "Hipertensão", color: "#F97316", icon: "activity", severity: "medium", description: "Paciente hipertenso", clinicalWarning: "Verificar pressão arterial antes do procedimento." },
    ] as any);
    stats.riskAlertTypes = 6;
  }
  } catch (e: any) { console.log("⚠️  Alertas de risco pulados:", e.message?.slice(0, 80)); }

  // ==================== AGENDAMENTOS ====================
  console.log("📅 Criando agendamentos...");
  const existingApts = await db.select({ id: appointments.id }).from(appointments).where(eq(appointments.companyId, companyId)).limit(1);
  let appointmentIds: { id: number; patientId: number | null; status: string; startTime: Date; endTime: Date }[] = [];

  if (existingApts.length === 0 && patientIds.length > 0 && procIds.length > 0) {
    const aptsData = [];

    // 100 agendamentos passados (últimos 90 dias)
    for (let i = 0; i < 100; i++) {
      const daysAgo = Math.floor(Math.random() * 90) + 1;
      const hour = 8 + Math.floor(Math.random() * 9);
      const minute = randomItem([0, 15, 30, 45]);
      const proc = randomItem(procIds);
      const pid = randomItem(patientIds);
      const did = randomItem(dentistIds);

      const startTime = setTime(subDays(new Date(), daysAgo), hour, minute);
      const endTime = new Date(startTime.getTime() + proc.duration * 60000);
      const status = daysAgo > 7 ? (Math.random() > 0.15 ? "completed" : randomItem(["cancelled", "no_show"])) : randomItem(["completed", "confirmed", "cancelled"]);

      aptsData.push({
        title: proc.name,
        patientId: pid,
        professionalId: did,
        roomId: roomIds.length > 0 ? randomItem(roomIds) : null,
        startTime,
        endTime,
        status: status as any,
        notes: i % 7 === 0 ? "Paciente relatou sensibilidade" : i % 11 === 0 ? "Reavaliar em 30 dias" : null,
        companyId,
        createdAt: subDays(startTime, Math.floor(Math.random() * 7) + 1),
      });
    }

    // 50 agendamentos futuros (próximos 30 dias)
    for (let i = 0; i < 50; i++) {
      const daysAhead = Math.floor(Math.random() * 30) + 1;
      const hour = 8 + Math.floor(Math.random() * 9);
      const minute = randomItem([0, 15, 30, 45]);
      const proc = randomItem(procIds);
      const pid = randomItem(patientIds);
      const did = randomItem(dentistIds);

      const startTime = setTime(addDays(new Date(), daysAhead), hour, minute);
      const endTime = new Date(startTime.getTime() + proc.duration * 60000);

      aptsData.push({
        title: proc.name,
        patientId: pid,
        professionalId: did,
        roomId: roomIds.length > 0 ? randomItem(roomIds) : null,
        startTime,
        endTime,
        status: randomItem(["scheduled", "confirmed", "confirmed"]) as any,
        companyId,
        createdAt: subDays(new Date(), Math.floor(Math.random() * 5)),
      });
    }

    const created = await db.insert(appointments).values(aptsData).returning();
    appointmentIds = created.map(a => ({ id: a.id, patientId: a.patientId, status: a.status ?? "scheduled", startTime: a.startTime!, endTime: a.endTime! }));
    stats.appointments = created.length;

    // Vincular procedimentos
    const aptProcData = created.map(apt => ({
      appointmentId: apt.id,
      procedureId: randomItem(procIds).id,
      quantity: 1,
      price: randomItem(procIds).price,
    }));
    await db.insert(appointmentProcedures).values(aptProcData);
  } else {
    const all = await db.select({ id: appointments.id, patientId: appointments.patientId, status: appointments.status, startTime: appointments.startTime, endTime: appointments.endTime }).from(appointments).where(eq(appointments.companyId, companyId));
    appointmentIds = all.map(a => ({ id: a.id, patientId: a.patientId, status: a.status ?? "scheduled", startTime: a.startTime!, endTime: a.endTime! }));
  }

  // ==================== PAGAMENTOS / FINANCEIRO ====================
  console.log("💰 Criando transações financeiras...");
  try {
  const existingFin = await db.select({ id: financialTransactions.id }).from(financialTransactions).where(eq(financialTransactions.companyId, companyId)).limit(1);

  if (existingFin.length === 0 && appointmentIds.length > 0) {
    const completedApts = appointmentIds.filter(a => a.status === "completed");
    const finData = [];

    // Receitas dos atendimentos
    for (const apt of completedApts.slice(0, 70)) {
      const proc = randomItem(procIds);
      const method = randomItem(["cash", "credit_card", "debit_card", "pix", "pix", "credit_card"]);
      const amount = Math.round(proc.price * 100); // cents
      const feeRate = method === "credit_card" ? 0.032 : method === "debit_card" ? 0.015 : 0;
      const feeAmount = Math.round(amount * feeRate);

      finData.push({
        companyId,
        type: "income",
        category: "procedimento",
        description: proc.name,
        amount,
        patientId: apt.patientId,
        appointmentId: apt.id,
        professionalId: randomItem(dentistIds),
        date: apt.endTime,
        paymentMethod: method,
        status: "paid",
        feeAmount,
        netAmount: amount - feeAmount,
      });
    }

    // Despesas fixas dos últimos 3 meses
    const expenseCategories = [
      { cat: "aluguel", desc: "Aluguel do consultório", amount: 800000 },
      { cat: "energia", desc: "Conta de energia elétrica", amount: 95000 },
      { cat: "agua", desc: "Conta de água", amount: 25000 },
      { cat: "internet", desc: "Internet fibra óptica", amount: 29900 },
      { cat: "limpeza", desc: "Serviço de limpeza", amount: 180000 },
      { cat: "contabilidade", desc: "Honorários contábeis", amount: 120000 },
      { cat: "material", desc: "Material odontológico", amount: 350000 },
      { cat: "software", desc: "Licença software gestão", amount: 19700 },
    ];

    for (let month = 0; month < 3; month++) {
      for (const exp of expenseCategories) {
        finData.push({
          companyId,
          type: "expense",
          category: exp.cat,
          description: exp.desc,
          amount: exp.amount + Math.floor(Math.random() * 5000), // pequena variação
          date: subDays(new Date(), month * 30 + Math.floor(Math.random() * 28)),
          paymentMethod: randomItem(["bank_transfer", "pix", "cash"]),
          status: "paid",
          professionalId: null,
          patientId: null,
          appointmentId: null,
          feeAmount: 0,
          netAmount: exp.amount,
        });
      }
    }

    await db.insert(financialTransactions).values(finData as any);
    stats.financialTransactions = finData.length;
  }
  } catch (e: any) { console.log("⚠️  Financeiro pulado:", e.message?.slice(0, 80)); }

  // ==================== ESTOQUE ====================
  console.log("📦 Criando estoque...");
  try {
  const existingInv = await db.select().from(inventoryItems).where(eq(inventoryItems.companyId, companyId)).limit(1);

  if (existingInv.length === 0) {
    // Categorias
    const cats = await db.insert(inventoryCategories).values([
      { companyId, name: "EPI", description: "Equipamentos de Proteção Individual" },
      { companyId, name: "Anestésicos", description: "Anestésicos locais" },
      { companyId, name: "Materiais Restauradores", description: "Resinas, amálgamas, cimentos" },
      { companyId, name: "Instrumentais", description: "Brocas, limas, espátulas" },
      { companyId, name: "Descartáveis", description: "Sugadores, gazes, algodão" },
      { companyId, name: "Produtos de Higiene", description: "Pastas, flúor, enxaguantes" },
    ]).returning();

    const catMap: Record<string, number> = {};
    cats.forEach(c => { catMap[c.name] = c.id; });

    const invData = [
      { name: "Luvas Nitrilo P (cx 100)", currentStock: 45, minimumStock: 10, unitOfMeasure: "caixa", price: 3500, categoryId: catMap["EPI"] },
      { name: "Luvas Nitrilo M (cx 100)", currentStock: 60, minimumStock: 10, unitOfMeasure: "caixa", price: 3500, categoryId: catMap["EPI"] },
      { name: "Máscaras Cirúrgicas (cx 50)", currentStock: 35, minimumStock: 15, unitOfMeasure: "caixa", price: 1800, categoryId: catMap["EPI"] },
      { name: "Óculos de Proteção", currentStock: 12, minimumStock: 4, unitOfMeasure: "unidade", price: 2500, categoryId: catMap["EPI"] },
      { name: "Lidocaína 2% c/ Epinefrina", currentStock: 150, minimumStock: 40, unitOfMeasure: "tubete", price: 280, categoryId: catMap["Anestésicos"] },
      { name: "Mepivacaína 3% s/ Vaso", currentStock: 80, minimumStock: 20, unitOfMeasure: "tubete", price: 320, categoryId: catMap["Anestésicos"] },
      { name: "Articaína 4% c/ Epinefrina", currentStock: 60, minimumStock: 20, unitOfMeasure: "tubete", price: 450, categoryId: catMap["Anestésicos"] },
      { name: "Resina Z350 A2 (seringa)", currentStock: 8, minimumStock: 3, unitOfMeasure: "seringa", price: 9500, categoryId: catMap["Materiais Restauradores"] },
      { name: "Resina Z350 A3 (seringa)", currentStock: 6, minimumStock: 3, unitOfMeasure: "seringa", price: 9500, categoryId: catMap["Materiais Restauradores"] },
      { name: "Cimento Ionômero Vidro", currentStock: 5, minimumStock: 2, unitOfMeasure: "kit", price: 7800, categoryId: catMap["Materiais Restauradores"] },
      { name: "Ácido Fosfórico 37%", currentStock: 15, minimumStock: 5, unitOfMeasure: "seringa", price: 1200, categoryId: catMap["Materiais Restauradores"] },
      { name: "Adesivo Single Bond", currentStock: 4, minimumStock: 2, unitOfMeasure: "frasco", price: 12500, categoryId: catMap["Materiais Restauradores"] },
      { name: "Brocas Diamantadas (kit 10)", currentStock: 6, minimumStock: 2, unitOfMeasure: "kit", price: 15000, categoryId: catMap["Instrumentais"] },
      { name: "Limas Endodônticas K-File", currentStock: 20, minimumStock: 8, unitOfMeasure: "caixa", price: 4500, categoryId: catMap["Instrumentais"] },
      { name: "Sugadores Descartáveis (pct 40)", currentStock: 25, minimumStock: 10, unitOfMeasure: "pacote", price: 1200, categoryId: catMap["Descartáveis"] },
      { name: "Gaze Estéril (pct 10)", currentStock: 80, minimumStock: 20, unitOfMeasure: "pacote", price: 350, categoryId: catMap["Descartáveis"] },
      { name: "Rolos de Algodão (pct 100)", currentStock: 40, minimumStock: 10, unitOfMeasure: "pacote", price: 800, categoryId: catMap["Descartáveis"] },
      { name: "Pasta Profilática Menta", currentStock: 18, minimumStock: 5, unitOfMeasure: "pote", price: 2200, categoryId: catMap["Produtos de Higiene"] },
      { name: "Flúor Gel Neutro 200ml", currentStock: 12, minimumStock: 4, unitOfMeasure: "frasco", price: 2800, categoryId: catMap["Produtos de Higiene"] },
      { name: "Peróxido Hidrogênio 35%", currentStock: 5, minimumStock: 2, unitOfMeasure: "kit", price: 25000, categoryId: catMap["Produtos de Higiene"] },
    ].map(item => ({ ...item, companyId, description: item.name }));

    const createdInv = await db.insert(inventoryItems).values(invData).returning();
    stats.inventoryItems = createdInv.length;

    // Transações
    const txData: any[] = [];
    for (const item of createdInv) {
      txData.push({ itemId: item.id, userId: adminId, type: "entrada", quantity: item.currentStock || 0, reason: "Estoque inicial", previousStock: 0, newStock: item.currentStock || 0 });
      // Saídas aleatórias
      let stock = item.currentStock || 0;
      for (let j = 0; j < Math.floor(Math.random() * 4) + 1; j++) {
        const qty = Math.floor(Math.random() * 5) + 1;
        const newStock = Math.max(0, stock - qty);
        txData.push({ itemId: item.id, userId: adminId, type: "saida", quantity: qty, reason: "Uso em procedimento", previousStock: stock, newStock });
        stock = newStock;
      }
    }
    await db.insert(inventoryTransactions).values(txData);
    stats.inventoryTransactions = txData.length;
  }
  } catch (e: any) { console.log("⚠️  Estoque pulado:", e.message?.slice(0, 80)); }

  // ==================== LABORATÓRIOS E PRÓTESES ====================
  console.log("🔬 Criando laboratórios e próteses...");
  try {
  const existingLabs = await db.select().from(laboratories).where(eq(laboratories.companyId, companyId)).limit(1);

  if (existingLabs.length === 0 && patientIds.length > 0) {
    const labs = await db.insert(laboratories).values([
      { companyId, name: "Dental Lab São Paulo", contactName: "Roberto Silva", phone: "(11) 3333-1111", email: "contato@dentallab.com.br", address: "Rua Vergueiro, 2000 - Vila Mariana, SP", specialties: ["Coroa", "Ponte", "Faceta"] },
      { companyId, name: "ProDent Laboratório", contactName: "Ana Carla", phone: "(11) 3333-2222", email: "ana@prodent.com.br", address: "Av. Ibirapuera, 500 - Moema, SP", specialties: ["Prótese Total", "PPR", "Provisório"] },
      { companyId, name: "CeramicArt Lab", contactName: "Fernando Mendes", phone: "(11) 3333-3333", email: "fernando@ceramicart.com.br", address: "Rua Augusta, 2500 - Jardins, SP", specialties: ["Faceta", "Lente de Contato", "Inlay", "Onlay"] },
    ]).returning();

    // Labels
    await db.insert(prosthesisLabels).values([
      { companyId, name: "Urgente", color: "#EF4444" },
      { companyId, name: "Estética", color: "#EC4899" },
      { companyId, name: "Implante", color: "#8B5CF6" },
      { companyId, name: "Retrabalho", color: "#F59E0B" },
    ]);

    // Próteses
    const prosthesisData = [
      { type: "Coroa de Porcelana", description: "Coroa metal-free em zircônia - dente 16", laboratory: labs[0].name, status: "completed", cost: 35000, price: 150000 },
      { type: "Faceta de Porcelana", description: "Facetas de porcelana - dentes 11 a 13", laboratory: labs[2].name, status: "sent", cost: 90000, price: 540000 },
      { type: "Ponte Fixa", description: "Ponte fixa 3 elementos - 24 a 26", laboratory: labs[0].name, status: "pending", cost: 80000, price: 450000 },
      { type: "Prótese Total Superior", description: "Dentadura superior completa", laboratory: labs[1].name, status: "returned", cost: 45000, price: 220000 },
      { type: "Provisório", description: "Coroa provisória dente 21", laboratory: labs[1].name, status: "completed", cost: 5000, price: 25000 },
      { type: "Inlay de Porcelana", description: "Inlay cerâmico dente 36", laboratory: labs[2].name, status: "sent", cost: 25000, price: 120000 },
      { type: "Coroa sobre Implante", description: "Coroa parafusada sobre implante - região 46", laboratory: labs[0].name, status: "pending", cost: 50000, price: 180000 },
      { type: "PPR (Prótese Parcial Removível)", description: "PPR classe III Kennedy inferior", laboratory: labs[1].name, status: "sent", cost: 35000, price: 180000 },
    ].map((p, i) => ({
      ...p,
      companyId,
      patientId: patientIds[i % patientIds.length],
      professionalId: randomItem(dentistIds),
      sentDate: p.status !== "pending" ? subDays(new Date(), Math.floor(Math.random() * 20) + 5).toISOString().split("T")[0] : null,
      expectedReturnDate: addDays(new Date(), Math.floor(Math.random() * 15) + 3).toISOString().split("T")[0],
      returnDate: p.status === "completed" || p.status === "returned" ? subDays(new Date(), Math.floor(Math.random() * 5)).toISOString().split("T")[0] : null,
    }));

    await db.insert(prosthesis).values(prosthesisData as any);
    stats.prosthesis = prosthesisData.length;
    stats.laboratories = labs.length;
  }
  } catch (e: any) { console.log("⚠️  Próteses puladas:", e.message?.slice(0, 80)); }

  // ==================== CRM - FUNIL DE VENDAS ====================
  console.log("🎯 Criando CRM...");
  try {
  const existingStages = await db.select().from(salesFunnelStages).where(eq(salesFunnelStages.companyId, companyId)).limit(1);

  if (existingStages.length === 0) {
    const { seedDefaultStages } = await import("../services/crm-auto-progression");
    await seedDefaultStages(companyId);
  }

  const stages = await db.select().from(salesFunnelStages).where(eq(salesFunnelStages.companyId, companyId));
  const existingOpps = await db.select({ id: salesOpportunities.id }).from(salesOpportunities).where(eq(salesOpportunities.companyId, companyId)).limit(1);

  if (existingOpps.length === 0 && stages.length > 0) {
    const stageByTrigger: Record<string, number> = {};
    for (const s of stages) {
      if (s.automationTrigger) stageByTrigger[s.automationTrigger] = s.id;
    }
    const defaultStageId = stages.find((s: any) => s.isDefault)?.id || stages[0].id;

    const opps = [
      { title: "Implante - Maria Clara", leadName: "Maria Clara Oliveira", leadPhone: "(11) 99123-4567", leadSource: "whatsapp", treatmentType: "implante", estimatedValue: "8500.00", probability: 80, aiStage: "confirmation" },
      { title: "Ortodontia - João Pedro", leadName: "João Pedro Santos", leadPhone: "(11) 99234-5678", leadSource: "instagram", treatmentType: "ortodontia", estimatedValue: "6000.00", probability: 60, aiStage: "scheduling" },
      { title: "Clareamento - Ana Beatriz", leadName: "Ana Beatriz Lima", leadPhone: "(11) 99345-6789", leadSource: "google", treatmentType: "clareamento", estimatedValue: "1200.00", probability: 90, aiStage: "consultation_done" },
      { title: "Faceta - Carlos Eduardo", leadName: "Carlos Eduardo Ferreira", leadPhone: "(11) 99456-7890", leadSource: "indicacao", treatmentType: "harmonizacao", estimatedValue: "12000.00", probability: 40, aiStage: "first_contact" },
      { title: "Limpeza - Fernanda Costa", leadName: "Fernanda Costa Silva", leadPhone: "(11) 99567-8901", leadSource: "site", treatmentType: "limpeza", estimatedValue: "350.00", probability: 95, aiStage: "payment_done" },
      { title: "Canal - Ricardo Almeida", leadName: "Ricardo Almeida Souza", leadPhone: "(11) 99678-9012", leadSource: "whatsapp", treatmentType: "canal", estimatedValue: "2200.00", probability: 70, aiStage: "scheduling" },
      { title: "Prótese - Juliana Martins", leadName: "Juliana Martins Rocha", leadPhone: "(11) 99789-0123", leadSource: "instagram", treatmentType: "protese", estimatedValue: "5000.00", probability: 50, aiStage: "first_contact" },
      { title: "Restauração - Paulo Roberto", leadName: "Paulo Roberto Gomes", leadPhone: "(11) 99890-1234", leadSource: "telefone", treatmentType: "restauracao", estimatedValue: "800.00", probability: 85, aiStage: "confirmation" },
      { title: "Implante - Camila Rodrigues", leadName: "Camila Rodrigues Dias", leadPhone: "(11) 99901-2345", leadSource: "google", treatmentType: "implante", estimatedValue: "12000.00", probability: 30, aiStage: "first_contact" },
      { title: "Extração - Lucas Henrique", leadName: "Lucas Henrique Pereira", leadPhone: "(11) 99012-3456", leadSource: "whatsapp", treatmentType: "extracao", estimatedValue: "600.00", probability: 75, aiStage: "consultation_done" },
      { title: "Aparelho - Isabela Fernandes", leadName: "Isabela Fernandes Moreira", leadPhone: "(11) 98333-6677", leadSource: "instagram", treatmentType: "ortodontia", estimatedValue: "4500.00", probability: 65, aiStage: "scheduling" },
      { title: "Clareamento - Letícia Santos", leadName: "Letícia Aparecida Santos", leadPhone: "(11) 98555-8899", leadSource: "google", treatmentType: "clareamento", estimatedValue: "900.00", probability: 88, aiStage: "confirmation" },
    ];

    for (const opp of opps) {
      const stageId = stageByTrigger[opp.aiStage] || defaultStageId;
      const [created] = await db.insert(salesOpportunities).values({
        companyId, title: opp.title, leadName: opp.leadName, leadPhone: opp.leadPhone,
        leadSource: opp.leadSource, treatmentType: opp.treatmentType, estimatedValue: opp.estimatedValue,
        probability: opp.probability, aiStage: opp.aiStage, aiStageUpdatedAt: new Date(),
        stageId, stageEnteredAt: new Date(),
      }).returning();

      await db.insert(salesOpportunityHistory).values({
        opportunityId: created.id, toStageId: stageId, action: "created",
        description: "Oportunidade criada", createdBy: adminId,
      });
    }

    // Tarefas de follow-up
    const allOpps = await db.select().from(salesOpportunities).where(eq(salesOpportunities.companyId, companyId));
    for (const opp of allOpps.slice(0, 6)) {
      await db.insert(salesTasks).values({
        companyId, opportunityId: opp.id,
        title: randomItem(["Ligar para confirmar interesse", "Enviar orçamento por WhatsApp", "Follow-up após avaliação", "Verificar retorno do paciente"]),
        description: "Tarefa de acompanhamento do lead",
        type: randomItem(["call", "whatsapp", "email"]),
        dueDate: addDays(new Date(), Math.floor(Math.random() * 7) + 1),
        assignedTo: randomItem(dentistIds),
        status: "pending",
        priority: randomItem(["low", "medium", "high"]),
        createdBy: adminId,
      });
    }
    stats.crmOpportunities = opps.length;
  }
  } catch (e: any) { console.log("⚠️  CRM pulado:", e.message?.slice(0, 80)); }

  // ==================== AUTOMAÇÕES ====================
  console.log("🤖 Criando automações...");
  try {
  const existingAut = await db.select().from(automations).where(eq(automations.companyId, companyId)).limit(1);

  if (existingAut.length === 0) {
    await db.insert(automations).values([
      { companyId, name: "Lembrete 24h antes", triggerType: "time_before", timeBeforeValue: 24, timeBeforeUnit: "hours", whatsappEnabled: true, whatsappTemplateId: "appointment_reminder_24h", emailEnabled: true, emailSubject: "Lembrete: Consulta amanhã", emailBody: "Olá {{patient_name}}, lembramos que sua consulta está marcada para amanhã às {{appointment_time}}.", active: true, executionCount: 156, lastExecution: subDays(new Date(), 1) },
      { companyId, name: "Lembrete 2h antes", triggerType: "time_before", timeBeforeValue: 2, timeBeforeUnit: "hours", whatsappEnabled: true, whatsappTemplateId: "appointment_reminder_2h", active: true, executionCount: 142, lastExecution: subDays(new Date(), 0) },
      { companyId, name: "Confirmação agendamento", triggerType: "appointment", appointmentStatus: "scheduled", whatsappEnabled: true, whatsappTemplateId: "appointment_confirmation", emailEnabled: true, emailSubject: "Consulta confirmada!", emailBody: "Sua consulta foi agendada com sucesso para {{appointment_date}} às {{appointment_time}}.", active: true, executionCount: 98 },
      { companyId, name: "Pós-consulta - Avaliação", triggerType: "after_appointment", timeBeforeValue: 2, timeBeforeUnit: "hours", whatsappEnabled: true, whatsappTemplateId: "post_appointment_review", active: true, executionCount: 45 },
      { companyId, name: "Reativação 30 dias", triggerType: "time_before", timeBeforeValue: 30, timeBeforeUnit: "days", whatsappEnabled: true, whatsappTemplateId: "reactivation_30d", active: false, executionCount: 12 },
    ]);
    stats.automations = 5;
  }
  } catch (e: any) { console.log("⚠️  Automações puladas:", e.message?.slice(0, 80)); }

  // ==================== PLANOS DE TRATAMENTO ====================
  console.log("📝 Criando planos de tratamento...");
  try {
  const existingTP = await db.select().from(treatmentPlans).where(eq(treatmentPlans.companyId, companyId)).limit(1);

  if (existingTP.length === 0 && patientIds.length > 0 && procIds.length > 0) {
    const tpData = [
      { name: "Reabilitação Oral Completa", description: "Tratamento completo incluindo implantes e próteses", totalAmount: 2800000, paidAmount: 1200000, status: "in_progress", patientIdx: 0 },
      { name: "Tratamento Ortodôntico", description: "Aparelho fixo + manutenções mensais por 24 meses", totalAmount: 850000, paidAmount: 380000, status: "in_progress", patientIdx: 1 },
      { name: "Clareamento + Facetas", description: "Clareamento dental + 6 facetas de porcelana", totalAmount: 1200000, paidAmount: 1200000, status: "completed", patientIdx: 2 },
      { name: "Implante Unitário + Coroa", description: "Implante região 36 + coroa de porcelana", totalAmount: 470000, paidAmount: 0, status: "proposed", patientIdx: 3 },
      { name: "Tratamento Periodontal", description: "Raspagem + manutenção periodontal trimestral", totalAmount: 180000, paidAmount: 60000, status: "in_progress", patientIdx: 5 },
    ];

    for (const tp of tpData) {
      const [plan] = await db.insert(treatmentPlans).values({
        companyId, patientId: patientIds[tp.patientIdx], professionalId: randomItem(dentistIds),
        name: tp.name, description: tp.description, totalAmount: tp.totalAmount,
        paidAmount: tp.paidAmount, status: tp.status as any,
        startDate: tp.status !== "proposed" ? subDays(new Date(), Math.floor(Math.random() * 60) + 30) : null,
        completedDate: tp.status === "completed" ? subDays(new Date(), Math.floor(Math.random() * 15)) : null,
      }).returning();

      // Procedimentos do plano
      const numProcs = Math.floor(Math.random() * 3) + 2;
      for (let j = 0; j < numProcs; j++) {
        const proc = randomItem(procIds);
        const unitPrice = Math.round(proc.price * 100);
        await db.insert(treatmentPlanProcedures).values({
          treatmentPlanId: plan.id, procedureId: proc.id, quantity: 1,
          unitPrice, totalPrice: unitPrice,
          status: tp.status === "completed" ? "completed" : j === 0 ? "completed" : "pending",
        });
      }
    }
    stats.treatmentPlans = tpData.length;
  }
  } catch (e: any) { console.log("⚠️  Planos de tratamento pulados:", e.message?.slice(0, 80)); }

  // ==================== ODONTOGRAMA ====================
  console.log("🦷 Criando odontogramas...");
  try {
  const existingOdonto = await db.select().from(odontogramEntries).where(eq(odontogramEntries.companyId, companyId)).limit(1);

  if (existingOdonto.length === 0 && patientIds.length > 0) {
    const conditions = ["caries", "restoration", "crown", "implant", "extraction", "root_canal", "missing"];
    const surfaces = ["mesial", "distal", "oclusal", "vestibular", "lingual"];
    const odontoData: any[] = [];

    for (const pid of patientIds.slice(0, 10)) {
      const numEntries = Math.floor(Math.random() * 6) + 2;
      for (let j = 0; j < numEntries; j++) {
        const toothNum = randomItem([11, 12, 13, 14, 15, 16, 17, 18, 21, 22, 23, 24, 25, 26, 27, 28, 31, 32, 33, 34, 35, 36, 37, 38, 41, 42, 43, 44, 45, 46, 47, 48]);
        odontoData.push({
          companyId, patientId: pid, toothNumber: toothNum,
          condition: randomItem(conditions), surface: randomItem(surfaces),
          notes: Math.random() > 0.7 ? "Acompanhar evolução" : null,
          createdBy: randomItem(dentistIds),
        });
      }
    }
    await db.insert(odontogramEntries).values(odontoData);
    stats.odontogramEntries = odontoData.length;
  }
  } catch (e: any) { console.log("⚠️  Odontograma pulado:", e.message?.slice(0, 80)); }

  // ==================== PRONTUÁRIOS ====================
  console.log("📄 Criando prontuários...");
  try {
  const existingRecords = await db.select().from(patientRecords).where(eq(patientRecords.companyId, companyId)).limit(1);

  if (existingRecords.length === 0 && patientIds.length > 0) {
    const recordsData: any[] = [];
    for (const pid of patientIds.slice(0, 12)) {
      const numRecords = Math.floor(Math.random() * 3) + 1;
      for (let j = 0; j < numRecords; j++) {
        recordsData.push({
          companyId, patientId: pid, recordType: randomItem(["evolution", "evolution", "prescription", "document"]),
          content: {
            text: randomItem([
              "Paciente compareceu para consulta de rotina. Higiene oral satisfatória. Sem queixas.",
              "Realizada restauração em resina composta dente 36 face oclusal. Paciente tolerou bem o procedimento.",
              "Aplicação de flúor gel neutro. Orientações de higiene oral reforçadas.",
              "Remoção de tártaro supragengival. Sangramento gengival leve. Retorno em 6 meses.",
              "Moldagem para coroa provisória dente 21. Envio ao laboratório hoje.",
              "Paciente relata sensibilidade ao frio no dente 14. Teste de vitalidade positivo. Prescrição de creme dental para sensibilidade.",
            ]),
            date: subDays(new Date(), Math.floor(Math.random() * 90)).toISOString(),
          },
          createdBy: randomItem(dentistIds),
          createdAt: subDays(new Date(), Math.floor(Math.random() * 90)),
        });
      }
    }
    await db.insert(patientRecords).values(recordsData);
    stats.patientRecords = recordsData.length;
  }
  } catch (e: any) { console.log("⚠️  Prontuários pulados:", e.message?.slice(0, 80)); }

  // ==================== NOTIFICAÇÕES ====================
  console.log("🔔 Criando notificações...");
  try {
  const existingNotifs = await db.select().from(notifications).where(eq(notifications.companyId, companyId)).limit(1);

  if (existingNotifs.length === 0) {
    await db.insert(notifications).values([
      { companyId, userId: adminId, type: "appointment", title: "Nova consulta agendada", message: "Maria Clara agendou consulta para amanhã às 09:00", isRead: false },
      { companyId, userId: adminId, type: "payment", title: "Pagamento recebido", message: "Pagamento de R$ 280,00 confirmado via PIX - João Pedro Santos", isRead: false },
      { companyId, userId: adminId, type: "inventory", title: "Estoque baixo", message: "Resina Z350 A3 está com estoque abaixo do mínimo (6 unidades)", isRead: false },
      { companyId, userId: adminId, type: "appointment", title: "Consulta cancelada", message: "Carlos Eduardo cancelou a consulta de sexta-feira", isRead: true },
      { companyId, userId: adminId, type: "system", title: "Backup realizado", message: "Backup automático do banco de dados concluído com sucesso", isRead: true },
      { companyId, userId: dentist1Id, type: "appointment", title: "Agenda atualizada", message: "3 novos agendamentos para esta semana", isRead: false },
      { companyId, userId: dentist2Id, type: "crm", title: "Nova oportunidade", message: "Nova oportunidade no CRM - Implante Dentário (R$ 8.500)", isRead: false },
    ]);
    stats.notifications = 7;
  }
  } catch (e: any) { console.log("⚠️  Notificações puladas:", e.message?.slice(0, 80)); }

  // ==================== RESUMO ====================
  console.log("\n🎉 Seed completo finalizado!\n");
  console.log("📋 Resumo:");
  Object.entries(stats).forEach(([key, val]) => {
    console.log(`   - ${key}: ${val}`);
  });

  return { success: true, companyId, stats };
}

// Execução direta via CLI
const isMainModule = typeof import.meta !== 'undefined' && import.meta.url &&
  import.meta.url.endsWith('seed-complete-data.ts');

if (isMainModule) {
  seedCompleteData()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Erro:", err);
      process.exit(1);
    });
}
