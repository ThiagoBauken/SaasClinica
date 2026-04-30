import { useMemo, useState } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect } from "react";
import { TrendingUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function AnimatedNumber({ value, prefix = "", suffix = "" }: { value: number; prefix?: string; suffix?: string }) {
  const motionValue = useMotionValue(0);
  const rounded = useTransform(motionValue, (v) => Math.round(v));
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const controls = animate(motionValue, value, {
      duration: 0.6,
      ease: "easeOut",
    });
    const unsub = rounded.on("change", (v) => setDisplay(v));
    return () => {
      controls.stop();
      unsub();
    };
  }, [value, motionValue, rounded]);

  return (
    <span>
      {prefix}
      {display.toLocaleString("pt-BR")}
      {suffix}
    </span>
  );
}

/**
 * Calculadora client-side. Premissas conservadoras:
 * - Taxa atual de no-show informada pelo usuário (default 20%)
 * - Com IA + lembretes automáticos, no-show reduz para 8% (média histórica)
 * - Recuperação = (taxa_atual - 8%) × pacientes/mês × ticket
 * - Custo do plano Profissional (R$ 197) é descontado para mostrar lucro líquido
 */
const POST_AI_NOSHOW_RATE = 0.08;
const PRO_PLAN_COST = 197;

export function ROICalculator() {
  const [patients, setPatients] = useState(200);
  const [ticket, setTicket] = useState(300);
  const [noShow, setNoShow] = useState(20);

  const result = useMemo(() => {
    const currentRate = Math.max(0, Math.min(100, noShow)) / 100;
    if (currentRate <= POST_AI_NOSHOW_RATE) {
      return { recovered: 0, revenue: 0, profit: 0, sessionsRecovered: 0 };
    }
    const reduction = currentRate - POST_AI_NOSHOW_RATE;
    const sessionsRecovered = Math.round(patients * reduction);
    const revenue = sessionsRecovered * ticket;
    const profit = Math.max(0, revenue - PRO_PLAN_COST);
    return { recovered: reduction, revenue, profit, sessionsRecovered };
  }, [patients, ticket, noShow]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5 }}
      className="bg-white border border-slate-200 rounded-2xl shadow-lg p-6 sm:p-10 max-w-4xl mx-auto"
    >
      <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-full mb-4">
            <TrendingUp className="h-3.5 w-3.5" /> Calculadora de ROI
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mb-3">
            Quanto você ganha com nossa IA?
          </h3>
          <p className="text-slate-600 text-sm mb-6 leading-relaxed">
            Reduzimos no-show de clínicas para ~8% em média. Calcule quanto sua clínica
            recupera por mês com lembretes e confirmação automática via WhatsApp.
          </p>

          <div className="space-y-4">
            <div>
              <Label htmlFor="patients" className="text-xs font-medium text-slate-700">
                Pacientes agendados por mês
              </Label>
              <Input
                id="patients"
                type="number"
                min={1}
                value={patients}
                onChange={(e) => setPatients(Math.max(1, Number(e.target.value) || 0))}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="ticket" className="text-xs font-medium text-slate-700">
                Ticket médio por consulta (R$)
              </Label>
              <Input
                id="ticket"
                type="number"
                min={1}
                value={ticket}
                onChange={(e) => setTicket(Math.max(1, Number(e.target.value) || 0))}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="noshow" className="text-xs font-medium text-slate-700">
                Sua taxa atual de no-show (%)
              </Label>
              <Input
                id="noshow"
                type="number"
                min={0}
                max={100}
                value={noShow}
                onChange={(e) => setNoShow(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                className="mt-1.5"
              />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-600 to-cyan-500 text-white rounded-xl p-6 sm:p-8 shadow-lg">
          <p className="text-xs uppercase tracking-wider text-blue-100 font-semibold mb-2">
            Receita recuperada por mês
          </p>
          <div className="text-4xl sm:text-5xl font-extrabold mb-1">
            <AnimatedNumber value={result.revenue} prefix="R$ " />
          </div>
          <p className="text-xs text-blue-100 mb-6">
            ≈ <AnimatedNumber value={result.sessionsRecovered} /> consultas a mais por mês
          </p>

          <div className="border-t border-white/20 pt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-blue-100">No-show pós IA</span>
              <span className="font-semibold">8%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-100">Custo plano Profissional</span>
              <span className="font-semibold">−R$ {PRO_PLAN_COST}</span>
            </div>
            <div className="flex justify-between text-base pt-2 border-t border-white/20">
              <span className="text-blue-100 font-medium">Lucro líquido/mês</span>
              <span className="font-extrabold">
                <AnimatedNumber value={result.profit} prefix="R$ " />
              </span>
            </div>
          </div>

          <p className="text-[11px] text-blue-100 mt-4 leading-relaxed opacity-80">
            * Estimativa baseada em redução média de no-show de clínicas que adotaram a IA.
            Resultados reais variam por especialidade e perfil de paciente.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
