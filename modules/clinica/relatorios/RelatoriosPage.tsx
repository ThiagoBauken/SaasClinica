import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../../../client/src/components/ui/card';
import { Button } from '../../../client/src/components/ui/button';
import { Input } from '../../../client/src/components/ui/input';
import { Label } from '../../../client/src/components/ui/label';
import { Badge } from '../../../client/src/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../client/src/components/ui/tabs';
import { 
  BarChart, 
  TrendingUp, 
  Users, 
  Calendar,
  DollarSign,
  Download,
  Filter,
  FileText,
  PieChart,
  Activity,
  Clock,
  Target
} from 'lucide-react';

interface RevenueData {
  period: string;
  revenue: number;
  procedures: number;
  patients: number;
}

interface AppointmentStats {
  total: number;
  completed: number;
  cancelled: number;
  noShow: number;
  averageDuration: number;
}

interface ProcedureAnalytics {
  id: number;
  name: string;
  count: number;
  revenue: number;
  averagePrice: number;
  category: string;
}

interface PatientAnalytics {
  totalPatients: number;
  newPatients: number;
  returningPatients: number;
  averageAge: number;
  genderDistribution: { male: number; female: number; other: number };
}

export function RelatoriosPage() {
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  const { data: revenueData = [], isLoading: revenueLoading } = useQuery({
    queryKey: ['/api/reports/revenue', dateRange],
    select: (data: RevenueData[]) => data || []
  });

  const { data: appointmentStats, isLoading: appointmentLoading } = useQuery({
    queryKey: ['/api/reports/appointments', dateRange],
    select: (data: AppointmentStats) => data || {
      total: 0,
      completed: 0,
      cancelled: 0,
      noShow: 0,
      averageDuration: 0
    }
  });

  const { data: procedureAnalytics = [], isLoading: procedureLoading } = useQuery({
    queryKey: ['/api/reports/procedures', dateRange],
    select: (data: ProcedureAnalytics[]) => data || []
  });

  const { data: patientAnalytics, isLoading: patientLoading } = useQuery({
    queryKey: ['/api/reports/patients', dateRange],
    select: (data: PatientAnalytics) => data || {
      totalPatients: 0,
      newPatients: 0,
      returningPatients: 0,
      averageAge: 0,
      genderDistribution: { male: 0, female: 0, other: 0 }
    }
  });

  const totalRevenue = revenueData.reduce((sum, item) => sum + item.revenue, 0);
  const totalProcedures = revenueData.reduce((sum, item) => sum + item.procedures, 0);
  const averageTicket = totalRevenue / totalProcedures || 0;

  const isLoading = revenueLoading || appointmentLoading || procedureLoading || patientLoading;

  const exportReport = (type: string) => {
    console.log(`Exporting ${type} report for period ${dateRange.startDate} to ${dateRange.endDate}`);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Relatórios e Analytics</h1>
          <p className="text-muted-foreground">
            Análise detalhada do desempenho da clínica
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
          <Button variant="outline">
            <Filter className="mr-2 h-4 w-4" />
            Filtros
          </Button>
        </div>
      </div>

      {/* Date Range Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center space-x-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Data Início</Label>
              <Input
                id="startDate"
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">Data Fim</Label>
              <Input
                id="endDate"
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
              />
            </div>
            <Button className="mt-8">
              Atualizar Relatório
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {(totalRevenue / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">
              {revenueData.length > 1 && (
                <span className="text-green-600">
                  +{((revenueData[revenueData.length - 1]?.revenue || 0) / (revenueData[0]?.revenue || 1) * 100 - 100).toFixed(1)}%
                </span>
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Procedimentos</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProcedures}</div>
            <p className="text-xs text-muted-foreground">
              procedimentos realizados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {(averageTicket / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">
              por procedimento
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {appointmentStats ? ((appointmentStats.completed / appointmentStats.total) * 100).toFixed(1) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              consultas realizadas
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="revenue" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="revenue">Financeiro</TabsTrigger>
          <TabsTrigger value="appointments">Agendamentos</TabsTrigger>
          <TabsTrigger value="procedures">Procedimentos</TabsTrigger>
          <TabsTrigger value="patients">Pacientes</TabsTrigger>
        </TabsList>

        {/* Revenue Tab */}
        <TabsContent value="revenue" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart className="h-5 w-5" />
                  Evolução da Receita
                </CardTitle>
              </CardHeader>
              <CardContent>
                {revenueData.length === 0 ? (
                  <div className="text-center py-8">
                    <BarChart className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-semibold">Dados não disponíveis</h3>
                    <p className="mt-2 text-muted-foreground">
                      Não há dados de receita para o período selecionado.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {revenueData.slice(0, 5).map((item, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <span className="text-sm">{item.period}</span>
                        <div className="text-right">
                          <div className="font-semibold">
                            R$ {(item.revenue / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {item.procedures} procedimentos
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5" />
                  Distribuição por Período
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Receita Média Diária</span>
                    <span className="font-semibold">
                      R$ {(totalRevenue / (revenueData.length || 1) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Procedimentos por Dia</span>
                    <span className="font-semibold">
                      {(totalProcedures / (revenueData.length || 1)).toFixed(1)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Crescimento</span>
                    <Badge variant="outline" className="text-green-600">
                      +5.2%
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Appointments Tab */}
        <TabsContent value="appointments" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Consultas</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{appointmentStats?.total || 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Realizadas</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{appointmentStats?.completed || 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Canceladas</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{appointmentStats?.cancelled || 0}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Detalhes dos Agendamentos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <span>Taxa de Comparecimento</span>
                  <Badge variant="default">
                    {appointmentStats ? ((appointmentStats.completed / appointmentStats.total) * 100).toFixed(1) : 0}%
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <span>Duração Média</span>
                  <span className="font-semibold">{appointmentStats?.averageDuration || 0} min</span>
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <span>No-show</span>
                  <Badge variant="destructive">
                    {appointmentStats?.noShow || 0} consultas
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Procedures Tab */}
        <TabsContent value="procedures" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Procedimentos Mais Realizados</CardTitle>
            </CardHeader>
            <CardContent>
              {procedureAnalytics.length === 0 ? (
                <div className="text-center py-8">
                  <Activity className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 text-lg font-semibold">Dados não disponíveis</h3>
                  <p className="mt-2 text-muted-foreground">
                    Não há dados de procedimentos para o período selecionado.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {procedureAnalytics.slice(0, 10).map((procedure) => (
                    <div key={procedure.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <div className="font-semibold">{procedure.name}</div>
                        <div className="text-sm text-muted-foreground">{procedure.category}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">
                          R$ {(procedure.revenue / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {procedure.count} realizados
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Patients Tab */}
        <TabsContent value="patients" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Pacientes</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{patientAnalytics?.totalPatients || 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Novos Pacientes</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{patientAnalytics?.newPatients || 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Retornos</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{patientAnalytics?.returningPatients || 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Idade Média</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{patientAnalytics?.averageAge || 0} anos</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Distribuição Demográfica</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Masculino</span>
                  <Badge variant="outline">
                    {patientAnalytics?.genderDistribution.male || 0} pacientes
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Feminino</span>
                  <Badge variant="outline">
                    {patientAnalytics?.genderDistribution.female || 0} pacientes
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Outros</span>
                  <Badge variant="outline">
                    {patientAnalytics?.genderDistribution.other || 0} pacientes
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default RelatoriosPage;