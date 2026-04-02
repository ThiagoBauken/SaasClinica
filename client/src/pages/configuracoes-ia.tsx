import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/core/AuthProvider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Bot, CheckCircle2, XCircle, AlertCircle, Loader2, Sparkles,
  Shield, Zap, MessageSquare, Brain, Settings, ChevronRight
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import DashboardLayout from "@/layouts/DashboardLayout";

// ============================================
// PRESETS: 3 opcoes prontas + 1 personalizada
// ============================================

const PERSONALITY_PRESETS = [
  {
    id: "professional",
    label: "Profissional",
    icon: Shield,
    description: "Formal e cortez. Ideal para clinicas tradicionais.",
    botName: "Assistente Virtual",
    prompt: "Seja profissional e formal. Use 'senhor/senhora'. Mantenha respostas objetivas e respeitosas.",
    useEmojis: false,
  },
  {
    id: "friendly",
    label: "Amigavel",
    icon: MessageSquare,
    description: "Caloroso e acolhedor. Equilibrio entre profissional e informal.",
    botName: "Carol",
    prompt: "Seja amigavel e acolhedora. Use 'voce' naturalmente. Mostre empatia e cuidado com o paciente.",
    useEmojis: true,
  },
  {
    id: "casual",
    label: "Descontraido",
    icon: Sparkles,
    description: "Leve e moderno. Ideal para clinicas jovens e estetica.",
    botName: "Bia",
    prompt: "Seja descontraida e moderna. Use linguagem jovem mas profissional. Crie conexao com o paciente.",
    useEmojis: true,
  },
  {
    id: "custom",
    label: "Personalizado",
    icon: Settings,
    description: "Configure do seu jeito.",
    botName: "",
    prompt: "",
    useEmojis: true,
  },
];

const GREETING_PRESETS = [
  {
    id: "time_based",
    label: "Por horario",
    description: "Bom dia / Boa tarde / Boa noite automatico",
    morning: "Bom dia! Como posso ajudar?",
    afternoon: "Boa tarde! Em que posso ajudar?",
    evening: "Boa noite! Como posso ajudar?",
  },
  {
    id: "warm",
    label: "Calorosa",
    description: "Saudacao mais pessoal e acolhedora",
    morning: "Ola! Que bom falar com voce! Como posso te ajudar hoje?",
    afternoon: "Oi! Tudo bem? Estou aqui pra te ajudar!",
    evening: "Boa noite! Ficamos felizes em atender voce!",
  },
  {
    id: "direct",
    label: "Direta",
    description: "Objetiva, vai direto ao ponto",
    morning: "Ola! Agendar consulta, verificar horarios ou outra duvida?",
    afternoon: "Ola! Agendar consulta, verificar horarios ou outra duvida?",
    evening: "Ola! Agendar consulta, verificar horarios ou outra duvida?",
  },
  {
    id: "custom",
    label: "Personalizada",
    description: "Escreva suas proprias saudacoes",
    morning: "",
    afternoon: "",
    evening: "",
  },
];

const PRICE_POLICY_PRESETS = [
  {
    id: "always",
    label: "Sempre informar",
    description: "A IA informa precos quando perguntada",
    icon: CheckCircle2,
  },
  {
    id: "only_general",
    label: "Faixa de valores",
    description: "Apenas faixas gerais, detalhes so presencialmente",
    icon: AlertCircle,
  },
  {
    id: "never_chat",
    label: "Nunca por chat",
    description: "Valores apenas na consulta presencial",
    icon: XCircle,
  },
];

const WELCOME_PRESETS = [
  {
    id: "menu",
    label: "Menu com opcoes",
    message: "Ola! Bem-vindo(a) a {{clinicName}}!\n\nComo posso ajudar?\n\n1 - Agendar consulta\n2 - Meus agendamentos\n3 - Informacoes da clinica\n4 - Falar com atendente",
  },
  {
    id: "natural",
    label: "Conversa natural",
    message: "Ola! Sou a assistente virtual da {{clinicName}}. Como posso ajudar voce hoje?",
  },
  {
    id: "detailed",
    label: "Detalhada",
    message: "Ola! Bem-vindo(a) a {{clinicName}}!\n\nSou sua assistente virtual e posso te ajudar com agendamentos, informacoes sobre procedimentos, horarios e muito mais.\n\nComo posso ajudar?",
  },
  {
    id: "custom",
    label: "Personalizada",
    message: "",
  },
];

