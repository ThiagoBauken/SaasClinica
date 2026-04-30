import { Fragment } from "react";
import { Check, X } from "lucide-react";
import { FEATURE_MATRIX, type FeatureRow } from "./plans-data";
import { cn } from "@/lib/utils";

function Cell({ value, popular }: { value: boolean | string; popular?: boolean }) {
  if (typeof value === "string") {
    return <span className={cn("text-sm", popular ? "text-blue-700 font-semibold" : "text-slate-700")}>{value}</span>;
  }
  return value ? (
    <Check className={cn("h-5 w-5 mx-auto", popular ? "text-blue-600" : "text-emerald-500")} />
  ) : (
    <X className="h-5 w-5 mx-auto text-slate-300" />
  );
}

export function FeatureComparisonTable() {
  const groups = Array.from(new Set(FEATURE_MATRIX.map((r: FeatureRow) => r.group)));

  return (
    <div className="max-w-5xl mx-auto overflow-x-auto">
      <table className="w-full bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <thead className="bg-slate-50">
          <tr>
            <th className="text-left p-4 text-sm font-semibold text-slate-700 w-2/5">Recurso</th>
            <th className="p-4 text-sm font-semibold text-slate-700 text-center">Básico</th>
            <th className="p-4 text-sm font-semibold text-blue-700 text-center bg-blue-50">Profissional</th>
            <th className="p-4 text-sm font-semibold text-slate-700 text-center">Empresarial</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <Fragment key={group}>
              <tr className="bg-slate-50/60">
                <td colSpan={4} className="px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {group}
                </td>
              </tr>
              {FEATURE_MATRIX.filter((r) => r.group === group).map((row, i) => (
                <tr key={`${group}-${i}`} className="border-t border-slate-100 hover:bg-slate-50/40">
                  <td className="p-4 text-sm text-slate-700">{row.feature}</td>
                  <td className="p-4 text-center"><Cell value={row.basic} /></td>
                  <td className="p-4 text-center bg-blue-50/40"><Cell value={row.professional} popular /></td>
                  <td className="p-4 text-center"><Cell value={row.enterprise} /></td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
