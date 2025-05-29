import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Calendar, 
  Users, 
  DollarSign, 
  Package, 
  Scissors, 
  Activity, 
  Bot,
  Building2,
  Settings
} from "lucide-react";
import AdminNavbar from "@/components/admin/AdminNavbar";

const moduleIcons = {
  agenda: Calendar,
  pacientes: Users,
  financeiro: DollarSign,
  estoque: Package,
  proteses: Scissors,
  odontograma: Activity,
  automacoes: Bot,
  clinica: Building2
};

interface ModuleData {
  definition: {
    id: string;
    name: string;
    displayName: string;
    version: string;
    description: string;
    icon?: string;
    dependencies?: string[];
    permissions?: string[];
  };
  isActive: boolean;
}

interface ModulesResponse {
  all: ModuleData[];
  byCategory: {
    clinico: ModuleData[];
    administrativo: ModuleData[];
    integracao: ModuleData[];
  };
  loaded: number;
}

export default function ClinicModulesPage() {
  const { data: modulesData, isLoading } = useQuery<ModulesResponse>({
    queryKey: ["/api/clinic/modules"],
    queryFn: async () => {
      const response = await fetch("/api/clinic/modules");
      if (!response.ok) throw new Error("Falha ao carregar módulos");
      return response.json();
    }
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AdminNavbar type="company" />
        <div className="container mx-auto p-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-lg">Carregando módulos da clínica...</div>
          </div>
        </div>
      </div>
    );
  }

  const renderModuleCard = (module: ModuleData) => {
    const IconComponent = moduleIcons[module.definition.id as keyof typeof moduleIcons] || Settings;
    
    return (
      <Card key={module.definition.id} className="hover:shadow-md transition-shadow">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <IconComponent className="h-5 w-5 text-blue-600" />
              <span>{module.definition.displayName}</span>
            </div>
            <Badge variant={module.isActive ? "default" : "secondary"}>
              {module.isActive ? "Ativo" : "Inativo"}
            </Badge>
          </CardTitle>
          <CardDescription>
            {module.definition.description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              <strong>Versão:</strong> {module.definition.version}
            </div>
            
            {module.definition.dependencies && module.definition.dependencies.length > 0 && (
              <div className="text-sm text-muted-foreground">
                <strong>Dependências:</strong> {module.definition.dependencies.join(", ")}
              </div>
            )}
            
            {module.definition.permissions && module.definition.permissions.length > 0 && (
              <div className="text-sm text-muted-foreground">
                <strong>Permissões:</strong>
                <div className="flex flex-wrap gap-1 mt-1">
                  {module.definition.permissions.map(permission => (
                    <Badge key={permission} variant="outline" className="text-xs">
                      {permission}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            <div className="pt-2">
              <Button
                variant={module.isActive ? "destructive" : "default"}
                size="sm"
                className="w-full"
              >
                {module.isActive ? "Desativar" : "Ativar"} Módulo
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNavbar type="company" />
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Building2 className="h-8 w-8 text-blue-600" />
            Módulos da Clínica
          </h1>
          <p className="text-muted-foreground mt-2">
            Gerencie os módulos disponíveis para sua clínica odontológica
          </p>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total de Módulos</p>
                  <p className="text-2xl font-bold">{modulesData?.loaded || 0}</p>
                </div>
                <Package className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Módulos Ativos</p>
                  <p className="text-2xl font-bold text-green-600">
                    {modulesData?.all.filter(m => m.isActive).length || 0}
                  </p>
                </div>
                <Activity className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Categorias</p>
                  <p className="text-2xl font-bold">3</p>
                </div>
                <Settings className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Módulos por Categoria */}
        <div className="space-y-8">
          {/* Módulos Clínicos */}
          <div>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Activity className="h-5 w-5 text-green-600" />
              Módulos Clínicos
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {modulesData?.byCategory.clinico.map(renderModuleCard)}
            </div>
          </div>

          {/* Módulos Administrativos */}
          <div>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-blue-600" />
              Módulos Administrativos
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {modulesData?.byCategory.administrativo.map(renderModuleCard)}
            </div>
          </div>

          {/* Módulos de Integração */}
          <div>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Bot className="h-5 w-5 text-purple-600" />
              Módulos de Integração
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {modulesData?.byCategory.integracao.map(renderModuleCard)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}