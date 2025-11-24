import express from 'express';
import { db } from '../db';
import { digitalSignatures, prescriptions, patients, users } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { pdfGenerator } from '../services/pdf-generator.service';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs/promises';

const router = express.Router();

// Middleware simples de autenticação
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

/**
 * POST /api/v1/digital-signature/sign-prescription/:prescriptionId
 * Assina digitalmente uma prescrição/atestado
 */
router.post('/sign-prescription/:prescriptionId', requireAuth, async (req, res) => {
  try {
    const { prescriptionId } = req.params;
    const user = req.user as any; // Type assertion - authCheck middleware garante que existe
    const professionalId = user.id;
    const companyId = user.companyId;

    // 1. Buscar prescrição
    const [prescription] = await db
      .select()
      .from(prescriptions)
      .where(
        and(
          eq(prescriptions.id, parseInt(prescriptionId)),
          eq(prescriptions.companyId, companyId)
        )
      );

    if (!prescription) {
      return res.status(404).json({ error: 'Prescription not found' });
    }

    // Verificar se já está assinada
    if (prescription.digitallySigned) {
      return res.status(400).json({ error: 'Prescription already digitally signed' });
    }

    // 2. Buscar dados do paciente
    const [patient] = await db
      .select()
      .from(patients)
      .where(eq(patients.id, prescription.patientId));

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // 3. Buscar dados do profissional
    const [professional] = await db
      .select()
      .from(users)
      .where(eq(users.id, professionalId));

    if (!professional.cfoRegistrationNumber || !professional.cfoState) {
      return res.status(400).json({
        error: 'Professional does not have CFO registration number configured'
      });
    }

    // 4. Gerar URL de validação única
    const validationToken = crypto.randomBytes(16).toString('hex');
    const validationUrl = `${process.env.BASE_URL || 'http://localhost:5000'}/validate/${validationToken}`;

    // 5. Preparar dados para o PDF
    const pdfData = {
      id: prescription.id,
      patientName: patient.fullName,
      patientAge: patient.birthDate
        ? new Date().getFullYear() - new Date(patient.birthDate).getFullYear()
        : undefined,
      patientCpf: patient.cpf || undefined,
      professionalName: professional.fullName,
      professionalCro: professional.cfoRegistrationNumber,
      professionalCroState: professional.cfoState,
      type: prescription.type,
      title: prescription.title,
      content: prescription.content,
      medications: prescription.medications as any,
      instructions: prescription.instructions || undefined,
      period: prescription.period || undefined,
      cid: prescription.cid || undefined,
      date: prescription.createdAt || new Date(),
      validationUrl: validationUrl,
    };

    // 6. Gerar PDF
    const pdfBuffer = await pdfGenerator.generatePrescriptionPDF(pdfData);

    // 7. Calcular hash do documento
    const hash = crypto.createHash('sha256');
    hash.update(pdfBuffer);
    const signatureHash = hash.digest('hex');

    // 8. Salvar PDF no sistema de arquivos (ou cloud storage)
    const uploadsDir = path.join(process.cwd(), 'uploads', 'signed-prescriptions');
    await fs.mkdir(uploadsDir, { recursive: true });

    const filename = `prescription-${prescription.id}-${Date.now()}.pdf`;
    const filepath = path.join(uploadsDir, filename);
    await fs.writeFile(filepath, pdfBuffer);

    const signedPdfUrl = `/uploads/signed-prescriptions/${filename}`;

    // 9. Gerar dados do QR Code
    const qrCodeData = `CFO-VALIDATION:${validationToken}`;

    // 10. Criar registro de assinatura digital
    const [signature] = await db
      .insert(digitalSignatures)
      .values({
        companyId,
        professionalId,
        documentType: 'prescription',
        documentId: prescription.id,
        cfoRegistrationNumber: professional.cfoRegistrationNumber,
        cfoState: professional.cfoState,
        signedPdfUrl,
        signatureHash,
        qrCodeData,
        cfoValidationUrl: validationUrl,
        status: 'valid',
        metadata: {
          validationToken,
          originalFilename: filename
        }
      })
      .returning();

    // 11. Atualizar prescrição
    await db
      .update(prescriptions)
      .set({
        signatureId: signature.id,
        digitallySigned: true,
        signedPdfUrl,
        validatedByCfo: true, // Em produção, isso seria validado pelo CFO
        cfoValidationUrl: validationUrl,
        qrCodeData
      })
      .where(eq(prescriptions.id, prescription.id));

    res.json({
      success: true,
      signatureId: signature.id,
      signedPdfUrl,
      validationUrl,
      qrCodeData,
      message: 'Prescrição assinada digitalmente com sucesso'
    });

  } catch (error) {
    console.error('Error signing prescription:', error);
    res.status(500).json({ error: 'Failed to sign prescription digitally' });
  }
});