// ============================================
// INTERFACES
// ============================================

interface ActivationStatus {
  canActivate: boolean;
  isActive: boolean;
  missingRequired: { key: string; label: string; description: string }[];
  missingRecommended: { key: string; label: string; description: string }[];
  passed: { key: string; label: string; description: string }[];
  completionPercent: number;
}

interface AISettings {
  // Personality
  botPersonality: string;
  botName: string;
  humanizedPromptContext: string;
  useEmojis: boolean;
  // Greeting
  greetingStyle: string;
  customGreetingMorning: string;
  customGreetingAfternoon: string;
  customGreetingEvening: string;
  // Policies
  priceDisclosurePolicy: string;
  conversationStyle: string;
  // Welcome
  chatWelcomeMessage: string;
  chatFallbackMessage: string;
  // Clinic context
  clinicContextForBot: string;
  // Agent
  aiAgentEnabled: boolean;
  aiAgentModel: string;
  aiProvider: string;
}

interface ProviderHealth {
  name: string;
  label: string;
  status: 'healthy' | 'offline' | 'no_key';
  model: string;
  latency: number;
  error?: string;
}

interface HealthResponse {
  providers: ProviderHealth[];
  activeProvider: string;
  isReady: boolean;
}

const AI_PROVIDERS = [
  {
    id: "anthropic",
    label: "Anthropic Claude",
    description: "Melhor para atendimento odontologico. Suporte nativo a ferramentas.",
    icon: Brain,
    tag: "Recomendado",
    models: [
      { id: "claude-haiku-4-5-20251001", label: "Haiku (Rapido)", desc: "Rapido e economico. Ideal para atendimento.", tag: "Recomendado" },
      { id: "claude-sonnet-4-6-20250514", label: "Sonnet (Equilibrado)", desc: "Melhor raciocinio. Para casos complexos.", tag: "" },
      { id: "claude-opus-4-6-20250715", label: "Opus (Avancado)", desc: "Maximo de inteligencia. Custo mais alto.", tag: "" },
    ],
  },
  {
    id: "openai",
    label: "OpenAI ChatGPT",
    description: "Alternativa popular. Boa qualidade geral.",
    icon: Zap,
    tag: "",
    models: [
      { id: "gpt-4o-mini", label: "GPT-4o Mini (Rapido)", desc: "Rapido e barato. Bom para maioria dos casos.", tag: "Recomendado" },
      { id: "gpt-4o", label: "GPT-4o (Avancado)", desc: "Maximo de qualidade. Custo mais alto.", tag: "" },
    ],
  },
  {
    id: "ollama",
    label: "LLM Local (Ollama)",
    description: "Privacidade total. Roda no seu servidor, sem custos de API.",
    icon: Shield,
    tag: "Privacidade",
    models: [
      { id: "llama3.1:8b", label: "Llama 3.1 8B", desc: "Leve e rapido. Bom para GPUs com 8GB+.", tag: "Recomendado" },
      { id: "llama3.1:70b", label: "Llama 3.1 70B", desc: "Alta qualidade. Requer GPU potente.", tag: "" },
      { id: "custom", label: "Modelo personalizado", desc: "Digite o nome do modelo instalado no Ollama.", tag: "" },
    ],
  },
];

// ============================================
// COMPONENT
// ============================================

