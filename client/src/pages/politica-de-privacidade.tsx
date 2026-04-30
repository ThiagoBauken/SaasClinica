import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function PoliticaDePrivacidadePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Link href="/landing">
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </Link>

        <h1 className="text-3xl font-bold mb-8">Política de Privacidade</h1>

        <div className="bg-white rounded-lg shadow p-8 space-y-6 text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold mb-3 text-gray-900">1. Informações que Coletamos</h2>
            <p>Coletamos as seguintes categorias de dados:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li><strong>Dados da clínica:</strong> nome, CNPJ, endereço, telefone, e-mail</li>
              <li><strong>Dados dos profissionais:</strong> nome, CRO, especialidade, horários de trabalho</li>
              <li><strong>Dados dos pacientes:</strong> nome, CPF, data de nascimento, endereço, telefone, histórico clínico, odontograma</li>
              <li><strong>Dados financeiros:</strong> registros de pagamentos, orçamentos, receitas e despesas</li>
              <li><strong>Dados de uso:</strong> logs de acesso, funcionalidades utilizadas</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-gray-900">2. Como Utilizamos os Dados</h2>
            <p>Os dados coletados são utilizados para:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Prover as funcionalidades do sistema de gestão</li>
              <li>Enviar lembretes e notificações configurados pela clínica</li>
              <li>Gerar relatórios e análises para a clínica</li>
              <li>Melhorar e desenvolver novas funcionalidades</li>
              <li>Garantir a segurança da plataforma</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-gray-900">3. Compartilhamento de Dados</h2>
            <p>
              Não vendemos, alugamos ou compartilhamos dados pessoais com terceiros para fins de marketing.
              Os dados podem ser compartilhados apenas com:
            </p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Sub-processadores listados na <a href="#sub-processadores" className="text-blue-600 hover:underline">seção 8</a> abaixo, estritamente para operação do serviço</li>
              <li>Autoridades competentes quando exigido por lei ou ordem judicial</li>
              <li>Em caso de fusão, aquisição ou venda da empresa, com notificação prévia aos titulares</li>
            </ul>
            <p className="mt-3 text-sm text-gray-600">
              Antes de envio para qualquer LLM externo (Anthropic, Groq, OpenAI), aplicamos
              <strong> anonimização de PII</strong> (CPF, telefone, e-mail e nomes próprios são
              substituídos por placeholders) em conformidade com o Art. 12 da LGPD.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-gray-900">4. Segurança dos Dados</h2>
            <p>
              Implementamos medidas técnicas e organizacionais para proteger seus dados, incluindo:
              criptografia em trânsito (TLS/SSL), criptografia em repouso, backups automáticos diários,
              controle de acesso baseado em funções e monitoramento contínuo de segurança.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-gray-900">5. Retenção de Dados</h2>
            <p>
              Os dados são mantidos enquanto a conta estiver ativa. Após o cancelamento da assinatura,
              os dados são mantidos por 90 dias para possível reativação. Após esse período, os dados
              são permanentemente excluídos, exceto quando a retenção for exigida por lei.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-gray-900">6. Seus Direitos</h2>
            <p>Você tem direito a:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Acessar seus dados pessoais armazenados</li>
              <li>Corrigir dados incompletos ou desatualizados</li>
              <li>Solicitar a exclusão de dados pessoais</li>
              <li>Exportar seus dados em formato legível</li>
              <li>Revogar consentimento para processamento de dados</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-gray-900">7. Cookies</h2>
            <p>
              Utilizamos cookies essenciais para autenticação e funcionamento do sistema
              (sessão, CSRF token e preferências de UI). Não utilizamos cookies de
              rastreamento publicitário ou cookies de terceiros para perfilamento.
            </p>
          </section>

          <section id="sub-processadores">
            <h2 className="text-xl font-semibold mb-3 text-gray-900">8. Sub-processadores</h2>
            <p>
              Para operar o serviço, utilizamos os seguintes sub-processadores. Mantemos
              esta lista atualizada — alterações relevantes serão comunicadas aos clientes
              com antecedência mínima de 30 dias.
            </p>
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-sm border border-gray-200 rounded-lg">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-3 font-semibold text-gray-900">Sub-processador</th>
                    <th className="text-left p-3 font-semibold text-gray-900">Finalidade</th>
                    <th className="text-left p-3 font-semibold text-gray-900">Localidade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr><td className="p-3 font-medium">Stripe</td><td className="p-3">Processamento de pagamentos por cartão</td><td className="p-3">EUA / UE</td></tr>
                  <tr><td className="p-3 font-medium">Mercado Pago</td><td className="p-3">Pagamentos por Pix, boleto e cartão</td><td className="p-3">Brasil</td></tr>
                  <tr><td className="p-3 font-medium">NOWPayments</td><td className="p-3">Pagamentos em criptomoedas (opcional)</td><td className="p-3">UE</td></tr>
                  <tr><td className="p-3 font-medium">Anthropic (Claude)</td><td className="p-3">Modelo de IA do agente WhatsApp — recebe apenas dados anonimizados</td><td className="p-3">EUA</td></tr>
                  <tr><td className="p-3 font-medium">Groq / OpenAI</td><td className="p-3">Modelos LLM de fallback (opcionais) — recebem apenas dados anonimizados</td><td className="p-3">EUA</td></tr>
                  <tr><td className="p-3 font-medium">Google Cloud Vision</td><td className="p-3">OCR para digitalização de prontuários físicos</td><td className="p-3">EUA</td></tr>
                  <tr><td className="p-3 font-medium">Google Calendar API</td><td className="p-3">Sincronização bidirecional de agenda (opcional, ativado pelo cliente)</td><td className="p-3">EUA</td></tr>
                  <tr><td className="p-3 font-medium">SendGrid</td><td className="p-3">Envio de e-mails transacionais (verificação, recuperação de senha, lembretes)</td><td className="p-3">EUA</td></tr>
                  <tr><td className="p-3 font-medium">Meta Cloud API / Wuzapi / Evolution API</td><td className="p-3">Provedores de WhatsApp (cliente escolhe um)</td><td className="p-3">Variável</td></tr>
                  <tr><td className="p-3 font-medium">MinIO / S3-compatível</td><td className="p-3">Armazenamento de arquivos (raio-x, fotos, documentos PDF)</td><td className="p-3">Brasil (EasyPanel)</td></tr>
                  <tr><td className="p-3 font-medium">EasyPanel / VPS</td><td className="p-3">Hospedagem da aplicação e banco de dados PostgreSQL</td><td className="p-3">Brasil</td></tr>
                  <tr><td className="p-3 font-medium">Sentry</td><td className="p-3">Monitoramento de erros (opcional, anonimizado)</td><td className="p-3">EUA</td></tr>
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-sm text-gray-600">
              <strong>Transferências internacionais:</strong> alguns sub-processadores estão
              sediados nos EUA ou na UE. Garantimos a conformidade com o Art. 33 da LGPD por
              meio de contratos com cláusulas-padrão de proteção de dados (SCCs) e/ou
              certificações equivalentes (ex.: SOC 2 Type II, ISO 27001).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-gray-900">9. Contato do Encarregado (DPO)</h2>
            <p>
              Para exercer seus direitos ou esclarecer dúvidas sobre privacidade, entre em contato:
              privacidade@dentcare.com.br
            </p>
          </section>

          <p className="text-sm text-gray-500 pt-4 border-t">
            Última atualização: Março de 2026
          </p>
        </div>
      </div>
    </div>
  );
}
