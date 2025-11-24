import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface PrescriptionData {
  id: number;
  patientName: string;
  patientAge?: number;
  patientCpf?: string;
  professionalName: string;
  professionalCro: string;
  professionalCroState: string;
  type: string; // 'prescription', 'certificate', 'attestation'
  title: string;
  content: string;
  medications?: Array<{
    name: string;
    dosage: string;
    usage: string;
  }>;
  instructions?: string;
  period?: string;
  cid?: string;
  date: Date;
  clinicName?: string;
  clinicAddress?: string;
  clinicPhone?: string;
  validationUrl?: string;
}

export class PdfGeneratorService {
  /**
   * Gera PDF de prescrição médica/odontológica
   */
  async generatePrescriptionPDF(data: PrescriptionData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 }
      });

      const buffers: Buffer[] = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });
      doc.on('error', reject);

      // Header com logo da clínica (se houver)
      doc.fontSize(20)
        .font('Helvetica-Bold')
        .text(data.clinicName || 'Clínica Odontológica', { align: 'center' });

      if (data.clinicAddress) {
        doc.fontSize(10)
          .font('Helvetica')
          .text(data.clinicAddress, { align: 'center' });
      }

      if (data.clinicPhone) {
        doc.text(data.clinicPhone, { align: 'center' });
      }

      doc.moveDown(2);

      // Linha separadora
      doc.moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .stroke();

      doc.moveDown();

      // Título do documento
      doc.fontSize(16)
        .font('Helvetica-Bold')
        .text(data.title, { align: 'center' });

      doc.moveDown(2);

      // Dados do paciente
      doc.fontSize(12)
        .font('Helvetica-Bold')
        .text('Paciente:', { continued: false });

      doc.font('Helvetica')
        .text(`Nome: ${data.patientName}`);

      if (data.patientAge) {
        doc.text(`Idade: ${data.patientAge} anos`);
      }

      if (data.patientCpf) {
        doc.text(`CPF: ${data.patientCpf}`);
      }

      doc.moveDown();

      // Data
      doc.text(`Data: ${format(data.date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`);

      doc.moveDown(2);

      // Conteúdo específico por tipo
      if (data.type === 'prescription' && data.medications) {
        // Receita Médica
        doc.fontSize(14)
          .font('Helvetica-Bold')
          .text('Medicamentos Prescritos:', { underline: true });

        doc.moveDown();

        data.medications.forEach((med, index) => {
          doc.fontSize(12)
            .font('Helvetica-Bold')
            .text(`${index + 1}. ${med.name}`, { continued: false });

          doc.font('Helvetica')
            .text(`   Dosagem: ${med.dosage}`)
            .text(`   Uso: ${med.usage}`);

          doc.moveDown(0.5);
        });

        if (data.instructions) {
          doc.moveDown();
          doc.fontSize(12)
            .font('Helvetica-Bold')
            .text('Instruções:', { underline: true });

          doc.font('Helvetica')
            .text(data.instructions, { align: 'justify' });
        }
      } else {
        // Atestado ou Declaração
        doc.fontSize(12)
          .font('Helvetica')
          .text(data.content, { align: 'justify' });

        if (data.period) {
          doc.moveDown();
          doc.font('Helvetica-Bold')
            .text(`Período: ${data.period}`);
        }

        if (data.cid) {
          doc.text(`CID: ${data.cid}`);
        }
      }

      doc.moveDown(3);

      // QR Code para validação (se houver URL)
      if (data.validationUrl) {
        this.addQRCode(doc, data.validationUrl).then(() => {
          this.addSignatureSection(doc, data);
          doc.end();
        }).catch(reject);
      } else {
        this.addSignatureSection(doc, data);
        doc.end();
      }
    });
  }

  /**
   * Adiciona QR Code ao PDF
   */
  private async addQRCode(doc: PDFKit.PDFDocument, validationUrl: string): Promise<void> {
    try {
      const qrCodeDataUrl = await QRCode.toDataURL(validationUrl, {
        width: 150,
        margin: 1
      });

      // Converter data URL para buffer
      const base64Data = qrCodeDataUrl.replace(/^data:image\/png;base64,/, '');
      const imageBuffer = Buffer.from(base64Data, 'base64');

      // Adicionar QR code no canto inferior direito
      doc.image(imageBuffer, 420, doc.page.height - 200, {
        width: 120,
        height: 120
      });

      doc.fontSize(8)
        .font('Helvetica')
        .text('Validar no Portal CFO', 420, doc.page.height - 75, {
          width: 120,
          align: 'center'
        });
    } catch (error) {
      console.error('Error generating QR code:', error);
    }
  }

  /**
   * Adiciona seção de assinatura ao PDF
   */
  private addSignatureSection(doc: PDFKit.PDFDocument, data: PrescriptionData): void {
    const signatureY = doc.page.height - 150;

    // Linha de assinatura
    doc.moveTo(50, signatureY)
      .lineTo(300, signatureY)
      .stroke();

    doc.fontSize(10)
      .font('Helvetica-Bold')
      .text(data.professionalName, 50, signatureY + 10, {
        width: 250,
        align: 'center'
      });

    doc.font('Helvetica')
      .text(`CRO-${data.professionalCroState}: ${data.professionalCro}`, 50, signatureY + 25, {
        width: 250,
        align: 'center'
      });

    // Rodapé com informações de autenticidade
    doc.fontSize(8)
      .font('Helvetica-Oblique')
      .text('Documento gerado eletronicamente', 50, doc.page.height - 50, {
        align: 'center',
        width: doc.page.width - 100
      });

    if (data.validationUrl) {
      doc.text(data.validationUrl, {
        align: 'center',
        link: data.validationUrl
      });
    }
  }

  /**
   * Gera PDF genérico a partir de HTML (para casos mais complexos)
   */
  async generatePDFFromHTML(html: string): Promise<Buffer> {
    // TODO: Implementar conversão HTML -> PDF se necessário
    // Pode usar bibliotecas como html-pdf ou puppeteer
    throw new Error('HTML to PDF conversion not implemented yet');
  }
}

// Export singleton
export const pdfGenerator = new PdfGeneratorService();
