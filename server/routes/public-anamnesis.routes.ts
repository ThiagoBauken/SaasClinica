/**
 * Rotas para Anamnese Pública via Link
 *
 * Permite que pacientes preencham anamnese remotamente antes da consulta
 * através de um link enviado via WhatsApp
 */

import { Router } from 'express';
import { db } from '../db';
import { eq, and } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import {
  publicAnamnesisLinks,
  publicAnamnesisResponses,
  patients,
  appointments,
  anamnesisTemplates,
  anamnesis,
  clinicSettings,
  companies,
  riskAlertTypes,
  patientRiskAlerts,
} from '@shared/schema';
import { requireAuth } from '../middleware/auth';

const router = Router();

// ==================== ROTAS AUTENTICADAS (Admin) ====================

/**
 * POST /api/public-anamnesis/create-link
 * Cria um link público de anamnese para um paciente/agendamento
 */
router.post('/create-link', requireAuth, async (req, res) => {
  try {
    const companyId = req.user?.companyId!;
    const userId = req.user?.id;
    const { patientId, appointmentId, templateId, expiresInHours } = req.body;

    // Gerar token único
    const token = randomBytes(32).toString('hex');

    // Calcular expiração (default: 7 dias)
    const expiresAt = expiresInHours
      ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const [link] = await db
      .insert(publicAnamnesisLinks)
      .values({
        companyId,
        patientId: patientId || null,
        appointmentId: appointmentId || null,
        templateId: templateId || null,
        token,
        expiresAt,
        createdBy: userId,
      })
      .returning();

    // Buscar configurações da clínica para montar URL completa
    const [settings] = await db
      .select()
      .from(clinicSettings)
      .where(eq(clinicSettings.companyId, companyId))
      .limit(1);

    // URL base (usar env ou inferir)
    const baseUrl = process.env.PUBLIC_URL || process.env.VITE_API_URL || 'http://localhost:5000';
    const publicUrl = `${baseUrl}/anamnese/${token}`;

    res.status(201).json({
      link,
      publicUrl,
      expiresAt,
    });
  } catch (error: any) {
    console.error('Erro ao criar link de anamnese:', error);
    res.status(500).json({ error: 'Erro ao criar link de anamnese' });
  }
});

/**
 * POST /api/public-anamnesis/send-whatsapp
 * Envia link de anamnese via WhatsApp
 */
router.post('/send-whatsapp', requireAuth, async (req, res) => {
  try {
    const companyId = req.user?.companyId!;
    const { patientId, appointmentId, templateId } = req.body;

    // Buscar paciente
    const [patient] = await db
      .select()
      .from(patients)
      .where(
        and(
          eq(patients.id, patientId),
          eq(patients.companyId, companyId)
        )
      );

    if (!patient) {
      return res.status(404).json({ error: 'Paciente não encontrado' });
    }

    const phone = patient.whatsappPhone || patient.cellphone || patient.phone;
    if (!phone) {
      return res.status(400).json({ error: 'Paciente não possui telefone cadastrado' });
    }

    // Criar link
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 horas

    const [link] = await db
      .insert(publicAnamnesisLinks)
      .values({
        companyId,
        patientId,
        appointmentId: appointmentId || null,
        templateId: templateId || null,
        token,
        expiresAt,
        createdBy: req.user?.id,
      })
      .returning();

    // Buscar configurações
    const [settings] = await db
      .select()
      .from(clinicSettings)
      .where(eq(clinicSettings.companyId, companyId))
      .limit(1);

    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    const baseUrl = process.env.PUBLIC_URL || 'http://localhost:5000';
    const publicUrl = `${baseUrl}/anamnese/${token}`;

    // Montar mensagem
    const patientFirstName = patient.fullName?.split(' ')[0] || 'Paciente';
    const message = `Olá ${patientFirstName}! 😊

Para agilizar seu atendimento na ${settings?.name || company?.name || 'clínica'}, pedimos que preencha sua ficha de saúde pelo link abaixo:

🔗 ${publicUrl}

⏰ Este link é válido por 48 horas.

O preenchimento leva menos de 5 minutos e suas informações são confidenciais.

Caso tenha dúvidas, responda esta mensagem.

${settings?.name || company?.name || ''}`;

    // Enviar via WhatsApp (usar serviço existente)
    const { createWhatsAppService, getWhatsAppConfig } = await import('../services/whatsapp.service');
    const whatsappConfig = await getWhatsAppConfig(null, companyId);

    let result: { success: boolean; error?: string; messageId?: string } = { success: false, error: 'WhatsApp não configurado' };
    if (whatsappConfig?.instanceId && whatsappConfig?.apiKey) {
      const whatsappService = createWhatsAppService(whatsappConfig);
      result = await whatsappService.sendMessage({ phone, message });
    }

    res.json({
      success: true,
      linkId: link.id,
      publicUrl,
      whatsappResult: result,
    });
  } catch (error: any) {
    console.error('Erro ao enviar link de anamnese:', error);
    res.status(500).json({ error: 'Erro ao enviar link de anamnese' });
  }
});

