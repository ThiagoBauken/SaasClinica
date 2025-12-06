import DashboardLayout from "@/layouts/DashboardLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Link } from "wouter";
import {
  CalendarPlus,
  UserPlus,
  Calendar,
  Users,
  DollarSign,
  BarChart3,
  Activity
} from "lucide-react";

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
      {/* Quick Actions */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-3">
          <Link href="/agenda/novo">
            <Button className="gap-2">
              <CalendarPlus className="h-4 w-4" />
              Novo Agendamento
            </Button>
          </Link>
          <Link href="/pacientes?action=new">
            <Button variant="outline" className="gap-2">
              <UserPlus className="h-4 w-4" />
              Novo Paciente
            </Button>
          </Link>
          <Link href="/agenda">
            <Button variant="outline" className="gap-2">
              <Calendar className="h-4 w-4" />
              Ver Agenda
            </Button>
          </Link>
          <Link href="/financeiro">
            <Button variant="outline" className="gap-2">
              <DollarSign className="h-4 w-4" />
              Financeiro
            </Button>
          </Link>
        </div>
      </div>

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
            ) : weeklyAppointments && weeklyAppointments.length > 0 && weeklyAppointments.some(d => d.agendamentos > 0) ? (
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
            ) : (
              <div className="h-80 flex flex-col items-center justify-center text-center p-4">
                <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-medium text-lg mb-2">Nenhum agendamento esta semana</h3>
                <p className="text-muted-foreground mb-4">
                  Comece agendando consultas para visualizar os dados aqui.
                </p>
                <Link href="/agenda/novo">
                  <Button size="sm" className="gap-2">
                    <CalendarPlus className="h-4 w-4" />
                    Criar Agendamento
                  </Button>
                </Link>
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
            ) : monthlyRevenue && monthlyRevenue.length > 0 && monthlyRevenue.some(d => d.valor > 0) ? (
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
            ) : (
              <div className="h-80 flex flex-col items-center justify-center text-center p-4">
                <DollarSign className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-medium text-lg mb-2">Sem dados de receita</h3>
                <p className="text-muted-foreground mb-4">
                  Registre pagamentos para visualizar a evolução da receita.
                </p>
                <Link href="/financeiro">
                  <Button size="sm" variant="outline" className="gap-2">
                    <DollarSign className="h-4 w-4" />
                    Ir para Financeiro
                  </Button>
                </Link>
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
              <div className="h-64 flex flex-col items-center justify-center text-center p-4">
                <BarChart3 className="h-10 w-10 text-muted-foreground mb-3" />
                <h3 className="font-medium mb-2">Sem procedimentos</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Registre procedimentos nos agendamentos.
                </p>
                <Link href="/agenda">
                  <Button size="sm" variant="outline">Ver Agenda</Button>
                </Link>
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
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Activity className="h-10 w-10 text-muted-foreground mb-3" />
                    <h3 className="font-medium mb-2">Nenhuma atividade recente</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      As atividades aparecerão aqui conforme você usar o sistema.
                    </p>
                    <div className="flex gap-2">
                      <Link href="/agenda/novo">
                        <Button size="sm" className="gap-2">
                          <CalendarPlus className="h-4 w-4" />
                          Agendar
                        </Button>
                      </Link>
                      <Link href="/pacientes?action=new">
                        <Button size="sm" variant="outline" className="gap-2">
                          <UserPlus className="h-4 w-4" />
                          Novo Paciente
                        </Button>
                      </Link>
                    </div>
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