/**
 * GET /api/v1/digital-signature/validate/:token
 * Valida uma assinatura digital pelo token
 */
router.get('/validate/:token', async (req, res) => {
  try {
    const { token } = req.params;

    // Buscar assinatura pelo token no metadata
    const [signature] = await db
      .select()
      .from(digitalSignatures)
      .where(eq(digitalSignatures.metadata, { validationToken: token } as any))
      .limit(1);

    if (!signature) {
      return res.status(404).json({
        valid: false,
        error: 'Assinatura não encontrada'
      });
    }

    // Verificar status
    const isValid = signature.status === 'valid';
    const isExpired = signature.expiresAt && new Date(signature.expiresAt) < new Date();

    // Buscar informações do documento
    let documentInfo: any = {};

    if (signature.documentType === 'prescription') {
      const [prescription] = await db
        .select()
        .from(prescriptions)
        .where(eq(prescriptions.id, signature.documentId));

      if (prescription) {
        const [patient] = await db
          .select()
          .from(patients)
          .where(eq(patients.id, prescription.patientId));

        const [professional] = await db
          .select()
          .from(users)
          .where(eq(users.id, signature.professionalId));

        documentInfo = {
          type: prescription.type,
          title: prescription.title,
          patientName: patient?.fullName,
          professionalName: professional?.fullName,
          professionalCro: `${signature.cfoState}-${signature.cfoRegistrationNumber}`,
          signedAt: signature.signedAt
        };
      }
    }

    res.json({
      valid: isValid && !isExpired,
      signature: {
        id: signature.id,
        documentType: signature.documentType,
        signedAt: signature.signedAt,
        status: signature.status,
        isExpired,
        professionalCro: `${signature.cfoState}-${signature.cfoRegistrationNumber}`,
        ...documentInfo
      }
    });

  } catch (error) {
    console.error('Error validating signature:', error);
    res.status(500).json({ error: 'Failed to validate signature' });
  }
});

/**
 * GET /api/v1/digital-signature/:signatureId
 * Busca informações de uma assinatura digital
 */
router.get('/:signatureId', requireAuth, async (req, res) => {
  try {
    const { signatureId } = req.params;
    const user = req.user as any;
    const companyId = user.companyId;

    const [signature] = await db
      .select()
      .from(digitalSignatures)
      .where(
        and(
          eq(digitalSignatures.id, parseInt(signatureId)),
          eq(digitalSignatures.companyId, companyId)
        )
      );

    if (!signature) {
      return res.status(404).json({ error: 'Signature not found' });
    }

    res.json(signature);
  } catch (error) {
    console.error('Error fetching signature:', error);
    res.status(500).json({ error: 'Failed to fetch signature' });
  }
});

/**
 * POST /api/v1/digital-signature/:signatureId/revoke
 * Revoga uma assinatura digital
 */
router.post('/:signatureId/revoke', requireAuth, async (req, res) => {
  try {
    const { signatureId } = req.params;
    const { reason } = req.body;
    const user = req.user as any;
    const companyId = user.companyId;

    const [signature] = await db
      .update(digitalSignatures)
      .set({
        status: 'revoked',
        revokedAt: new Date(),
        revokedReason: reason || 'Revogada pelo profissional'
      })
      .where(
        and(
          eq(digitalSignatures.id, parseInt(signatureId)),
          eq(digitalSignatures.companyId, companyId),
          eq(digitalSignatures.status, 'valid')
        )
      )
      .returning();

    if (!signature) {
      return res.status(404).json({ error: 'Signature not found or already revoked' });
    }

    res.json({
      success: true,
      message: 'Assinatura revogada com sucesso',
      signature
    });

  } catch (error) {
    console.error('Error revoking signature:', error);
    res.status(500).json({ error: 'Failed to revoke signature' });
  }
});

export default router;