/**
 * GET /api/public-anamnesis/links
 * Lista links de anamnese da empresa
 */
router.get('/links', requireAuth, async (req, res) => {
  try {
    const companyId = req.user?.companyId!;

    const links = await db
      .select({
        link: publicAnamnesisLinks,
        patient: patients,
      })
      .from(publicAnamnesisLinks)
      .leftJoin(patients, eq(publicAnamnesisLinks.patientId, patients.id))
      .where(eq(publicAnamnesisLinks.companyId, companyId))
      .orderBy(publicAnamnesisLinks.createdAt);

    res.json(links);
  } catch (error: any) {
    console.error('Erro ao listar links:', error);
    res.status(500).json({ error: 'Erro ao listar links' });
  }
});

/**
 * GET /api/public-anamnesis/responses
 * Lista respostas de anamnese pendentes de processamento
 */
router.get('/responses', requireAuth, async (req, res) => {
  try {
    const companyId = req.user?.companyId!;
    const { status = 'pending' } = req.query;

    const responses = await db
      .select()
      .from(publicAnamnesisResponses)
      .where(
        and(
          eq(publicAnamnesisResponses.companyId, companyId),
          eq(publicAnamnesisResponses.status, status as string)
        )
      )
      .orderBy(publicAnamnesisResponses.createdAt);

    res.json(responses);
  } catch (error: any) {
    console.error('Erro ao listar respostas:', error);
    res.status(500).json({ error: 'Erro ao listar respostas' });
  }
});

/**
 * POST /api/public-anamnesis/process/:responseId
 * Processa uma resposta de anamnese (cria/atualiza paciente e alertas)
 */
router.post('/process/:responseId', requireAuth, async (req, res) => {
  try {
    const { responseId } = req.params;
    const companyId = req.user?.companyId!;
    const userId = req.user?.id;

    // Buscar resposta
    const [response] = await db
      .select()
      .from(publicAnamnesisResponses)
      .where(eq(publicAnamnesisResponses.id, parseInt(responseId)));

    if (!response || response.companyId !== companyId) {
      return res.status(404).json({ error: 'Resposta não encontrada' });
    }

    let patientId = response.patientId;

    // Se não tem paciente vinculado, criar novo
    if (!patientId && response.fullName) {
      const [newPatient] = await db
        .insert(patients)
        .values({
          companyId,
          fullName: response.fullName,
          email: response.email,
          phone: response.phone,
          cpf: response.cpf,
          dateOfBirth: response.dateOfBirth,
          dataProcessingConsent: response.consentGiven || false,
          consentDate: response.consentTimestamp,
          consentMethod: 'online',
        })
        .returning();

      patientId = newPatient.id;
    }

    // Criar alertas de risco baseados nas respostas
    const detectedAlerts = response.detectedAlerts || [];
    if (patientId && detectedAlerts.length > 0) {
      const alertTypes = await db
        .select()
        .from(riskAlertTypes)
        .where(eq(riskAlertTypes.isActive, true));

      for (const alertCode of detectedAlerts) {
        const alertType = alertTypes.find((t: typeof riskAlertTypes.$inferSelect) => t.code === alertCode);
        if (alertType) {
          await db
            .insert(patientRiskAlerts)
            .values({
              patientId,
              alertTypeId: alertType.id,
              details: (response.responses as any)?.[`${alertCode}_details`] || null,
              notes: 'Detectado via anamnese online',
              createdBy: userId,
            })
            .onConflictDoNothing();
        }
      }
    }

    // Salvar anamnese no prontuário
    if (patientId) {
      await db.insert(anamnesis).values({
        patientId,
        data: response.responses,
        createdAt: new Date(),
      });
    }

    // Marcar resposta como processada
    await db
      .update(publicAnamnesisResponses)
      .set({
        status: 'processed',
        processedAt: new Date(),
        patientId,
      })
      .where(eq(publicAnamnesisResponses.id, parseInt(responseId)));

    res.json({
      success: true,
      patientId,
      alertsCreated: detectedAlerts.length,
    });
  } catch (error: any) {
    console.error('Erro ao processar resposta:', error);
    res.status(500).json({ error: 'Erro ao processar resposta' });
  }
});

// ==================== ROTAS PÚBLICAS (Sem autenticação) ====================

