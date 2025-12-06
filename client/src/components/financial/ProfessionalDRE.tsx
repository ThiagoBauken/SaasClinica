import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import {
  BarChart,
  Bar,
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
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Trophy,
  Loader2,
  Download,
  ChevronRight,
} from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

const COLORS = ["#22c55e", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4"];

interface DREProps {
  className?: string;
}

export function ProfessionalDRE({ className }: DREProps) {
  const [period, setPeriod] = useState<"week" | "month" | "quarter" | "year">("month");
  const [selectedProfessional, setSelectedProfessional] = useState<number | null>(null);

  // Calcular datas do período
  const getDateRange = () => {
    const now = new Date();
    let start: Date;
    let end = new Date(now);

    switch (period) {
      case "week":
        start = new Date(now);
        start.setDate(now.getDate() - 7);
        break;
      case "month":
        start = startOfMonth(now);
        end = endOfMonth(now);
        break;
      case "quarter":
        start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        break;
      case "year":
        start = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        start = startOfMonth(now);
        end = endOfMonth(now);
    }

    return { start, end };
  };

  const { start, end } = getDateRange();

  // Buscar DRE de todos os profissionais
  const { data: dreData, isLoading } = useQuery({
    queryKey: ["/api/v1/financial/dre/professional", start.toISOString(), end.toISOString()],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      });

      const res = await fetch(`/api/v1/financial/dre/professional?${params}`, {
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to fetch DRE data");
      return res.json();
    },
  });

  // Buscar ranking
  const { data: rankingData } = useQuery({
    queryKey: ["/api/v1/financial/dre/ranking", period],
    queryFn: async () => {
      const res = await fetch(`/api/v1/financial/dre/ranking?period=${period}`, {
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to fetch ranking");
      return res.json();
    },
  });

  // Buscar DRE detalhado de um profissional específico
  const { data: professionalDetail } = useQuery({
    queryKey: ["/api/v1/financial/dre/professional", selectedProfessional, start.toISOString(), end.toISOString()],
    queryFn: async () => {
      if (!selectedProfessional) return null;

      const params = new URLSearchParams({
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      });

      const res = await fetch(`/api/v1/financial/dre/professional/${selectedProfessional}?${params}`, {
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to fetch professional detail");
      return res.json();
    },
    enabled: !!selectedProfessional,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center h-64 ${className}`}>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header com filtros */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">DRE Profissional</h2>
          <p className="text-muted-foreground">
            Demonstrativo de resultado por profissional
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Última Semana</SelectItem>
              <SelectItem value="month">Este Mês</SelectItem>
              <SelectItem value="quarter">Trimestre</SelectItem>
              <SelectItem value="year">Este Ano</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Bruta</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(dreData?.totals?.grossRevenue || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {dreData?.totals?.completedAppointments || 0} consultas realizadas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Parte Profissionais</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(dreData?.totals?.professionalShares || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {dreData?.settings?.defaultCommissionRate || 50}% de comissão padrão
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Parte Clínica</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {formatCurrency(dreData?.totals?.clinicShares || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Após split de pagamentos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Profissionais Ativos</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dreData?.professionals?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Com faturamento no período
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="table" className="space-y-4">
        <TabsList>
          <TabsTrigger value="table">Tabela</TabsTrigger>
          <TabsTrigger value="ranking">Ranking</TabsTrigger>
          <TabsTrigger value="charts">Gráficos</TabsTrigger>
        </TabsList>

        {/* Tabela de DRE */}
        <TabsContent value="table" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>DRE por Profissional</CardTitle>
              <CardDescription>
                Período: {format(start, "dd/MM/yyyy", { locale: ptBR })} a{" "}
                {format(end, "dd/MM/yyyy", { locale: ptBR })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Profissional</TableHead>
                    <TableHead className="text-right">Consultas</TableHead>
                    <TableHead className="text-right">Receita Bruta</TableHead>
                    <TableHead className="text-right">Taxas</TableHead>
                    <TableHead className="text-right">Comissão ({dreData?.settings?.defaultCommissionRate}%)</TableHead>
                    <TableHead className="text-right">Clínica</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dreData?.professionals?.map((prof: any) => (
                    <TableRow
                      key={prof.professional.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedProfessional(prof.professional.id)}
                    >
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{prof.professional.name}</span>
                          {prof.professional.speciality && (
                            <span className="text-xs text-muted-foreground">
                              {prof.professional.speciality}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary">
                          {prof.metrics.completedAppointments}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium text-green-600">
                        {formatCurrency(prof.revenue.gross)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {prof.revenue.fees > 0 ? (
                          <span className="text-red-500">
                            -{formatCurrency(prof.revenue.fees)}
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium text-blue-600">
                        {formatCurrency(prof.split.professionalShare)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-purple-600">
                        {formatCurrency(prof.split.clinicShare)}
                      </TableCell>
                      <TableCell>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {(!dreData?.professionals || dreData.professionals.length === 0) && (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum profissional com faturamento no período selecionado.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Detalhe do profissional selecionado */}
          {selectedProfessional && professionalDetail && (
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>{professionalDetail.professional.fullName}</CardTitle>
                    <CardDescription>
                      {professionalDetail.professional.speciality || "Clínico Geral"} •{" "}
                      {professionalDetail.professional.email}
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedProfessional(null)}
                  >
                    Fechar
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Resumo do profissional */}
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground">Receita Bruta</p>
                    <p className="text-xl font-bold text-green-600">
                      {formatCurrency(professionalDetail.summary.grossRevenue)}
                    </p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground">Taxas Descontadas</p>
                    <p className="text-xl font-bold text-red-500">
                      -{formatCurrency(professionalDetail.summary.fees)}
                    </p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground">Comissão ({professionalDetail.summary.commissionRate}%)</p>
                    <p className="text-xl font-bold text-blue-600">
                      {formatCurrency(professionalDetail.summary.professionalShare)}
                    </p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground">Líquido Final</p>
                    <p className="text-xl font-bold">
                      {formatCurrency(professionalDetail.summary.professionalNet)}
                    </p>
                  </div>
                </div>

                {/* Por método de pagamento */}
                {professionalDetail.byPaymentMethod?.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-3">Por Método de Pagamento</h4>
                    <div className="grid gap-2 md:grid-cols-4">
                      {professionalDetail.byPaymentMethod.map((pm: any) => (
                        <div key={pm.method} className="flex justify-between items-center p-2 border rounded">
                          <span className="capitalize">{pm.method.replace("_", " ")}</span>
                          <span className="font-medium">{formatCurrency(pm.total)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Últimas transações */}
                <div>
                  <h4 className="font-medium mb-3">Últimas Transações</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {professionalDetail.transactions?.slice(0, 10).map((t: any) => (
                        <TableRow key={t.id}>
                          <TableCell>
                            {format(new Date(t.date), "dd/MM/yyyy", { locale: ptBR })}
                          </TableCell>
                          <TableCell>{t.description}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{t.category}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            <span className={t.type === "expense" ? "text-red-500" : "text-green-600"}>
                              {t.type === "expense" ? "-" : "+"}
                              {formatCurrency(t.amount)}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Ranking */}
        <TabsContent value="ranking" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                Ranking de Faturamento
              </CardTitle>
              <CardDescription>
                Profissionais ordenados por receita no período
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {rankingData?.ranking?.map((prof: any, index: number) => (
                  <div key={prof.professionalId} className="flex items-center gap-4">
                    <div
                      className={`flex items-center justify-center w-8 h-8 rounded-full font-bold ${
                        index === 0
                          ? "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300"
                          : index === 1
                          ? "bg-muted text-muted-foreground"
                          : index === 2
                          ? "bg-orange-500/20 text-orange-700 dark:text-orange-300"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {prof.position}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-medium">{prof.name}</span>
                        <span className="font-bold text-green-600">
                          {formatCurrency(prof.revenue)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress value={prof.percentOfTotal} className="flex-1" />
                        <span className="text-sm text-muted-foreground w-12">
                          {prof.percentOfTotal.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))}

                {(!rankingData?.ranking || rankingData.ranking.length === 0) && (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum dado de faturamento no período.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Gráficos */}
        <TabsContent value="charts" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Gráfico de barras - Receita por profissional */}
            <Card>
              <CardHeader>
                <CardTitle>Receita por Profissional</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={dreData?.professionals?.map((p: any) => ({
                      name: p.professional.name.split(" ")[0],
                      receita: p.revenue.gross,
                      comissao: p.split.professionalShare,
                      clinica: p.split.clinicShare,
                    })) || []}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      labelFormatter={(label) => `Dr(a). ${label}`}
                    />
                    <Legend />
                    <Bar dataKey="comissao" name="Comissão" fill="#3b82f6" />
                    <Bar dataKey="clinica" name="Clínica" fill="#8b5cf6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Gráfico de pizza - Distribuição */}
            <Card>
              <CardHeader>
                <CardTitle>Distribuição do Faturamento</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={dreData?.professionals?.map((p: any, i: number) => ({
                        name: p.professional.name,
                        value: p.revenue.gross,
                        fill: COLORS[i % COLORS.length],
                      })) || []}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) =>
                        `${name.split(" ")[0]} (${(percent * 100).toFixed(0)}%)`
                      }
                      outerRadius={100}
                      dataKey="value"
                    >
                      {dreData?.professionals?.map((_: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default ProfessionalDRE;
