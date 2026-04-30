import { cn } from "@/lib/utils";

export type BillingCycle = "monthly" | "yearly";

interface PricingToggleProps {
  value: BillingCycle;
  onChange: (cycle: BillingCycle) => void;
}

export function PricingToggle({ value, onChange }: PricingToggleProps) {
  return (
    <div className="inline-flex items-center bg-slate-100 p-1 rounded-full">
      <button
        type="button"
        onClick={() => onChange("monthly")}
        className={cn(
          "px-5 py-2 text-sm font-medium rounded-full transition-all",
          value === "monthly"
            ? "bg-white text-slate-900 shadow-sm"
            : "text-slate-600 hover:text-slate-900"
        )}
      >
        Mensal
      </button>
      <button
        type="button"
        onClick={() => onChange("yearly")}
        className={cn(
          "px-5 py-2 text-sm font-medium rounded-full transition-all flex items-center gap-2",
          value === "yearly"
            ? "bg-white text-slate-900 shadow-sm"
            : "text-slate-600 hover:text-slate-900"
        )}
      >
        Anual
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
          −17%
        </span>
      </button>
    </div>
  );
}
