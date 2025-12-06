import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Calendar, TrendingUp, TrendingDown, Users, Clock, AlertCircle, CheckCircle2, XCircle, Loader2, DollarSign } from "lucide-react";
import { format, subDays, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ProfessionalDRE } from "@/components/financial/ProfessionalDRE";

type PeriodType = "7days" | "30days" | "90days" | "thisMonth" | "lastMonth" | "custom";

const COLORS = {
  completed: "#22c55e",
  scheduled: "#3b82f6",
  confirmed: "#8b5cf6",
  in_progress: "#f59e0b",
  cancelled: "#ef4444",
  no_show: "#6b7280",
};

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<PeriodType>("30days");
  const [selectedProfessional, setSelectedProfessional] = useState<string>("all");

  const getDateRange = () => {
    const now = new Date();
    let start: Date;
    let end: Date = now;

    switch (period) {
      case "7days":
        start = subDays(now, 7);
        break;
      case "30days":
        start = subDays(now, 30);
        break;
      case "90days":
        start = subDays(now, 90);
        break;
      case "thisMonth":
        start = startOfMonth(now);
        end = endOfMonth(now);
        break;
      case "lastMonth":
        start = startOfMonth(subMonths(now, 1));
        end = endOfMonth(subMonths(now, 1));
        break;
      default:
        start = subDays(now, 30);
    }

    return { start, end };
  };

  const { start, end } = getDateRange();

  // Buscar dados de visão geral
  const { data: overview, isLoading: loadingOverview } = useQuery({
    queryKey: ["/api/v1/analytics/overview", start.toISOString(), end.toISOString(), selectedProfessional],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      });

      if (selectedProfessional !== "all") {
        params.append("professionalId", selectedProfessional);
      }

      const res = await fetch(`/api/v1/analytics/overview?${params}`, {
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to fetch overview");
      return res.json();
    },
  });

  // Buscar métricas por profissional
  const { data: professionals } = useQuery({
    queryKey: ["/api/v1/analytics/professionals", start.toISOString(), end.toISOString()],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      });

      const res = await fetch(`/api/v1/analytics/professionals?${params}`, {
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to fetch professionals");
      return res.json();
    },
  });

  // Buscar procedimentos mais realizados
  const { data: procedures } = useQuery({
    queryKey: ["/api/v1/analytics/procedures", start.toISOString(), end.toISOString()],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      });

      const res = await fetch(`/api/v1/analytics/procedures?${params}`, {
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to fetch procedures");
      return res.json();
    },
  });

  // Buscar horários de pico
  const { data: peakHours } = useQuery({
    queryKey: ["/api/v1/analytics/peak-hours", start.toISOString(), end.toISOString()],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      });

      const res = await fetch(`/api/v1/analytics/peak-hours?${params}`, {
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to fetch peak hours");
      return res.json();
    },
  });

  // Buscar tendências
  const { data: trends } = useQuery({
    queryKey: ["/api/v1/analytics/trends", start.toISOString(), end.toISOString(), "day"],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        groupBy: "day",
      });

      const res = await fetch(`/api/v1/analytics/trends?${params}`, {
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to fetch trends");
      return res.json();
    },
  });

  if (loadingOverview) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controles de Período */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Período:</h2>
          <Select value={period} onValueChange={(value) => setPeriod(value as PeriodType)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7days">Últimos 7 dias</SelectItem>
              <SelectItem value="30days">Últimos 30 dias</SelectItem>
              <SelectItem value="90days">Últimos 90 dias</SelectItem>
              <SelectItem value="thisMonth">Este mês</SelectItem>
              <SelectItem value="lastMonth">Mês passado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          <Select value={selectedProfessional} onValueChange={setSelectedProfessional}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Todos profissionais" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos profissionais</SelectItem>
              {professionals?.professionals?.map((prof: any) => (
                <SelectItem key={prof.professionalId} value={prof.professionalId.toString()}>
                  {prof.professionalName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Agendamentos</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview?.summary?.totalAppointments || 0}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              {overview?.summary?.growthRate >= 0 ? (
                <>
                  <TrendingUp className="h-3 w-3 text-green-500" />
                  <span className="text-green-500">+{overview?.summary?.growthRate}%</span>
                </>
              ) : (
                <>
                  <TrendingDown className="h-3 w-3 text-red-500" />
                  <span className="text-red-500">{overview?.summary?.growthRate}%</span>
                </>
              )}
              <span>vs período anterior</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Ocupação</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview?.summary?.occupancyRate || 0}%</div>
            <p className="text-xs text-muted-foreground">Slots utilizados vs disponíveis</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Cancelamento</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{overview?.summary?.cancellationRate || 0}%</div>
            <p className="text-xs text-muted-foreground">{overview?.summary?.cancelledAppointments || 0} cancelamentos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Falta</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{overview?.summary?.noShowRate || 0}%</div>
            <p className="text-xs text-muted-foreground">{overview?.summary?.noShowAppointments || 0} faltas</p>
          </CardContent>
        </Card>
      </div>

      {/* Abas de Visualizações */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="professionals">Por Profissional</TabsTrigger>
          <TabsTrigger value="procedures">Procedimentos</TabsTrigger>
          <TabsTrigger value="peaks">Horários de Pico</TabsTrigger>
          <TabsTrigger value="dre" className="flex items-center gap-1">
            <DollarSign className="h-4 w-4" />
            DRE Profissional
          </TabsTrigger>
        </TabsList>

        {/* Tab: Visão Geral */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Distribuição por Status */}
            <Card>
              <CardHeader>
                <CardTitle>Distribuição por Status</CardTitle>
                <CardDescription>Agendamentos por status no período</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={overview?.statusDistribution || []}
                      dataKey="count"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={(entry) => `${entry.label}: ${entry.count}`}
                    >
                      {overview?.statusDistribution?.map((entry: any) => (
                        <Cell key={entry.status} fill={COLORS[entry.status as keyof typeof COLORS] || "#888"} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Tendência ao Longo do Tempo */}
            <Card>
              <CardHeader>
                <CardTitle>Tendência de Agendamentos</CardTitle>
                <CardDescription>Evolução diária no período</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trends?.trends || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="total" stroke="#3b82f6" name="Total" />
                    <Line type="monotone" dataKey="completed" stroke="#22c55e" name="Concluídos" />
                    <Line type="monotone" dataKey="cancelled" stroke="#ef4444" name="Cancelados" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab: Por Profissional */}
        <TabsContent value="professionals" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Desempenho por Profissional</CardTitle>
              <CardDescription>Comparativo de agendamentos e taxa de conclusão</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={professionals?.professionals || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="professionalName" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="totalAppointments" fill="#3b82f6" name="Total" />
                  <Bar dataKey="completedAppointments" fill="#22c55e" name="Concluídos" />
                  <Bar dataKey="cancelledAppointments" fill="#ef4444" name="Cancelados" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Procedimentos */}
        <TabsContent value="procedures" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top 10 Procedimentos</CardTitle>
              <CardDescription>Procedimentos mais realizados no período</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={procedures?.topProcedures || []} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="procedureName" type="category" width={150} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" fill="#8b5cf6" name="Quantidade" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Horários de Pico */}
        <TabsContent value="peaks" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Horários de Pico</CardTitle>
                <CardDescription>Distribuição de agendamentos por hora</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={peakHours?.peakHours || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#f59e0b" name="Agendamentos" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Dias da Semana Mais Movimentados</CardTitle>
                <CardDescription>Distribuição por dia da semana</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={peakHours?.peakDays || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#8b5cf6" name="Agendamentos" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab: DRE Profissional */}
        <TabsContent value="dre" className="space-y-4">
          <ProfessionalDRE />
        </TabsContent>
      </Tabs>
    </div>
  );
}
