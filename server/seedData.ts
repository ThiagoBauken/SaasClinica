import { db } from "./db";
import {
  companies,
  users,
  patients,
  appointments,
  procedures,
  appointmentProcedures,
  payments,
  inventoryItems,
  inventoryTransactions,
  riskAlertTypes,
  salesFunnelStages
} from "@shared/schema";
import { eq } from "drizzle-orm";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { addDays, subDays, subMonths, setHours, setMinutes, startOfMonth, endOfMonth } from "date-fns";

import { logger } from './logger';
const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

/**
 * Seed completo do banco de dados com dados realistas
 */
export async function seedDatabase() {
  try {
    logger.info('Iniciando seed do banco de dados...\n');

    // 1. Criar ou buscar empresas de exemplo
    logger.info('Criando empresas...');

    // Verificar se empresas já existem
    const existingCompanies = await db.select().from(companies).limit(2);

    let company1, company2;
    if (existingCompanies && existingCompanies.length > 0) {
      logger.info('Empresas já existem, usando existentes...');
      company1 = existingCompanies[0];
      company2 = existingCompanies[1];
    } else {
      // Criar novas empresas
      const companiesResult = await db
        .insert(companies)
        .values([
          {
            name: "Clínica Odontológica Sorriso Perfeito",
            email: "contato@sorrisoperfeito.com.br",
            phone: "(11) 3456-7890",
            address: "Av. Paulista, 1234 - Bela Vista, São Paulo - SP",
            cnpj: "12.345.678/0001-90",
            active: true,
            trialEndsAt: addDays(new Date(), 30)
          },
          {
            name: "DentalCare Plus",
            email: "atendimento@dentalcareplus.com.br",
            phone: "(21) 2345-6789",
            address: "Rua das Laranjeiras, 567 - Laranjeiras, Rio de Janeiro - RJ",
            cnpj: "98.765.432/0001-10",
            active: true,
            trialEndsAt: addDays(new Date(), 15)
          }
        ])
        .returning();

      [company1, company2] = companiesResult;
    }

    if (!company1?.id) {
      throw new Error('SEED ERROR: Failed to find or create company — cannot proceed without a valid companyId');
    }
    const companyId = company1.id;
    logger.info({ companyName: company1?.name, companyId }, 'Companies created')

    // 2. Criar ou buscar usuários (dentistas, recepcionistas, admin)
    logger.info('Criando usuários...');

    // Verificar se usuários já existem para esta empresa
    const existingUsers = await db.select().from(users).where(eq(users.companyId, companyId));

    type UserRow = typeof users.$inferSelect;
    let admin, dentist1, dentist2, receptionist;
    if (existingUsers && existingUsers.length > 0) {
      logger.info('Usuários já existem, usando existentes...');
      admin = existingUsers.find((u: UserRow) => u.role === 'admin');
      dentist1 = existingUsers.find((u: UserRow) => u.username === 'dra.ana');
      dentist2 = existingUsers.find((u: UserRow) => u.username === 'dr.pedro');
      receptionist = existingUsers.find((u: UserRow) => u.role === 'receptionist');
    } else {
      // Criar novos usuários
      const usersResult = await db
        .insert(users)
        .values([
          {
            username: "admin",
            password: await hashPassword("admin123"),
            fullName: "Dr. Carlos Administrador",
            email: "admin@sorrisoperfeito.com.br",
            role: "admin",
            phone: "(11) 98765-4321",
            speciality: "Gestão Clínica",
            active: true,
            companyId,
            trialEndsAt: addDays(new Date(), 30)
          },
          {
            username: "dra.ana",
            password: await hashPassword("dentista123"),
            fullName: "Dra. Ana Paula Silva",
            email: "ana.silva@sorrisoperfeito.com.br",
            role: "dentist",
            phone: "(11) 98765-1111",
            speciality: "Ortodontia",
            active: true,
            companyId,
            trialEndsAt: addDays(new Date(), 30)
          },
          {
            username: "dr.pedro",
            password: await hashPassword("dentista123"),
            fullName: "Dr. Pedro Henrique Costa",
            email: "pedro.costa@sorrisoperfeito.com.br",
            role: "dentist",
            phone: "(11) 98765-2222",
            speciality: "Implantodontia",
            active: true,
            companyId,
            trialEndsAt: addDays(new Date(), 30)
          },
          {
            username: "maria",
            password: await hashPassword("recep123"),
            fullName: "Maria Santos",
            email: "maria@sorrisoperfeito.com.br",
            role: "receptionist",
            phone: "(11) 98765-3333",
            speciality: null,
            active: true,
            companyId,
            trialEndsAt: addDays(new Date(), 30)
          }
        ])
        .returning();

      [admin, dentist1, dentist2, receptionist] = usersResult;
    }

    logger.info({ 4: 4 }, '{4} usuários criados\n')

    // 3. Criar pacientes realistas
    logger.info('Criando pacientes...');
    const patientNames = [
      { name: "João da Silva", email: "joao.silva@email.com", phone: "(11) 99111-1111", cpf: "123.456.789-00" },
      { name: "Maria Oliveira", email: "maria.oliveira@email.com", phone: "(11) 99222-2222", cpf: "234.567.890-11" },
      { name: "José Santos", email: "jose.santos@email.com", phone: "(11) 99333-3333", cpf: "345.678.901-22" },
      { name: "Ana Costa", email: "ana.costa@email.com", phone: "(11) 99444-4444", cpf: "456.789.012-33" },
      { name: "Carlos Pereira", email: "carlos.pereira@email.com", phone: "(11) 99555-5555", cpf: "567.890.123-44" },
      { name: "Juliana Ferreira", email: "juliana.ferreira@email.com", phone: "(11) 99666-6666", cpf: "678.901.234-55" },
      { name: "Paulo Rodrigues", email: "paulo.rodrigues@email.com", phone: "(11) 99777-7777", cpf: "789.012.345-66" },
      { name: "Fernanda Lima", email: "fernanda.lima@email.com", phone: "(11) 99888-8888", cpf: "890.123.456-77" },
      { name: "Ricardo Alves", email: "ricardo.alves@email.com", phone: "(11) 99999-9999", cpf: "901.234.567-88" },
      { name: "Beatriz Souza", email: "beatriz.souza@email.com", phone: "(11) 98111-1111", cpf: "012.345.678-99" },
      { name: "Lucas Martins", email: "lucas.martins@email.com", phone: "(11) 98222-2222", cpf: "111.222.333-00" },
      { name: "Camila Rocha", email: "camila.rocha@email.com", phone: "(11) 98333-3333", cpf: "222.333.444-11" },
      { name: "Rafael Gomes", email: "rafael.gomes@email.com", phone: "(11) 98444-4444", cpf: "333.444.555-22" },
      { name: "Amanda Dias", email: "amanda.dias@email.com", phone: "(11) 98555-5555", cpf: "444.555.666-33" },
      { name: "Gabriel Carvalho", email: "gabriel.carvalho@email.com", phone: "(11) 98666-6666", cpf: "555.666.777-44" }
    ];

    const patientsData = patientNames.map((p, idx) => ({
      fullName: p.name,
      email: p.email,
      phone: p.phone,
      cpf: p.cpf,
      birthDate: new Date(1970 + (idx * 2), idx % 12, (idx * 3) % 28 + 1),
      address: `Rua Exemplo, ${100 + idx} - Bairro, São Paulo - SP`,
      zipCode: `01234-${String(idx).padStart(3, '0')}`,
      emergencyContact: `(11) 9${8000 + idx}-${String(idx * 111).padStart(4, '0')}`,
      healthInsurance: idx % 3 === 0 ? "Unimed" : idx % 3 === 1 ? "Bradesco Saúde" : null,
      healthInsuranceNumber: idx % 3 === 0 ? `UNI${String(idx * 1000).padStart(8, '0')}` : idx % 3 === 1 ? `BRA${String(idx * 2000).padStart(8, '0')}` : null,
      allergies: idx % 5 === 0 ? "Penicilina" : null,
      medicalConditions: idx % 4 === 0 ? "Diabetes tipo 2" : null,
      companyId,
      active: true,
      createdAt: subDays(new Date(), Math.floor(Math.random() * 180)) // Pacientes criados nos últimos 6 meses
    }));

    const createdPatients = await db
      .insert(patients)
      .values(patientsData)
      .returning()
      .onConflictDoNothing();

    logger.info({ count: createdPatients.length }, 'Patients created')

    // 4. Criar procedimentos padrão
    logger.info('Criando procedimentos...');
    const proceduresData = [
      { name: "Limpeza e Profilaxia", description: "Limpeza profissional dos dentes", price: 150.00, duration: 30, companyId },
      { name: "Obturação (Resina)", description: "Restauração com resina composta", price: 250.00, duration: 45, companyId },
      { name: "Extração Simples", description: "Extração de dente sem complicações", price: 200.00, duration: 30, companyId },
      { name: "Clareamento Dental", description: "Clareamento a laser", price: 800.00, duration: 60, companyId },
      { name: "Manutenção Ortodôntica", description: "Consulta de manutenção do aparelho", price: 180.00, duration: 30, companyId },
      { name: "Implante Dentário", description: "Colocação de implante", price: 2500.00, duration: 120, companyId },
      { name: "Canal (Endodontia)", description: "Tratamento de canal", price: 600.00, duration: 90, companyId },
      { name: "Prótese Fixa", description: "Coroa em porcelana", price: 1200.00, duration: 60, companyId },
      { name: "Aparelho Ortodôntico", description: "Instalação de aparelho fixo", price: 3500.00, duration: 90, companyId },
      { name: "Consulta Avaliação", description: "Primeira consulta e avaliação", price: 100.00, duration: 30, companyId }
    ];

    const createdProcedures = await db
      .insert(procedures)
      .values(proceduresData)
      .returning()
      .onConflictDoNothing();

    logger.info({ count: createdProcedures.length }, 'Procedures created')

    // 5. Criar agendamentos dos últimos 3 meses + futuro
    logger.info('Criando agendamentos...');
    const appointmentsData = [];
    const statuses = ['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show'];
    const dentistIds = [dentist1?.id, dentist2?.id].filter(Boolean);

    // Agendamentos passados (últimos 90 dias)
    for (let i = 0; i < 80; i++) {
      const daysAgo = Math.floor(Math.random() * 90);
      const hour = 8 + Math.floor(Math.random() * 9); // 8h às 17h
      const minute = Math.random() > 0.5 ? 0 : 30;
      const patientId = createdPatients[Math.floor(Math.random() * createdPatients.length)]?.id;
      const dentistId = dentistIds[Math.floor(Math.random() * dentistIds.length)];
      const procedureId = createdProcedures[Math.floor(Math.random() * createdProcedures.length)]?.id;

      const startTime = setMinutes(setHours(subDays(new Date(), daysAgo), hour), minute);
      type ProcedureRow = typeof procedures.$inferSelect;
      const duration = createdProcedures.find((p: ProcedureRow) => p.id === procedureId)?.duration || 30;
      const endTime = new Date(startTime.getTime() + duration * 60000);

      // Agendamentos passados são mais provavelmente completed ou confirmed
      const status = daysAgo > 7
        ? (Math.random() > 0.2 ? 'completed' : (Math.random() > 0.5 ? 'confirmed' : 'cancelled'))
        : statuses[Math.floor(Math.random() * statuses.length)];

      appointmentsData.push({
        title: "Consulta Odontológica",
        patientId,
        professionalId: dentistId,
        startTime,
        endTime,
        status: status as any,
        notes: i % 5 === 0 ? "Paciente relatou sensibilidade" : null,
        companyId,
        createdAt: subDays(startTime, 1) // Criado 1 dia antes
      });
    }

    // Agendamentos futuros (próximos 30 dias)
    for (let i = 0; i < 40; i++) {
      const daysAhead = Math.floor(Math.random() * 30) + 1;
      const hour = 8 + Math.floor(Math.random() * 9);
      const minute = Math.random() > 0.5 ? 0 : 30;
      const patientId = createdPatients[Math.floor(Math.random() * createdPatients.length)]?.id;
      const dentistId = dentistIds[Math.floor(Math.random() * dentistIds.length)];
      const procedureId = createdProcedures[Math.floor(Math.random() * createdProcedures.length)]?.id;

      const startTime = setMinutes(setHours(addDays(new Date(), daysAhead), hour), minute);
      type ProcedureRow = typeof procedures.$inferSelect;
      const duration = createdProcedures.find((p: ProcedureRow) => p.id === procedureId)?.duration || 30;
      const endTime = new Date(startTime.getTime() + duration * 60000);

      appointmentsData.push({
        title: "Consulta Odontológica",
        patientId,
        professionalId: dentistId,
        startTime,
        endTime,
        status: Math.random() > 0.3 ? 'confirmed' as any : 'scheduled' as any,
        notes: null,
        companyId,
        createdAt: new Date()
      });
    }

    const createdAppointments = await db
      .insert(appointments)
      .values(appointmentsData)
      .returning()
      .onConflictDoNothing();

    logger.info({ count: createdAppointments.length }, 'Appointments created')

    // 6. Vincular procedimentos aos agendamentos
    logger.info('Vinculando procedimentos aos agendamentos...');
    type AppointmentRow = typeof appointments.$inferSelect;
    const appointmentProceduresData = createdAppointments.map((apt: AppointmentRow) => ({
      appointmentId: apt.id,
      procedureId: createdProcedures[Math.floor(Math.random() * createdProcedures.length)]?.id!,
      quantity: 1,
      price: createdProcedures.find((p: typeof procedures.$inferSelect) => p.id)?.price || 150.00
    }));

    await db
      .insert(appointmentProcedures)
      .values(appointmentProceduresData)
      .onConflictDoNothing();

    logger.info('Procedimentos vinculados\n')

    // 7. Criar pagamentos
    logger.info('Criando pagamentos...');
    const paymentsData = [];

    // Pagamentos para agendamentos completados
    const completedAppointments = createdAppointments.filter((apt: AppointmentRow) => apt.status === 'completed');

    for (const apt of completedAppointments) {
      type AppointmentProcedureData = typeof appointmentProceduresData[0];
      const procedure = appointmentProceduresData.find((ap: AppointmentProcedureData) => ap.appointmentId === apt.id);
      if (procedure) {
        paymentsData.push({
          appointmentId: apt.id,
          patientId: apt.patientId,
          amount: procedure.price.toFixed(2),
          paymentMethod: ['credit_card', 'debit_card', 'cash', 'pix'][Math.floor(Math.random() * 4)] as any,
          status: Math.random() > 0.1 ? 'confirmed' as any : 'pending' as any,
          paymentDate: apt.endTime,
          companyId
        });
      }
    }

    await db
      .insert(payments)
      .values(paymentsData)
      .onConflictDoNothing();

    logger.info({ count: paymentsData.length }, 'Payments created')

    // 8. Criar itens de estoque
    logger.info('Criando itens de estoque...');
    const inventoryData = [
      { name: "Luvas Descartáveis (cx c/ 100)", description: "Luvas descartáveis para procedimentos", currentStock: 50, minimumStock: 10, unitOfMeasure: "caixa", price: 2500, companyId },
      { name: "Máscaras Cirúrgicas (cx c/ 50)", description: "Máscaras cirúrgicas descartáveis", currentStock: 80, minimumStock: 20, unitOfMeasure: "caixa", price: 1500, companyId },
      { name: "Anestésico Lidocaína 2%", description: "Anestésico local", currentStock: 120, minimumStock: 30, unitOfMeasure: "tubete", price: 250, companyId },
      { name: "Resina Composta A2", description: "Resina para restaurações", currentStock: 15, minimumStock: 5, unitOfMeasure: "seringa", price: 8500, companyId },
      { name: "Resina Composta A3", description: "Resina para restaurações", currentStock: 12, minimumStock: 5, unitOfMeasure: "seringa", price: 8500, companyId },
      { name: "Brocas Diamantadas (kit)", description: "Kit de brocas para procedimentos", currentStock: 8, minimumStock: 3, unitOfMeasure: "kit", price: 12000, companyId },
      { name: "Fio Dental (rolo)", description: "Fio dental para uso profissional", currentStock: 200, minimumStock: 50, unitOfMeasure: "unidade", price: 350, companyId },
      { name: "Pasta Profilática", description: "Pasta para limpeza dental", currentStock: 25, minimumStock: 10, unitOfMeasure: "pote", price: 1800, companyId },
      { name: "Flúor Gel", description: "Gel fluoretado para aplicação", currentStock: 30, minimumStock: 10, unitOfMeasure: "frasco", price: 2200, companyId },
      { name: "Gaze Estéril (pacote)", description: "Gaze estéril para procedimentos", currentStock: 100, minimumStock: 25, unitOfMeasure: "pacote", price: 800, companyId }
    ];

    const createdInventory = await db
      .insert(inventoryItems)
      .values(inventoryData)
      .returning()
      .onConflictDoNothing();

    logger.info({ count: createdInventory.length }, 'Inventory items created')

    // 9. Criar transações de estoque
    logger.info('Criando transações de estoque...');
    const transactionsData = [];

    for (const item of createdInventory) {
      let currentStockLevel = 0;

      // Entrada inicial
      transactionsData.push({
        itemId: item.id,
        userId: admin.id,
        type: 'entrada' as any,
        quantity: item.currentStock || 0,
        reason: "Estoque inicial",
        previousStock: currentStockLevel,
        newStock: (item.currentStock || 0)
      });

      currentStockLevel = item.currentStock || 0;

      // Algumas saídas aleatórias
      const numExits = Math.floor(Math.random() * 5) + 1;
      for (let i = 0; i < numExits; i++) {
        const exitQty = Math.floor(Math.random() * 10) + 1;
        const newStock = Math.max(0, currentStockLevel - exitQty);

        transactionsData.push({
          itemId: item.id,
          userId: admin.id,
          type: 'saida' as any,
          quantity: exitQty,
          reason: "Uso em procedimento",
          previousStock: currentStockLevel,
          newStock: newStock
        });

        currentStockLevel = newStock;
      }
    }

    await db
      .insert(inventoryTransactions)
      .values(transactionsData)
      .onConflictDoNothing();

    logger.info({ count: transactionsData.length }, 'Inventory transactions created')

    // 9. Criar tipos de alertas de risco (globais)
    logger.info('Criando tipos de alertas de risco...');

    const riskAlertTypesData = [
      {
        companyId: null, // Global
        code: 'allergy',
        name: 'Alergia',
        color: '#EF4444',
        icon: 'pill',
        severity: 'critical',
        description: 'Paciente possui alergia a medicamentos ou materiais',
        clinicalWarning: 'ATENÇÃO: Verificar histórico de alergias antes de administrar qualquer medicamento ou utilizar materiais.',
      },
      {
        companyId: null,
        code: 'cardiac',
        name: 'Cardiopatia',
        color: '#DC2626',
        icon: 'heart',
        severity: 'high',
        description: 'Paciente possui condição cardíaca',
        clinicalWarning: 'Evitar uso de anestésicos com vasoconstritor em doses altas. Monitorar pressão arterial. Consultar cardiologista se necessário.',
      },
      {
        companyId: null,
        code: 'diabetes',
        name: 'Diabetes',
        color: '#F59E0B',
        icon: 'droplet',
        severity: 'high',
        description: 'Paciente diabético',
        clinicalWarning: 'Agendar consultas pela manhã. Verificar glicemia. Atenção à cicatrização pós-procedimentos.',
      },
      {
        companyId: null,
        code: 'anticoagulant',
        name: 'Anticoagulante',
        color: '#EF4444',
        icon: 'syringe',
        severity: 'critical',
        description: 'Paciente em uso de anticoagulantes',
        clinicalWarning: 'SUSPENDER medicação 5-7 dias antes de procedimentos invasivos (com autorização médica). Risco de sangramento prolongado.',
      },
      {
        companyId: null,
        code: 'pregnancy',
        name: 'Gestante',
        color: '#EC4899',
        icon: 'baby',
        severity: 'high',
        description: 'Paciente gestante',
        clinicalWarning: 'Evitar radiografias no 1º trimestre. Usar apenas anestésicos seguros na gestação. Preferir 2º trimestre para tratamentos.',
      },
      {
        companyId: null,
        code: 'immunosuppressed',
        name: 'Imunossuprimido',
        color: '#7C3AED',
        icon: 'shield-alert',
        severity: 'critical',
        description: 'Paciente com sistema imunológico comprometido',
        clinicalWarning: 'Alto risco de infecções. Profilaxia antibiótica pode ser necessária. Ambiente estéril rigoroso.',
      },
      {
        companyId: null,
        code: 'bisphosphonate',
        name: 'Bifosfonatos',
        color: '#DC2626',
        icon: 'activity',
        severity: 'critical',
        description: 'Paciente em uso de bifosfonatos (Fosamax, Zometa, etc.)',
        clinicalWarning: 'RISCO DE OSTEONECROSE MANDIBULAR. Evitar extrações e procedimentos invasivos. Encaminhar para especialista.',
      },
      {
        companyId: null,
        code: 'hypertension',
        name: 'Hipertensão',
        color: '#F97316',
        icon: 'activity',
        severity: 'medium',
        description: 'Paciente hipertenso',
        clinicalWarning: 'Verificar pressão arterial antes do procedimento. Usar anestésico com vasoconstritor com cautela.',
      },
    ];

    await db
      .insert(riskAlertTypes)
      .values(riskAlertTypesData as any)
      .onConflictDoNothing();

    logger.info({ count: riskAlertTypesData.length }, 'Risk alert types created')

    // 10. Criar etapas padrão do funil de vendas
    logger.info('Criando etapas do funil de vendas...');

    const funnelStagesData = [
      {
        companyId,
        name: 'Lead Novo',
        code: 'new_lead',
        color: '#6B7280',
        order: 1,
        isDefault: true,
      },
      {
        companyId,
        name: 'Contato Realizado',
        code: 'contacted',
        color: '#3B82F6',
        order: 2,
      },
      {
        companyId,
        name: 'Avaliação Agendada',
        code: 'evaluation_scheduled',
        color: '#8B5CF6',
        order: 3,
      },
      {
        companyId,
        name: 'Orçamento Enviado',
        code: 'quote_sent',
        color: '#F59E0B',
        order: 4,
      },
      {
        companyId,
        name: 'Negociação',
        code: 'negotiation',
        color: '#F97316',
        order: 5,
      },
      {
        companyId,
        name: 'Fechado - Ganho',
        code: 'won',
        color: '#10B981',
        order: 6,
        isWon: true,
      },
      {
        companyId,
        name: 'Fechado - Perdido',
        code: 'lost',
        color: '#EF4444',
        order: 7,
        isLost: true,
      },
    ];

    await db
      .insert(salesFunnelStages)
      .values(funnelStagesData)
      .onConflictDoNothing();

    logger.info({ count: funnelStagesData.length }, 'Funnel stages created')

    logger.info('Seed do banco de dados concluído com sucesso!\n');
    logger.info('Resumo:');
    logger.info({ 1: 1 }, '- {1} empresa')
    logger.info({ 4: 4 }, '- {4} usuários')
    logger.info({ count: createdPatients.length }, 'Summary: patients')
    logger.info({ count: createdProcedures.length }, 'Summary: procedures')
    logger.info({ count: createdAppointments.length }, 'Summary: appointments')
    logger.info({ count: paymentsData.length }, 'Summary: payments')
    logger.info({ count: createdInventory.length }, 'Summary: inventory items')
    logger.info({ count: transactionsData.length }, 'Summary: inventory transactions')

    return {
      success: true,
      companyId,
      stats: {
        companies: 1,
        users: 4,
        patients: createdPatients.length,
        procedures: createdProcedures.length,
        appointments: createdAppointments.length,
        payments: paymentsData.length,
        inventory: createdInventory.length,
        transactions: transactionsData.length
      }
    };
  } catch (error) {
    logger.error({ err: error }, 'Erro ao fazer seed do banco:');
    throw error;
  }
}
