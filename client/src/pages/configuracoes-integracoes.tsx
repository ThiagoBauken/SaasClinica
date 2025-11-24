import { useState, useEffect } from "react";
import DashboardLayout from "@/layouts/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useIntegrations } from "@/hooks/use-integrations";
import {
  Loader2,
  MessageCircle,
  Calendar,
  Workflow,
  Key,
  AlertCircle,
  CheckCircle2,
  Send,
  TestTube2,
  ExternalLink,
  Zap,
  Bell,
  Clock,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function ConfiguracoesIntegracoesPage() {
  const { toast } = useToast();
  const {
    integrationSettings,
    isLoading,
    updateIntegrations,
    isUpdating,
    testWhatsApp,
    isTestingWhatsApp,
    testN8N,
    isTestingN8N,
    sendTestWhatsApp,
    isSendingTest,
  } = useIntegrations();

  const [form, setForm] = useState({
    // Wuzapi
    wuzapiInstanceId: "",
    wuzapiApiKey: "",
    wuzapiBaseUrl: "https://wuzapi.cloud/api/v2",

    // Google Calendar
    defaultGoogleCalendarId: "",
    googleCalendarTimezone: "America/Sao_Paulo",

    // N8N
    n8nWebhookBaseUrl: "",

    // Admin
    adminWhatsappPhone: "",

    // Preferências de Automação
    enableAppointmentReminders: true,
    reminderHoursBefore: 24,
    enableBirthdayMessages: true,
    enableFeedbackRequests: true,
    feedbackHoursAfter: 24,
  });

  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState("🧪 Teste de integração Wuzapi - Sistema de Clínica Dental");
  const [showTestDialog, setShowTestDialog] = useState(false);

  // Atualiza o formulário quando os dados são carregados
  useEffect(() => {
    if (integrationSettings) {
      setForm({
        wuzapiInstanceId: integrationSettings.wuzapiInstanceId || "",
        wuzapiApiKey: "", // Não mostra a chave por segurança
        wuzapiBaseUrl: integrationSettings.wuzapiBaseUrl || "https://wuzapi.cloud/api/v2",
        defaultGoogleCalendarId: integrationSettings.defaultGoogleCalendarId || "",
        googleCalendarTimezone: integrationSettings.googleCalendarTimezone || "America/Sao_Paulo",
        n8nWebhookBaseUrl: integrationSettings.n8nWebhookBaseUrl || "",
        adminWhatsappPhone: integrationSettings.adminWhatsappPhone || "",
        enableAppointmentReminders: integrationSettings.enableAppointmentReminders !== false,
        reminderHoursBefore: integrationSettings.reminderHoursBefore || 24,
        enableBirthdayMessages: integrationSettings.enableBirthdayMessages !== false,
        enableFeedbackRequests: integrationSettings.enableFeedbackRequests !== false,
        feedbackHoursAfter: integrationSettings.feedbackHoursAfter || 24,
      });
    }
  }, [integrationSettings]);

  const handleSave = () => {
    const dataToSend: any = { ...form };

    // Se o campo da API Key estiver vazio, não enviar (manter a chave atual)
    if (!dataToSend.wuzapiApiKey) {
      delete dataToSend.wuzapiApiKey;
    }

    updateIntegrations(dataToSend);
  };

  const handleTestWhatsApp = () => {
    testWhatsApp();
  };

  const handleTestN8N = () => {
    testN8N();
  };

  const handleSendTestMessage = () => {
    if (!testPhone) {
      toast({
        title: "Número obrigatório",
        description: "Digite um número de telefone para enviar a mensagem de teste",
        variant: "destructive",
      });
      return;
    }

    sendTestWhatsApp({ phone: testPhone, message: testMessage });
    setShowTestDialog(false);
  };

  return (
    <DashboardLayout title="Configurações de Integrações" currentPath="/configuracoes/integracoes">
      <div className="flex flex-col space-y-6 p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Integrações</h1>
            <p className="text-muted-foreground mt-1">
              Configure Wuzapi, Google Calendar e N8N para automatizar sua clínica
            </p>
          </div>
          <Button
            onClick={handleSave}
            className="bg-gradient-to-r from-blue-600 to-blue-500"
            disabled={isUpdating}
          >
            {isUpdating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar Configurações"
            )}
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid gap-6">
            {/* Wuzapi (WhatsApp) */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <MessageCircle className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">Wuzapi - WhatsApp Business</CardTitle>
                      <CardDescription>
                        Configure sua conta Wuzapi para enviar mensagens via WhatsApp
                      </CardDescription>
                    </div>
                  </div>
                  {integrationSettings?.hasWuzapiConfig && (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Configurado
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="wuzapiInstanceId" className="flex items-center gap-2">
                      <Key className="h-4 w-4" />
                      Instance ID*
                    </Label>
                    <Input
                      id="wuzapiInstanceId"
                      placeholder="instance_123456"
                      value={form.wuzapiInstanceId}
                      onChange={(e) => setForm(prev => ({ ...prev, wuzapiInstanceId: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="wuzapiApiKey" className="flex items-center gap-2">
                      <Key className="h-4 w-4" />
                      API Key*
                    </Label>
                    <Input
                      id="wuzapiApiKey"
                      type="password"
                      placeholder={integrationSettings?.hasWuzapiConfig ? "***********" : "sua_api_key_aqui"}
                      value={form.wuzapiApiKey}
                      onChange={(e) => setForm(prev => ({ ...prev, wuzapiApiKey: e.target.value }))}
                    />
                    {integrationSettings?.hasWuzapiConfig && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Deixe em branco para manter a chave atual
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="wuzapiBaseUrl">Base URL</Label>
                  <Input
                    id="wuzapiBaseUrl"
                    placeholder="https://wuzapi.cloud/api/v2"
                    value={form.wuzapiBaseUrl}
                    onChange={(e) => setForm(prev => ({ ...prev, wuzapiBaseUrl: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="adminWhatsappPhone">Telefone do Administrador</Label>
                  <Input
                    id="adminWhatsappPhone"
                    placeholder="+5577998698925"
                    value={form.adminWhatsappPhone}
                    onChange={(e) => setForm(prev => ({ ...prev, adminWhatsappPhone: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Formato: +55 + DDD + número (ex: +5511999999999)
                  </p>
                </div>

                <Separator />

                {/* Botões de teste */}
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={handleTestWhatsApp}
                    disabled={isTestingWhatsApp || !integrationSettings?.hasWuzapiConfig}
                  >
                    {isTestingWhatsApp ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <TestTube2 className="mr-2 h-4 w-4" />
                    )}
                    Testar Conexão
                  </Button>

                  <Dialog open={showTestDialog} onOpenChange={setShowTestDialog}>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        className="text-green-700 border-green-300 hover:bg-green-50"
                        disabled={!integrationSettings?.hasWuzapiConfig}
                      >
                        <Send className="mr-2 h-4 w-4" />
                        Enviar Mensagem Teste
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Enviar Mensagem de Teste</DialogTitle>
                        <DialogDescription>
                          Envie uma mensagem via WhatsApp para testar a integração
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 mt-4">
                        <div className="space-y-2">
                          <Label htmlFor="testPhone">Número do Destinatário</Label>
                          <Input
                            id="testPhone"
                            placeholder="+5577998698925"
                            value={testPhone}
                            onChange={(e) => setTestPhone(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="testMessage">Mensagem</Label>
                          <Input
                            id="testMessage"
                            placeholder="Mensagem de teste"
                            value={testMessage}
                            onChange={(e) => setTestMessage(e.target.value)}
                          />
                        </div>
                        <Button
                          onClick={handleSendTestMessage}
                          disabled={isSendingTest}
                          className="w-full"
                        >
                          {isSendingTest ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="mr-2 h-4 w-4" />
                          )}
                          Enviar
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Button
                    variant="outline"
                    onClick={() => window.open("https://wuzapi.cloud", "_blank")}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Ir para Wuzapi
                  </Button>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                  <h4 className="font-medium text-blue-900 text-sm flex items-center gap-2">
                    <Key className="h-4 w-4" />
                    Como configurar Wuzapi
                  </h4>
                  <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                    <li>Acesse <a href="https://wuzapi.cloud" target="_blank" rel="noopener noreferrer" className="underline font-medium">wuzapi.cloud</a> e crie uma conta</li>
                    <li>Crie uma nova instância WhatsApp</li>
                    <li>Conecte seu número via QR Code</li>
                    <li>Copie o Instance ID e API Key</li>
                    <li>Cole as credenciais acima e salve</li>
                  </ol>
                </div>
              </CardContent>
            </Card>

            {/* Google Calendar */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Calendar className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">Google Calendar</CardTitle>
                      <CardDescription>
                        Sincronize agendamentos com Google Calendar
                      </CardDescription>
                    </div>
                  </div>
                  {integrationSettings?.hasGoogleCalendarConfig && (
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Configurado
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="defaultGoogleCalendarId">ID do Calendário</Label>
                  <Input
                    id="defaultGoogleCalendarId"
                    placeholder="primary ou email@gmail.com"
                    value={form.defaultGoogleCalendarId}
                    onChange={(e) => setForm(prev => ({ ...prev, defaultGoogleCalendarId: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Use "primary" para o calendário principal ou o email do calendário específico
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="googleCalendarTimezone">Fuso Horário</Label>
                  <Input
                    id="googleCalendarTimezone"
                    placeholder="America/Sao_Paulo"
                    value={form.googleCalendarTimezone}
                    onChange={(e) => setForm(prev => ({ ...prev, googleCalendarTimezone: e.target.value }))}
                  />
                </div>

                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h4 className="font-medium text-purple-900 text-sm mb-2">Configuração do Google Calendar</h4>
                  <p className="text-sm text-purple-800">
                    Para sincronizar com Google Calendar, você precisa configurar credenciais OAuth 2.0
                    no Google Cloud Console e autorizar o acesso ao calendário.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* N8N */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Workflow className="h-6 w-6 text-purple-600" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">N8N - Automação de Workflows</CardTitle>
                      <CardDescription>
                        Configure webhooks N8N para automações avançadas
                      </CardDescription>
                    </div>
                  </div>
                  {integrationSettings?.hasN8nConfig && (
                    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-300">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Configurado
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="n8nWebhookBaseUrl">URL Base do N8N</Label>
                  <Input
                    id="n8nWebhookBaseUrl"
                    placeholder="http://localhost:5678"
                    value={form.n8nWebhookBaseUrl}
                    onChange={(e) => setForm(prev => ({ ...prev, n8nWebhookBaseUrl: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    URL onde seus workflows N8N estão rodando
                  </p>
                </div>

                <Separator />

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={handleTestN8N}
                    disabled={isTestingN8N || !integrationSettings?.hasN8nConfig}
                  >
                    {isTestingN8N ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <TestTube2 className="mr-2 h-4 w-4" />
                    )}
                    Testar Conexão
                  </Button>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
                  <h4 className="font-medium text-amber-900 text-sm flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Fluxos N8N Disponíveis
                  </h4>
                  <ul className="text-sm text-amber-800 space-y-1 list-disc list-inside">
                    <li>Confirmação automática de consultas</li>
                    <li>Lembretes de agendamento</li>
                    <li>Sincronização com Google Calendar</li>
                    <li>Mensagens de aniversário</li>
                    <li>Solicitação de feedback pós-consulta</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Preferências de Automação */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <Sparkles className="h-6 w-6 text-indigo-600" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Preferências de Automação</CardTitle>
                    <CardDescription>
                      Configure quando e como as automações devem ser executadas
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Lembretes de Agendamento */}
                <div className="flex items-start justify-between space-x-4">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4 text-muted-foreground" />
                      <Label className="text-base font-medium">Lembretes de Agendamento</Label>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Enviar lembretes automáticos para pacientes antes das consultas
                    </p>
                  </div>
                  <Switch
                    checked={form.enableAppointmentReminders}
                    onCheckedChange={(checked) => setForm(prev => ({ ...prev, enableAppointmentReminders: checked }))}
                  />
                </div>

                {form.enableAppointmentReminders && (
                  <div className="ml-6 space-y-2">
                    <Label htmlFor="reminderHoursBefore" className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Horas antes da consulta
                    </Label>
                    <Input
                      id="reminderHoursBefore"
                      type="number"
                      min="1"
                      max="72"
                      value={form.reminderHoursBefore}
                      onChange={(e) => setForm(prev => ({ ...prev, reminderHoursBefore: parseInt(e.target.value) || 24 }))}
                      className="w-32"
                    />
                    <p className="text-xs text-muted-foreground">Entre 1 e 72 horas</p>
                  </div>
                )}

                <Separator />

                {/* Mensagens de Aniversário */}
                <div className="flex items-start justify-between space-x-4">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      <Label className="text-base font-medium">Mensagens de Aniversário</Label>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Enviar mensagens automáticas de parabéns no aniversário dos pacientes
                    </p>
                  </div>
                  <Switch
                    checked={form.enableBirthdayMessages}
                    onCheckedChange={(checked) => setForm(prev => ({ ...prev, enableBirthdayMessages: checked }))}
                  />
                </div>

                <Separator />

                {/* Solicitação de Feedback */}
                <div className="flex items-start justify-between space-x-4">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <MessageCircle className="h-4 w-4 text-muted-foreground" />
                      <Label className="text-base font-medium">Solicitação de Feedback</Label>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Solicitar feedback dos pacientes após consultas
                    </p>
                  </div>
                  <Switch
                    checked={form.enableFeedbackRequests}
                    onCheckedChange={(checked) => setForm(prev => ({ ...prev, enableFeedbackRequests: checked }))}
                  />
                </div>

                {form.enableFeedbackRequests && (
                  <div className="ml-6 space-y-2">
                    <Label htmlFor="feedbackHoursAfter" className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Horas após a consulta
                    </Label>
                    <Input
                      id="feedbackHoursAfter"
                      type="number"
                      min="1"
                      max="168"
                      value={form.feedbackHoursAfter}
                      onChange={(e) => setForm(prev => ({ ...prev, feedbackHoursAfter: parseInt(e.target.value) || 24 }))}
                      className="w-32"
                    />
                    <p className="text-xs text-muted-foreground">Entre 1 e 168 horas (7 dias)</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
