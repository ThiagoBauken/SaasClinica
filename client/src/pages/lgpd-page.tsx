import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield } from "lucide-react";

export default function LGPDPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Link href="/landing">
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <Shield className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold">LGPD - Lei Geral de Proteção de Dados</h1>
        </div>

        <div className="bg-white rounded-lg shadow p-8 space-y-6 text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold mb-3 text-gray-900">Nosso Compromisso com a LGPD</h2>
            <p>
              O DentalSys está em conformidade com a Lei Geral de Proteção de Dados (Lei n. 13.709/2018).
              Como sistema de gestão de clínicas odontológicas, tratamos dados pessoais e dados sensíveis
              de saúde com o mais alto nível de proteção e transparência.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-gray-900">Bases Legais para Tratamento</h2>
            <p>O tratamento de dados no DentalSys se baseia nas seguintes hipóteses legais:</p>
            <ul className="list-disc ml-6 mt-2 space-y-2">
              <li>
                <strong>Execução de contrato (Art. 7, V):</strong> dados necessários para prover o serviço
                contratado de gestão da clínica
              </li>
              <li>
                <strong>Tutela da saúde (Art. 7, VIII e Art. 11, II, f):</strong> dados sensíveis de saúde
                dos pacientes tratados para fins de atendimento clínico odontológico
              </li>
              <li>
                <strong>Obrigação legal (Art. 7, II):</strong> retenção de prontuários conforme exigido pelo
                Conselho Federal de Odontologia e legislação sanitária
              </li>
              <li>
                <strong>Consentimento (Art. 7, I):</strong> para envio de comunicações de marketing e
                lembretes automáticos aos pacientes
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-gray-900">Dados Sensíveis de Saúde</h2>
            <p>
              Tratamos dados sensíveis de saúde (prontuários, odontogramas, anamneses) exclusivamente para
              fins de atendimento clínico, conforme autorizado pelo Art. 11, II, f da LGPD. Estes dados
              são armazenados com criptografia AES-256-GCM em repouso e acesso restrito aos profissionais autorizados da clínica.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-gray-900">Medidas de Segurança Implementadas</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-2">Medidas Técnicas</h3>
                <ul className="text-sm space-y-1">
                  <li>Criptografia TLS/SSL em todas as comunicações</li>
                  <li>Criptografia AES-256-GCM em repouso para CPF, RG e dados de saúde</li>
                  <li>Processamento de IA 100% local (dados nunca saem do servidor)</li>
                  <li>Controle de acesso baseado em funções (RBAC)</li>
                  <li>Logs de auditoria de acessos</li>
                  <li>Backups criptografados diários</li>
                </ul>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="font-semibold text-green-900 mb-2">Medidas Organizacionais</h3>
                <ul className="text-sm space-y-1">
                  <li>Isolamento de dados por clínica (multi-tenant)</li>
                  <li>Política de retenção e descarte de dados</li>
                  <li>Procedimentos de resposta a incidentes</li>
                  <li>Avaliação de impacto à proteção de dados (RIPD)</li>
                  <li>Treinamento em proteção de dados</li>
                  <li>Encarregado de dados (DPO) designado</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-gray-900">Direitos dos Titulares (Art. 18)</h2>
            <p>
              Garantimos aos titulares de dados (pacientes e profissionais) o exercício dos seguintes direitos:
            </p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Confirmação da existência de tratamento</li>
              <li>Acesso aos dados pessoais</li>
              <li>Correção de dados incompletos ou desatualizados</li>
              <li>Anonimização, bloqueio ou eliminação de dados desnecessários</li>
              <li>Portabilidade dos dados</li>
              <li>Informação sobre compartilhamento de dados</li>
              <li>Revogação do consentimento</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-gray-900">Responsabilidade Compartilhada</h2>
            <p>
              O DentalSys atua como <strong>operador</strong> dos dados dos pacientes, enquanto a clínica
              odontológica é a <strong>controladora</strong>. A clínica é responsável por obter o consentimento
              dos pacientes quando necessário e informá-los sobre o tratamento de seus dados. O DentalSys
              fornece as ferramentas necessárias para que a clínica cumpra suas obrigações com a LGPD.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-gray-900">Encarregado de Proteção de Dados (DPO)</h2>
            <p>
              Para solicitações relacionadas à LGPD, contate nosso Encarregado de Proteção de Dados:
            </p>
            <div className="bg-gray-50 p-4 rounded-lg mt-3">
              <p><strong>E-mail:</strong> {/* TODO: Substituir pelo e-mail real do DPO (Art. 41 LGPD) */} dpo@suaclinica.com.br</p>
              <p><strong>Prazo de resposta:</strong> até 15 dias úteis</p>
            </div>
          </section>

          <p className="text-sm text-gray-500 pt-4 border-t">
            Última atualização: Março de 2026
          </p>
        </div>
      </div>
    </div>
  );
}
