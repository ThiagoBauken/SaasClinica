/**
 * AlertsWidget — aggregates operational alerts from multiple sources.
 *
 * Sources:
 *  1. Low stock items     → GET /api/inventory/items?belowMinimum=true
 *  2. Overdue payments    → GET /api/v1/accounts-receivable?status=overdue
 *  3. Unconfirmed appts   → GET /api/v1/appointments?status=pending&next24h=true
 *
 * Each alert shows an icon, count badge, description and navigates to the
 * relevant page on click. Empty state shows a green checkmark.
 */
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Package,
  DollarSign,
  Calendar,
  CheckCircle2,
  Loader2,
  Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface InventoryResponse {
  items?: any[];
  data?: any[];
  total?: number;
}

interface ReceivableResponse {
  data?: any[];
  pagination?: { total: number };
  total?: number;
}

interface AppointmentResponse {
  data?: any[];
  appointments?: any[];
  total?: number;
}

// ── Alert configuration ───────────────────────────────────────────────────────

interface AlertItem {
  key: string;
  icon: React.ElementType;
  iconColor: string;
  badgeColor: string;
  count: number;
  label: string;
  description: string;
  href: string;
  loading: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Extract a count from whatever shape the endpoint returns.
 * Handles { data: [] }, { items: [] }, { total: N }, { pagination: { total: N } }.
 */
function extractCount(response: any): number {
  if (!response) return 0;
  if (response.pagination?.total !== undefined) return response.pagination.total;
  if (response.total !== undefined) return response.total;
  if (Array.isArray(response.data)) return response.data.length;
  if (Array.isArray(response.items)) return response.items.length;
  if (Array.isArray(response.appointments)) return response.appointments.length;
  return 0;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AlertsWidget() {
  const [, navigate] = useLocation();

  // 1. Low stock items
  const {
    data: stockData,
    isLoading: stockLoading,
  } = useQuery<InventoryResponse>({
    queryKey: ["/api/inventory/items", { belowMinimum: true }],
    queryFn: async () => {
      const res = await fetch("/api/inventory/items?belowMinimum=true", {
        credentials: "include",
      });
      if (!res.ok) return { items: [] };
      return res.json();
    },
    staleTime: 120_000,
  });

  // 2. Overdue payments
  const {
    data: overdueData,
    isLoading: overdueLoading,
  } = useQuery<ReceivableResponse>({
    queryKey: ["/api/v1/accounts-receivable", { status: "overdue" }],
    queryFn: async () => {
      const res = await fetch("/api/v1/accounts-receivable?status=overdue&limit=1", {
        credentials: "include",
      });
      if (!res.ok) return { data: [], pagination: { total: 0 } };
      return res.json();
    },
    staleTime: 120_000,
  });

  // 3. Unconfirmed appointments in the next 24 hours
  const {
    data: apptData,
    isLoading: apptLoading,
  } = useQuery<AppointmentResponse>({
    queryKey: ["/api/v1/appointments", { status: "pending", next24h: true }],
    queryFn: async () => {
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const startTime = now.toISOString();
      const endTime = tomorrow.toISOString();
      const res = await fetch(
        `/api/v1/appointments?status=pending&startTime=${encodeURIComponent(startTime)}&endTime=${encodeURIComponent(endTime)}&limit=1`,
        { credentials: "include" }
      );
      if (!res.ok) return { data: [], pagination: { total: 0 } };
      return res.json();
    },
    staleTime: 60_000,
  });

  const stockCount = extractCount(stockData);
  const overdueCount = extractCount(overdueData);
  const apptCount = extractCount(apptData);

  const alerts: AlertItem[] = [
    {
      key: "stock",
      icon: Package,
      iconColor: "text-orange-500",
      badgeColor: "bg-orange-100 text-orange-700 border-orange-200",
      count: stockCount,
      label: "Estoque baixo",
      description:
        stockCount === 1
          ? "1 item abaixo do estoque mínimo"
          : `${stockCount} itens abaixo do estoque mínimo`,
      href: "/inventory",
      loading: stockLoading,
    },
    {
      key: "overdue",
      icon: DollarSign,
      iconColor: "text-red-500",
      badgeColor: "bg-red-100 text-red-700 border-red-200",
      count: overdueCount,
      label: "Pagamentos em atraso",
      description:
        overdueCount === 1
          ? "1 cobrança em atraso"
          : `${overdueCount} cobranças em atraso`,
      href: "/accounts-receivable",
      loading: overdueLoading,
    },
    {
      key: "appointments",
      icon: Calendar,
      iconColor: "text-blue-500",
      badgeColor: "bg-blue-100 text-blue-700 border-blue-200",
      count: apptCount,
      label: "Consultas sem confirmacao",
      description:
        apptCount === 1
          ? "1 consulta pendente de confirmacao nas proximas 24h"
          : `${apptCount} consultas pendentes de confirmacao nas proximas 24h`,
      href: "/agenda",
      loading: apptLoading,
    },
  ].filter((a) => a.count > 0 || a.loading);

  const isAnyLoading = stockLoading || overdueLoading || apptLoading;
  const activeAlerts = alerts.filter((a) => a.count > 0);
  const totalAlerts = activeAlerts.reduce((sum, a) => sum + a.count, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Alertas</CardTitle>
          </div>
          {totalAlerts > 0 && (
            <Badge variant="destructive" className="text-xs h-5 px-2">
              {totalAlerts}
            </Badge>
          )}
        </div>
        <CardDescription>Itens que precisam de atencao</CardDescription>
      </CardHeader>

      <CardContent>
        {isAnyLoading && activeAlerts.length === 0 && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isAnyLoading && activeAlerts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-6 text-center gap-2">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
            <p className="text-sm text-muted-foreground">
              Nenhum alerta no momento
            </p>
          </div>
        )}

        {activeAlerts.length > 0 && (
          <div className="space-y-2">
            {activeAlerts.map((alert) => {
              const Icon = alert.icon;
              return (
                <button
                  key={alert.key}
                  onClick={() => navigate(alert.href)}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-lg border px-3 py-2.5",
                    "text-left hover:bg-muted/50 transition-colors cursor-pointer"
                  )}
                >
                  {/* Icon */}
                  <div className="shrink-0">
                    <Icon className={cn("h-4 w-4", alert.iconColor)} />
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-none mb-0.5">
                      {alert.label}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {alert.description}
                    </p>
                  </div>

                  {/* Count badge */}
                  <Badge
                    variant="outline"
                    className={cn("shrink-0 text-xs font-semibold", alert.badgeColor)}
                  >
                    {alert.count}
                  </Badge>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
