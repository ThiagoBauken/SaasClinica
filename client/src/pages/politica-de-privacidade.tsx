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
              <li>Processadores de pagamento (Stripe, MercadoPago) para processar transações</li>
              <li>Serviços de infraestrutura (hospedagem, banco de dados) para operação do sistema</li>
              <li>Autoridades competentes quando exigido por lei</li>
            </ul>
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
              Utilizamos cookies essenciais para autenticação e funcionamento do sistema.
              Não utilizamos cookies de rastreamento ou publicidade de terceiros.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-gray-900">8. Contato do Encarregado (DPO)</h2>
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
