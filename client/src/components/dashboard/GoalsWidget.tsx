/**
 * GoalsWidget — compact card showing active sales goals with live progress bars.
 * Fetches from GET /api/v1/goals/dashboard (real-time calculation on the server).
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Target, ArrowRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface GoalDashboardItem {
  id: number;
  name: string;
  target_type: "revenue" | "appointments" | "new_patients" | string;
  target_value: number;
  current_value: number;
  percentage: number;
  start_date: string;
  end_date: string;
  user_name?: string | null;
}

interface GoalsDashboardResponse {
  data: GoalDashboardItem[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatGoalValue(value: number, targetType: string): string {
  if (targetType === "revenue") {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }
  if (targetType === "appointments") {
    return `${value} consulta${value !== 1 ? "s" : ""}`;
  }
  if (targetType === "new_patients") {
    return `${value} paciente${value !== 1 ? "s" : ""}`;
  }
  return String(value);
}

function targetTypeLabel(targetType: string): string {
  switch (targetType) {
    case "revenue":
      return "Receita";
    case "appointments":
      return "Consultas";
    case "new_patients":
      return "Novos pacientes";
    default:
      return targetType;
  }
}

/**
 * Returns a Tailwind color class based on progress percentage.
 * >75% → green, 50-75% → yellow, <50% → red
 */
function progressColor(pct: number): string {
  if (pct >= 75) return "bg-green-500";
  if (pct >= 50) return "bg-yellow-500";
  return "bg-red-500";
}

function progressTextColor(pct: number): string {
  if (pct >= 75) return "text-green-600";
  if (pct >= 50) return "text-yellow-600";
  return "text-red-500";
}

// ── Component ─────────────────────────────────────────────────────────────────

export function GoalsWidget() {
  const { data, isLoading, isError } = useQuery<GoalsDashboardResponse>({
    queryKey: ["/api/v1/goals/dashboard"],
    staleTime: 60_000, // 1 minute
  });

  const goals = data?.data ?? [];
  const visibleGoals = goals.slice(0, 3);
  const hasMore = goals.length > 3;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Metas de Vendas</CardTitle>
          </div>
          <Link href="/goals" className="text-xs text-primary hover:underline flex items-center gap-1">
            Ver todas
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <CardDescription>Progresso das metas ativas</CardDescription>
      </CardHeader>

      <CardContent>
        {isLoading && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {isError && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Erro ao carregar metas.
          </p>
        )}

        {!isLoading && !isError && visibleGoals.length === 0 && (
          <div className="flex flex-col items-center justify-center py-6 text-center gap-2">
            <Target className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Nenhuma meta ativa</p>
            <Link href="/goals" className="text-xs text-primary hover:underline">
              Criar primeira meta
            </Link>
          </div>
        )}

        {!isLoading && !isError && visibleGoals.length > 0 && (
          <div className="space-y-4">
            {visibleGoals.map((goal) => (
              <div key={goal.id} className="space-y-1.5">
                {/* Goal header */}
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate leading-none">{goal.name}</p>
                    {goal.user_name && (
                      <p className="text-xs text-muted-foreground mt-0.5">{goal.user_name}</p>
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-xs font-semibold shrink-0",
                      progressTextColor(goal.percentage)
                    )}
                  >
                    {goal.percentage}%
                  </span>
                </div>

                {/* Progress bar */}
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", progressColor(goal.percentage))}
                    style={{ width: `${goal.percentage}%` }}
                  />
                </div>

                {/* Value label */}
                <p className="text-xs text-muted-foreground">
                  {formatGoalValue(goal.current_value, goal.target_type)}
                  {" / "}
                  {formatGoalValue(goal.target_value, goal.target_type)}
                  <span className="ml-1 opacity-60">· {targetTypeLabel(goal.target_type)}</span>
                </p>
              </div>
            ))}

            {hasMore && (
              <Link href="/goals" className="text-xs text-primary hover:underline block text-center pt-1">
                +{goals.length - 3} mais metas
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
