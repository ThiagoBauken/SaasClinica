import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function TermosDeUsoPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Link href="/landing">
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </Link>

        <h1 className="text-3xl font-bold mb-8">Termos de Uso</h1>

        <div className="bg-white rounded-lg shadow p-8 space-y-6 text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold mb-3 text-gray-900">1. Aceitação dos Termos</h2>
            <p>
              Ao acessar e utilizar o sistema DentalSys, você concorda com os presentes Termos de Uso.
              Caso não concorde com qualquer disposição, recomendamos que não utilize a plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-gray-900">2. Descrição do Serviço</h2>
            <p>
              O DentalSys é uma plataforma SaaS (Software as a Service) de gestão para clínicas odontológicas,
              oferecendo funcionalidades de agendamento, prontuário eletrônico, odontograma digital,
              controle financeiro, gestão de estoque, automação de comunicação e CRM.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-gray-900">3. Cadastro e Conta</h2>
            <p>
              Para utilizar o sistema, é necessário criar uma conta com informações verdadeiras e atualizadas.
              Você é responsável pela confidencialidade de suas credenciais de acesso e por todas as atividades
              realizadas em sua conta.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-gray-900">4. Planos e Pagamentos</h2>
            <p>
              O DentalSys oferece diferentes planos de assinatura. Os valores, funcionalidades e limites de cada
              plano estão descritos na página de preços. O pagamento é recorrente e pode ser cancelado a qualquer momento.
              Ao cancelar, o acesso permanece ativo até o fim do período já pago.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-gray-900">5. Uso Adequado</h2>
            <p>O usuário se compromete a:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Utilizar o sistema apenas para fins legítimos de gestão clínica odontológica</li>
              <li>Não tentar acessar dados de outras clínicas ou usuários</li>
              <li>Não realizar engenharia reversa ou tentar extrair o código-fonte</li>
              <li>Manter seus dados de acesso em sigilo</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-gray-900">6. Propriedade Intelectual</h2>
            <p>
              Todo o conteúdo, design, código e funcionalidades do DentalSys são de propriedade exclusiva da empresa.
              Os dados inseridos pelos usuários permanecem de propriedade do usuário.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-gray-900">7. Limitação de Responsabilidade</h2>
            <p>
              O DentalSys não se responsabiliza por decisões clínicas tomadas com base nas informações do sistema.
              O profissional de saúde é o único responsável pelo atendimento ao paciente. Nos esforçamos para manter
              o sistema disponível 24/7, mas não garantimos disponibilidade ininterrupta.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-gray-900">8. Alterações nos Termos</h2>
            <p>
              Reservamo-nos o direito de alterar estes termos a qualquer momento. Alterações significativas serão
              comunicadas por e-mail ou notificação no sistema com antecedência mínima de 30 dias.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-gray-900">9. Contato</h2>
            <p>
              Em caso de dúvidas sobre estes termos, entre em contato pelo e-mail: contato@dentalsys.com.br
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
