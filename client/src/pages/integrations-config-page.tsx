import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/core/AuthProvider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Settings,
  MessageSquare,
  Calendar,
  Bot,
  Database,
  Copy,
  Check,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Eye,
  EyeOff
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Send, Wifi } from "lucide-react";
import DashboardLayout from "@/layouts/DashboardLayout";

interface ClinicSettings {
  id?: number;
  companyId?: number;
  name: string;
  phone: string;
  cellphone?: string;
  email?: string;
  address?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  // Wuzapi API
  wuzapiBaseUrl?: string;
  wuzapiApiKey?: string;
  adminWhatsappPhone?: string;
  // Flags de automação
  enableAppointmentReminders?: boolean;
  enableBirthdayMessages?: boolean;
  enableFeedbackRequests?: boolean;
  // Google
  defaultGoogleCalendarId?: string;
  googleReviewLink?: string;
  googleMapsLink?: string;
  // Flowise
  flowiseBaseUrl?: string;
  flowiseChatflowId?: string;
  // Baserow
  baserowApiKey?: string;
  baserowDatabaseId?: number;
  baserowPatientsTableId?: number;
  baserowAppointmentsTableId?: number;
  // Messages
  confirmationMessageTemplate?: string;
  reminderMessageTemplate?: string;
  cancellationMessageTemplate?: string;
  birthdayMessageTemplate?: string;
  reviewRequestTemplate?: string;
  emergencyPhone?: string;
}

const defaultMessages = {
  confirmationMessageTemplate: `Olá, {{patientName}}! 😊 Este é um lembrete de que sua consulta na {{companyName}} está agendada para hoje, dia {{appointmentDate}}, às {{appointmentTime}}. Estamos prontos para cuidar do seu sorriso. Te aguardamos!`,
  reminderMessageTemplate: `Olá, {{patientName}}! 😁 Identificamos sua consulta marcada para o dia {{appointmentDate}}. Posso confirmar a sua consulta marcada para dia {{appointmentDate}} às {{appointmentTime}}?`,
  birthdayMessageTemplate: `Hoje é um dia especial! 🎉 Estamos comemorando seu aniversário e queremos aproveitar para desejar um ano cheio de felicidade, saúde e muitos sorrisos.\n\nAgradecemos por fazer parte da nossa família {{companyName}}. Que seu dia seja tão incrível quanto você! 🥳😁`,
  reviewRequestTemplate: `Boa noite, {{patientName}}! Agradecemos por ter comparecido à sua consulta na {{companyName}}! Foi um prazer cuidar do seu sorriso. 😁\n\nQueremos continuar melhorando e oferecendo o melhor atendimento, por isso, sua opinião é muito importante para nós! Você pode avaliar a sua experiência clicando no link abaixo 👇\n\n{{googleReviewLink}}\n\nDesde já, muito obrigado pela sua colaboração! 💙`,
  cancellationMessageTemplate: `Olá, {{patientName}}. Sua consulta do dia {{appointmentDate}} às {{appointmentTime}} foi cancelada. Para reagendar, entre em contato conosco. 📞 {{companyPhone}}`,
};

