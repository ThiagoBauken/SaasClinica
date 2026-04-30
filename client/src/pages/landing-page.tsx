import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  FileText,
  MessageCircle,
  DollarSign,
  ShieldCheck,
  Sparkles,
  KanbanSquare,
  HeartPulse,
  ArrowRight,
  Bot,
  Zap,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { LandingNav } from "@/components/landing/LandingNav";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { FeatureCard } from "@/components/landing/FeatureCard";
import { PricingCard } from "@/components/landing/PricingCard";
import { PricingToggle, type BillingCycle } from "@/components/landing/PricingToggle";
import { FAQAccordion } from "@/components/landing/FAQAccordion";
import { TestimonialsCarousel } from "@/components/landing/TestimonialsCarousel";
import { ROICalculator } from "@/components/landing/ROICalculator";
import { WhatsAppMockup } from "@/components/landing/WhatsAppMockup";
import { PLANS, FAQ_GENERAL } from "@/components/landing/plans-data";

export default function LandingPage() {
  const [cycle, setCycle] = useState<BillingCycle>("monthly");

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <LandingNav />

      <main>
        <LandingHero />

        {/* Faixa de prova social — placeholders de logos */}
        <section className="bg-white border-y border-slate-100 py-8">
          <div className="container mx-auto px-4">
            <p className="text-center text-xs font-medium text-slate-400 uppercase tracking-wider mb-6">
              Clínicas modernas confiam no DentCare
            </p>
            <div className="flex flex-wrap justify-center items-center gap-x-10 gap-y-4 text-slate-300">
              {/* TODO: substituir por logos reais de clientes */}
              {["Sorriso Pleno", "OdontoCare+", "Dental Plus", "Clinic Smile", "OdonExpert", "BrancoDente"].map((name) => (
                <span key={name} className="text-sm font-bold tracking-wide opacity-60 hover:opacity-100 transition-opacity">
                  {name}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Seção: Dor / Problema */}
        <section className="py-20 bg-slate-50">
          <div className="container mx-auto px-4">
            <div className="max-w-2xl mx-auto text-center mb-12">
              <p className="text-sm font-semibold text-blue-600 uppercase tracking-wider mb-3">O problema</p>
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
                Você não precisa de mais um sistema. Precisa de um que trabalhe por você.
              </h2>
              <p className="text-slate-600">
                Software de gestão odonto da década passada faz seu time gastar horas no operacional.
                A gente automatiza o que dá pra automatizar — você foca no paciente.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              <PainCard
                icon={<XCircle />}
                title="Pacientes que somem"
                text="Você liga, manda mensagem, e mesmo assim 1 a cada 5 não aparece. Toda agenda em branco vira prejuízo."
              />
              <PainCard
                icon={<AlertTriangle />}
                title="Recepção sobrecarregada"
                text="Sua atendente passa o dia respondendo WhatsApp e marcando consultas — em vez de cuidar de quem está na clínica."
              />
              <PainCard
                icon={<Clock />}
                title="Caos no financeiro"
                text="Inadimplência subindo, comissões na ponta do lápis, planilha que ninguém entende. Final de mês é guerra."
              />
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="recursos" className="py-20 bg-white">
          <div className="container mx-auto px-4">
            <div className="max-w-2xl mx-auto text-center mb-14">
              <p className="text-sm font-semibold text-blue-600 uppercase tracking-wider mb-3">A solução</p>
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
                Tudo que sua clínica precisa, em um sistema único.
              </h2>
              <p className="text-slate-600">
                Da primeira mensagem do lead até o repasse de comissão. Sem gambiarra, sem integração quebrada.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-6xl mx-auto">
              <FeatureCard
                index={0}
                icon={<MessageCircle className="h-6 w-6" />}
                title="WhatsApp com IA 24/7"
                description="Agente Claude com 19 ferramentas: agenda, confirma, reagenda, cobra e responde dúvidas — autônomo."
                highlight
              />
              <FeatureCard
                index={1}
                icon={<Calendar className="h-6 w-6" />}
                title="Agenda inteligente"
                description="Drag-drop, multi-profissional, multi-sala. Booking público, lista de espera e recall automático."
              />
              <FeatureCard
                index={2}
                icon={<FileText className="h-6 w-6" />}
                title="Prontuário + odontograma"
                description="Anamnese versionada, plano de tratamento, evolução clínica, exames. Tudo digital, tudo assinado."
              />
              <FeatureCard
                index={3}
                icon={<KanbanSquare className="h-6 w-6" />}
                title="CRM Kanban com IA"
                description="Leads do WhatsApp viram cards. A IA move pelas etapas: primeiro contato → agendado → consulta feita → pago."
              />
              <FeatureCard
                index={4}
                icon={<DollarSign className="h-6 w-6" />}
                title="Financeiro completo"
                description="Caixa, contas a pagar/receber, parcelamentos, comissões, PIX, cartão e boleto. Conciliação bancária."
              />
              <FeatureCard
                index={5}
                icon={<HeartPulse className="h-6 w-6" />}
                title="Portal do paciente"
                description="Anamnese remota, link público de orçamento, confirmação one-click, antes/depois de procedimentos."
              />
              <FeatureCard
                index={6}
                icon={<Zap className="h-6 w-6" />}
                title="Lembretes automáticos"
                description="WhatsApp, e-mail e SMS com BullMQ. Sem furo: o paciente é lembrado, confirma e o no-show despenca."
              />
              <FeatureCard
                index={7}
                icon={<ShieldCheck className="h-6 w-6" />}
                title="Segurança & LGPD"
                description="Multi-tenant com Row-Level Security, criptografia em repouso, 2FA TOTP, audit log. Backups diários."
              />
            </div>
          </div>
        </section>

        {/* Diferencial IA — showcase */}
        <section id="ia" className="py-20 bg-slate-900 text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.15),transparent_70%)]" />

          <div className="container relative mx-auto px-4">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-semibold mb-5">
                  <Bot className="h-3.5 w-3.5" />
                  Diferencial DentCare
                </div>
                <h2 className="text-3xl sm:text-4xl font-bold mb-4 leading-tight">
                  Um agente IA de verdade,
                  <span className="text-cyan-400"> não um bot de fluxograma.</span>
                </h2>
                <p className="text-slate-300 leading-relaxed mb-8">
                  Powered by Claude (Anthropic). Conversa em linguagem natural, entende contexto da sua clínica,
                  consulta agenda em tempo real, aciona ferramentas internas. É um funcionário digital — não uma URA.
                </p>

                <div className="space-y-3">
                  {[
                    { icon: Calendar, text: "Agenda consultas verificando disponibilidade real" },
                    { icon: CheckCircle2, text: "Confirma e reagenda — reduz no-show para ~8%" },
                    { icon: KanbanSquare, text: "Move oportunidades no CRM automaticamente" },
                    { icon: DollarSign, text: "Cobra inadimplentes com tom certo, no horário certo" },
                    { icon: ShieldCheck, text: "Anonimiza PII antes de enviar para o LLM (LGPD)" },
                  ].map((item, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.1 }}
                      className="flex items-center gap-3 text-slate-200"
                    >
                      <div className="h-8 w-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-cyan-400 shrink-0">
                        <item.icon className="h-4 w-4" />
                      </div>
                      <span className="text-sm">{item.text}</span>
                    </motion.div>
                  ))}
                </div>

                <Link href="/auth">
                  <Button size="lg" className="mt-8 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600">
                    Ver a IA em ação
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </motion.div>

              <div className="lg:pl-8">
                <WhatsAppMockup />
              </div>
            </div>
          </div>
        </section>

        {/* Calculadora ROI */}
        <section className="py-20 bg-slate-50">
          <div className="container mx-auto px-4">
            <div className="max-w-2xl mx-auto text-center mb-10">
              <p className="text-sm font-semibold text-blue-600 uppercase tracking-wider mb-3">ROI</p>
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
                Faça as contas. A IA paga o sistema.
              </h2>
              <p className="text-slate-600">
                Calcule quanto sua clínica recupera por mês reduzindo no-show com lembretes e confirmação automática.
              </p>
            </div>
            <ROICalculator />
          </div>
        </section>

        {/* Planos */}
        <section id="planos" className="py-20 bg-white">
          <div className="container mx-auto px-4">
            <div className="max-w-2xl mx-auto text-center mb-10">
              <p className="text-sm font-semibold text-blue-600 uppercase tracking-wider mb-3">Planos</p>
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
                Comece grátis. Pague só quando vir resultado.
              </h2>
              <p className="text-slate-600 mb-8">
                14 dias de trial sem cartão de crédito. Cancele quando quiser.
              </p>
              <PricingToggle value={cycle} onChange={setCycle} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl mx-auto pt-8">
              {PLANS.map((plan, i) => (
                <PricingCard key={plan.id} plan={plan} cycle={cycle} index={i} />
              ))}
            </div>

            <div className="text-center mt-10">
              <Link href="/precos">
                <Button variant="link" className="text-blue-600">
                  Ver comparativo completo de recursos
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Depoimentos */}
        <section className="py-20 bg-slate-50">
          <div className="container mx-auto px-4">
            <div className="max-w-2xl mx-auto text-center mb-12">
              <p className="text-sm font-semibold text-blue-600 uppercase tracking-wider mb-3">Quem usa, recomenda</p>
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">
                Histórias reais de clínicas que automatizaram a operação.
              </h2>
            </div>
            <TestimonialsCarousel />
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="py-20 bg-white">
          <div className="container mx-auto px-4">
            <div className="max-w-2xl mx-auto text-center mb-10">
              <p className="text-sm font-semibold text-blue-600 uppercase tracking-wider mb-3">Perguntas frequentes</p>
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
                Tudo que você precisa saber antes de começar.
              </h2>
            </div>
            <FAQAccordion items={FAQ_GENERAL} />
          </div>
        </section>

        {/* CTA Final */}
        <section className="relative py-20 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-blue-700 to-cyan-600" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.15),transparent_50%)]" />

          <div className="container relative mx-auto px-4 text-center text-white">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="max-w-2xl mx-auto"
            >
              <Sparkles className="h-12 w-12 mx-auto mb-4 text-cyan-300" />
              <h2 className="text-3xl sm:text-5xl font-extrabold mb-4 leading-tight">
                Pronto pra colocar sua clínica no piloto automático?
              </h2>
              <p className="text-blue-100 text-lg mb-8">
                Comece o trial de 14 dias agora. Sem cartão, sem fidelidade, sem complicação.
              </p>
              <Link href="/auth">
                <Button
                  size="lg"
                  className="bg-white text-blue-700 hover:bg-blue-50 shadow-xl text-base px-8 h-12"
                >
                  Começar trial gratuito
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
              <p className="text-xs text-blue-200 mt-4">
                Setup em 5 minutos · Sem cartão de crédito · Cancele quando quiser
              </p>
            </motion.div>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}

function PainCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5 }}
      className="bg-white p-6 rounded-xl border border-slate-200"
    >
      <div className="h-10 w-10 rounded-lg bg-red-50 text-red-500 flex items-center justify-center mb-4 [&>svg]:h-5 [&>svg]:w-5">
        {icon}
      </div>
      <h3 className="font-semibold text-slate-900 mb-2">{title}</h3>
      <p className="text-sm text-slate-600 leading-relaxed">{text}</p>
    </motion.div>
  );
}

