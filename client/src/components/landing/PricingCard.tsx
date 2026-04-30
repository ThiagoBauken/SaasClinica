import { motion } from "framer-motion";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BillingCycle } from "./PricingToggle";
import type { PlanData } from "./plans-data";

interface PricingCardProps {
  plan: PlanData;
  cycle: BillingCycle;
  index?: number;
}

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function PricingCard({ plan, cycle, index = 0 }: PricingCardProps) {
  const monthly = plan.monthlyPrice;
  const yearly = plan.yearlyPrice;
  const displayPrice = cycle === "monthly" ? monthly : Math.round(yearly / 12);
  const yearlyTotal = yearly;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className={cn(
        "relative flex flex-col p-8 rounded-2xl border bg-white",
        plan.popular
          ? "border-blue-500 shadow-xl ring-2 ring-blue-500/20 lg:scale-105"
          : "border-slate-200 shadow-sm"
      )}
    >
      {plan.popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wider shadow-md">
          Mais escolhido
        </div>
      )}

      <h3 className="text-xl font-bold text-slate-900 mb-1">{plan.name}</h3>
      <p className="text-sm text-slate-500 mb-6 leading-snug">{plan.tagline}</p>

      <div className="mb-6">
        <div className="flex items-baseline gap-1">
          <span className="text-sm font-medium text-slate-500">R$</span>
          <span className="text-5xl font-extrabold text-slate-900 tracking-tight">
            {formatBRL(displayPrice)}
          </span>
          <span className="text-sm text-slate-500">/mês</span>
        </div>
        {cycle === "yearly" && (
          <p className="text-xs text-emerald-600 font-medium mt-1">
            R$ {formatBRL(yearlyTotal)} cobrados anualmente
          </p>
        )}
        {cycle === "monthly" && (
          <p className="text-xs text-slate-400 mt-1">
            ou R$ {formatBRL(yearly)} no plano anual (economize ~17%)
          </p>
        )}
      </div>

      <div className="mb-6 p-4 rounded-lg bg-slate-50 text-sm space-y-1.5">
        <div className="flex justify-between text-slate-700"><span>Usuários</span><span className="font-medium">{plan.limits.users}</span></div>
        <div className="flex justify-between text-slate-700"><span>Pacientes</span><span className="font-medium">{plan.limits.patients}</span></div>
        <div className="flex justify-between text-slate-700"><span>Agenda/mês</span><span className="font-medium">{plan.limits.appointments}</span></div>
        <div className="flex justify-between text-slate-700"><span>Trial</span><span className="font-medium">{plan.trialDays} dias</span></div>
      </div>

      <ul className="space-y-3 mb-8 flex-1">
        {plan.highlights.map((feature, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
            <Check className={cn("h-4 w-4 shrink-0 mt-0.5", plan.popular ? "text-blue-600" : "text-emerald-600")} />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <Link href={`/auth?plan=${plan.id}`}>
        <Button
          data-cta={`pricing-${plan.id}-${cycle}`}
          className={cn(
            "w-full",
            plan.popular
              ? "bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white"
              : ""
          )}
          variant={plan.popular ? "default" : "outline"}
          size="lg"
        >
          {plan.ctaLabel}
        </Button>
      </Link>
    </motion.div>
  );
}
