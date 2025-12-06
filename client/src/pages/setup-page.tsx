import { useState, useEffect } from "react";
import { useAuth } from "@/core/AuthProvider";
import { useIntegrations } from "@/hooks/use-integrations";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Check,
  Circle,
  Loader2,
  MessageSquare,
  QrCode,
  Webhook,
  Key,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Copy,
  ExternalLink,
  Smartphone,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

interface SetupStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  status: "pending" | "in_progress" | "completed" | "error";
}

export default function SetupPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState(0);
  const [isPolling, setIsPolling] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [copiedApiKey, setCopiedApiKey] = useState(false);

  const {
    wuzapiStatus,
    isLoadingWuzapiStatus,
    refetchWuzapiStatus,
    connectWuzapi,
    isConnecting,
    connectData,
    configureWebhook,
    isConfiguringWebhook,
    webhookInfo,
    n8nApiKeyInfo,
    generateN8nApiKey,
    isGeneratingApiKey,
    generatedApiKey,
  } = useIntegrations();

  // Define os passos do setup
  const [steps, setSteps] = useState<SetupStep[]>([
    {
      id: "whatsapp",
      title: "Conectar WhatsApp",
      description: "Escaneie o QR Code para conectar o WhatsApp Business",
      icon: <MessageSquare className="h-5 w-5" />,
      status: "pending",
    },
    {
      id: "webhook",
      title: "Configurar Webhook",
      description: "Ative o recebimento de mensagens",
      icon: <Webhook className="h-5 w-5" />,
      status: "pending",
    },
    {
      id: "apikey",
      title: "Gerar API Key N8N",
      description: "Crie a chave para automações externas",
      icon: <Key className="h-5 w-5" />,
      status: "pending",
    },
  ]);

  // Atualiza status dos passos baseado nos dados
  useEffect(() => {
    const newSteps = [...steps];

    // Passo 1: WhatsApp
    if (wuzapiStatus?.loggedIn) {
      newSteps[0].status = "completed";
      if (currentStep === 0) setCurrentStep(1);
    } else if (wuzapiStatus?.connected) {
      newSteps[0].status = "in_progress";
    } else if (wuzapiStatus?.configured) {
      newSteps[0].status = "pending";
    }

    // Passo 2: Webhook
    if (webhookInfo?.configured) {
      newSteps[1].status = "completed";
      if (currentStep === 1 && wuzapiStatus?.loggedIn) setCurrentStep(2);
    } else if (wuzapiStatus?.loggedIn) {
      newSteps[1].status = "pending";
    }

    // Passo 3: API Key
    if (n8nApiKeyInfo?.hasApiKey) {
      newSteps[2].status = "completed";
    }

    setSteps(newSteps);
  }, [wuzapiStatus, webhookInfo, n8nApiKeyInfo]);

  // Polling para verificar status de conexão
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPolling && !wuzapiStatus?.loggedIn) {
      interval = setInterval(() => {
        refetchWuzapiStatus();
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPolling, wuzapiStatus?.loggedIn, refetchWuzapiStatus]);

  // Para polling quando conectado
  useEffect(() => {
    if (wuzapiStatus?.loggedIn && isPolling) {
      setIsPolling(false);
      setQrCode(null);
      toast({
        title: "WhatsApp conectado!",
        description: `Conectado ao número ${wuzapiStatus.phoneNumber || ""}`,
      });
      // Configurar webhook automaticamente
      handleConfigureWebhook();
    }
  }, [wuzapiStatus?.loggedIn]);

  const handleConnectWhatsApp = async () => {
    try {
      const result = await connectWuzapi();
      if (result.qrCode) {
        setQrCode(result.qrCode);
        setIsPolling(true);
      } else if (result.loggedIn) {
        toast({
          title: "Já conectado!",
          description: "O WhatsApp já está conectado.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro ao conectar",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleConfigureWebhook = async () => {
    try {
      await configureWebhook({});
      toast({
        title: "Webhook configurado!",
        description: "Agora você receberá mensagens no sistema.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao configurar webhook",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleGenerateApiKey = async () => {
    try {
      await generateN8nApiKey();
      toast({
        title: "API Key gerada!",
        description: "Copie a chave - ela não será exibida novamente.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao gerar API Key",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const copyApiKey = async (key: string) => {
    await navigator.clipboard.writeText(key);
    setCopiedApiKey(true);
    setTimeout(() => setCopiedApiKey(false), 2000);
    toast({
      title: "API Key copiada!",
      description: "Cole no seu workflow N8N.",
    });
  };

  const completedSteps = steps.filter((s) => s.status === "completed").length;
  const progress = (completedSteps / steps.length) * 100;

  const allComplete = steps.every((s) => s.status === "completed");

  if (isLoadingWuzapiStatus) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Verificando configurações...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-3xl">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Configuracao Inicial</h1>
        <p className="text-muted-foreground">
          Configure as integracoes essenciais para comecar a usar o sistema
        </p>
      </div>

      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-muted-foreground">Progresso</span>
          <span className="font-medium">{completedSteps} de {steps.length} passos</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Steps */}
      <div className="space-y-4">
        {steps.map((step, index) => (
          <Card
            key={step.id}
            className={`transition-all ${
              index === currentStep ? "ring-2 ring-primary" : ""
            } ${step.status === "completed" ? "bg-green-50 dark:bg-green-950/20" : ""}`}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-full ${
                      step.status === "completed"
                        ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                        : step.status === "in_progress"
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                        : step.status === "error"
                        ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {step.status === "completed" ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : step.status === "error" ? (
                      <XCircle className="h-5 w-5" />
                    ) : (
                      step.icon
                    )}
                  </div>
                  <div>
                    <CardTitle className="text-lg">{step.title}</CardTitle>
                    <CardDescription>{step.description}</CardDescription>
                  </div>
                </div>
                <Badge
                  variant={
                    step.status === "completed"
                      ? "default"
                      : step.status === "in_progress"
                      ? "secondary"
                      : "outline"
                  }
                  className={step.status === "completed" ? "bg-green-600" : ""}
                >
                  {step.status === "completed"
                    ? "Concluido"
                    : step.status === "in_progress"
                    ? "Em progresso"
                    : "Pendente"}
                </Badge>
              </div>
            </CardHeader>

            {/* Step Content */}
            {index === currentStep && step.status !== "completed" && (
              <CardContent className="pt-4">
                <Separator className="mb-4" />

                {/* Step 1: WhatsApp */}
                {step.id === "whatsapp" && (
                  <div className="space-y-4">
                    {wuzapiStatus?.configured === false && (
                      <Alert variant="destructive">
                        <AlertDescription>
                          O token Wuzapi nao esta configurado. Acesse as configuracoes de integracao primeiro.
                        </AlertDescription>
                      </Alert>
                    )}

                    {!qrCode && !wuzapiStatus?.loggedIn && (
                      <div className="text-center py-6">
                        <Smartphone className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                        <p className="mb-4 text-muted-foreground">
                          Clique no botao abaixo para gerar o QR Code e escanear com seu WhatsApp
                        </p>
                        <Button
                          onClick={handleConnectWhatsApp}
                          disabled={isConnecting || wuzapiStatus?.configured === false}
                          size="lg"
                        >
                          {isConnecting ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <QrCode className="h-4 w-4 mr-2" />
                          )}
                          Gerar QR Code
                        </Button>
                      </div>
                    )}

                    {qrCode && !wuzapiStatus?.loggedIn && (
                      <div className="text-center py-4">
                        <div className="bg-card p-4 rounded-lg inline-block mb-4 border">
                          <img
                            src={qrCode}
                            alt="QR Code WhatsApp"
                            className="w-64 h-64"
                          />
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                          Aguardando escaneamento...
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Abra o WhatsApp no celular {">"} Dispositivos conectados {">"} Conectar dispositivo
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleConnectWhatsApp}
                          className="mt-4"
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Gerar novo QR Code
                        </Button>
                      </div>
                    )}

                    {wuzapiStatus?.loggedIn && (
                      <Alert className="bg-green-500/10 border-green-500/30">
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <AlertDescription className="text-green-700 dark:text-green-400">
                          WhatsApp conectado com sucesso! Numero: {wuzapiStatus.phoneNumber}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}

                {/* Step 2: Webhook */}
                {step.id === "webhook" && (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Configure o webhook para receber mensagens dos pacientes diretamente no sistema.
                    </p>

                    {webhookInfo?.configured ? (
                      <Alert className="bg-green-500/10 border-green-500/30">
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <AlertDescription className="text-green-700 dark:text-green-400">
                          Webhook configurado: {webhookInfo.webhookUrl}
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <div className="text-center py-4">
                        <Button
                          onClick={handleConfigureWebhook}
                          disabled={isConfiguringWebhook || !wuzapiStatus?.loggedIn}
                          size="lg"
                        >
                          {isConfiguringWebhook ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <Webhook className="h-4 w-4 mr-2" />
                          )}
                          Configurar Webhook
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Step 3: API Key */}
                {step.id === "apikey" && (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Gere uma API Key para conectar o N8N e outras automacoes externas.
                    </p>

                    {n8nApiKeyInfo?.hasApiKey ? (
                      <Alert className="bg-green-500/10 border-green-500/30">
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <AlertDescription className="text-green-700 dark:text-green-400">
                          API Key ja configurada: {n8nApiKeyInfo.apiKeyPreview}
                        </AlertDescription>
                      </Alert>
                    ) : generatedApiKey?.apiKey ? (
                      <div className="space-y-4">
                        <Alert>
                          <AlertDescription>
                            <strong>Importante:</strong> Copie a API Key agora. Ela nao sera exibida novamente!
                          </AlertDescription>
                        </Alert>
                        <div className="flex items-center gap-2 p-3 bg-muted rounded-lg font-mono text-sm">
                          <code className="flex-1 break-all">{generatedApiKey.apiKey}</code>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => copyApiKey(generatedApiKey.apiKey)}
                          >
                            {copiedApiKey ? (
                              <Check className="h-4 w-4 text-green-600" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Use esta chave no header <code>X-API-Key</code> das requisicoes N8N.
                        </p>
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <Button
                          onClick={handleGenerateApiKey}
                          disabled={isGeneratingApiKey}
                          size="lg"
                        >
                          {isGeneratingApiKey ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <Key className="h-4 w-4 mr-2" />
                          )}
                          Gerar API Key
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            )}

            {/* Show completed content */}
            {step.status === "completed" && (
              <CardContent className="pt-0">
                <div className="text-sm text-green-600 dark:text-green-400">
                  {step.id === "whatsapp" && wuzapiStatus?.phoneNumber && (
                    <span>Conectado: {wuzapiStatus.phoneNumber}</span>
                  )}
                  {step.id === "webhook" && webhookInfo?.webhookUrl && (
                    <span>URL: {webhookInfo.webhookUrl}</span>
                  )}
                  {step.id === "apikey" && n8nApiKeyInfo?.apiKeyPreview && (
                    <span>Key: {n8nApiKeyInfo.apiKeyPreview}</span>
                  )}
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {/* Completion Message */}
      {allComplete && (
        <Card className="mt-8 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-200">
          <CardContent className="py-8 text-center">
            <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-green-600" />
            <h2 className="text-2xl font-bold mb-2 text-green-700 dark:text-green-300">
              Configuracao Concluida!
            </h2>
            <p className="text-muted-foreground mb-6">
              Todas as integracoes estao configuradas. Voce pode comecar a usar o sistema!
            </p>
            <div className="flex gap-4 justify-center">
              <Button onClick={() => setLocation("/dashboard")} size="lg">
                Ir para o Dashboard
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              <Button
                variant="outline"
                onClick={() => setLocation("/integrations")}
                size="lg"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Configuracoes Avancadas
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation Buttons */}
      {!allComplete && (
        <div className="flex justify-between mt-8">
          <Button
            variant="ghost"
            onClick={() => setLocation("/dashboard")}
          >
            Pular por agora
          </Button>
          <Button
            variant="outline"
            onClick={() => refetchWuzapiStatus()}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar Status
          </Button>
        </div>
      )}
    </div>
  );
}