export default function ConfiguracoesIAPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch activation status
  const { data: activationStatus, isLoading: loadingStatus, refetch: refetchStatus } = useQuery<ActivationStatus>({
    queryKey: ["/api/v1/integrations/ai-agent/status"],
  });

  // Fetch clinic settings
  const { data: settings, isLoading: loadingSettings } = useQuery<any>({
    queryKey: ["/api/clinic-settings"],
  });

  // Fetch AI health
  const { data: healthData, isLoading: loadingHealth } = useQuery<HealthResponse>({
    queryKey: ["/api/v1/integrations/ai-agent/health"],
    refetchInterval: 60000,
    staleTime: 30000,
  });

  // Form state
  const [form, setForm] = useState<AISettings>({
    botPersonality: "friendly",
    botName: "Carol",
    humanizedPromptContext: "",
    useEmojis: true,
    greetingStyle: "time_based",
    customGreetingMorning: "",
    customGreetingAfternoon: "",
    customGreetingEvening: "",
    priceDisclosurePolicy: "always",
    conversationStyle: "humanized",
    chatWelcomeMessage: "",
    chatFallbackMessage: "Desculpe, nao entendi. Posso te ajudar com agendamentos, informacoes ou transferir para um atendente.",
    clinicContextForBot: "",
    aiAgentEnabled: false,
    aiAgentModel: "claude-haiku-4-5-20251001",
    aiProvider: "anthropic",
  });

  const [selectedPersonality, setSelectedPersonality] = useState("friendly");
  const [selectedGreeting, setSelectedGreeting] = useState("time_based");
  const [selectedWelcome, setSelectedWelcome] = useState("natural");

  // Load settings into form
  useEffect(() => {
    if (settings) {
      const personality = PERSONALITY_PRESETS.find(p => p.id === settings.botPersonality) ? settings.botPersonality : "custom";
      const greeting = GREETING_PRESETS.find(g => g.id === settings.greetingStyle) ? settings.greetingStyle : "custom";

      setSelectedPersonality(personality);
      setSelectedGreeting(greeting);

      setForm({
        botPersonality: settings.botPersonality || "friendly",
        botName: settings.botName || "Carol",
        humanizedPromptContext: settings.humanizedPromptContext || "",
        useEmojis: settings.useEmojis !== false,
        greetingStyle: settings.greetingStyle || "time_based",
        customGreetingMorning: settings.customGreetingMorning || "",
        customGreetingAfternoon: settings.customGreetingAfternoon || "",
        customGreetingEvening: settings.customGreetingEvening || "",
        priceDisclosurePolicy: settings.priceDisclosurePolicy || "always",
        conversationStyle: settings.conversationStyle || "humanized",
        chatWelcomeMessage: settings.chatWelcomeMessage || "",
        chatFallbackMessage: settings.chatFallbackMessage || "Desculpe, nao entendi. Posso te ajudar com agendamentos, informacoes ou transferir para um atendente.",
        clinicContextForBot: settings.clinicContextForBot || "",
        aiAgentEnabled: settings.aiAgentEnabled || false,
        aiAgentModel: settings.aiAgentModel || "claude-haiku-4-5-20251001",
        aiProvider: settings.aiProvider || "anthropic",
      });
    }
  }, [settings]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: AISettings) => {
      const method = settings?.id ? "PUT" : "POST";
      const res = await apiRequest(method, "/api/clinic-settings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clinic-settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/v1/integrations/ai-agent/status"] });
      toast({ title: "Salvo!", description: "Configuracoes da IA atualizadas." });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    },
  });

  // Toggle AI mutation
  const toggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await apiRequest("POST", "/api/v1/integrations/ai-agent/toggle", { enabled });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/v1/integrations/ai-agent/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clinic-settings"] });
      toast({ title: data.message });
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      refetchStatus();
    },
  });

  const handleSave = () => saveMutation.mutate(form);

  const handlePersonalitySelect = (presetId: string) => {
    setSelectedPersonality(presetId);
    const preset = PERSONALITY_PRESETS.find(p => p.id === presetId);
    if (preset && presetId !== "custom") {
      setForm(prev => ({
        ...prev,
        botPersonality: presetId,
        botName: preset.botName,
        humanizedPromptContext: preset.prompt,
        useEmojis: preset.useEmojis,
      }));
    } else {
      setForm(prev => ({ ...prev, botPersonality: "custom" }));
    }
  };

  const handleGreetingSelect = (presetId: string) => {
    setSelectedGreeting(presetId);
    const preset = GREETING_PRESETS.find(g => g.id === presetId);
    if (preset && presetId !== "custom") {
      setForm(prev => ({
        ...prev,
        greetingStyle: presetId,
        customGreetingMorning: preset.morning,
        customGreetingAfternoon: preset.afternoon,
        customGreetingEvening: preset.evening,
      }));
    } else {
      setForm(prev => ({ ...prev, greetingStyle: "custom" }));
    }
  };

  const handleWelcomeSelect = (presetId: string) => {
    setSelectedWelcome(presetId);
    const preset = WELCOME_PRESETS.find(w => w.id === presetId);
    if (preset && presetId !== "custom") {
      setForm(prev => ({ ...prev, chatWelcomeMessage: preset.message }));
    }
  };

  const isLoading = loadingStatus || loadingSettings;
  const status = activationStatus;

  return (
    <DashboardLayout title="Assistente IA" currentPath="/configuracoes/ia">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* ============================================ */}
        {/* STATUS / ATIVACAO */}
        {/* ============================================ */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-xl ${status?.isActive ? "bg-green-100 dark:bg-green-900/30" : "bg-muted"}`}>
                  <Bot className={`h-6 w-6 ${status?.isActive ? "text-green-600" : "text-muted-foreground"}`} />
                </div>
                <div>
                  <CardTitle className="text-xl">Assistente IA</CardTitle>
                  <CardDescription>
                    Atendimento automatico via WhatsApp com inteligencia artificial
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {status && (
                  <Badge variant={status.isActive ? "default" : "secondary"} className="text-sm px-3 py-1">
                    {status.isActive ? "Ativo" : "Inativo"}
                  </Badge>
                )}
                <Switch
                  checked={status?.isActive || false}
                  onCheckedChange={(checked) => toggleMutation.mutate(checked)}
                  disabled={toggleMutation.isPending || (!status?.canActivate && !status?.isActive)}
                />
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {/* Progress bar */}
            {status && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Configuracao</span>
                  <span className="font-medium">{status.completionPercent}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2.5">
                  <div
                    className={`h-2.5 rounded-full transition-all duration-500 ${
                      status.completionPercent === 100 ? "bg-green-500" :
                      status.completionPercent >= 70 ? "bg-yellow-500" : "bg-red-500"
                    }`}
                    style={{ width: `${status.completionPercent}%` }}
                  />
                </div>

                {/* Missing required */}
                {status.missingRequired.length > 0 && (
                  <Alert variant="destructive" className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <p className="font-medium mb-2">Preencha para ativar:</p>
                      <ul className="space-y-1">
                        {status.missingRequired.map((item) => (
                          <li key={item.key} className="flex items-center gap-2 text-sm">
                            <XCircle className="h-3.5 w-3.5 flex-shrink-0" />
                            <span><strong>{item.label}</strong> - {item.description}</span>
                          </li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Missing recommended */}
                {status.missingRecommended.length > 0 && status.missingRequired.length === 0 && (
                  <Alert className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <p className="font-medium mb-2">Recomendado (opcional):</p>
                      <ul className="space-y-1">
                        {status.missingRecommended.map((item) => (
                          <li key={item.key} className="flex items-center gap-2 text-sm text-muted-foreground">
                            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                            <span>{item.label} - {item.description}</span>
                          </li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {/* All passed */}
                {status.canActivate && status.missingRecommended.length === 0 && (
                  <Alert className="mt-4 border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-700 dark:text-green-400">
                      Tudo configurado! A IA esta pronta para atender.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ============================================ */}
        {/* PERSONALIDADE */}
        {/* ============================================ */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              Personalidade da IA
            </CardTitle>
            <CardDescription>
              Escolha como sua assistente virtual se comunica com os pacientes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {PERSONALITY_PRESETS.map((preset) => {
                const Icon = preset.icon;
                const isSelected = selectedPersonality === preset.id;
                return (
                  <div
                    key={preset.id}
                    onClick={() => handlePersonalitySelect(preset.id)}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-1">
                      <Icon className={`h-5 w-5 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                      <span className="font-medium">{preset.label}</span>
                      {isSelected && <CheckCircle2 className="h-4 w-4 text-primary ml-auto" />}
                    </div>
                    <p className="text-sm text-muted-foreground">{preset.description}</p>
                  </div>
                );
              })}
            </div>

            <Separator />

            {/* Custom fields (always visible, editable when custom selected) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Nome da assistente</Label>
                <Input
                  value={form.botName}
                  onChange={(e) => setForm(prev => ({ ...prev, botName: e.target.value }))}
                  placeholder="Ex: Carol, Bia, Dra. Ana..."
                />
              </div>
              <div className="flex items-center gap-3 pt-6">
                <Switch
                  checked={form.useEmojis}
                  onCheckedChange={(checked) => setForm(prev => ({ ...prev, useEmojis: checked }))}
                />
                <Label>Usar emojis nas respostas</Label>
              </div>
            </div>

            <div>
              <Label>Instrucoes adicionais para a IA</Label>
              <Textarea
                value={form.humanizedPromptContext}
                onChange={(e) => setForm(prev => ({ ...prev, humanizedPromptContext: e.target.value }))}
                placeholder="Ex: Sempre mencione que temos estacionamento gratuito. Foque em tratamentos esteticos..."
                rows={3}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Instrucoes extras que a IA seguira em todas as conversas
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ============================================ */}
        {/* SAUDACAO */}
        {/* ============================================ */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Saudacao Inicial
            </CardTitle>
            <CardDescription>
              Como a IA cumprimenta os pacientes na primeira mensagem
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {GREETING_PRESETS.map((preset) => {
                const isSelected = selectedGreeting === preset.id;
                return (
                  <div
                    key={preset.id}
                    onClick={() => handleGreetingSelect(preset.id)}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">{preset.label}</span>
                      {isSelected && <CheckCircle2 className="h-4 w-4 text-primary" />}
                    </div>
                    <p className="text-sm text-muted-foreground">{preset.description}</p>
                  </div>
                );
              })}
            </div>

            {(selectedGreeting === "custom" || selectedGreeting === "time_based") && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div>
                  <Label>Manha (6h-12h)</Label>
                  <Input
                    value={form.customGreetingMorning}
                    onChange={(e) => setForm(prev => ({ ...prev, customGreetingMorning: e.target.value }))}
                    placeholder="Bom dia! Como posso ajudar?"
                  />
                </div>
                <div>
                  <Label>Tarde (12h-18h)</Label>
                  <Input
                    value={form.customGreetingAfternoon}
                    onChange={(e) => setForm(prev => ({ ...prev, customGreetingAfternoon: e.target.value }))}
                    placeholder="Boa tarde! Em que posso ajudar?"
                  />
                </div>
                <div>
                  <Label>Noite (18h-6h)</Label>
                  <Input
                    value={form.customGreetingEvening}
                    onChange={(e) => setForm(prev => ({ ...prev, customGreetingEvening: e.target.value }))}
                    placeholder="Boa noite! Como posso ajudar?"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ============================================ */}
        {/* MENSAGEM DE BOAS-VINDAS */}
        {/* ============================================ */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Mensagem de Boas-vindas
            </CardTitle>
            <CardDescription>
              Primeira mensagem enviada quando um paciente novo entra em contato
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {WELCOME_PRESETS.map((preset) => {
                const isSelected = selectedWelcome === preset.id;
                return (
                  <div
                    key={preset.id}
                    onClick={() => handleWelcomeSelect(preset.id)}
                    className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{preset.label}</span>
                      {isSelected && <CheckCircle2 className="h-4 w-4 text-primary" />}
                    </div>
                  </div>
                );
              })}
            </div>

            <div>
              <Label>Mensagem</Label>
              <Textarea
                value={form.chatWelcomeMessage}
                onChange={(e) => setForm(prev => ({ ...prev, chatWelcomeMessage: e.target.value }))}
                placeholder="Mensagem de boas-vindas..."
                rows={4}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Use {"{{clinicName}}"} para o nome da clinica
              </p>
            </div>

            <div>
              <Label>Mensagem quando nao entende</Label>
              <Textarea
                value={form.chatFallbackMessage}
                onChange={(e) => setForm(prev => ({ ...prev, chatFallbackMessage: e.target.value }))}
                placeholder="Mensagem quando a IA nao consegue processar..."
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* ============================================ */}
        {/* POLITICA DE PRECOS */}
        {/* ============================================ */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Politica de Precos
            </CardTitle>
            <CardDescription>
              Defina se a IA pode informar valores pelo WhatsApp
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {PRICE_POLICY_PRESETS.map((preset) => {
                const Icon = preset.icon;
                const isSelected = form.priceDisclosurePolicy === preset.id;
                return (
                  <div
                    key={preset.id}
                    onClick={() => setForm(prev => ({ ...prev, priceDisclosurePolicy: preset.id }))}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={`h-4 w-4 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                      <span className="font-medium text-sm">{preset.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{preset.description}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* ============================================ */}
        {/* CONTEXTO DA CLINICA */}
        {/* ============================================ */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Contexto da Clinica
            </CardTitle>
            <CardDescription>
              Informacoes especificas que a IA deve saber sobre sua clinica
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={form.clinicContextForBot}
              onChange={(e) => setForm(prev => ({ ...prev, clinicContextForBot: e.target.value }))}
              placeholder={"Ex:\n- Temos estacionamento gratuito na rua de tras\n- Aceitamos convenio Amil e Bradesco\n- Especializados em implantes e estetica dental\n- Dr. Marcos atende apenas as tercas e quintas"}
              rows={5}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Essas informacoes serao usadas pela IA para responder perguntas dos pacientes
            </p>
          </CardContent>
        </Card>

        {/* ============================================ */}
        {/* PROVIDER DE IA */}
        {/* ============================================ */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              Provider de IA
            </CardTitle>
            <CardDescription>
              Escolha qual servico de inteligencia artificial usar
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Provider selector */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {AI_PROVIDERS.map((provider) => {
                const isSelected = form.aiProvider === provider.id;
                const health = healthData?.providers.find(p => p.name === provider.id);
                const Icon = provider.icon;
                return (
                  <div
                    key={provider.id}
                    onClick={() => {
                      const defaultModel = provider.models[0].id;
                      setForm(prev => ({ ...prev, aiProvider: provider.id, aiAgentModel: defaultModel }));
                    }}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <span className="font-medium text-sm">{provider.label}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {provider.tag && <Badge variant="secondary" className="text-xs">{provider.tag}</Badge>}
                        {health && (
                          <div className={`h-2.5 w-2.5 rounded-full ${
                            health.status === 'healthy' ? 'bg-green-500' :
                            health.status === 'no_key' ? 'bg-yellow-500' : 'bg-red-500'
                          }`} title={health.status === 'healthy' ? `Online (${health.latency}ms)` : health.error || health.status} />
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">{provider.description}</p>
                  </div>
                );
              })}
            </div>

            {/* Health status detail */}
            {healthData && (
              <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 text-sm">
                {healthData.providers.map((p) => (
                  <div key={p.name} className="flex items-center gap-1.5">
                    <div className={`h-2 w-2 rounded-full ${
                      p.status === 'healthy' ? 'bg-green-500' :
                      p.status === 'no_key' ? 'bg-yellow-500' : 'bg-red-500'
                    }`} />
                    <span className="text-muted-foreground">{p.label}</span>
                    {p.status === 'healthy' && <span className="text-xs text-green-600">{p.latency}ms</span>}
                    {p.status === 'no_key' && <span className="text-xs text-yellow-600">sem chave</span>}
                    {p.status === 'offline' && <span className="text-xs text-red-600">offline</span>}
                  </div>
                ))}
              </div>
            )}

            <Separator />

            {/* Model selector (dynamic based on provider) */}
            <div>
              <Label className="text-sm font-medium mb-3 block">Modelo</Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {(AI_PROVIDERS.find(p => p.id === form.aiProvider)?.models || []).map((model) => {
                  const isSelected = form.aiAgentModel === model.id;
                  return (
                    <div
                      key={model.id}
                      onClick={() => setForm(prev => ({ ...prev, aiAgentModel: model.id }))}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">{model.label}</span>
                        {model.tag && <Badge variant="secondary" className="text-xs">{model.tag}</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">{model.desc}</p>
                    </div>
                  );
                })}
              </div>

              {/* Custom model input for Ollama */}
              {form.aiProvider === "ollama" && form.aiAgentModel === "custom" && (
                <div className="mt-3">
                  <Input
                    placeholder="Nome do modelo (ex: mistral, codellama, etc.)"
                    value={form.aiAgentModel === "custom" ? "" : form.aiAgentModel}
                    onChange={(e) => setForm(prev => ({ ...prev, aiAgentModel: e.target.value || "custom" }))}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ============================================ */}
        {/* BOTAO SALVAR */}
        {/* ============================================ */}
        <div className="flex justify-end pb-8">
          <Button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            size="lg"
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar Configuracoes"
            )}
          </Button>
        </div>

      </div>
    </DashboardLayout>
  );
}
