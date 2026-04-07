/**
 * NFS-e (Nota Fiscal de Servico Eletronica) emission service
 * Abstraction layer supporting multiple providers: Focus NFSe, Enotas, NFSe Nacional
 */

import { db } from '../db';
import { fiscalSettings, companies } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

export interface NfseData {
  companyId: number;
  patientName: string;
  patientCpf: string;
  serviceDescription: string;
  serviceCode: string; // TUSS code or municipal service code
  amount: number; // in cents
  paymentId?: number;
  issDate?: Date;
}

export interface NfseResult {
  success: boolean;
  nfseNumber?: string;
  nfseUrl?: string;
  verificationCode?: string;
  pdfUrl?: string;
  error?: string;
}

interface FiscalSettingsWithCompany {
  nfseProvider: string | null;
  nfseToken: string | null;
  nfseUrl: string | null;
  defaultTaxRate: string | null;
  defaultServiceCode: string | null;
  cnpj: string | null;
  inscricaoMunicipal: string | null;
}

export class NfseEmissionService {
  /**
   * Fetch fiscal settings for company from DB, joined with company cnpj
   */
  private async getFiscalSettings(companyId: number): Promise<FiscalSettingsWithCompany | null> {
    const result = await db.$client.query(
      `SELECT
         fs.nfse_provider       AS "nfseProvider",
         fs.nfse_token          AS "nfseToken",
         fs.nfse_url            AS "nfseUrl",
         fs.default_tax_rate    AS "defaultTaxRate",
         fs.default_service_code AS "defaultServiceCode",
         c.cnpj                 AS "cnpj",
         NULL::text             AS "inscricaoMunicipal"
       FROM fiscal_settings fs
       JOIN companies c ON c.id = fs.company_id
       WHERE fs.company_id = $1
       LIMIT 1`,
      [companyId]
    );

    return result.rows[0] ?? null;
  }

  /**
   * Emit NFS-e via the configured provider for the given company
   */
  async emit(data: NfseData): Promise<NfseResult> {
    const settings = await this.getFiscalSettings(data.companyId);

    if (!settings?.nfseProvider || !settings?.nfseToken) {
      return {
        success: false,
        error: 'NFS-e nao configurada. Configure em Configuracoes > Financeiro.',
      };
    }

    switch (settings.nfseProvider) {
      case 'focus_nfse':
        return this.emitFocusNFSe(data, settings);
      case 'enotas':
        return this.emitEnotas(data, settings);
      case 'nfse_nacional':
        return this.emitNfseNacional(data, settings);
      default:
        return {
          success: false,
          error: `Provider ${settings.nfseProvider} nao suportado`,
        };
    }
  }

  /**
   * Cancel an emitted NFS-e by number
   */
  async cancel(companyId: number, nfseNumber: string, reason: string): Promise<NfseResult> {
    const settings = await this.getFiscalSettings(companyId);

    if (!settings?.nfseProvider || !settings?.nfseToken) {
      return {
        success: false,
        error: 'NFS-e nao configurada. Configure em Configuracoes > Financeiro.',
      };
    }

    if (settings.nfseProvider === 'focus_nfse') {
      try {
        const response = await fetch(
          `${settings.nfseUrl || 'https://api.focusnfe.com.br'}/v2/nfse/${encodeURIComponent(nfseNumber)}`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Token token=${settings.nfseToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ justificativa: reason }),
          }
        );

        if (response.ok || response.status === 204) {
          return { success: true, nfseNumber };
        }

        const result = await response.json().catch(() => ({}));
        return {
          success: false,
          error: (result as any).mensagem || `Erro ao cancelar NFS-e (HTTP ${response.status})`,
        };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    return { success: false, error: `Cancelamento nao implementado para o provider ${settings.nfseProvider}` };
  }

