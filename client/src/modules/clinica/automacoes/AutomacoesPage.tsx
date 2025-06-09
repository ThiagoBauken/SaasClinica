import { useState } from "react";
import DashboardLayout from "@/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { 
  Dialog, 
  DialogContent, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Plus, 
  MessageSquare, 
  Clock, 
  Zap,
  Settings,
  Play,
  Pause,
  Edit,
  Trash2
} from "lucide-react";

export default function AutomacoesPage() {
  const { toast } = useToast();
  const [isAddAutomationOpen, setIsAddAutomationOpen] = useState(false);

  // Fetch automations
  const {
    data: automations = [],
    isLoading: isLoadingAutomations,
    error: automationsError
  } = useQuery({
    queryKey: ["/api/automations"],
    retry: false
  });

  // Create automation mutation
  const createAutomationMutation = useMutation({
    mutationFn: (newAutomation: any) => apiRequest("/api/automations", "POST", newAutomation),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automations"] });
      setIsAddAutomationOpen(false);
      toast({
        title: "Sucesso",
        description: "Automação criada com sucesso!",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao criar automação",
        variant: "destructive",
      });
    },
  });

  // Toggle automation mutation
  const toggleAutomationMutation = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      apiRequest(`/api/automations/${id}/toggle`, "PATCH", { active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automations"] });
      toast({
        title: "Sucesso",
        description: "Status da automação atualizado!",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao atualizar automação",
        variant: "destructive",
      });
    },
  });

  // Handle form submission
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    
    const automationData = {
      name: formData.get("name"),
      description: formData.get("description"),
      trigger: formData.get("trigger"),
      action: formData.get("action"),
      messageTemplate: formData.get("messageTemplate"),
      delayHours: parseInt(formData.get("delayHours") as string) || 0,
      active: true
    };

    createAutomationMutation.mutate(automationData);
  };

  if (automationsError) {
    return (
      <DashboardLayout title="Automações" currentPath="/automation">
        <div className="text-center py-12">
          <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Erro ao carregar automações</h3>
          <p className="text-gray-600 mb-4">Sistema de automações temporariamente indisponível</p>
          <Button onClick={() => window.location.reload()}>
            Tentar Novamente
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Automações" currentPath="/automation">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-semibold">Automações</h2>
            <p className="text-muted-foreground">
              Configure automações para notificações e lembretes
            </p>
          </div>
          
          <Dialog open={isAddAutomationOpen} onOpenChange={setIsAddAutomationOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Automação
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Criar Nova Automação</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Nome da Automação</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="Ex: Lembrete de consulta"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    name="description"
                    placeholder="Descreva o objetivo desta automação"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="trigger">Gatilho</Label>
                    <Select name="trigger" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar gatilho" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="appointment_scheduled">Consulta Agendada</SelectItem>
                        <SelectItem value="appointment_tomorrow">Consulta Amanhã</SelectItem>
                        <SelectItem value="appointment_missed">Consulta Perdida</SelectItem>
                        <SelectItem value="payment_due">Pagamento Vencido</SelectItem>
                        <SelectItem value="birthday">Aniversário do Paciente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="action">Ação</Label>
                    <Select name="action" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar ação" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="send_whatsapp">Enviar WhatsApp</SelectItem>
                        <SelectItem value="send_sms">Enviar SMS</SelectItem>
                        <SelectItem value="send_email">Enviar E-mail</SelectItem>
                        <SelectItem value="create_task">Criar Tarefa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="delayHours">Delay (horas)</Label>
                  <Input
                    id="delayHours"
                    name="delayHours"
                    type="number"
                    min="0"
                    max="168"
                    placeholder="0"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Tempo de espera antes de executar a ação (0 = imediato)
                  </p>
                </div>

                <div>
                  <Label htmlFor="messageTemplate">Template da Mensagem</Label>
                  <Textarea
                    id="messageTemplate"
                    name="messageTemplate"
                    placeholder="Olá {paciente}, sua consulta está marcada para {data} às {hora}."
                    rows={4}
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Use {paciente}, {data}, {hora} para personalizar a mensagem
                  </p>
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsAddAutomationOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createAutomationMutation.isPending}>
                    {createAutomationMutation.isPending ? "Criando..." : "Criar Automação"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Automations List */}
        {isLoadingAutomations ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
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
        ) : automations.length === 0 ? (
          <div className="text-center py-12">
            <Zap className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhuma automação configurada</h3>
            <p className="text-gray-600 mb-4">
              Crie sua primeira automação para otimizar o atendimento
            </p>
            <Button onClick={() => setIsAddAutomationOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Primeira Automação
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {automations.map((automation: any) => (
              <Card key={automation.id} className="transition-all hover:shadow-lg">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{automation.name}</CardTitle>
                    <div className="flex items-center space-x-2">
                      <Badge variant={automation.active ? "default" : "secondary"}>
                        {automation.active ? "Ativo" : "Inativo"}
                      </Badge>
                      <Switch
                        checked={automation.active}
                        onCheckedChange={(checked) =>
                          toggleAutomationMutation.mutate({
                            id: automation.id,
                            active: checked
                          })
                        }
                        disabled={toggleAutomationMutation.isPending}
                      />
                    </div>
                  </div>
                  <CardDescription>{automation.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center text-sm text-gray-600">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    <span className="capitalize">{automation.trigger?.replace('_', ' ')}</span>
                  </div>
                  
                  <div className="flex items-center text-sm text-gray-600">
                    <Zap className="h-4 w-4 mr-2" />
                    <span className="capitalize">{automation.action?.replace('_', ' ')}</span>
                  </div>

                  {automation.delayHours > 0 && (
                    <div className="flex items-center text-sm text-gray-600">
                      <Clock className="h-4 w-4 mr-2" />
                      <span>Delay: {automation.delayHours}h</span>
                    </div>
                  )}

                  <div className="pt-3 border-t">
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {automation.messageTemplate}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div className="text-xs text-gray-500">
                      Criado em {new Date(automation.createdAt).toLocaleDateString('pt-BR')}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Integration Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Settings className="h-5 w-5 mr-2" />
              Configurações de Integração
            </CardTitle>
            <CardDescription>
              Configure as integrações para que as automações funcionem
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">WhatsApp Business API</CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge variant="secondary">Não Configurado</Badge>
                  <p className="text-xs text-muted-foreground mt-2">
                    Configure sua API do WhatsApp Business
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">SMS (Twilio)</CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge variant="secondary">Não Configurado</Badge>
                  <p className="text-xs text-muted-foreground mt-2">
                    Configure sua conta Twilio para SMS
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">E-mail (SMTP)</CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge variant="secondary">Não Configurado</Badge>
                  <p className="text-xs text-muted-foreground mt-2">
                    Configure seu servidor SMTP
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="pt-4">
              <Button variant="outline">
                <Settings className="h-4 w-4 mr-2" />
                Configurar Integrações
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}