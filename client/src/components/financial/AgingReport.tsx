import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrendingDown } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgingBracket {
  count: number;
  totalAmount: number;
}

export interface AgingReportData {
  current: AgingBracket;
  days1to30: AgingBracket;
  days31to60: AgingBracket;
  days61to90: AgingBracket;
  days90plus: AgingBracket;
}

interface AgingReportProps {
  data: AgingReportData;
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

// ---------------------------------------------------------------------------
// Bracket card
// ---------------------------------------------------------------------------

interface BracketCardProps {
  label: string;
  sublabel: string;
  count: number;
  totalAmount: number;
  percentage: number;
  colorClass: string;
  progressClass: string;
}

function BracketCard({
  label,
  sublabel,
  count,
  totalAmount,
  percentage,
  colorClass,
  progressClass,
}: BracketCardProps) {
  return (
    <Card className="flex-1 min-w-[140px]">
      <CardHeader className="pb-2">
        <CardTitle className={`text-xs font-semibold uppercase tracking-wide ${colorClass}`}>
          {label}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{sublabel}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className={`text-xl font-bold ${colorClass}`}>{formatBRL(totalAmount)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {count} {count === 1 ? "titulo" : "titulos"}
          </p>
        </div>
        <div className="space-y-1">
          <Progress
            value={percentage}
            className={`h-2 ${progressClass}`}
          />
          <p className="text-xs text-muted-foreground text-right">
            {percentage.toFixed(0)}% do total
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * AgingReport
 *
 * Renders a 5-bucket aging visualization for accounts receivable.
 * Expects data from GET /api/v1/accounts-receivable/aging.
 *
 * Example usage:
 *   const { data } = useQuery({ queryKey: ["/api/v1/accounts-receivable/aging"], ... });
 *   {data && <AgingReport data={data} />}
 */
export function AgingReport({ data, className = "" }: AgingReportProps) {
  const buckets = [
    data.current,
    data.days1to30,
    data.days31to60,
    data.days61to90,
    data.days90plus,
  ];

  const grandTotal = buckets.reduce((s, b) => s + b.totalAmount, 0);

  const pct = (b: AgingBracket) =>
    grandTotal === 0 ? 0 : (b.totalAmount / grandTotal) * 100;

  const bracketConfig = [
    {
      label: "Em dia",
      sublabel: "Vence hoje ou no futuro",
      bracket: data.current,
      colorClass: "text-green-600",
      progressClass: "[&>div]:bg-green-500",
    },
    {
      label: "1 – 30 dias",
      sublabel: "Vencido ha ate 30 dias",
      bracket: data.days1to30,
      colorClass: "text-yellow-600",
      progressClass: "[&>div]:bg-yellow-500",
    },
    {
      label: "31 – 60 dias",
      sublabel: "Vencido ha 31–60 dias",
      bracket: data.days31to60,
      colorClass: "text-orange-600",
      progressClass: "[&>div]:bg-orange-500",
    },
    {
      label: "61 – 90 dias",
      sublabel: "Vencido ha 61–90 dias",
      bracket: data.days61to90,
      colorClass: "text-red-600",
      progressClass: "[&>div]:bg-red-500",
    },
    {
      label: "Mais de 90 dias",
      sublabel: "Vencido ha mais de 90 dias",
      bracket: data.days90plus,
      colorClass: "text-red-800",
      progressClass: "[&>div]:bg-red-800",
    },
  ];

  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-3">
        <TrendingDown className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Relatorio de Aging
        </h3>
        {grandTotal > 0 && (
          <span className="ml-auto text-sm font-medium">
            Total: {formatBRL(grandTotal)}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        {bracketConfig.map((cfg) => (
          <BracketCard
            key={cfg.label}
            label={cfg.label}
            sublabel={cfg.sublabel}
            count={cfg.bracket.count}
            totalAmount={cfg.bracket.totalAmount}
            percentage={pct(cfg.bracket)}
            colorClass={cfg.colorClass}
            progressClass={cfg.progressClass}
          />
        ))}
      </div>
    </div>
  );
}

export default AgingReport;