  /**
   * Query the status of an emitted NFS-e
   */
  async query(companyId: number, nfseNumber: string): Promise<NfseResult> {
    const settings = await this.getFiscalSettings(companyId);

    if (!settings?.nfseProvider || !settings?.nfseToken) {
      return {
        success: false,
        error: 'NFS-e nao configurada. Configure em Configuracoes > Financeiro.',
      };
    }

    if (settings.nfseProvider === 'focus_nfse') {
      try {
        const response = await fetch(
          `${settings.nfseUrl || 'https://api.focusnfe.com.br'}/v2/nfse/${encodeURIComponent(nfseNumber)}`,
          {
            method: 'GET',
            headers: { Authorization: `Token token=${settings.nfseToken}` },
          }
        );

        const result = await response.json();

        if (response.ok) {
          return {
            success: true,
            nfseNumber: result.numero,
            nfseUrl: result.url,
            verificationCode: result.codigo_verificacao,
            pdfUrl: result.caminho_pdf_nota_fiscal,
          };
        }

        return {
          success: false,
          error: (result as any).mensagem || `Erro ao consultar NFS-e (HTTP ${response.status})`,
        };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    return { success: false, error: `Consulta nao implementada para o provider ${settings.nfseProvider}` };
  }

  // ---------------------------------------------------------------------------
  // Provider implementations
  // ---------------------------------------------------------------------------

  private async emitFocusNFSe(
    data: NfseData,
    settings: FiscalSettingsWithCompany
  ): Promise<NfseResult> {
    // Focus NFSe API: POST https://api.focusnfe.com.br/v2/nfse
    const payload = {
      data_emissao: (data.issDate ?? new Date()).toISOString(),
      prestador: {
        cnpj: settings.cnpj,
        inscricao_municipal: settings.inscricaoMunicipal,
      },
      tomador: {
        cpf: data.patientCpf,
        razao_social: data.patientName,
      },
      servico: {
        valor_servicos: data.amount / 100,
        discriminacao: data.serviceDescription,
        item_lista_servico: data.serviceCode || settings.defaultServiceCode,
        codigo_tributario_municipio: settings.defaultServiceCode,
        aliquota: parseFloat(settings.defaultTaxRate || '0') / 100,
      },
    };

    try {
      const response = await fetch(
        `${settings.nfseUrl || 'https://api.focusnfe.com.br'}/v2/nfse`,
        {
          method: 'POST',
          headers: {
            Authorization: `Token token=${settings.nfseToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      const result = await response.json();

      if (response.ok) {
        return {
          success: true,
          nfseNumber: result.numero,
          nfseUrl: result.url,
          verificationCode: result.codigo_verificacao,
          pdfUrl: result.caminho_pdf_nota_fiscal,
        };
      }

      return {
        success: false,
        error: result.mensagem || result.erros?.[0]?.mensagem || 'Erro ao emitir NFS-e via Focus NFSe',
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  private async emitEnotas(
    data: NfseData,
    settings: FiscalSettingsWithCompany
  ): Promise<NfseResult> {
    // Enotas API: POST https://api.enotas.com.br/v1/nfe
    // Payload structure follows Enotas v1 specification
    const payload = {
      idExterno: data.paymentId ? String(data.paymentId) : undefined,
      cliente: {
        cpfCnpj: data.patientCpf,
        nome: data.patientName,
      },
      servico: {
        descricao: data.serviceDescription,
        aliquotaIss: parseFloat(settings.defaultTaxRate || '0'),
        valorTotal: data.amount / 100,
        codigoServico: data.serviceCode || settings.defaultServiceCode,
      },
    };

    try {
      const baseUrl = settings.nfseUrl || 'https://api.enotas.com.br';
      const response = await fetch(`${baseUrl}/v1/nfe`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${settings.nfseToken}:`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok) {
        return {
          success: true,
          nfseNumber: result.id || result.numero,
          nfseUrl: result.linkDownloadPdf,
          pdfUrl: result.linkDownloadPdf,
        };
      }

      return {
        success: false,
        error: result.mensagem || result.message || 'Erro ao emitir NFS-e via Enotas',
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  private async emitNfseNacional(
    data: NfseData,
    settings: FiscalSettingsWithCompany
  ): Promise<NfseResult> {
    // NFSe Nacional (padrao ABRASF 2.04 / novo padrao nacional)
    // Skeleton — full implementation requires municipality-specific WSDL endpoints
    void data;
    void settings;
    return { success: false, error: 'NFSe Nacional provider em implementacao' };
  }
}

export const nfseService = new NfseEmissionService();
