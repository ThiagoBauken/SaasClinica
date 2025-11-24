import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FileCheck,
  Download,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Shield,
  ExternalLink
} from 'lucide-react';

interface DigitalSignatureProps {
  prescriptionId: number;
  isSigned?: boolean;
  signedPdfUrl?: string;
  validationUrl?: string;
  qrCodeData?: string;
  onSigned?: () => void;
}

export function DigitalSignature({
  prescriptionId,
  isSigned = false,
  signedPdfUrl,
  validationUrl,
  qrCodeData,
  onSigned
}: DigitalSignatureProps) {
  const [loading, setLoading] = useState(false);
  const [signed, setSigned] = useState(isSigned);
  const [pdfUrl, setPdfUrl] = useState(signedPdfUrl);
  const [validation, setValidation] = useState(validationUrl);
  const [qrCode, setQrCode] = useState(qrCodeData);
  const [error, setError] = useState<string | null>(null);

  const handleSign = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/v1/digital-signature/sign-prescription/${prescriptionId}`,
        {
          method: 'POST',
          credentials: 'include',
        }
      );

      const data = await response.json();

      if (response.ok) {
        setSigned(true);
        setPdfUrl(data.signedPdfUrl);
        setValidation(data.validationUrl);
        setQrCode(data.qrCodeData);
        onSigned?.();
        alert('✅ Prescrição assinada digitalmente com sucesso!');
      } else {
        setError(data.error || 'Erro ao assinar prescrição');
        alert(`❌ ${data.error || 'Erro ao assinar prescrição'}`);
      }
    } catch (err) {
      console.error('Error signing prescription:', err);
      setError('Erro ao conectar com o servidor');
      alert('❌ Erro ao conectar com o servidor');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = () => {
    if (pdfUrl) {
      window.open(pdfUrl, '_blank');
    }
  };

  const handleValidate = () => {
    if (validation) {
      window.open(validation, '_blank');
    }
  };

  if (!signed) {
    return (
      <Card className="p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-100 rounded-lg">
            <Shield className="h-6 w-6 text-blue-600" />
          </div>

          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-2">Assinatura Digital CFO</h3>
            <p className="text-sm text-gray-600 mb-4">
              Assine este documento digitalmente para gerar uma prescrição válida conforme
              as normas do Conselho Federal de Odontologia (CFO).
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-800">Erro ao assinar</p>
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              </div>
            )}

            <div className="space-y-2 mb-4">
              <div className="text-sm">
                <span className="font-medium">O documento incluirá:</span>
                <ul className="ml-4 mt-2 space-y-1 text-gray-600">
                  <li>• Assinatura digital válida</li>
                  <li>• QR Code para validação</li>
                  <li>• Hash de segurança SHA-256</li>
                  <li>• Link de validação no portal CFO</li>
                </ul>
              </div>
            </div>

            <Button
              onClick={handleSign}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              <FileCheck className="h-4 w-4 mr-2" />
              {loading ? 'Assinando...' : 'Assinar Digitalmente'}
            </Button>

            <p className="text-xs text-gray-500 mt-3">
              ⚠️ Certifique-se de que seus dados de CRO estão configurados corretamente
              em suas configurações de perfil.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-start gap-4">
        <div className="p-3 bg-green-100 rounded-lg">
          <CheckCircle2 className="h-6 w-6 text-green-600" />
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg font-semibold">Documento Assinado Digitalmente</h3>
            <Badge variant="default" className="bg-green-600">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Válido
            </Badge>
          </div>

          <p className="text-sm text-gray-600 mb-4">
            Este documento foi assinado digitalmente e possui validade legal conforme CFO.
          </p>

          {/* Ações */}
          <div className="flex flex-wrap gap-3 mb-4">
            {pdfUrl && (
              <Button
                onClick={handleDownloadPDF}
                variant="outline"
                size="sm"
              >
                <Download className="h-4 w-4 mr-2" />
                Baixar PDF Assinado
              </Button>
            )}

            {validation && (
              <Button
                onClick={handleValidate}
                variant="outline"
                size="sm"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Validar no Portal CFO
              </Button>
            )}
          </div>

          {/* Informações de validação */}
          <div className="border-t pt-4 mt-4">
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <QrCode className="h-4 w-4" />
              Validação
            </h4>

            {validation && (
              <div className="mb-2">
                <label className="text-xs text-gray-600">URL de Validação:</label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="text"
                    value={validation}
                    readOnly
                    className="flex-1 text-sm bg-gray-50 border rounded px-3 py-2 font-mono"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      navigator.clipboard.writeText(validation);
                      alert('Link copiado!');
                    }}
                  >
                    Copiar
                  </Button>
                </div>
              </div>
            )}

            <p className="text-xs text-gray-500 mt-2">
              💡 O QR Code impresso no documento pode ser escaneado para validar
              a autenticidade da assinatura.
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
