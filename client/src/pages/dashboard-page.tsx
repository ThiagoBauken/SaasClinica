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
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const appointmentData = [
  { name: "Segunda", agendamentos: 12 },
  { name: "Terça", agendamentos: 19 },
  { name: "Quarta", agendamentos: 15 },
  { name: "Quinta", agendamentos: 17 },
  { name: "Sexta", agendamentos: 20 },
  { name: "Sábado", agendamentos: 8 },
  { name: "Domingo", agendamentos: 0 },
];

const revenueData = [
  { name: "Jan", valor: 4000 },
  { name: "Fev", valor: 3000 },
  { name: "Mar", valor: 2000 },
  { name: "Abr", valor: 2780 },
  { name: "Mai", valor: 1890 },
  { name: "Jun", valor: 2390 },
  { name: "Jul", valor: 3490 },
];

const procedureData = [
  { name: "Limpeza", value: 35 },
  { name: "Restauração", value: 25 },
  { name: "Canal", value: 15 },
  { name: "Extração", value: 10 },
  { name: "Outros", value: 15 },
];

const COLORS = ["#1976d2", "#43a047", "#ff5722", "#9c27b0", "#607d8b"];

export default function DashboardPage() {
  const { user } = useAuth();
  
  // Buscar atividades recentes da agenda
  const { data: recentActivities, isLoading: activitiesLoading } = useQuery({
    queryKey: ["/api/recent-activities"],
    enabled: !!user
  });

  // Função para obter cor baseada no tipo de atividade
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
            <div className="text-3xl font-bold">127</div>
            <p className="text-sm text-green-600">+12% em relação ao mês anterior</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Receita</CardTitle>
            <CardDescription>Total do mês</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">R$ 24.500</div>
            <p className="text-sm text-green-600">+8% em relação ao mês anterior</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Pacientes</CardTitle>
            <CardDescription>Novos pacientes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">17</div>
            <p className="text-sm text-green-600">+5% em relação ao mês anterior</p>
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
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={appointmentData}
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
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={revenueData}
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
                    {procedureData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
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
                {recentActivities && recentActivities.length > 0 ? (
                  recentActivities.map((activity: any, index: number) => (
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
