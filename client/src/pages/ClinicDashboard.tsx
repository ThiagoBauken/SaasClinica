import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { 
  Calendar, 
  Users, 
  DollarSign, 
  Package, 
  Scissors, 
  Activity, 
  Bot,
  Building2,
  ArrowRight,
  TrendingUp,
  Clock
} from "lucide-react";

const moduleConfig = {
  agenda: { 
    icon: Calendar, 
    color: "text-blue-600", 
    bgColor: "bg-blue-50",
    href: "/calendar",
    description: "Visualizar agenda e agendamentos"
  },
  pacientes: { 
    icon: Users, 
    color: "text-green-600", 
    bgColor: "bg-green-50",
    href: "/patients",
    description: "Gerenciar cadastros de pacientes"
  },
  financeiro: { 
    icon: DollarSign, 
    color: "text-yellow-600", 
    bgColor: "bg-yellow-50",
    href: "/financial",
    description: "Controle financeiro e faturamento"
  },
  estoque: { 
    icon: Package, 
    color: "text-purple-600", 
    bgColor: "bg-purple-50",
    href: "/inventory",
    description: "Controle de estoque e materiais"
  },
  proteses: { 
    icon: Scissors, 
    color: "text-orange-600", 
    bgColor: "bg-orange-50",
    href: "/prosthesis",
    description: "Gestão de próteses e laboratórios"
  },
  odontograma: { 
    icon: Activity, 
    color: "text-red-600", 
    bgColor: "bg-red-50",
    href: "/odontogram",
    description: "Odontograma digital e diagnósticos"
  },
  automacoes: { 
    icon: Bot, 
    color: "text-indigo-600", 
    bgColor: "bg-indigo-50",
    href: "/automations",
    description: "Automações e integrações"
  }
};

interface ModuleData {
  definition: {
    id: string;
    displayName: string;
    description: string;
  };
  isActive: boolean;
}

export default function ClinicDashboard() {
  const { data: modulesData, isLoading } = useQuery({
    queryKey: ["/api/clinic/modules"],
    queryFn: async () => {
      const response = await fetch("/api/clinic/modules");
      if (!response.ok) throw new Error("Falha ao carregar módulos");
      return response.json();
    }
  });

  const activeModules = modulesData?.all?.filter((m: ModuleData) => 
    m.isActive && m.definition.id !== 'clinica'
  ) || [];

  const renderModuleCard = (module: ModuleData) => {
    const config = moduleConfig[module.definition.id as keyof typeof moduleConfig];
    if (!config) return null;

    const IconComponent = config.icon;
    
    return (
      <Link key={module.definition.id} href={config.href}>
        <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer group">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className={`p-3 rounded-lg ${config.bgColor}`}>
                <IconComponent className={`h-6 w-6 ${config.color}`} />
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <div className="mt-4">
              <h3 className="font-semibold text-lg">{module.definition.displayName}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {config.description}
              </p>
            </div>
            <div className="mt-4">
              <Badge variant="default" className="text-xs">
                Ativo
              </Badge>
            </div>
          </CardContent>
        </Card>
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Building2 className="h-8 w-8 text-blue-600" />
            Dashboard da Clínica
          </h1>
          <p className="text-muted-foreground mt-2">
            Acesse rapidamente todos os módulos da sua clínica odontológica
          </p>
        </div>

        {/* Estatísticas Rápidas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Módulos Ativos</p>
                  <p className="text-2xl font-bold">{activeModules.length}</p>
                </div>
                <Activity className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Consultas Hoje</p>
                  <p className="text-2xl font-bold">12</p>
                </div>
                <Clock className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Pacientes Ativos</p>
                  <p className="text-2xl font-bold">184</p>
                </div>
                <Users className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Receita Mensal</p>
                  <p className="text-2xl font-bold">R$ 15.2k</p>
                </div>
                <TrendingUp className="h-8 w-8 text-yellow-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Módulos Disponíveis */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold">Módulos Disponíveis</h2>
            <Link href="/admin/company/modules">
              <Button variant="outline" size="sm">
                Gerenciar Módulos
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-6">
                    <div className="space-y-3">
                      <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-3 bg-gray-200 rounded w-full"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : activeModules.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeModules.map(renderModuleCard)}
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhum módulo ativo</h3>
                <p className="text-muted-foreground mb-4">
                  Configure os módulos da sua clínica para começar a usar o sistema
                </p>
                <Link href="/admin/company/modules">
                  <Button>
                    Configurar Módulos
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Acesso Rápido */}
        <div>
          <h2 className="text-2xl font-semibold mb-6">Acesso Rápido</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Link href="/calendar">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-blue-600" />
                    Agenda do Dia
                  </CardTitle>
                  <CardDescription>
                    Visualizar compromissos de hoje
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>

            <Link href="/admin/company">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-green-600" />
                    Administração
                  </CardTitle>
                  <CardDescription>
                    Gerenciar usuários e configurações
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}