export default function IntegrationsConfigPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [testingWuzapi, setTestingWuzapi] = useState(false);
  const [sendingTestMessage, setSendingTestMessage] = useState(false);
  const [testPhone, setTestPhone] = useState("");

  const { data: settings, isLoading } = useQuery<ClinicSettings>({
    queryKey: ["/api/clinic-settings"],
  });

  const [formData, setFormData] = useState<ClinicSettings>({
    name: "",
    phone: "",
    ...defaultMessages,
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        ...formData,
        ...settings,
        // Usar templates padrão se não houver
        confirmationMessageTemplate: settings.confirmationMessageTemplate || defaultMessages.confirmationMessageTemplate,
        reminderMessageTemplate: settings.reminderMessageTemplate || defaultMessages.reminderMessageTemplate,
        birthdayMessageTemplate: settings.birthdayMessageTemplate || defaultMessages.birthdayMessageTemplate,
        reviewRequestTemplate: settings.reviewRequestTemplate || defaultMessages.reviewRequestTemplate,
        cancellationMessageTemplate: settings.cancellationMessageTemplate || defaultMessages.cancellationMessageTemplate,
      });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (data: ClinicSettings) => {
      const method = settings?.id ? "PUT" : "POST";
      const res = await apiRequest(method, "/api/clinic-settings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clinic-settings"] });
      toast({
        title: "Configurações salvas!",
        description: "As integrações foram atualizadas com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleInputChange = (field: keyof ClinicSettings, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    saveMutation.mutate(formData);
  };

  const toggleShowApiKey = (field: string) => {
    setShowApiKeys((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const testWuzapiConnection = async () => {
    setTestingWuzapi(true);
    try {
      const res = await apiRequest("POST", "/api/v1/integrations/test-wuzapi");
      const response = await res.json() as { connected?: boolean; loggedIn?: boolean; error?: string };
      if (response.connected) {
        toast({
          title: "Conexão OK!",
          description: `Wuzapi conectado. Status: ${response.loggedIn ? "WhatsApp Logado" : "Aguardando QR Code"}`,
        });
      } else {
        toast({
          title: "Falha na conexão",
          description: response.error || "Não foi possível conectar à Wuzapi",
          variant: "destructive",
        });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Verifique as configurações da Wuzapi";
      toast({
        title: "Erro de conexão",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setTestingWuzapi(false);
    }
  };

  const sendTestMessage = async () => {
    if (!testPhone) {
      toast({
        title: "Número obrigatório",
        description: "Informe um número de telefone para enviar a mensagem de teste",
        variant: "destructive",
      });
      return;
    }
    setSendingTestMessage(true);
    try {
      const res = await apiRequest("POST", "/api/v1/integrations/send-test-wuzapi", { phone: testPhone });
      const response = await res.json() as { success?: boolean; error?: string };
      if (response.success) {
        toast({
          title: "Mensagem enviada!",
          description: "A mensagem de teste foi enviada com sucesso.",
        });
      } else {
        toast({
          title: "Falha no envio",
          description: response.error || "Não foi possível enviar a mensagem",
          variant: "destructive",
        });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Verifique as configurações e tente novamente";
      toast({
        title: "Erro no envio",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setSendingTestMessage(false);
    }
  };

  const variablesHelp = [
    { var: "{{patientName}}", desc: "Nome do paciente" },
    { var: "{{appointmentDate}}", desc: "Data da consulta" },
    { var: "{{appointmentTime}}", desc: "Horário da consulta" },
    { var: "{{companyName}}", desc: "Nome da clínica" },
    { var: "{{companyPhone}}", desc: "Telefone da clínica" },
    { var: "{{googleReviewLink}}", desc: "Link de avaliação Google" },
  ];

  if (isLoading) {
    return (
      <DashboardLayout title="Integrações" currentPath="/integracoes">
        <div className="flex items-center justify-center h-96">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Integrações" currentPath="/integracoes">
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="h-6 w-6" />
            Configurações de Integrações
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure as integrações com WhatsApp, Flowise e outros serviços
          </p>
        </div>
        <Button onClick={handleSave} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? (
            <RefreshCw className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Check className="h-4 w-4 mr-2" />
          )}
          Salvar Configurações
        </Button>
      </div>

      <Tabs defaultValue="company" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="company" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Empresa
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            WhatsApp
          </TabsTrigger>
          <TabsTrigger value="google" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Google
          </TabsTrigger>
          <TabsTrigger value="automation" className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            Automação
          </TabsTrigger>
          <TabsTrigger value="messages" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Mensagens
          </TabsTrigger>
        </TabsList>

        {/* Dados da Empresa */}
        <TabsContent value="company">
          <Card>
            <CardHeader>
              <CardTitle>Dados da Empresa</CardTitle>
              <CardDescription>
                Informações básicas que serão usadas nas mensagens automáticas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Clínica *</Label>
                  <Input
                    id="name"
                    value={formData.name || ""}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    placeholder="Nome da sua clínica"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone Principal *</Label>
                  <Input
                    id="phone"
                    value={formData.phone || ""}
                    onChange={(e) => handleInputChange("phone", e.target.value)}
                    placeholder="(11) 99999-9999"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email || ""}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    placeholder="contato@clinica.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emergencyPhone">Telefone de Emergência</Label>
                  <Input
                    id="emergencyPhone"
                    value={formData.emergencyPhone || ""}
                    onChange={(e) => handleInputChange("emergencyPhone", e.target.value)}
                    placeholder="(11) 99999-9999"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Endereço Completo</Label>
                <Input
                  id="address"
                  value={formData.address || ""}
                  onChange={(e) => handleInputChange("address", e.target.value)}
                  placeholder="Rua, número, bairro, cidade - UF"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* WhatsApp / Wuzapi */}
        <TabsContent value="whatsapp">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-green-600" />
                Integração WhatsApp (Wuzapi)
              </CardTitle>
              <CardDescription>
                Configure a conexão com a Wuzapi para envio de mensagens WhatsApp
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  A Wuzapi permite enviar mensagens WhatsApp automatizadas.
                  Você precisa ter um token de usuário configurado no seu servidor Wuzapi.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="wuzapiBaseUrl">URL da API Wuzapi</Label>
                <Input
                  id="wuzapiBaseUrl"
                  value={formData.wuzapiBaseUrl || ""}
                  onChange={(e) => handleInputChange("wuzapiBaseUrl", e.target.value)}
                  placeholder="https://wuzapi.cloud"
                />
                <p className="text-xs text-muted-foreground">
                  URL do seu servidor Wuzapi (sem barra no final)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="wuzapiApiKey">Token de Usuário (API Key)</Label>
                <div className="flex gap-2">
                  <Input
                    id="wuzapiApiKey"
                    type={showApiKeys.wuzapiApiKey ? "text" : "password"}
                    value={formData.wuzapiApiKey || ""}
                    onChange={(e) => handleInputChange("wuzapiApiKey", e.target.value)}
                    placeholder="seu-token-de-usuario"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => toggleShowApiKey("wuzapiApiKey")}
                  >
                    {showApiKeys.wuzapiApiKey ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Token gerado pelo admin do Wuzapi para sua clínica
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="adminWhatsappPhone">WhatsApp do Administrador</Label>
                <Input
                  id="adminWhatsappPhone"
                  value={formData.adminWhatsappPhone || ""}
                  onChange={(e) => handleInputChange("adminWhatsappPhone", e.target.value)}
                  placeholder="5511999999999"
                />
                <p className="text-xs text-muted-foreground">
                  Número que receberá o resumo diário e notificações (com código do país, sem +)
                </p>
              </div>

              <Separator />

              {/* Flags de Automação */}
              <div className="space-y-4">
                <h4 className="font-medium">Automações Habilitadas</h4>
                <div className="grid grid-cols-3 gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.enableAppointmentReminders ?? true}
                      onChange={(e) => handleInputChange("enableAppointmentReminders", e.target.checked as any)}
                      className="h-4 w-4"
                    />
                    <span className="text-sm">Lembretes de Consulta</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.enableBirthdayMessages ?? true}
                      onChange={(e) => handleInputChange("enableBirthdayMessages", e.target.checked as any)}
                      className="h-4 w-4"
                    />
                    <span className="text-sm">Aniversários</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.enableFeedbackRequests ?? true}
                      onChange={(e) => handleInputChange("enableFeedbackRequests", e.target.checked as any)}
                      className="h-4 w-4"
                    />
                    <span className="text-sm">Pedido de Avaliação</span>
                  </label>
                </div>
              </div>

              <Separator />

              {/* Botões de Teste */}
              <div className="space-y-4">
                <h4 className="font-medium">Testar Conexão</h4>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={testWuzapiConnection}
                    disabled={testingWuzapi || !formData.wuzapiBaseUrl || !formData.wuzapiApiKey}
                  >
                    {testingWuzapi ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Wifi className="h-4 w-4 mr-2" />
                    )}
                    Testar Conexão
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="testPhone">Enviar Mensagem de Teste</Label>
                  <div className="flex gap-2">
                    <Input
                      id="testPhone"
                      value={testPhone}
                      onChange={(e) => setTestPhone(e.target.value)}
                      placeholder="5511999999999"
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      onClick={sendTestMessage}
                      disabled={sendingTestMessage || !testPhone || !formData.wuzapiApiKey}
                    >
                      {sendingTestMessage ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      Enviar Teste
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Formato: código do país + DDD + número (ex: 5511999999999)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Google */}
        <TabsContent value="google">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-600" />
                Integrações Google
              </CardTitle>
              <CardDescription>
                Configure Google Calendar, Reviews e Maps
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="defaultGoogleCalendarId">ID do Google Calendar</Label>
                <Input
                  id="defaultGoogleCalendarId"
                  value={formData.defaultGoogleCalendarId || ""}
                  onChange={(e) => handleInputChange("defaultGoogleCalendarId", e.target.value)}
                  placeholder="seu-calendar-id@group.calendar.google.com"
                />
                <p className="text-xs text-muted-foreground">
                  Encontre em Google Calendar {">"} Configurações {">"} ID da agenda
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="googleReviewLink">Link de Avaliação Google</Label>
                <Input
                  id="googleReviewLink"
                  value={formData.googleReviewLink || ""}
                  onChange={(e) => handleInputChange("googleReviewLink", e.target.value)}
                  placeholder="https://g.co/kgs/seuCodigo"
                />
                <p className="text-xs text-muted-foreground">
                  Link curto do Google para clientes deixarem avaliações
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="googleMapsLink">Link do Google Maps</Label>
                <Input
                  id="googleMapsLink"
                  value={formData.googleMapsLink || ""}
                  onChange={(e) => handleInputChange("googleMapsLink", e.target.value)}
                  placeholder="https://maps.google.com/?q=..."
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Automação */}
        <TabsContent value="automation">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-orange-600" />
                  Flowise AI
                </CardTitle>
                <CardDescription>
                  Configure o Flowise para processamento de IA
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="flowiseBaseUrl">URL do Flowise</Label>
                    <Input
                      id="flowiseBaseUrl"
                      value={formData.flowiseBaseUrl || ""}
                      onChange={(e) => handleInputChange("flowiseBaseUrl", e.target.value)}
                      placeholder="https://seu-flowise.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="flowiseChatflowId">ID do Chatflow</Label>
                    <Input
                      id="flowiseChatflowId"
                      value={formData.flowiseChatflowId || ""}
                      onChange={(e) => handleInputChange("flowiseChatflowId", e.target.value)}
                      placeholder="seu-chatflow-id"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-cyan-600" />
                  Baserow (Opcional)
                </CardTitle>
                <CardDescription>
                  Configure se você usa Baserow como banco de dados adicional
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="baserowApiKey">API Key do Baserow</Label>
                  <div className="flex gap-2">
                    <Input
                      id="baserowApiKey"
                      type={showApiKeys.baserowApiKey ? "text" : "password"}
                      value={formData.baserowApiKey || ""}
                      onChange={(e) => handleInputChange("baserowApiKey", e.target.value)}
                      placeholder="sua-api-key"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => toggleShowApiKey("baserowApiKey")}
                    >
                      {showApiKeys.baserowApiKey ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="baserowDatabaseId">Database ID</Label>
                    <Input
                      id="baserowDatabaseId"
                      type="number"
                      value={formData.baserowDatabaseId || ""}
                      onChange={(e) => handleInputChange("baserowDatabaseId", parseInt(e.target.value) || 0)}
                      placeholder="101"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="baserowPatientsTableId">Tabela Pacientes</Label>
                    <Input
                      id="baserowPatientsTableId"
                      type="number"
                      value={formData.baserowPatientsTableId || ""}
                      onChange={(e) => handleInputChange("baserowPatientsTableId", parseInt(e.target.value) || 0)}
                      placeholder="531"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="baserowAppointmentsTableId">Tabela Agendamentos</Label>
                    <Input
                      id="baserowAppointmentsTableId"
                      type="number"
                      value={formData.baserowAppointmentsTableId || ""}
                      onChange={(e) => handleInputChange("baserowAppointmentsTableId", parseInt(e.target.value) || 0)}
                      placeholder="532"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Templates de Mensagens */}
        <TabsContent value="messages">
          <Card>
            <CardHeader>
              <CardTitle>Templates de Mensagens Automáticas</CardTitle>
              <CardDescription>
                Personalize as mensagens enviadas automaticamente aos pacientes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Variáveis disponíveis:</strong>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {variablesHelp.map((v) => (
                      <Badge key={v.var} variant="secondary" className="cursor-pointer" onClick={() => copyToClipboard(v.var, v.var)}>
                        {v.var}
                        {copied === v.var && <Check className="h-3 w-3 ml-1" />}
                      </Badge>
                    ))}
                  </div>
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="confirmationMessageTemplate">Mensagem de Confirmação (No dia)</Label>
                <Textarea
                  id="confirmationMessageTemplate"
                  value={formData.confirmationMessageTemplate || ""}
                  onChange={(e) => handleInputChange("confirmationMessageTemplate", e.target.value)}
                  rows={4}
                  placeholder="Mensagem enviada no dia da consulta..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reminderMessageTemplate">Mensagem de Lembrete (1 dia antes)</Label>
                <Textarea
                  id="reminderMessageTemplate"
                  value={formData.reminderMessageTemplate || ""}
                  onChange={(e) => handleInputChange("reminderMessageTemplate", e.target.value)}
                  rows={4}
                  placeholder="Mensagem de lembrete 24h antes..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cancellationMessageTemplate">Mensagem de Cancelamento</Label>
                <Textarea
                  id="cancellationMessageTemplate"
                  value={formData.cancellationMessageTemplate || ""}
                  onChange={(e) => handleInputChange("cancellationMessageTemplate", e.target.value)}
                  rows={3}
                  placeholder="Mensagem quando consulta é cancelada..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="birthdayMessageTemplate">Mensagem de Aniversário</Label>
                <Textarea
                  id="birthdayMessageTemplate"
                  value={formData.birthdayMessageTemplate || ""}
                  onChange={(e) => handleInputChange("birthdayMessageTemplate", e.target.value)}
                  rows={4}
                  placeholder="Mensagem de parabéns..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reviewRequestTemplate">Solicitação de Avaliação</Label>
                <Textarea
                  id="reviewRequestTemplate"
                  value={formData.reviewRequestTemplate || ""}
                  onChange={(e) => handleInputChange("reviewRequestTemplate", e.target.value)}
                  rows={5}
                  placeholder="Mensagem pedindo avaliação após consulta..."
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
    </DashboardLayout>
  );
}
