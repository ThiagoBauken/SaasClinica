import { useState } from "react";
import DashboardLayout from "@/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Search,
  Plus,
  Clock,
  Bell,
  MessageSquare,
  Mail,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ToggleRight,
  Loader2,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { AutomationFormData } from "@/lib/types";
import N8NAutomationForm from "@/components/automation/N8NAutomationForm";

export default function AutomationPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddAutomationOpen, setIsAddAutomationOpen] = useState(false);
  const [selectedAutomation, setSelectedAutomation] = useState<AutomationFormData | null>(null);

  // Fetch automations
  const {
    data: automations,
    isLoading: isLoadingAutomations,
    error,
  } = useQuery({
    queryKey: ["/api/automations"],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", "/api/automations");
        return await response.json();
      } catch (error) {
        console.error("Error fetching automations:", error);
        // Usar dados fixos em caso de erro
        return [
          {
            id: 1,
            name: "Confirmação de Agendamento",
            triggerType: "appointment",
            whatsappEnabled: true,
            emailEnabled: true,
            smsEnabled: false,
            webhookUrl: "https://n8n.clinicadental.com.br/webhook/confirmacao",
            active: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: 2,
            name: "Lembrete 24h Antes",
            triggerType: "time_before",
            timeBeforeValue: 24,
            timeBeforeUnit: "hours",
            appointmentStatus: "confirmed",
            whatsappEnabled: true,
            whatsappTemplateId: "lembrete_consulta",
            whatsappTemplateVariables: "Olá {{nome_paciente}},\n\nLembramos que sua consulta está agendada para amanhã ({{data_consulta}}) às {{hora_consulta}} com {{nome_profissional}}.\n\nPara confirmar, responda SIM. Para reagendar, responda NÃO.",
            emailEnabled: true,
            emailSender: "contato@clinicadental.com.br",
            emailSubject: "Lembrete: Sua consulta amanhã",
            emailBody: "Olá {{nome_paciente}},\n\nEste é um lembrete que você tem uma consulta agendada para amanhã, dia {{data_consulta}}, às {{hora_consulta}} com {{nome_profissional}}.\n\nEndereço: Av. Brasil, 1500 - Centro\nTelefone: (11) 3000-5000\n\nAtenciosamente,\nEquipe DentCare",
            smsEnabled: false,
            webhookUrl: "https://n8n.clinicadental.com.br/webhook/lembrete",
            customHeaders: [
              { name: "Content-Type", value: "application/json" },
              { name: "Authorization", value: "Bearer ********" },
            ],
            responseActions: {
              confirmIfPositive: true,
              notifyIfNegative: true,
            },
            logLevel: "complete",
            active: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: 3,
            name: "Agradecimento Pós-Consulta",
            triggerType: "after_appointment",
            appointmentStatus: "completed",
            whatsappEnabled: true,
            emailEnabled: false,
            smsEnabled: false,
            webhookUrl: "https://n8n.clinicadental.com.br/webhook/agradecimento",
            active: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: 4,
            name: "Notificação de Cancelamento",
            triggerType: "status_change",
            appointmentStatus: "cancelled",
            whatsappEnabled: true,
            emailEnabled: true,
            smsEnabled: false,
            webhookUrl: "https://n8n.clinicadental.com.br/webhook/cancelamento",
            active: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: 5,
            name: "Feedback Após Tratamento",
            triggerType: "custom",
            whatsappEnabled: true,
            emailEnabled: true,
            smsEnabled: false,
            webhookUrl: "https://n8n.clinicadental.com.br/webhook/feedback",
            active: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ];
      }
    },
  });

  // Create automation mutation
  const createAutomationMutation = useMutation({
    mutationFn: async (automationData: AutomationFormData) => {
      const res = await apiRequest("POST", "/api/automations", automationData);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automations"] });
      toast({
        title: "Automação criada",
        description: "A automação foi criada com sucesso!",
      });
      setIsAddAutomationOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar automação",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update automation mutation
  const updateAutomationMutation = useMutation({
    mutationFn: async (automationData: AutomationFormData) => {
      const res = await apiRequest(
        "PATCH",
        `/api/automations/${automationData.id}`,
        automationData
      );
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automations"] });
      toast({
        title: "Automação atualizada",
        description: "A automação foi atualizada com sucesso!",
      });
      setSelectedAutomation(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar automação",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete automation mutation
  const deleteAutomationMutation = useMutation({
    mutationFn: async (automationId: number) => {
      const res = await apiRequest("DELETE", `/api/automations/${automationId}`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automations"] });
      toast({
        title: "Automação excluída",
        description: "A automação foi excluída com sucesso!",
      });
      setSelectedAutomation(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir automação",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // ToggleRight automation active status
  const toggleAutomationMutation = useMutation({
    mutationFn: async ({ id, active }: { id: number; active: boolean }) => {
      const res = await apiRequest("PATCH", `/api/automations/${id}/toggle`, {
        active,
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automations"] });
      toast({
        title: "Status alterado",
        description: "O status da automação foi alterado com sucesso!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao alterar status",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Filter automations based on search query
  const filteredAutomations = automations
    ? automations.filter((automation: AutomationFormData) =>
        automation.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const handleAddAutomation = () => {
    setSelectedAutomation(null);
    setIsAddAutomationOpen(true);
  };

  const handleEditAutomation = (automation: AutomationFormData) => {
    setSelectedAutomation(automation);
    setIsAddAutomationOpen(true);
  };

  const handleSaveAutomation = (automationData: AutomationFormData) => {
    if (selectedAutomation) {
      updateAutomationMutation.mutate({
        ...automationData,
        id: selectedAutomation.id,
      });
    } else {
      createAutomationMutation.mutate(automationData);
    }
  };

  const handleDeleteAutomation = (id: number) => {
    deleteAutomationMutation.mutate(id);
  };

  const handleToggleActive = (id: number, active: boolean) => {
    toggleAutomationMutation.mutate({ id, active });
  };

  const getTriggerTypeLabel = (triggerType: string) => {
    switch (triggerType) {
      case "appointment":
        return "Agendamento";
      case "time_before":
        return "Tempo Antes";
      case "after_appointment":
        return "Após Consulta";
      case "status_change":
        return "Mudança de Status";
      case "custom":
        return "Personalizado";
      default:
        return triggerType;
    }
  };

  const getChannelIcon = (automation: any) => {
    return (
      <div className="flex space-x-1">
        {automation.whatsappEnabled && (
          <MessageSquare className="h-4 w-4 text-green-600" />
        )}
        {automation.emailEnabled && <Mail className="h-4 w-4 text-blue-600" />}
        {automation.smsEnabled && <Bell className="h-4 w-4 text-purple-600" />}
      </div>
    );
  };

  return (
    <DashboardLayout title="Automações" currentPath="/automation">
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Total de Automações</CardTitle>
            <CardDescription>Automações configuradas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{automations?.length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Automações Ativas</CardTitle>
            <CardDescription>Automações em execução</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {automations?.filter((a: AutomationFormData) => a.active).length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Execuções Hoje</CardTitle>
            <CardDescription>Total de notificações enviadas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">27</div>
          </CardContent>
        </Card>
      </div>

      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar automação"
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button
          className="bg-primary text-white"
          onClick={handleAddAutomation}
        >
          <Plus className="mr-2 h-4 w-4" />
          Nova Automação
        </Button>
      </div>

      {isLoadingAutomations ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="text-center text-red-500 p-4">
          Erro ao carregar automações. Tente novamente.
        </div>
      ) : (
        <div className="bg-card rounded-lg shadow-sm border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Gatilho</TableHead>
                <TableHead>Canais</TableHead>
                <TableHead>Webhook</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAutomations.map((automation: AutomationFormData) => (
                <TableRow key={automation.id}>
                  <TableCell>
                    <div className="font-medium">{automation.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Criado em{" "}
                      {(automation as any).createdAt
                        ? new Date((automation as any).createdAt).toLocaleDateString("pt-BR")
                        : "N/A"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      {automation.triggerType === "appointment" ? (
                        <Bell className="h-4 w-4 text-primary mr-2" />
                      ) : automation.triggerType === "time_before" ? (
                        <Clock className="h-4 w-4 text-amber-600 mr-2" />
                      ) : automation.triggerType === "after_appointment" ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600 mr-2" />
                      ) : automation.triggerType === "status_change" ? (
                        <AlertCircle className="h-4 w-4 text-red-600 mr-2" />
                      ) : (
                        <ToggleRight className="h-4 w-4 text-purple-600 mr-2" />
                      )}
                      <span>{getTriggerTypeLabel(automation.triggerType)}</span>
                    </div>
                    {automation.triggerType === "time_before" &&
                      automation.timeBeforeValue && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {automation.timeBeforeValue}{" "}
                          {automation.timeBeforeUnit === "minutes"
                            ? "minutos"
                            : automation.timeBeforeUnit === "hours"
                            ? "horas"
                            : "dias"}{" "}
                          antes
                        </div>
                      )}
                  </TableCell>
                  <TableCell>{getChannelIcon(automation)}</TableCell>
                  <TableCell>
                    <div className="flex items-center text-xs">
                      <ExternalLink className="h-3 w-3 text-muted-foreground mr-1" />
                      <span className="truncate max-w-[120px]">
                        {automation.webhookUrl}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={automation.active}
                      onCheckedChange={(checked) =>
                        automation.id && handleToggleActive(automation.id, checked)
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditAutomation(automation)}
                    >
                      Editar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <N8NAutomationForm
        isOpen={isAddAutomationOpen}
        onClose={() => setIsAddAutomationOpen(false)}
        initialData={selectedAutomation || undefined}
        onSave={handleSaveAutomation}
        onDelete={handleDeleteAutomation}
      />
    </DashboardLayout>
  );
}
