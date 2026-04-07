import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BarChart3, TrendingUp, TrendingDown, Users, Calendar, DollarSign, Package,
  AlertTriangle, FileText, Download, FileDown, Loader2, PieChart, Activity,
} from 'lucide-react';
import { getCsrfHeaders } from '@/lib/csrf';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';

const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

type ReportKey = string;

interface ReportDef {
  key: ReportKey;
  name: string;
  endpoint: string;
  icon: typeof BarChart3;
  description: string;
}

const REPORT_CATEGORIES = [
  {
    id: 'financial',
    name: 'Financeiro',
    icon: DollarSign,
    reports: [
      { key: 'revenue-period', name: 'Receita por Periodo', endpoint: '/api/v1/reports/revenue-by-period', icon: TrendingUp, description: 'Receita diaria, semanal ou mensal' },
      { key: 'revenue-prof', name: 'Receita por Profissional', endpoint: '/api/v1/reports/revenue-by-professional', icon: Users, description: 'Producao financeira por dentista' },
      { key: 'revenue-proc', name: 'Receita por Procedimento', endpoint: '/api/v1/reports/revenue-by-procedure', icon: BarChart3, description: 'Procedimentos mais rentaveis' },
      { key: 'revenue-ins', name: 'Convenio vs Particular', endpoint: '/api/v1/reports/revenue-insurance-vs-private', icon: PieChart, description: 'Comparativo de fontes de receita' },
      { key: 'commissions', name: 'Comissoes', endpoint: '/api/v1/reports/commissions', icon: DollarSign, description: 'Comissoes por profissional' },
      { key: 'overdue', name: 'Inadimplencia', endpoint: '/api/v1/reports/overdue-payments', icon: AlertTriangle, description: 'Pagamentos pendentes e atrasados' },
      { key: 'cashflow', name: 'Fluxo de Caixa', endpoint: '/api/v1/reports/cashflow-projection', icon: TrendingUp, description: 'Receitas vs despesas mensal' },
    ] as ReportDef[],
  },
  {
    id: 'patients',
    name: 'Pacientes',
    icon: Users,
    reports: [
      { key: 'new-patients', name: 'Pacientes Novos', endpoint: '/api/v1/reports/new-patients', icon: Users, description: 'Novos cadastros por periodo' },
      { key: 'patients-status', name: 'Ativos vs Inativos', endpoint: '/api/v1/reports/patients-status', icon: PieChart, description: 'Distribuicao de pacientes' },
      { key: 'without-return', name: 'Sem Retorno', endpoint: '/api/v1/reports/patients-without-return', icon: AlertTriangle, description: 'Pacientes que nao voltaram' },
      { key: 'birthdays', name: 'Aniversariantes', endpoint: '/api/v1/reports/birthdays', icon: Calendar, description: 'Aniversariantes do mes' },
      { key: 'referral', name: 'Origem dos Pacientes', endpoint: '/api/v1/reports/referral-sources', icon: PieChart, description: 'Como encontraram a clinica' },
    ] as ReportDef[],
  },
  {
    id: 'clinical',
    name: 'Clinico',
    icon: Activity,
    reports: [
      { key: 'appt-prof', name: 'Agendamentos por Profissional', endpoint: '/api/v1/reports/appointments-by-professional', icon: Calendar, description: 'Volume por dentista' },
      { key: 'no-show', name: 'Taxa de Faltas', endpoint: '/api/v1/reports/no-show-rate', icon: AlertTriangle, description: 'No-show rate mensal' },
      { key: 'avg-duration', name: 'Tempo Medio', endpoint: '/api/v1/reports/avg-appointment-duration', icon: Activity, description: 'Duracao media por profissional' },
      { key: 'top-proc', name: 'Top Procedimentos', endpoint: '/api/v1/reports/top-procedures', icon: BarChart3, description: 'Procedimentos mais realizados' },
      { key: 'case-accept', name: 'Aceitacao de Orcamentos', endpoint: '/api/v1/reports/case-acceptance', icon: TrendingUp, description: 'Taxa de conversao' },
      { key: 'recall', name: 'Taxa de Retorno', endpoint: '/api/v1/reports/recall-effectiveness', icon: Users, description: 'Pacientes que retornam' },
      { key: 'pending-budgets', name: 'Orcamentos Pendentes', endpoint: '/api/v1/reports/pending-budgets', icon: FileText, description: 'Orcamentos aguardando resposta' },
    ] as ReportDef[],
  },
  {
    id: 'operational',
    name: 'Operacional',
    icon: Package,
    reports: [
      { key: 'production-room', name: 'Producao por Sala', endpoint: '/api/v1/reports/production-by-room', icon: BarChart3, description: 'Utilizacao por consultorio' },
      { key: 'idle-slots', name: 'Horarios Ociosos', endpoint: '/api/v1/reports/idle-slots', icon: Calendar, description: 'Ociosidade da agenda' },
      { key: 'low-stock', name: 'Estoque Baixo', endpoint: '/api/v1/reports/low-stock', icon: AlertTriangle, description: 'Itens abaixo do minimo' },
      { key: 'material-consumption', name: 'Consumo de Materiais', endpoint: '/api/v1/reports/material-consumption', icon: Package, description: 'Saidas de estoque' },
      { key: 'dashboard', name: 'Resumo Geral', endpoint: '/api/v1/reports/dashboard-summary', icon: PieChart, description: 'Visao geral do mes' },
    ] as ReportDef[],
  },
];

