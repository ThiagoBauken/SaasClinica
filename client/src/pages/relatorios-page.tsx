import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BarChart3, TrendingUp, Users, Calendar, DollarSign, Package,
  AlertTriangle, FileText, Download, Loader2, PieChart, Activity,
} from 'lucide-react';

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
              <Button variant="outline" size="sm" onClick={exportCSV} className="ml-auto gap-1">
                <Download className="h-4 w-4" /> Exportar CSV
              </Button>
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

  // Single-object reports (summary cards)
  if (!Array.isArray(data)) {
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

  // Table view for arrays
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