/**
 * GET /api/public-anamnesis/form/:token
 * Retorna dados do formulário público de anamnese
 */
router.get('/form/:token', async (req, res) => {
  try {
    const { token } = req.params;

    // Buscar link
    const [link] = await db
      .select()
      .from(publicAnamnesisLinks)
      .where(eq(publicAnamnesisLinks.token, token));

    if (!link) {
      return res.status(404).json({ error: 'Link não encontrado' });
    }

    // Verificar se está ativo e não expirou
    if (!link.isActive) {
      return res.status(410).json({ error: 'Link desativado' });
    }

    if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
      return res.status(410).json({ error: 'Link expirado' });
    }

    if (link.usedAt) {
      return res.status(410).json({ error: 'Este formulário já foi preenchido' });
    }

    // Buscar configurações da clínica
    const [settings] = await db
      .select()
      .from(clinicSettings)
      .where(eq(clinicSettings.companyId, link.companyId))
      .limit(1);

    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, link.companyId))
      .limit(1);

    // Buscar template se especificado
    let template = null;
    if (link.templateId) {
      const [t] = await db
        .select()
        .from(anamnesisTemplates)
        .where(eq(anamnesisTemplates.id, link.templateId));
      template = t;
    }

    // Buscar dados do paciente se especificado
    let patient = null;
    if (link.patientId) {
      const [p] = await db
        .select({
          fullName: patients.fullName,
          email: patients.email,
          phone: patients.phone,
          birthDate: patients.birthDate,
        })
        .from(patients)
        .where(eq(patients.id, link.patientId));
      patient = p;
    }

    res.json({
      clinicName: settings?.name || company?.name || 'Clínica',
      clinicLogo: settings?.logo || null,
      template,
      patient,
      hasPatient: !!link.patientId,
    });
  } catch (error: any) {
    console.error('Erro ao buscar formulário:', error);
    res.status(500).json({ error: 'Erro ao buscar formulário' });
  }
});

/**
 * POST /api/public-anamnesis/submit/:token
 * Submete respostas do formulário público
 */
router.post('/submit/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { responses, patientData, consent } = req.body;

    // Buscar link
    const [link] = await db
      .select()
      .from(publicAnamnesisLinks)
      .where(eq(publicAnamnesisLinks.token, token));

    if (!link || !link.isActive) {
      return res.status(404).json({ error: 'Link inválido' });
    }

    if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
      return res.status(410).json({ error: 'Link expirado' });
    }

    if (link.usedAt) {
      return res.status(410).json({ error: 'Este formulário já foi preenchido' });
    }

    // Detectar alertas de risco automaticamente
    const detectedAlerts: string[] = [];

    // Verificar respostas para detectar alertas
    if (responses.has_allergy === true || responses.tem_alergia === true) {
      detectedAlerts.push('allergy');
    }
    if (responses.has_cardiac === true || responses.tem_problema_cardiaco === true ||
        responses.hipertensao === true || responses.pressao_alta === true) {
      detectedAlerts.push('cardiac');
    }
    if (responses.has_diabetes === true || responses.tem_diabetes === true) {
      detectedAlerts.push('diabetes');
    }
    if (responses.uses_anticoagulant === true || responses.usa_anticoagulante === true ||
        (responses.medicamentos && responses.medicamentos.toLowerCase().includes('warfarin')) ||
        (responses.medicamentos && responses.medicamentos.toLowerCase().includes('aas'))) {
      detectedAlerts.push('anticoagulant');
    }
    if (responses.is_pregnant === true || responses.esta_gravida === true) {
      detectedAlerts.push('pregnancy');
    }

    // Salvar resposta
    const [response] = await db
      .insert(publicAnamnesisResponses)
      .values({
        linkId: link.id,
        companyId: link.companyId,
        patientId: link.patientId,
        fullName: patientData?.fullName || null,
        email: patientData?.email || null,
        phone: patientData?.phone || null,
        cpf: patientData?.cpf || null,
        dateOfBirth: patientData?.dateOfBirth || null,
        responses,
        detectedAlerts,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        consentGiven: consent === true,
        consentTimestamp: consent === true ? new Date() : null,
        status: 'pending',
      })
      .returning();

    // Marcar link como usado
    await db
      .update(publicAnamnesisLinks)
      .set({ usedAt: new Date() })
      .where(eq(publicAnamnesisLinks.id, link.id));

    res.json({
      success: true,
      responseId: response.id,
      detectedAlerts,
      message: 'Obrigado por preencher sua ficha de saúde!',
    });
  } catch (error: any) {
    console.error('Erro ao submeter anamnese:', error);
    res.status(500).json({ error: 'Erro ao submeter anamnese' });
  }
});

export default router;
