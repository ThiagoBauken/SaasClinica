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
  QrCode,
  RefreshCw,
  Copy,
  Trash2,
  WifiOff,
  Smartphone,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
    // Wuzapi Status e QR Code
    wuzapiStatus,
    isLoadingWuzapiStatus,
    refetchWuzapiStatus,
    getQrCode,
    qrCodeData,
    isLoadingQrCode,
    disconnectWuzapi,
    isDisconnecting,
    // Wuzapi Reconnect
    reconnectWuzapi,
    isReconnecting,
    // Wuzapi Reconfigure
    reconfigureWuzapi,
    isReconfiguring,
    // Wuzapi Reset
    resetWuzapi,
    isResetting,
    // N8N API Key
    n8nApiKeyInfo,
    isLoadingN8nApiKey,
    generateN8nApiKey,
    isGeneratingApiKey,
    generatedApiKey,
    revokeN8nApiKey,
    isRevokingApiKey,
  } = useIntegrations();

  const [showQrCodeDialog, setShowQrCodeDialog] = useState(false);
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
  const [copiedApiKey, setCopiedApiKey] = useState(false);

  const [form, setForm] = useState({
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

  // Track se já configuramos para não chamar múltiplas vezes
  const [hasConfigured, setHasConfigured] = useState(false);

  // Fechar dialog automaticamente quando LOGADO no WhatsApp (escaneou QR code)
  // Verifica tanto wuzapiStatus?.loggedIn quanto qrCodeData?.connected
  useEffect(() => {
    // Considera conectado se loggedIn=true OU qrCodeData retornou connected=true
    const isConnected = wuzapiStatus?.loggedIn === true || qrCodeData?.connected === true;

    if (showQrCodeDialog && isConnected && !hasConfigured) {
      // Marcar como configurado para não chamar novamente
      setHasConfigured(true);

      // AUTO-CONFIGURAR S3, HMAC e Webhook após escanear QR code
      console.log('[QR Scan] Detectado login! Configurando S3, HMAC e Webhook...');

      // Mostrar toast de progresso
      toast({
        title: "WhatsApp Conectado!",
        description: "Configurando webhook, S3 e segurança...",
      });

      // Chamar reconfigure e tratar resultado
      reconfigureWuzapi()
        .then((result) => {
          console.log('[QR Scan] Resultado da configuração:', result);
          setShowQrCodeDialog(false);
          toast({
            title: result.success ? "Configuração Completa!" : "Atenção",
            description: result.success
              ? "WhatsApp, webhook, S3 e HMAC configurados."
              : result.message || "Algumas configurações podem ter falhado.",
            variant: result.success ? "default" : "destructive",
          });
        })
        .catch((error) => {
          console.error('[QR Scan] Erro ao configurar:', error);
          setShowQrCodeDialog(false);
          toast({
            title: "Erro na Configuração",
            description: error.message || "Tente clicar em Reconfigurar manualmente.",
            variant: "destructive",
          });
        });
    }

    // Reset hasConfigured quando dialog fecha
    if (!showQrCodeDialog && hasConfigured) {
      setHasConfigured(false);
    }
  }, [wuzapiStatus?.loggedIn, qrCodeData?.connected, showQrCodeDialog, hasConfigured, toast, reconfigureWuzapi]);

  // Polling mais frequente enquanto o dialog do QR Code está aberto
  // Faz polling a cada 2 segundos para detectar quando usuário escanear o QR
  useEffect(() => {
    const isConnected = wuzapiStatus?.loggedIn === true || qrCodeData?.connected === true;

    if (showQrCodeDialog && !isConnected) {
      // Faz uma chamada imediata ao abrir o dialog
      refetchWuzapiStatus();

      const pollInterval = setInterval(() => {
        console.log('[Polling] Verificando status do WhatsApp...');
        refetchWuzapiStatus();
      }, 2000); // Poll a cada 2 segundos quando aguardando QR scan

      return () => clearInterval(pollInterval);
    }
  }, [showQrCodeDialog, wuzapiStatus?.loggedIn, qrCodeData?.connected, refetchWuzapiStatus]);

  const handleSave = () => {
    updateIntegrations(form);
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

  const handleShowQrCode = async () => {
    setShowQrCodeDialog(true);
    await getQrCode();
  };

  const handleGenerateApiKey = async () => {
    await generateN8nApiKey();
  };

  const handleCopyApiKey = async () => {
    if (generatedApiKey?.apiKey) {
      await navigator.clipboard.writeText(generatedApiKey.apiKey);
      setCopiedApiKey(true);
      setTimeout(() => setCopiedApiKey(false), 2000);
      toast({
        title: "API Key copiada!",
        description: "A chave foi copiada para a área de transferência",
      });
    }
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
                    <div className="p-2 bg-green-500/20 rounded-lg">
                      <MessageCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">Wuzapi - WhatsApp Business</CardTitle>
                      <CardDescription>
                        Configure sua conta Wuzapi para enviar mensagens via WhatsApp
                      </CardDescription>
                    </div>
                  </div>
                  {integrationSettings?.hasWuzapiConfig && (
                    <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Configurado
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Status da Conexão WhatsApp - Wuzapi 3.0 (automático) */}
                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${wuzapiStatus?.loggedIn ? 'bg-green-500/20' : wuzapiStatus?.connected ? 'bg-yellow-500/20' : 'bg-gray-500/20'}`}>
                        <Smartphone className={`h-5 w-5 ${wuzapiStatus?.loggedIn ? 'text-green-600 dark:text-green-400' : wuzapiStatus?.connected ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-500'}`} />
                      </div>
                      <div>
                        <p className="font-medium">
                          {isLoadingWuzapiStatus ? 'Verificando...' :
                            wuzapiStatus?.loggedIn ? 'WhatsApp Conectado' :
                            wuzapiStatus?.connected ? 'Aguardando QR Code' :
                            wuzapiStatus?.configured ? 'Desconectado' : 'Não Configurado'}
                        </p>
                        {wuzapiStatus?.phoneNumber && (
                          <p className="text-sm text-muted-foreground">
                            {wuzapiStatus.pushName} • {wuzapiStatus.phoneNumber}
                          </p>
                        )}
                        {!wuzapiStatus?.loggedIn && wuzapiStatus?.configured && (
                          <p className="text-sm text-muted-foreground">
                            Clique em "Conectar" para escanear o QR Code
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap justify-end">
                      {wuzapiStatus?.loggedIn ? (
                        <>
                          {/* Botão Reconfigurar - força atualização de webhook, S3 e HMAC */}
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-blue-600 dark:text-blue-400 border-blue-500/30 hover:bg-blue-500/10"
                            onClick={() => reconfigureWuzapi()}
                            disabled={isReconfiguring}
                            title="Atualiza webhook, S3 e HMAC no Wuzapi"
                          >
                            {isReconfiguring ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="mr-2 h-4 w-4" />
                            )}
                            Reconfigurar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-orange-600 dark:text-orange-400 border-orange-500/30 hover:bg-orange-500/10"
                            onClick={() => disconnectWuzapi()}
                            disabled={isDisconnecting}
                          >
                            {isDisconnecting ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <WifiOff className="mr-2 h-4 w-4" />
                            )}
                            Desconectar
                          </Button>
                          {/* Botão Deletar - reseta completamente a instância */}
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 dark:text-red-400 border-red-500/30 hover:bg-red-500/10"
                            onClick={() => {
                              if (confirm('Tem certeza que deseja deletar a instância? Você precisará reconectar via QR Code.')) {
                                resetWuzapi();
                              }
                            }}
                            disabled={isResetting}
                            title="Deleta a instância e limpa o banco"
                          >
                            {isResetting ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="mr-2 h-4 w-4" />
                            )}
                            Deletar
                          </Button>
                        </>
                      ) : (
                        <>
                          {/* Botão Conectar - abre QR Code */}
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={handleShowQrCode}
                            disabled={isLoadingQrCode}
                          >
                            {isLoadingQrCode ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <QrCode className="mr-2 h-4 w-4" />
                            )}
                            Conectar
                          </Button>
                          {/* Botão Reconectar - para quando já tem sessão salva */}
                          {wuzapiStatus?.configured && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-blue-600 dark:text-blue-400 border-blue-500/30 hover:bg-blue-500/10"
                              onClick={() => reconnectWuzapi()}
                              disabled={isReconnecting}
                            >
                              {isReconnecting ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <RefreshCw className="mr-2 h-4 w-4" />
                              )}
                              Reconectar
                            </Button>
                          )}
                          {/* Botão Deletar */}
                          {wuzapiStatus?.configured && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-600 dark:text-red-400 border-red-500/30 hover:bg-red-500/10"
                              onClick={() => {
                                if (confirm('Tem certeza que deseja deletar a instância?')) {
                                  resetWuzapi();
                                }
                              }}
                              disabled={isResetting}
                            >
                              {isResetting ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="mr-2 h-4 w-4" />
                              )}
                              Deletar
                            </Button>
                          )}
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => refetchWuzapiStatus()}
                        title="Atualizar status"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                <Separator />

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

                {/* Dialog QR Code */}
                <Dialog open={showQrCodeDialog} onOpenChange={setShowQrCodeDialog}>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <QrCode className="h-5 w-5" />
                        Conectar WhatsApp
                      </DialogTitle>
                      <DialogDescription>
                        Escaneie o QR Code com seu WhatsApp para conectar
                      </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col items-center justify-center py-6">
                      {isLoadingQrCode ? (
                        <div className="flex flex-col items-center gap-4">
                          <Loader2 className="h-12 w-12 animate-spin text-primary" />
                          <p className="text-muted-foreground">Gerando QR Code...</p>
                        </div>
                      ) : qrCodeData?.connected || wuzapiStatus?.loggedIn ? (
                        <div className="flex flex-col items-center gap-4">
                          <CheckCircle2 className="h-16 w-16 text-green-500" />
                          <p className="text-lg font-medium text-green-700">WhatsApp conectado!</p>
                          <p className="text-sm text-muted-foreground">Fechando automaticamente...</p>
                        </div>
                      ) : qrCodeData?.qrCode ? (
                        <div className="flex flex-col items-center gap-4">
                          <img
                            src={qrCodeData.qrCode.startsWith('data:') ? qrCodeData.qrCode : `data:image/png;base64,${qrCodeData.qrCode}`}
                            alt="QR Code WhatsApp"
                            className="w-64 h-64 border rounded-lg"
                          />
                          <p className="text-sm text-muted-foreground text-center">
                            Abra o WhatsApp no seu celular, vá em Configurações {'>'} Dispositivos conectados {'>'} Conectar dispositivo
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Aguardando leitura do QR Code...
                          </div>
                          <Button
                            variant="outline"
                            onClick={() => getQrCode()}
                          >
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Atualizar QR Code
                          </Button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-4">
                          <AlertCircle className="h-12 w-12 text-yellow-500" />
                          <p className="text-muted-foreground text-center">
                            {qrCodeData?.message || 'Não foi possível gerar o QR Code. Verifique suas credenciais.'}
                          </p>
                          <Button
                            variant="outline"
                            onClick={() => getQrCode()}
                          >
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Tentar Novamente
                          </Button>
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>

                <Separator />

                {/* Botões de teste */}
                <div className="flex gap-3 flex-wrap">
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
                        className="text-green-700 dark:text-green-400 border-green-500/30 hover:bg-green-500/10"
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

                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 space-y-2">
                  <h4 className="font-medium text-blue-900 dark:text-blue-300 text-sm flex items-center gap-2">
                    <Key className="h-4 w-4" />
                    Como configurar Wuzapi
                  </h4>
                  <ol className="text-sm text-blue-800 dark:text-blue-300 space-y-1 list-decimal list-inside">
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
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                      <Calendar className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">Google Calendar</CardTitle>
                      <CardDescription>
                        Sincronize agendamentos com Google Calendar
                      </CardDescription>
                    </div>
                  </div>
                  {integrationSettings?.hasGoogleCalendarConfig && (
                    <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30">
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

                <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                  <h4 className="font-medium text-purple-900 dark:text-purple-300 text-sm mb-2">Configuração do Google Calendar</h4>
                  <p className="text-sm text-purple-800 dark:text-purple-300">
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
                    <div className="p-2 bg-purple-500/20 rounded-lg">
                      <Workflow className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">N8N - Automação de Workflows</CardTitle>
                      <CardDescription>
                        Configure webhooks N8N para automações avançadas
                      </CardDescription>
                    </div>
                  </div>
                  {integrationSettings?.hasN8nConfig && (
                    <Badge variant="outline" className="bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30">
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

                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 space-y-2">
                  <h4 className="font-medium text-amber-900 dark:text-amber-300 text-sm flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Fluxos N8N Disponíveis
                  </h4>
                  <ul className="text-sm text-amber-800 dark:text-amber-300 space-y-1 list-disc list-inside">
                    <li>Confirmação automática de consultas</li>
                    <li>Lembretes de agendamento</li>
                    <li>Sincronização com Google Calendar</li>
                    <li>Mensagens de aniversário</li>
                    <li>Solicitação de feedback pós-consulta</li>
                  </ul>
                </div>

                <Separator />

                {/* N8N API Key para autenticação externa */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium flex items-center gap-2">
                        <Key className="h-4 w-4" />
                        API Key para N8N
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        Use esta chave para autenticar chamadas do N8N para sua API
                      </p>
                    </div>
                    {n8nApiKeyInfo?.hasApiKey && (
                      <Badge variant="outline" className="bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Chave Ativa
                      </Badge>
                    )}
                  </div>

                  {isLoadingN8nApiKey ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Carregando...</span>
                    </div>
                  ) : n8nApiKeyInfo?.hasApiKey ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                        <code className="flex-1 font-mono text-sm">{n8nApiKeyInfo.apiKeyPreview}</code>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-500/10"
                          onClick={() => revokeN8nApiKey()}
                          disabled={isRevokingApiKey}
                        >
                          {isRevokingApiKey ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Criada em: {n8nApiKeyInfo.createdAt ? new Date(n8nApiKeyInfo.createdAt).toLocaleDateString('pt-BR') : 'N/A'}
                      </p>
                      <Button
                        variant="outline"
                        onClick={handleGenerateApiKey}
                        disabled={isGeneratingApiKey}
                      >
                        {isGeneratingApiKey ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="mr-2 h-4 w-4" />
                        )}
                        Regenerar API Key
                      </Button>
                    </div>
                  ) : (
                    <Button
                      onClick={handleGenerateApiKey}
                      disabled={isGeneratingApiKey}
                    >
                      {isGeneratingApiKey ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Key className="mr-2 h-4 w-4" />
                      )}
                      Gerar API Key
                    </Button>
                  )}

                  {/* Mostrar a chave recém-gerada */}
                  {generatedApiKey?.apiKey && (
                    <Alert className="bg-green-500/10 border-green-500/30">
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <AlertDescription>
                        <div className="space-y-2">
                          <p className="font-medium text-green-800 dark:text-green-300">Nova API Key gerada!</p>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 p-2 bg-card rounded border font-mono text-xs break-all">
                              {generatedApiKey.apiKey}
                            </code>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleCopyApiKey}
                            >
                              {copiedApiKey ? (
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                          <p className="text-xs text-green-700 dark:text-green-400">
                            <strong>Importante:</strong> Copie esta chave agora! Ela não será exibida novamente.
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Use no header: <code className="bg-white px-1 rounded">X-API-Key: {generatedApiKey.apiKey.substring(0, 20)}...</code>
                          </p>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Preferências de Automação */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-500/20 rounded-lg">
                    <Sparkles className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
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
