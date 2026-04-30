import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import { LandingNav } from "@/components/landing/LandingNav";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { PricingCard } from "@/components/landing/PricingCard";
import { PricingToggle, type BillingCycle } from "@/components/landing/PricingToggle";
import { FAQAccordion } from "@/components/landing/FAQAccordion";
import { FeatureComparisonTable } from "@/components/landing/FeatureComparisonTable";
import { PLANS, FAQ_PRICING } from "@/components/landing/plans-data";

export default function PrecosPage() {
  const [cycle, setCycle] = useState<BillingCycle>("monthly");

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <LandingNav />

      <main>
        {/* Hero curto */}
        <section className="relative pt-28 pb-12 sm:pt-36 sm:pb-16 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-cyan-50" />
          <div className="container relative mx-auto px-4 text-center max-w-3xl">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100/60 border border-blue-200 text-blue-700 text-xs font-semibold mb-5">
                <Sparkles className="h-3.5 w-3.5" />
                Planos transparentes — sem letra miúda
              </div>
              <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 leading-tight tracking-tight mb-4">
                Comece em{" "}
                <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
                  14 dias grátis
                </span>
                .
              </h1>
              <p className="text-lg text-slate-600 leading-relaxed mb-6">
                Sem cartão de crédito durante o trial. Sem fidelidade. Sem taxa de setup.
                Cancele quando quiser, direto pelo painel.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Toggle + Cards */}
        <section className="py-8">
          <div className="container mx-auto px-4">
            <div className="flex justify-center mb-10">
              <PricingToggle value={cycle} onChange={setCycle} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl mx-auto pt-4">
              {PLANS.map((plan, i) => (
                <PricingCard key={plan.id} plan={plan} cycle={cycle} index={i} />
              ))}
            </div>
          </div>
        </section>

        {/* Comparativo completo */}
        <section className="py-16 bg-slate-50">
          <div className="container mx-auto px-4">
            <div className="max-w-2xl mx-auto text-center mb-10">
              <p className="text-sm font-semibold text-blue-600 uppercase tracking-wider mb-3">Comparativo</p>
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">
                Veja exatamente o que cada plano inclui.
              </h2>
              <p className="text-slate-600">
                Toda funcionalidade do sistema, mapeada por plano. Sem surpresas no final do mês.
              </p>
            </div>
            <FeatureComparisonTable />
          </div>
        </section>

        {/* FAQ específica de billing */}
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <div className="max-w-2xl mx-auto text-center mb-10">
              <p className="text-sm font-semibold text-blue-600 uppercase tracking-wider mb-3">Perguntas sobre cobrança</p>
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
                Dúvidas comuns sobre planos e pagamento.
              </h2>
            </div>
            <FAQAccordion items={FAQ_PRICING} />
          </div>
        </section>

        {/* CTA Final */}
        <section className="relative py-16 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-blue-700 to-cyan-600" />
          <div className="container relative mx-auto px-4 text-center text-white">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="max-w-2xl mx-auto"
            >
              <h2 className="text-3xl sm:text-4xl font-extrabold mb-3">
                Ainda em dúvida sobre qual plano?
              </h2>
              <p className="text-blue-100 mb-6">
                Comece pelo Profissional — é o mais escolhido. Você troca de plano a qualquer momento, sem penalidade.
              </p>
              <Link href="/auth">
                <Button size="lg" className="bg-white text-blue-700 hover:bg-blue-50">
                  Começar trial de 14 dias
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </motion.div>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
