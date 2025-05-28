import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Settings, Users, Package, Shield } from "lucide-react";

interface Company {
  id: number;
  name: string;
  email: string;
  active: boolean;
  created_at: string;
}

interface Module {
  id: number;
  name: string;
  displayName: string;
  description: string;
  isActive: boolean;
}

export default function AdminDashboard() {
  const [selectedTab, setSelectedTab] = useState("overview");

  const { data: companies } = useQuery({
    queryKey: ["/api/admin/companies"],
  });

  const { data: modules } = useQuery({
    queryKey: ["/api/admin/modules"],
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Painel de Administração
          </h1>
          <p className="text-gray-600">
            Gerencie empresas, módulos e configurações do sistema
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {[
                { id: "overview", name: "Visão Geral", icon: Settings },
                { id: "companies", name: "Empresas", icon: Users },
                { id: "modules", name: "Módulos", icon: Package },
                { id: "permissions", name: "Permissões", icon: Shield },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedTab(tab.id)}
                  className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
                    selectedTab === tab.id
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  <span>{tab.name}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Overview Tab */}
        {selectedTab === "overview" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Empresas</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{companies?.length || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Empresas registradas no sistema
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Módulos Ativos</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {modules?.filter((m: Module) => m.isActive).length || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  De {modules?.length || 0} módulos disponíveis
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Sistema</CardTitle>
                <Settings className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">Ativo</div>
                <p className="text-xs text-muted-foreground">
                  Arquitetura modular funcionando
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Segurança</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">Alta</div>
                <p className="text-xs text-muted-foreground">
                  Controle de acesso por módulo
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Companies Tab */}
        {selectedTab === "companies" && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Empresas Registradas</h2>
              <Button>Nova Empresa</Button>
            </div>
            
            <div className="grid gap-4">
              {companies?.map((company: Company) => (
                <Card key={company.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{company.name}</CardTitle>
                        <CardDescription>{company.email}</CardDescription>
                      </div>
                      <Badge variant={company.active ? "default" : "secondary"}>
                        {company.active ? "Ativa" : "Inativa"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between items-center">
                      <p className="text-sm text-gray-500">
                        Criada em: {new Date(company.created_at).toLocaleDateString()}
                      </p>
                      <Button variant="outline" size="sm">
                        Gerenciar Módulos
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Modules Tab */}
        {selectedTab === "modules" && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Módulos do Sistema</h2>
              <Button>Novo Módulo</Button>
            </div>
            
            <div className="grid gap-4">
              {modules?.map((module: Module) => (
                <Card key={module.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{module.displayName}</CardTitle>
                        <CardDescription>{module.description}</CardDescription>
                      </div>
                      <Badge variant={module.isActive ? "default" : "secondary"}>
                        {module.isActive ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between items-center">
                      <p className="text-sm text-gray-500">
                        Nome: {module.name}
                      </p>
                      <div className="space-x-2">
                        <Button variant="outline" size="sm">
                          Configurar
                        </Button>
                        <Button 
                          variant={module.isActive ? "destructive" : "default"} 
                          size="sm"
                        >
                          {module.isActive ? "Desativar" : "Ativar"}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Permissions Tab */}
        {selectedTab === "permissions" && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Controle de Permissões</h2>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle>Sistema de Permissões Modular</CardTitle>
                <CardDescription>
                  Configure quais módulos cada empresa pode acessar
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  🎯 <strong>Arquitetura Implementada:</strong><br/>
                  • Cada empresa pode ter módulos específicos habilitados<br/>
                  • Superadmin controla ativação/desativação por empresa<br/>
                  • Sistema totalmente modular e escalável<br/>
                  • Carregamento dinâmico de funcionalidades
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}