import DashboardLayout from "@/layouts/DashboardLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useAuth } from "@/core/AuthProvider";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

// Dashboard types
interface MetricData {
  total: number;
  growth: number;
}

interface DashboardStats {
  appointments: MetricData;
  revenue: MetricData;
  newPatients: MetricData;
}

interface WeeklyAppointment {
  name: string;
  agendamentos: number;
}

interface MonthlyRevenue {
  name: string;
  valor: number;
}

interface ProcedureDistribution {
  name: string;
  value: number;
}

interface RecentActivity {
  type: string;
  title: string;
  description: string;
  created_at: string;
}

const COLORS = ["#1976d2", "#43a047", "#ff5722", "#9c27b0", "#607d8b"];

export default function DashboardPage() {
  const { user } = useAuth();

  // Buscar estatísticas gerais do dashboard
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
    enabled: !!user
  });

  // Buscar agendamentos da semana
  const { data: weeklyAppointments, isLoading: weeklyLoading } = useQuery<WeeklyAppointment[]>({
    queryKey: ["/api/dashboard/appointments-week"],
    enabled: !!user
  });

  // Buscar receita mensal
  const { data: monthlyRevenue, isLoading: revenueLoading } = useQuery<MonthlyRevenue[]>({
    queryKey: ["/api/dashboard/revenue-monthly"],
    enabled: !!user
  });

  // Buscar distribuição de procedimentos
  const { data: proceduresDistribution, isLoading: proceduresLoading } = useQuery<ProcedureDistribution[]>({
    queryKey: ["/api/dashboard/procedures-distribution"],
    enabled: !!user
  });

  // Buscar atividades recentes da agenda
  const { data: recentActivities, isLoading: activitiesLoading } = useQuery<RecentActivity[]>({
    queryKey: ["/api/recent-activities"],
    enabled: !!user
  });

  // Função para obter cor baseada no tipo de atividade
  const getActivityColor = (type: string) => {
    switch (type) {
      case 'appointment': return 'bg-blue-500';
      case 'payment': return 'bg-green-500';
      case 'patient': return 'bg-purple-500';
      default: return 'bg-muted-foreground';
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
                <div className="h-9 bg-muted rounded mb-2 w-24"></div>
                <div className="h-5 bg-muted/70 rounded w-full"></div>
              </div>
            ) : (
              <>
                <div className="text-3xl font-bold">{stats?.appointments?.total ?? 0}</div>
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
                <div className="h-9 bg-muted rounded mb-2 w-32"></div>
                <div className="h-5 bg-muted/70 rounded w-full"></div>
              </div>
            ) : (
              <>
                <div className="text-3xl font-bold">
                  {new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL'
                  }).format(stats?.revenue?.total || 0)}
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
                <div className="h-9 bg-muted rounded mb-2 w-16"></div>
                <div className="h-5 bg-muted/70 rounded w-full"></div>
              </div>
            ) : (
              <>
                <div className="text-3xl font-bold">{stats?.newPatients?.total ?? 0}</div>
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
            {weeklyLoading ? (
              <div className="h-80 flex items-center justify-center">
                <div className="text-muted-foreground">Carregando dados...</div>
              </div>
            ) : (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={weeklyAppointments || []}
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
              </div>
            )}
          </CardContent>
        </Card>

        {/* Monthly revenue chart */}
        <Card>
          <CardHeader>
            <CardTitle>Receita Mensal</CardTitle>
            <CardDescription>Receita dos últimos 7 meses</CardDescription>
          </CardHeader>
          <CardContent>
            {revenueLoading ? (
              <div className="h-80 flex items-center justify-center">
                <div className="text-muted-foreground">Carregando dados...</div>
              </div>
            ) : (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={monthlyRevenue || []}
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
                      formatter={(value) => [`R$ ${value}`, "Valor"]}
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
              </div>
            )}
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
            {proceduresLoading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="text-muted-foreground">Carregando dados...</div>
              </div>
            ) : proceduresDistribution && proceduresDistribution.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={proceduresDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {proceduresDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center">
                <div className="text-gray-500">Nenhum dado disponível</div>
              </div>
            )}
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
                    <div className="w-2 h-2 mt-2 mr-3 rounded-full bg-muted"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-muted rounded mb-2"></div>
                      <div className="h-3 bg-muted/70 rounded mb-1"></div>
                      <div className="h-3 bg-muted/70 rounded w-1/3"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {Array.isArray(recentActivities) && recentActivities.length > 0 ? (
                  recentActivities.map((activity, index) => (
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