function formatCurrency(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return 'R$ 0,00';
  return `R$ ${(num / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

export default function RelatoriosPage() {
  const [activeCategory, setActiveCategory] = useState('financial');
  const [selectedReport, setSelectedReport] = useState<ReportDef | null>(null);
  const [isPdfExporting, setIsPdfExporting] = useState(false);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const { data: reportData, isLoading } = useQuery({
    queryKey: [selectedReport?.endpoint, startDate, endDate],
    queryFn: async () => {
      if (!selectedReport) return null;
      const url = `${selectedReport.endpoint}?startDate=${startDate}&endDate=${endDate}`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Erro ao carregar relatorio');
      return res.json();
    },
    enabled: !!selectedReport,
  });

  const exportCSV = () => {
    if (!reportData?.data) return;
    const data = Array.isArray(reportData.data) ? reportData.data : [reportData.data];
    if (data.length === 0) return;

    const headers = Object.keys(data[0]);
    const csv = [
      headers.join(','),
      ...data.map((row: any) => headers.map((h) => `"${row[h] ?? ''}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedReport?.key || 'report'}_${startDate}_${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = useCallback(async () => {
    if (!selectedReport || !reportData?.data) return;

    const data = Array.isArray(reportData.data) ? reportData.data : [reportData.data];
    if (data.length === 0) return;

    // Build column descriptors from the first row's keys so the server can
    // apply heuristic formatting (currency / percent inference).
    const columns = Object.keys(data[0]).map((key) => ({
      key,
      label: key.replace(/_/g, ' '),
    }));

    setIsPdfExporting(true);
    try {
      const response = await fetch('/api/v1/reports/export-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getCsrfHeaders(),
        },
        credentials: 'include',
        body: JSON.stringify({
          title: selectedReport.name,
          subtitle: selectedReport.description,
          dateRange: `${startDate} a ${endDate}`,
          columns,
          data,
        }),
      });

      if (!response.ok) {
        throw new Error(`Servidor retornou ${response.status}`);
      }

      const html = await response.text();
      // Open in a new tab so the user can trigger the browser's Print dialog
      // and choose "Save as PDF". Using a Blob URL avoids pop-up blockers that
      // would fire on window.open() calls without a direct user gesture.
      const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const tab = window.open(url, '_blank');
      // Revoke the object URL after the new tab has had time to load it
      if (tab) {
        tab.addEventListener('load', () => URL.revokeObjectURL(url), { once: true });
      }
    } catch (err) {
      console.error('PDF export failed:', err);
    } finally {
      setIsPdfExporting(false);
    }
  }, [selectedReport, reportData, startDate, endDate]);

  const currentCategory = REPORT_CATEGORIES.find((c) => c.id === activeCategory);

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-[1400px]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-blue-600" />
            Relatorios Gerenciais
          </h1>
          <p className="text-muted-foreground mt-1">25 relatorios para gestao completa da clinica</p>
        </div>
      </div>

      {/* Date filters */}
      <Card className="mb-6">
        <CardContent className="py-3">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <Label className="text-xs">Data Inicio</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" />
            </div>
            <div>
              <Label className="text-xs">Data Fim</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40" />
            </div>
            <div className="flex gap-1">
              {[
                { label: '7d', days: 7 },
                { label: '30d', days: 30 },
                { label: '90d', days: 90 },
                { label: '1 ano', days: 365 },
              ].map(({ label, days }) => (
                <Button
                  key={label}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEndDate(new Date().toISOString().split('T')[0]);
                    setStartDate(new Date(Date.now() - days * 86400000).toISOString().split('T')[0]);
                  }}
                >
                  {label}
                </Button>
              ))}
            </div>
            {selectedReport && reportData?.data && (
              <div className="ml-auto flex gap-2">
                <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1">
                  <Download className="h-4 w-4" /> Exportar CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportPdf}
                  disabled={isPdfExporting}
                  className="gap-1"
                >
                  {isPdfExporting
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <FileDown className="h-4 w-4" />}
                  Exportar PDF
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left: Report list */}
        <div className="lg:col-span-1 space-y-4">
          <Tabs value={activeCategory} onValueChange={(v) => { setActiveCategory(v); setSelectedReport(null); }}>
            <TabsList className="grid grid-cols-2 lg:grid-cols-1 gap-1">
              {REPORT_CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                return (
                  <TabsTrigger key={cat.id} value={cat.id} className="justify-start gap-2 text-xs">
                    <Icon className="h-3.5 w-3.5" />
                    {cat.name}
                    <Badge variant="secondary" className="ml-auto text-[10px]">{cat.reports.length}</Badge>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>

          {currentCategory && (
            <div className="space-y-1">
              {currentCategory.reports.map((report) => {
                const Icon = report.icon;
                const isActive = selectedReport?.key === report.key;
                return (
                  <button
                    key={report.key}
                    onClick={() => setSelectedReport(report)}
                    className={`w-full text-left p-2.5 rounded-lg transition-colors flex items-start gap-2 ${
                      isActive ? 'bg-blue-50 border border-blue-200 text-blue-900' : 'hover:bg-gray-50 border border-transparent'
                    }`}
                  >
                    <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                    <div>
                      <p className="text-sm font-medium">{report.name}</p>
                      <p className="text-[11px] text-muted-foreground">{report.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Report viewer */}
        <div className="lg:col-span-3">
          {!selectedReport ? (
            <Card>
              <CardContent className="py-16">
                <div className="text-center">
                  <BarChart3 className="h-16 w-16 mx-auto text-gray-200 mb-4" />
                  <p className="text-lg text-gray-500">Selecione um relatorio</p>
                  <p className="text-sm text-gray-400 mt-1">Escolha um relatorio na lista ao lado para visualizar</p>
                </div>
              </CardContent>
            </Card>
          ) : isLoading ? (
            <Card>
              <CardContent className="py-16 flex flex-col items-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-3" />
                <p className="text-muted-foreground">Carregando relatorio...</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{selectedReport.name}</CardTitle>
                <CardDescription>{selectedReport.description} ({startDate} a {endDate})</CardDescription>
              </CardHeader>
              <CardContent>
                <ReportDataView data={reportData?.data} reportKey={selectedReport.key} />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Generic Report Data Viewer
// ============================================================

function ReportDataView({ data, reportKey }: { data: any; reportKey: string }) {
  if (!data) return <p className="text-muted-foreground">Sem dados para o periodo selecionado</p>;

  // Single-object reports (summary cards) — pass to chart-aware renderer too
  if (!Array.isArray(data)) {
    // no-show-rate: show summary card with trend arrow
    if (reportKey === 'no-show') {
      const rate = typeof data.rate === 'number' ? data.rate : parseFloat(data.rate ?? '0');
      const prev = typeof data.previousRate === 'number' ? data.previousRate : parseFloat(data.previousRate ?? '0');
      const improved = rate <= prev;
      return (
        <div className="space-y-6">
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-5xl font-bold text-blue-600">{isNaN(rate) ? '—' : `${rate.toFixed(1)}%`}</p>
              <p className="text-sm text-muted-foreground mt-1">Taxa de Faltas atual</p>
            </div>
            {!isNaN(prev) && prev > 0 && (
              <div className={`flex items-center gap-1 text-sm font-medium ${improved ? 'text-green-600' : 'text-red-500'}`}>
                {improved ? <TrendingDown className="h-5 w-5" /> : <TrendingUp className="h-5 w-5" />}
                {Math.abs(rate - prev).toFixed(1)}% vs periodo anterior
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Object.entries(data).filter(([k]) => k !== 'rate' && k !== 'previousRate').map(([key, value]) => (
              <Card key={key}>
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</p>
                  <p className="text-xl font-bold mt-1">{String(value ?? 0)}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Object.entries(data).map(([key, value]) => (
          <Card key={key}>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</p>
              <p className="text-2xl font-bold mt-1">
                {typeof value === 'number' && key.includes('revenue')
                  ? formatCurrency(value)
                  : String(value ?? 0)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Empty array
  if (data.length === 0) {
    return <p className="text-muted-foreground text-center py-8">Nenhum dado encontrado para o periodo</p>;
  }

  // --------------------------------------------------------
  // Chart views for specific report keys
  // --------------------------------------------------------

  if (reportKey === 'revenue-period') {
    // AreaChart: X = period label, Y = total revenue
    const chartData = data.map((row: any) => ({
      period: row.period ?? row.date ?? row.month ?? row.week ?? String(row[Object.keys(row)[0]]),
      total: typeof row.total === 'number' ? row.total / 100 : parseFloat(row.total ?? '0') / 100,
    }));
    return (
      <div className="space-y-6">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS[0]} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={CHART_COLORS[0]} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="period" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${v}`} />
              <Tooltip formatter={(v: number) => [`R$ ${v.toFixed(2)}`, 'Receita']} />
              <Area type="monotone" dataKey="total" stroke={CHART_COLORS[0]} fill="url(#colorRevenue)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <ReportTable data={data} />
      </div>
    );
  }

  if (reportKey === 'revenue-prof') {
    // Horizontal BarChart: professional names
    const chartData = data.map((row: any) => ({
      name: row.professional ?? row.name ?? row.dentist ?? String(row[Object.keys(row)[0]]),
      total: typeof row.total === 'number' ? row.total / 100 : parseFloat(row.total ?? '0') / 100,
    }));
    return (
      <div className="space-y-6">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${v}`} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => [`R$ ${v.toFixed(2)}`, 'Receita']} />
              <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                {chartData.map((_: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <ReportTable data={data} />
      </div>
    );
  }

  if (reportKey === 'top-proc') {
    // PieChart: procedure distribution
    const chartData = data.map((row: any) => ({
      name: row.procedure ?? row.name ?? String(row[Object.keys(row)[0]]),
      value: typeof row.count === 'number' ? row.count : parseInt(row.count ?? '0', 10),
    }));
    const total = chartData.reduce((s: number, d: any) => s + d.value, 0);
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="h-64 w-64 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  outerRadius={96}
                  dataKey="value"
                  labelLine={false}
                >
                  {chartData.map((_: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => [`${v} realizacoes`, '']} />
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-col gap-2 w-full">
            {chartData.map((item: any, index: number) => (
              <div key={index} className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                <span className="flex-1 truncate">{item.name}</span>
                <span className="font-medium">{item.value}</span>
                <span className="text-muted-foreground text-xs">({total > 0 ? ((item.value / total) * 100).toFixed(1) : 0}%)</span>
              </div>
            ))}
          </div>
        </div>
        <ReportTable data={data} />
      </div>
    );
  }

  if (reportKey === 'cashflow' || reportKey === 'dashboard') {
    // BarChart: income vs expense per month/period
    const chartData = data.map((row: any) => ({
      period: row.period ?? row.month ?? row.date ?? String(row[Object.keys(row)[0]]),
      receita: typeof row.revenue === 'number' ? row.revenue / 100 : typeof row.income === 'number' ? row.income / 100 : parseFloat(row.revenue ?? row.income ?? '0') / 100,
      despesa: typeof row.expense === 'number' ? row.expense / 100 : typeof row.expenses === 'number' ? row.expenses / 100 : parseFloat(row.expense ?? row.expenses ?? '0') / 100,
    }));
    return (
      <div className="space-y-6">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="period" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${v}`} />
              <Tooltip formatter={(v: number, name: string) => [`R$ ${v.toFixed(2)}`, name]} />
              <Legend />
              <Bar dataKey="receita" name="Receita" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} />
              <Bar dataKey="despesa" name="Despesa" fill={CHART_COLORS[3]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <ReportTable data={data} />
      </div>
    );
  }

  // Default: plain table
  return <ReportTable data={data} />;
}

// ============================================================
// Reusable table component used below charts as detail view
// ============================================================

function ReportTable({ data }: { data: any[] }) {
  if (!data || data.length === 0) return null;
  const columns = Object.keys(data[0]);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50">
            {columns.map((col) => (
              <th key={col} className="text-left p-2 font-medium capitalize text-xs">
                {col.replace(/_/g, ' ')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row: any, i: number) => (
            <tr key={i} className="border-b hover:bg-gray-50">
              {columns.map((col) => {
                const val = row[col];
                const isMonetary = col.includes('total') || col.includes('revenue') || col.includes('commission') || col.includes('cost') || col.includes('balance') || col.includes('amount');
                return (
                  <td key={col} className="p-2">
                    {isMonetary && val !== null ? formatCurrency(val) : val ?? '-'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
