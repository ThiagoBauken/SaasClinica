import React, { lazy } from 'react';
import DashboardLayout from '../../../client/src/layouts/DashboardLayout';
import { useAuth } from '../../../client/src/core/AuthProvider';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../client/src/components/ui/card';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const COLORS = ['#1976d2', '#43a047', '#f57c00', '#7b1fa2', '#616161'];

// Type definitions for dashboard data
interface DashboardStats {
  appointments?: { total: number; growth: number };
  revenue?: { total: number; growth: number };
  newPatients?: { total: number; growth: number };
}

interface AppointmentChartData {
  name: string;
  agendamentos: number;
}

interface RevenueChartData {
  name: string;
  receita: number;
}

interface ProcedureChartData {
  name: string;
  value: number;
}

interface RecentActivity {
  id: number;
  type: string;
  title: string;
  description: string;
  created_at: string;
}

function DashboardModule() {
  const { user } = useAuth();

  // Fetch dashboard statistics
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
    enabled: !!user
  });

  // Fetch weekly appointments
  const { data: appointmentData, isLoading: appointmentsLoading } = useQuery<AppointmentChartData[]>({
    queryKey: ["/api/dashboard/appointments-week"],
    enabled: !!user
  });

  // Fetch monthly revenue
  const { data: revenueData, isLoading: revenueLoading } = useQuery<RevenueChartData[]>({
    queryKey: ["/api/dashboard/revenue-monthly"],
    enabled: !!user
  });

  // Fetch procedures distribution
  const { data: procedureData, isLoading: proceduresLoading } = useQuery<ProcedureChartData[]>({
    queryKey: ["/api/dashboard/procedures-distribution"],
    enabled: !!user
  });

  // Fetch recent activities
  const { data: recentActivities, isLoading: activitiesLoading } = useQuery<RecentActivity[]>({
    queryKey: ["/api/recent-activities"],
    enabled: !!user
  });

  // Function to get activity color based on type
  const getActivityColor = (type: string) => {
    switch (type) {
      case 'appointment': return 'bg-blue-500';
      case 'payment': return 'bg-green-500';
      case 'patient': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <DashboardLayout title="Dashboard" currentPath="/">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Agendamentos</CardTitle>
            <CardDescription>Total do mês</CardDescription>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="animate-pulse">
                <div className="h-9 bg-gray-300 rounded mb-2 w-20"></div>
                <div className="h-4 bg-gray-200 rounded w-40"></div>
              </div>
            ) : (
              <>
                <div className="text-3xl font-bold">{stats?.appointments?.total || 0}</div>
                <p className={`text-sm ${(stats?.appointments?.growth ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {(stats?.appointments?.growth ?? 0) >= 0 ? '+' : ''}{stats?.appointments?.growth ?? 0}% em relação ao mês anterior
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Receita</CardTitle>
            <CardDescription>Total do mês</CardDescription>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="animate-pulse">
                <div className="h-9 bg-gray-300 rounded mb-2 w-32"></div>
                <div className="h-4 bg-gray-200 rounded w-40"></div>
              </div>
            ) : (
              <>
                <div className="text-3xl font-bold">
                  R$ {(stats?.revenue?.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <p className={`text-sm ${(stats?.revenue?.growth ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {(stats?.revenue?.growth ?? 0) >= 0 ? '+' : ''}{stats?.revenue?.growth ?? 0}% em relação ao mês anterior
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Pacientes</CardTitle>
            <CardDescription>Novos pacientes</CardDescription>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="animate-pulse">
                <div className="h-9 bg-gray-300 rounded mb-2 w-16"></div>
                <div className="h-4 bg-gray-200 rounded w-40"></div>
              </div>
            ) : (
              <>
                <div className="text-3xl font-bold">{stats?.newPatients?.total || 0}</div>
                <p className={`text-sm ${(stats?.newPatients?.growth ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {(stats?.newPatients?.growth ?? 0) >= 0 ? '+' : ''}{stats?.newPatients?.growth ?? 0}% em relação ao mês anterior
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Weekly appointments chart */}
        <Card>
          <CardHeader>
            <CardTitle>Agendamentos da Semana</CardTitle>
            <CardDescription>Total de agendamentos por dia</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              {appointmentsLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-pulse text-gray-400">Carregando...</div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={appointmentData || []}
                    margin={{
                      top: 5,
                      right: 30,
                      left: 20,
                      bottom: 5,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="agendamentos" fill="#1976d2" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Monthly revenue chart */}
        <Card>
          <CardHeader>
            <CardTitle>Receita Mensal</CardTitle>
            <CardDescription>Receita dos últimos 7 meses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              {revenueLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-pulse text-gray-400">Carregando...</div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={revenueData || []}
                    margin={{
                      top: 5,
                      right: 30,
                      left: 20,
                      bottom: 5,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip
                      formatter={(value) => [`R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, "Valor"]}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="valor"
                      stroke="#43a047"
                      activeDot={{ r: 8 }}
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Procedures chart */}
        <Card>
          <CardHeader>
            <CardTitle>Procedimentos</CardTitle>
            <CardDescription>Distribuição por tipo</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {proceduresLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-pulse text-gray-400">Carregando...</div>
                </div>
              ) : (procedureData && procedureData.length > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={procedureData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {procedureData.map((entry: ProcedureChartData, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">
                  Nenhum procedimento registrado este mês
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        
        {/* Recent activities */}
        <Card className="col-span-1 md:col-span-2">
          <CardHeader>
            <CardTitle>Atividades Recentes</CardTitle>
            <CardDescription>Últimas ações no sistema</CardDescription>
          </CardHeader>
          <CardContent>
            {activitiesLoading ? (
              <div className="space-y-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex items-start animate-pulse">
                    <div className="w-2 h-2 mt-2 mr-3 rounded-full bg-gray-300"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-300 rounded mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded mb-1"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {Array.isArray(recentActivities) && recentActivities.length > 0 ? (
                  recentActivities.map((activity: RecentActivity, index: number) => (
                    <div key={index} className="flex items-start">
                      <div className={`w-2 h-2 mt-2 mr-3 rounded-full ${getActivityColor(activity.type)}`}></div>
                      <div>
                        <p className="font-medium">{activity.title}</p>
                        <p className="text-sm text-neutral-medium">{activity.description}</p>
                        <p className="text-xs text-neutral-medium">
                          {formatDistanceToNow(new Date(activity.created_at), { 
                            addSuffix: true, 
                            locale: ptBR 
                          })}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-neutral-medium">
                    <p>Nenhuma atividade recente encontrada</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

// Export the component
export { DashboardModule };

// Lazy export for dynamic loading
export const LazyDashboardModule = lazy(() => import('./index').then(module => ({ default: module.DashboardModule })));