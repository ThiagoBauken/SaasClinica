import { useState } from "react";
import DashboardLayout from "@/layouts/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getCsrfHeaders } from "@/lib/csrf";
import {
  Loader2,
  HardDrive,
  Clock,
  Download,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Users,
  DollarSign,
  Calendar,
  RefreshCw,
} from "lucide-react";

interface BackupInfo {
  lastBackupDate: string | null;
  lastBackupSize: string | null;
  autoBackupEnabled: boolean;
  autoBackupFrequency: string;
  retentionDays: number;
}

const defaultBackupInfo: BackupInfo = {
  lastBackupDate: null,
  lastBackupSize: null,
  autoBackupEnabled: false,
  autoBackupFrequency: "diario",
  retentionDays: 30,
};

export default function ConfiguracoesBackupPage() {
  const { toast } = useToast();
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const [autoBackupFrequency, setAutoBackupFrequency] = useState("diario");
  const [retentionDays, setRetentionDays] = useState("30");
  const [isDangerDialogOpen, setDangerDialogOpen] = useState(false);
  const [isCleaningData, setIsCleaningData] = useState(false);
  const [exportingKey, setExportingKey] = useState<string | null>(null);

  const { data: backupInfo, isLoading } = useQuery<BackupInfo>({
    queryKey: ["/api/v1/settings/backup"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/v1/settings/backup");
        const data: BackupInfo = await res.json();
        setAutoBackupEnabled(data.autoBackupEnabled);
        setAutoBackupFrequency(data.autoBackupFrequency || "diario");
        setRetentionDays(String(data.retentionDays || 30));
        return data;
      } catch {
        return defaultBackupInfo;
      }
    },
  });

  const createBackupMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/v1/settings/backup/create");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v1/settings/backup"] });
      toast({ title: "Backup criado com sucesso", description: "O backup dos dados foi gerado e está disponível para download." });
    },
    onError: () => {
      toast({ title: "Erro ao criar backup", description: "Não foi possível criar o backup. Tente novamente.", variant: "destructive" });
    },
  });

  const saveScheduleMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", "/api/v1/settings/backup", {
        autoBackupEnabled,
        autoBackupFrequency,
        retentionDays: parseInt(retentionDays),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v1/settings/backup"] });
      toast({ title: "Configurações salvas", description: "As configurações de backup automático foram salvas." });
    },
    onError: () => {
      toast({ title: "Erro ao salvar", description: "Não foi possível salvar as configurações.", variant: "destructive" });
    },
  });

  const handleExport = async (type: "pacientes" | "financeiro" | "agenda") => {
    const endpointMap = {
      pacientes: "/api/v1/export/patients.csv",
      financeiro: "/api/v1/export/financial.csv",
      agenda: "/api/v1/export/appointments.csv",
    };
    setExportingKey(type);
    try {
      const res = await fetch(endpointMap[type], { credentials: "include" });
      if (!res.ok) throw new Error("Falha ao exportar dados");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${type}-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast({ title: "Exportação concluída", description: `Os dados de ${type} foram exportados com sucesso.` });
    } catch {
      toast({ title: "Erro ao exportar", description: "Não foi possível exportar os dados. Tente novamente.", variant: "destructive" });
    } finally {
      setExportingKey(null);
    }
  };

  const handleCleanTestData = async () => {
    setIsCleaningData(true);
    try {
      const res = await fetch("/api/v1/settings/data/clean-test", {
        method: "DELETE",
        headers: getCsrfHeaders(),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha ao limpar dados");
      toast({ title: "Dados de teste removidos", description: "Os dados de teste foram removidos com sucesso." });
    } catch {
      toast({ title: "Erro ao limpar dados", description: "Não foi possível limpar os dados de teste.", variant: "destructive" });
    } finally {
      setIsCleaningData(false);
      setDangerDialogOpen(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Nenhum backup realizado";
    return new Date(dateStr).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <DashboardLayout title="Backup e Dados" currentPath="/settings/backup">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Backup e Dados" currentPath="/settings/backup">
      <div className="max-w-3xl mx-auto py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Backup e Gerenciamento de Dados</h1>
          <p className="text-muted-foreground mt-1">Gerencie backups, exporte dados e configure políticas de retenção.</p>
        </div>

        {/* Last Backup Info */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <HardDrive className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Status do Backup</CardTitle>
            </div>
            <CardDescription>Informações sobre o último backup realizado e opção de backup manual.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/40 border">
              <div className="flex items-center gap-3">
                {backupInfo?.lastBackupDate ? (
                  <CheckCircle2 className="h-8 w-8 text-green-500 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="h-8 w-8 text-yellow-500 flex-shrink-0" />
                )}
                <div>
                  <p className="text-sm font-medium">Último backup</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatDate(backupInfo?.lastBackupDate ?? null)}
                  </p>
                  {backupInfo?.lastBackupSize && (
                    <Badge variant="secondary" className="mt-1 text-xs">
                      {backupInfo.lastBackupSize}
                    </Badge>
                  )}
                </div>
              </div>
              <Button
                onClick={() => createBackupMutation.mutate()}
                disabled={createBackupMutation.isPending}
                variant="outline"
              >
                {createBackupMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Criando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Fazer Backup Agora
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Auto Backup Schedule */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Backup Automático</CardTitle>
            </div>
            <CardDescription>Configure backups automáticos para proteger os dados da clínica.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Ativar backup automático</p>
                <p className="text-xs text-muted-foreground">Realiza backups automaticamente conforme a frequência selecionada</p>
              </div>
              <Switch
                checked={autoBackupEnabled}
                onCheckedChange={setAutoBackupEnabled}
              />
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="frequency">Frequência</Label>
                <Select
                  value={autoBackupFrequency}
                  onValueChange={setAutoBackupFrequency}
                  disabled={!autoBackupEnabled}
                >
                  <SelectTrigger id="frequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="diario">Diário</SelectItem>
                    <SelectItem value="semanal">Semanal</SelectItem>
                    <SelectItem value="mensal">Mensal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="retention">Retenção de Backups</Label>
                <Select value={retentionDays} onValueChange={setRetentionDays}>
                  <SelectTrigger id="retention">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 dias</SelectItem>
                    <SelectItem value="60">60 dias</SelectItem>
                    <SelectItem value="90">90 dias</SelectItem>
                    <SelectItem value="180">180 dias</SelectItem>
                    <SelectItem value="365">365 dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button
                variant="outline"
                onClick={() => saveScheduleMutation.mutate()}
                disabled={saveScheduleMutation.isPending}
              >
                {saveScheduleMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Salvar Agendamento"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Data Export */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Download className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Exportar Dados</CardTitle>
            </div>
            <CardDescription>Exporte os dados da clínica em formato CSV para análise externa ou migração.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              {
                key: "pacientes" as const,
                label: "Exportar Pacientes (CSV)",
                description: "Nome, contato, histórico médico e dados dos pacientes",
                icon: Users,
              },
              {
                key: "financeiro" as const,
                label: "Exportar Financeiro (CSV)",
                description: "Receitas, despesas, pagamentos e relatórios financeiros",
                icon: DollarSign,
              },
              {
                key: "agenda" as const,
                label: "Exportar Agenda (CSV)",
                description: "Consultas, agendamentos e histórico de atendimentos",
                icon: Calendar,
              },
            ].map(({ key, label, description, icon: Icon }) => (
              <div key={key} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-md bg-muted">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{description}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleExport(key)}
                  disabled={exportingKey === key}
                >
                  {exportingKey === key ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-destructive/50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <CardTitle className="text-base text-destructive">Zona de Perigo</CardTitle>
            </div>
            <CardDescription>Ações irreversíveis que afetam os dados da clínica. Proceda com cautela.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 rounded-lg border border-destructive/30 bg-destructive/5">
              <div>
                <p className="text-sm font-medium">Limpar Dados de Teste</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Remove pacientes, agendamentos e registros financeiros marcados como dados de teste.
                  Esta ação não pode ser desfeita.
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDangerDialogOpen(true)}
                className="flex-shrink-0 ml-4"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Limpar Dados
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Confirmation Dialog */}
        <Dialog open={isDangerDialogOpen} onOpenChange={setDangerDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Confirmar Limpeza de Dados
              </DialogTitle>
              <DialogDescription className="pt-2 space-y-2">
                <p>Você está prestes a remover permanentemente todos os dados de teste do sistema. Esta ação <strong>não pode ser desfeita</strong>.</p>
                <p>Os seguintes dados serão removidos:</p>
                <ul className="list-disc list-inside text-sm space-y-1 pl-2">
                  <li>Pacientes de teste</li>
                  <li>Agendamentos de teste</li>
                  <li>Registros financeiros de teste</li>
                  <li>Conversas e histórico de teste</li>
                </ul>
                <p className="font-medium text-foreground">Tem certeza que deseja continuar?</p>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setDangerDialogOpen(false)}
                disabled={isCleaningData}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={handleCleanTestData}
                disabled={isCleaningData}
              >
                {isCleaningData ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Limpando...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Confirmar Limpeza
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
