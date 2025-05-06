import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Briefcase, Calendar, ChartBar, Database, FileText, Gauge, Lock, MessageCircle, ShieldCheck, Tag, Users } from "lucide-react";

export default function LandingPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-cyan-500 to-blue-700 text-white">
        <div className="container mx-auto px-4 py-16 md:py-24">
          <nav className="flex justify-between items-center mb-16">
            <div className="flex items-center space-x-2 text-2xl font-bold">
              <span className="text-3xl">🦷</span>
              <span>DentalSys</span>
            </div>
            <div className="space-x-4">
              {user ? (
                <Link href="/">
                  <Button variant="outline" className="bg-white text-blue-700 hover:bg-gray-100">
                    Acessar Sistema
                  </Button>
                </Link>
              ) : (
                <>
                  <Link href="/auth">
                    <Button variant="outline" className="bg-white text-blue-700 hover:bg-gray-100">
                      Entrar
                    </Button>
                  </Link>
                  <Link href="/auth">
                    <Button className="bg-blue-900 hover:bg-blue-950">
                      Experimente Grátis
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </nav>
          
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="md:w-1/2 mb-10 md:mb-0">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
                Sistema Completo para Clínicas Odontológicas
              </h1>
              <p className="text-xl mb-8 max-w-lg">
                Gerencie sua clínica com eficiência total. Agendamentos, prontuários, odontograma, financeiro e muito mais em um único sistema.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/auth">
                  <Button size="lg" className="bg-white text-blue-700 hover:bg-gray-100 w-full sm:w-auto">
                    Teste Gratuito por 7 Dias
                  </Button>
                </Link>
                <Button variant="outline" className="border-white text-white hover:bg-blue-800 w-full sm:w-auto">
                  <a href="#planos">Ver Planos</a>
                </Button>
              </div>
            </div>
            <div className="md:w-1/2">
              <img 
                src="https://images.unsplash.com/photo-1606811971618-4486d14f3f99?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1470&q=80" 
                alt="Interface do sistema" 
                className="rounded-lg shadow-xl w-full"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Recursos Completos para sua Clínica</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              O DentalSys oferece todos os recursos necessários para gerenciar sua clínica odontológica com eficiência
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<Calendar className="h-8 w-8 text-blue-600" />}
              title="Agendamento Inteligente"
              description="Visualize e gerencie a agenda de todos os profissionais, com controle de salas e procedimentos"
            />
            <FeatureCard 
              icon={<FileText className="h-8 w-8 text-blue-600" />}
              title="Prontuário Eletrônico"
              description="Mantenha todos os registros dos pacientes organizados e acessíveis em um único lugar"
            />
            <FeatureCard 
              icon={<Database className="h-8 w-8 text-blue-600" />}
              title="Odontograma Digital"
              description="Registre e visualize procedimentos realizados e planejados no odontograma interativo"
            />
            <FeatureCard 
              icon={<ChartBar className="h-8 w-8 text-blue-600" />}
              title="Financeiro Completo"
              description="Controle receitas, despesas, orçamentos e repasses com suporte a várias formas de pagamento"
            />
            <FeatureCard 
              icon={<MessageCircle className="h-8 w-8 text-blue-600" />}
              title="Automação de Comunicação"
              description="Envie lembretes automáticos de consultas por WhatsApp, SMS e E-mail"
            />
            <FeatureCard 
              icon={<ShieldCheck className="h-8 w-8 text-blue-600" />}
              title="Dados Seguros"
              description="Seus dados são protegidos com criptografia e backups automáticos diários"
            />
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="planos" className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Planos e Preços</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Escolha o plano que melhor atende às necessidades da sua clínica
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <PricingCard 
              title="Básico"
              price="R$ 99,90"
              description="Ideal para profissionais autônomos"
              features={[
                "1 Profissional",
                "Agenda completa",
                "Prontuário eletrônico",
                "Odontograma básico",
                "Financeiro simples"
              ]}
              buttonText="Comece Grátis"
              buttonVariant="outline"
            />
            <PricingCard 
              title="Premium"
              price="R$ 199,90"
              description="Ideal para pequenas clínicas"
              features={[
                "Até 5 Profissionais",
                "Tudo do plano Básico",
                "Odontograma avançado",
                "Financeiro completo",
                "Lembretes automáticos",
                "Automações de marketing",
                "Suporte prioritário"
              ]}
              buttonText="Teste Grátis por 7 Dias"
              buttonVariant="default"
              highlighted={true}
            />
            <PricingCard 
              title="Enterprise"
              price="R$ 349,90"
              description="Ideal para clínicas de médio/grande porte"
              features={[
                "Profissionais ilimitados",
                "Tudo do plano Premium",
                "Integração TISS",
                "Multi-clínicas",
                "API para integrações",
                "Dashboard avançado",
                "Suporte personalizado"
              ]}
              buttonText="Entre em Contato"
              buttonVariant="outline"
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-blue-700 text-white py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Pronto para transformar sua clínica?</h2>
          <p className="text-xl mb-8 max-w-2xl mx-auto">
            Inicie agora com 7 dias de teste gratuito. Sem compromisso, cartão de crédito não exigido.
          </p>
          <Link href="/auth">
            <Button size="lg" className="bg-white text-blue-700 hover:bg-gray-100">
              Começar Teste Gratuito
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-lg font-bold mb-4">DentalSys</h3>
              <p className="text-gray-400">
                Sistema completo para gestão de clínicas odontológicas.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-bold mb-4">Links Rápidos</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white">Recursos</a></li>
                <li><a href="#planos" className="hover:text-white">Preços</a></li>
                <li><a href="#" className="hover:text-white">Contato</a></li>
                <li><a href="#" className="hover:text-white">Blog</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-bold mb-4">Legal</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white">Termos de Uso</a></li>
                <li><a href="#" className="hover:text-white">Política de Privacidade</a></li>
                <li><a href="#" className="hover:text-white">LGPD</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-bold mb-4">Contato</h3>
              <ul className="space-y-2 text-gray-400">
                <li>contato@dentalsys.com.br</li>
                <li>(11) 9999-9999</li>
                <li>São Paulo, SP</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-700 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; {new Date().getFullYear()} DentalSys. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Feature Card Component
function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md border border-gray-100 hover:shadow-lg transition-shadow">
      <div className="mb-4">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}

// Pricing Card Component
function PricingCard({ 
  title, 
  price, 
  description, 
  features, 
  buttonText, 
  buttonVariant,
  highlighted = false
}: { 
  title: string, 
  price: string, 
  description: string, 
  features: string[], 
  buttonText: string, 
  buttonVariant: "default" | "outline",
  highlighted?: boolean 
}) {
  return (
    <div className={`p-6 rounded-lg border ${highlighted ? 'border-blue-500 shadow-xl scale-105 relative' : 'border-gray-200 shadow-md'}`}>
      {highlighted && (
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-medium">
          Mais Popular
        </div>
      )}
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <div className="text-3xl font-bold mb-2">{price}</div>
      <p className="text-gray-600 mb-6">{description}</p>
      <ul className="space-y-3 mb-8">
        {features.map((feature, index) => (
          <li key={index} className="flex items-center">
            <div className="mr-2 text-green-500">✓</div>
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <Link href="/auth">
        <Button variant={buttonVariant} className={`w-full ${highlighted ? 'bg-blue-600 hover:bg-blue-700' : ''}`}>
          {buttonText}
        </Button>
      </Link>
    </div>
  );
}