import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { 
  Building2, 
  Calendar, 
  Users, 
  DollarSign, 
  Package, 
  Scissors, 
  Activity, 
  Bot,
  CheckCircle,
  XCircle,
  Settings
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const moduleIcons = {
  clinica: Building2,
  agenda: Calendar,
  pacientes: Users,
  financeiro: DollarSign,
  estoque: Package,
  proteses: Scissors,
  odontograma: Activity,
  automacoes: Bot
};

export default function ClinicModulesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: modulesData, isLoading } = useQuery({
    queryKey: ["/api/clinic/modules"],
    staleTime: 30000
  });

  const activateMutation = useMutation({
    mutationFn: (moduleId: string) => 
      apiRequest(`/api/clinic/modules/${moduleId}/activate`, "POST"),
    onSuccess: (_, moduleId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clinic/modules"] });
      toast({
        title: "Módulo Ativado",
        description: `O módulo ${moduleId} foi ativado com sucesso.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Falha ao ativar módulo",
        variant: "destructive",
      });
    }
  });

  const deactivateMutation = useMutation({
    mutationFn: (moduleId: string) => 
      apiRequest(`/api/clinic/modules/${moduleId}/deactivate`, "POST"),
    onSuccess: (_, moduleId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clinic/modules"] });
      toast({
        title: "Módulo Desativado",
        description: `O módulo ${moduleId} foi desativado com sucesso.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Falha ao desativar módulo",
        variant: "destructive",
      });
    }
  });

  const handleToggleModule = (moduleId: string, isActive: boolean) => {
    if (isActive) {
      deactivateMutation.mutate(moduleId);
    } else {
      activateMutation.mutate(moduleId);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(8)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-3">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2 mt-2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-20 bg-gray-200 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const { byCategory } = modulesData || { byCategory: {} };

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Módulos da Clínica</h1>
          <p className="text-muted-foreground">
            Gerencie os módulos e funcionalidades da sua clínica
          </p>
        </div>
        <Badge variant="secondary" className="text-sm">
          {modulesData?.loaded || 0} módulos carregados
        </Badge>
      </div>

      {/* Módulos Clínicos */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-blue-600">Módulos Clínicos</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {byCategory.clinico?.map((module: any) => {
            const IconComponent = moduleIcons[module.definition.id as keyof typeof moduleIcons] || Settings;
            return (
              <Card key={module.definition.id} className="transition-all hover:shadow-lg">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <IconComponent className="h-5 w-5 text-blue-600" />
                      <CardTitle className="text-lg">{module.definition.displayName}</CardTitle>
                    </div>
                    <div className="flex items-center space-x-2">
                      {module.isActive ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-gray-400" />
                      )}
                      <Switch
                        checked={module.isActive}
                        onCheckedChange={() => handleToggleModule(module.definition.id, module.isActive)}
                        disabled={activateMutation.isPending || deactivateMutation.isPending}
                      />
                    </div>
                  </div>
                  <CardDescription className="text-sm">
                    {module.definition.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Versão: {module.definition.version}</span>
                      <Badge variant={module.isActive ? "default" : "secondary"} className="text-xs">
                        {module.isActive ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                    {module.definition.dependencies?.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        <span className="font-medium">Dependências:</span> {module.definition.dependencies.join(", ")}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Módulos Administrativos */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-green-600">Módulos Administrativos</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {byCategory.administrativo?.map((module: any) => {
            const IconComponent = moduleIcons[module.definition.id as keyof typeof moduleIcons] || Settings;
            return (
              <Card key={module.definition.id} className="transition-all hover:shadow-lg">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <IconComponent className="h-5 w-5 text-green-600" />
                      <CardTitle className="text-lg">{module.definition.displayName}</CardTitle>
                    </div>
                    <div className="flex items-center space-x-2">
                      {module.isActive ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-gray-400" />
                      )}
                      <Switch
                        checked={module.isActive}
                        onCheckedChange={() => handleToggleModule(module.definition.id, module.isActive)}
                        disabled={activateMutation.isPending || deactivateMutation.isPending}
                      />
                    </div>
                  </div>
                  <CardDescription className="text-sm">
                    {module.definition.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Versão: {module.definition.version}</span>
                      <Badge variant={module.isActive ? "default" : "secondary"} className="text-xs">
                        {module.isActive ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                    {module.definition.dependencies?.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        <span className="font-medium">Dependências:</span> {module.definition.dependencies.join(", ")}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Módulos de Integração */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-purple-600">Módulos de Integração</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {byCategory.integracao?.map((module: any) => {
            const IconComponent = moduleIcons[module.definition.id as keyof typeof moduleIcons] || Settings;
            return (
              <Card key={module.definition.id} className="transition-all hover:shadow-lg">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <IconComponent className="h-5 w-5 text-purple-600" />
                      <CardTitle className="text-lg">{module.definition.displayName}</CardTitle>
                    </div>
                    <div className="flex items-center space-x-2">
                      {module.isActive ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-gray-400" />
                      )}
                      <Switch
                        checked={module.isActive}
                        onCheckedChange={() => handleToggleModule(module.definition.id, module.isActive)}
                        disabled={activateMutation.isPending || deactivateMutation.isPending}
                      />
                    </div>
                  </div>
                  <CardDescription className="text-sm">
                    {module.definition.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Versão: {module.definition.version}</span>
                      <Badge variant={module.isActive ? "default" : "secondary"} className="text-xs">
                        {module.isActive ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                    {module.definition.dependencies?.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        <span className="font-medium">Dependências:</span> {module.definition.dependencies.join(", ")}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}