import { motion } from "framer-motion";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Play } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DashboardMockup } from "./DashboardMockup";

export function LandingHero() {
  const [demoOpen, setDemoOpen] = useState(false);

  return (
    <section className="relative overflow-hidden pt-28 pb-20 sm:pt-36 sm:pb-28">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-cyan-50" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.08),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(34,211,238,0.08),transparent_50%)]" />

      <div className="container relative mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-100/60 border border-blue-200 text-blue-700 text-xs font-semibold mb-6"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Powered by Claude AI — Anthropic
            </motion.div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 leading-tight tracking-tight mb-6">
              Sua clínica no{" "}
              <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
                piloto automático
              </span>
              <br className="hidden sm:block" /> com IA de verdade.
            </h1>

            <p className="text-lg text-slate-600 leading-relaxed mb-8 max-w-xl">
              Agenda, prontuário, financeiro e um agente IA que conversa com seus pacientes
              no WhatsApp 24/7 — confirma consultas, agenda, cobra, move oportunidades.
              Tudo em um sistema só.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-8">
              <Link href="/auth">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white shadow-lg shadow-blue-500/30 w-full sm:w-auto"
                >
                  Testar 14 dias grátis
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Button
                size="lg"
                variant="outline"
                onClick={() => setDemoOpen(true)}
                className="w-full sm:w-auto"
              >
                <Play className="h-4 w-4" />
                Ver demo (2 min)
              </Button>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Sem cartão de crédito
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Cancele quando quiser
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                LGPD compliant
              </span>
            </div>
          </motion.div>

          <div className="lg:pl-6">
            <DashboardMockup />
          </div>
        </div>
      </div>

      <Dialog open={demoOpen} onOpenChange={setDemoOpen}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          <div className="aspect-video bg-slate-900 flex flex-col items-center justify-center text-white p-8 text-center">
            <Play className="h-12 w-12 text-white/50 mb-4" />
            <p className="text-lg font-semibold mb-2">Demo em produção em breve</p>
            <p className="text-sm text-slate-400 max-w-md">
              Nosso vídeo de apresentação está sendo finalizado.
              Enquanto isso, comece o trial gratuito de 14 dias e veja na prática.
            </p>
            <Link href="/auth">
              <Button className="mt-6 bg-gradient-to-r from-blue-600 to-cyan-500">
                Começar agora — 14 dias grátis
              </Button>
            </Link>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
