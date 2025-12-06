import { useState, useEffect } from "react";
import DashboardLayout from "@/layouts/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Loader2,
  MessageCircle,
  Phone,
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  Bot,
  Users,
  MessageSquare,
  Settings2,
  Link,
  MapPin,
  Star,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Types for settings API
type ConversationStyle = "menu" | "humanized";
type BotPersonality = "professional" | "friendly" | "casual";
type GreetingStyle = "time_based" | "simple";
type PriceDisclosurePolicy = "always" | "never_chat" | "only_general";

interface SettingsData {
  chatEnabled?: boolean;
  chatWelcomeMessage?: string;
  chatFallbackMessage?: string;
  emergencyPhone?: string;
  googleReviewLink?: string;
  googleMapsLink?: string;
  conversationStyle?: ConversationStyle;
  botPersonality?: BotPersonality;
  botName?: string;
  useEmojis?: boolean;
  greetingStyle?: GreetingStyle;
  customGreetingMorning?: string;
  customGreetingAfternoon?: string;
  customGreetingEvening?: string;
  humanizedPromptContext?: string;
  priceDisclosurePolicy?: PriceDisclosurePolicy;
}

interface SettingsResponse {
  data: SettingsData;
}

interface CannedResponsesResponse {
  data: CannedResponse[];
}

interface AdminPhonesResponse {
  data: AdminPhone[];
}

interface ChatStatsResponse {
  data: ChatStats;
}

interface MetaItem {
  value: string;
  label: string;
}

interface MetaResponse {
  data: MetaItem[];
}
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Tipos
interface CannedResponse {
  id: number;
  intent: string;
  name: string;
  content: string;
  category: string;
  priority: number;
  isActive: boolean;
}

interface AdminPhone {
  id: number;
  phone: string;
  name: string;
  role: string;
  isActive: boolean;
  canReceiveNotifications: boolean;
  notificationTypes: string[];
}

interface ChatStats {
  totalSessions: number;
  totalMessages: number;
  totalTokens: number;
  processingDistribution: { processedBy: string; count: number }[];
  topIntents: { intent: string; count: number }[];
  estimatedCost: number;
}

export default function ConfiguracoesChatPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("general");

  // Estados do formulário geral
  const [chatSettings, setChatSettings] = useState({
    chatEnabled: true,
    chatWelcomeMessage: "",
    chatFallbackMessage: "",
    emergencyPhone: "",
    googleReviewLink: "",
    googleMapsLink: "",
  });

  // Estados do estilo do bot
  const [botStyleSettings, setBotStyleSettings] = useState({
    conversationStyle: "menu" as "menu" | "humanized",
    botPersonality: "professional" as "professional" | "friendly" | "casual",
    botName: "Assistente",
    useEmojis: true,
    greetingStyle: "time_based" as "time_based" | "simple",
    customGreetingMorning: "",
    customGreetingAfternoon: "",
    customGreetingEvening: "",
    humanizedPromptContext: "",
    priceDisclosurePolicy: "always" as "always" | "never_chat" | "only_general",
  });

  // Estado para edição de respostas prontas
  const [editingResponse, setEditingResponse] = useState<CannedResponse | null>(null);
  const [newResponseDialogOpen, setNewResponseDialogOpen] = useState(false);
  const [newResponse, setNewResponse] = useState({
    intent: "",
    name: "",
    content: "",
    category: "general",
    priority: 0,
    isActive: true,
  });

  // Estado para edição de telefones admin
  const [editingPhone, setEditingPhone] = useState<AdminPhone | null>(null);
  const [newPhoneDialogOpen, setNewPhoneDialogOpen] = useState(false);
  const [newPhone, setNewPhone] = useState({
    phone: "",
    name: "",
    role: "admin",
    isActive: true,
    canReceiveNotifications: true,
    notificationTypes: ["all"],
  });

  // Queries
  const { data: settings, isLoading: isLoadingSettings } = useQuery<SettingsResponse>({
    queryKey: ["/api/v1/settings"],
  });

  const { data: cannedResponses, isLoading: isLoadingResponses } = useQuery<CannedResponsesResponse>({
    queryKey: ["/api/v1/canned-responses"],
  });

  const { data: adminPhones, isLoading: isLoadingPhones } = useQuery<AdminPhonesResponse>({
    queryKey: ["/api/v1/admin-phones"],
  });

  const { data: chatStats } = useQuery<ChatStatsResponse>({
    queryKey: ["/api/v1/chat/stats"],
  });

  const { data: intents } = useQuery<MetaResponse>({
    queryKey: ["/api/v1/canned-responses/meta/intents"],
  });

  const { data: notificationTypes } = useQuery<MetaResponse>({
    queryKey: ["/api/v1/admin-phones/meta/notification-types"],
  });

  const { data: roles } = useQuery<MetaResponse>({
    queryKey: ["/api/v1/admin-phones/meta/roles"],
  });

  // Mutations
  const updateSettings = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", "/api/v1/settings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v1/settings"] });
      toast({ title: "Configurações salvas com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao salvar configurações", variant: "destructive" });
    },
  });

  const seedDefaultResponses = useMutation({
    mutationFn: () => apiRequest("POST", "/api/v1/canned-responses/seed-defaults"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v1/canned-responses"] });
      toast({ title: "Respostas padrão criadas com sucesso!" });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar respostas padrão",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const createResponse = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/v1/canned-responses", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v1/canned-responses"] });
      setNewResponseDialogOpen(false);
      setNewResponse({ intent: "", name: "", content: "", category: "general", priority: 0, isActive: true });
      toast({ title: "Resposta criada com sucesso!" });
    },
  });

  const updateResponse = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiRequest("PUT", `/api/v1/canned-responses/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v1/canned-responses"] });
      setEditingResponse(null);
      toast({ title: "Resposta atualizada!" });
    },
  });

  const deleteResponse = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/v1/canned-responses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v1/canned-responses"] });
      toast({ title: "Resposta removida!" });
    },
  });

  const createPhone = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/v1/admin-phones", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v1/admin-phones"] });
      setNewPhoneDialogOpen(false);
      setNewPhone({ phone: "", name: "", role: "admin", isActive: true, canReceiveNotifications: true, notificationTypes: ["all"] });
      toast({ title: "Telefone adicionado com sucesso!" });
    },
  });

  const updatePhone = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiRequest("PUT", `/api/v1/admin-phones/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v1/admin-phones"] });
      setEditingPhone(null);
      toast({ title: "Telefone atualizado!" });
    },
  });

  const deletePhone = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/v1/admin-phones/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v1/admin-phones"] });
      toast({ title: "Telefone removido!" });
    },
  });

  // Efeito para carregar settings
  useEffect(() => {
    if (settings?.data) {
      setChatSettings({
        chatEnabled: settings.data.chatEnabled !== false,
        chatWelcomeMessage: settings.data.chatWelcomeMessage || "",
        chatFallbackMessage: settings.data.chatFallbackMessage || "",
        emergencyPhone: settings.data.emergencyPhone || "",
        googleReviewLink: settings.data.googleReviewLink || "",
        googleMapsLink: settings.data.googleMapsLink || "",
      });
      setBotStyleSettings({
        conversationStyle: settings.data.conversationStyle || "menu",
        botPersonality: settings.data.botPersonality || "professional",
        botName: settings.data.botName || "Assistente",
        useEmojis: settings.data.useEmojis !== false,
        greetingStyle: settings.data.greetingStyle || "time_based",
        customGreetingMorning: settings.data.customGreetingMorning || "",
        customGreetingAfternoon: settings.data.customGreetingAfternoon || "",
        customGreetingEvening: settings.data.customGreetingEvening || "",
        humanizedPromptContext: settings.data.humanizedPromptContext || "",
        priceDisclosurePolicy: settings.data.priceDisclosurePolicy || "always",
      });
    }
  }, [settings]);

  const handleSaveSettings = () => {
    updateSettings.mutate(chatSettings);
  };

  const handleSaveBotStyle = () => {
    updateSettings.mutate(botStyleSettings);
  };

  // Preview de saudação
  const getGreetingPreview = () => {
    const hour = new Date().getHours();
    if (botStyleSettings.greetingStyle === "simple") {
      return botStyleSettings.useEmojis ? "Olá! 👋" : "Olá!";
    }
    if (hour >= 5 && hour < 12) {
      return botStyleSettings.customGreetingMorning || (botStyleSettings.useEmojis ? "Bom dia! ☀️" : "Bom dia!");
    } else if (hour >= 12 && hour < 18) {
      return botStyleSettings.customGreetingAfternoon || (botStyleSettings.useEmojis ? "Boa tarde! 🌤️" : "Boa tarde!");
    }
    return botStyleSettings.customGreetingEvening || (botStyleSettings.useEmojis ? "Boa noite! 🌙" : "Boa noite!");
  };

  const isLoading = isLoadingSettings || isLoadingResponses || isLoadingPhones;

  return (
    <DashboardLayout title="Configurações de Chat" currentPath="/configuracoes/chat">
      <div className="flex flex-col space-y-6 p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Chat & Automação</h1>
            <p className="text-muted-foreground mt-1">
              Configure respostas automáticas, telefones admin e integrações de chat
            </p>
          </div>
        </div>

        {/* Estatísticas */}
        {chatStats?.data && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Sessões (30 dias)</p>
                    <p className="text-2xl font-bold">{chatStats.data.totalSessions}</p>
                  </div>
                  <MessageCircle className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Mensagens</p>
                    <p className="text-2xl font-bold">{chatStats.data.totalMessages}</p>
                  </div>
                  <MessageSquare className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Tokens Usados</p>
                    <p className="text-2xl font-bold">{chatStats.data.totalTokens}</p>
                  </div>
                  <Bot className="h-8 w-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Custo Estimado</p>
                    <p className="text-2xl font-bold">R$ {(chatStats.data.estimatedCost * 5).toFixed(2)}</p>
                  </div>
                  <AlertCircle className="h-8 w-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="general">
              <Settings2 className="h-4 w-4 mr-2" />
              Geral
            </TabsTrigger>
            <TabsTrigger value="bot-style">
              <Bot className="h-4 w-4 mr-2" />
              Estilo do Bot
            </TabsTrigger>
            <TabsTrigger value="responses">
              <MessageSquare className="h-4 w-4 mr-2" />
              Respostas Prontas
            </TabsTrigger>
            <TabsTrigger value="phones">
              <Phone className="h-4 w-4 mr-2" />
              Telefones Admin
            </TabsTrigger>
            <TabsTrigger value="stats">
              <MessageCircle className="h-4 w-4 mr-2" />
              Estatísticas
            </TabsTrigger>
          </TabsList>

          {/* Aba Geral */}
          <TabsContent value="general" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Configurações Gerais do Chat</CardTitle>
                <CardDescription>
                  Configure links, telefones e mensagens padrão
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Chat Habilitado</Label>
                    <p className="text-sm text-muted-foreground">
                      Ativar processamento automático de mensagens
                    </p>
                  </div>
                  <Switch
                    checked={chatSettings.chatEnabled}
                    onCheckedChange={(checked) =>
                      setChatSettings({ ...chatSettings, chatEnabled: checked })
                    }
                  />
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="emergencyPhone">
                      <Phone className="h-4 w-4 inline mr-2" />
                      Telefone de Emergência
                    </Label>
                    <Input
                      id="emergencyPhone"
                      placeholder="5511999999999"
                      value={chatSettings.emergencyPhone}
                      onChange={(e) =>
                        setChatSettings({ ...chatSettings, emergencyPhone: e.target.value })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Usado em mensagens de emergência
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="googleReviewLink">
                      <Star className="h-4 w-4 inline mr-2" />
                      Link Google Review
                    </Label>
                    <Input
                      id="googleReviewLink"
                      placeholder="https://g.page/r/..."
                      value={chatSettings.googleReviewLink}
                      onChange={(e) =>
                        setChatSettings({ ...chatSettings, googleReviewLink: e.target.value })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Link para avaliação no Google
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="googleMapsLink">
                      <MapPin className="h-4 w-4 inline mr-2" />
                      Link Google Maps
                    </Label>
                    <Input
                      id="googleMapsLink"
                      placeholder="https://maps.google.com/..."
                      value={chatSettings.googleMapsLink}
                      onChange={(e) =>
                        setChatSettings({ ...chatSettings, googleMapsLink: e.target.value })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Link para localização no Google Maps
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="chatWelcomeMessage">Mensagem de Boas-Vindas</Label>
                  <Textarea
                    id="chatWelcomeMessage"
                    placeholder="Olá! 👋 Seja bem-vindo(a)..."
                    rows={4}
                    value={chatSettings.chatWelcomeMessage}
                    onChange={(e) =>
                      setChatSettings({ ...chatSettings, chatWelcomeMessage: e.target.value })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Variáveis: {"{{company.name}}"}, {"{{company.phone}}"}, {"{{company.address}}"}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="chatFallbackMessage">Mensagem de Fallback</Label>
                  <Textarea
                    id="chatFallbackMessage"
                    placeholder="Desculpe, não entendi..."
                    rows={4}
                    value={chatSettings.chatFallbackMessage}
                    onChange={(e) =>
                      setChatSettings({ ...chatSettings, chatFallbackMessage: e.target.value })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Quando a IA não consegue entender a mensagem
                  </p>
                </div>

                <Button
                  onClick={handleSaveSettings}
                  disabled={updateSettings.isPending}
                  className="w-full"
                >
                  {updateSettings.isPending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</>
                  ) : (
                    <><Save className="mr-2 h-4 w-4" /> Salvar Configurações</>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba Estilo do Bot */}
          <TabsContent value="bot-style" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Configurações principais */}
              <Card>
                <CardHeader>
                  <CardTitle>Estilo de Conversa</CardTitle>
                  <CardDescription>
                    Define como o bot interage com os pacientes
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label>Tipo de Conversa</Label>
                    <Select
                      value={botStyleSettings.conversationStyle}
                      onValueChange={(v: "menu" | "humanized") =>
                        setBotStyleSettings({ ...botStyleSettings, conversationStyle: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="menu">Menu com Opções (1️⃣ 2️⃣ 3️⃣)</SelectItem>
                        <SelectItem value="humanized">Humanizado (Conversa Natural)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {botStyleSettings.conversationStyle === "menu"
                        ? "Mostra opções numeradas na primeira mensagem"
                        : "Conversa natural sem menus numéricos"}
                    </p>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label>Personalidade do Bot</Label>
                    <Select
                      value={botStyleSettings.botPersonality}
                      onValueChange={(v: "professional" | "friendly" | "casual") =>
                        setBotStyleSettings({ ...botStyleSettings, botPersonality: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="professional">Profissional</SelectItem>
                        <SelectItem value="friendly">Amigável</SelectItem>
                        <SelectItem value="casual">Casual</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {botStyleSettings.botPersonality === "professional" && "Tom formal e educado"}
                      {botStyleSettings.botPersonality === "friendly" && "Tom simpático e próximo"}
                      {botStyleSettings.botPersonality === "casual" && "Tom descontraído e informal"}
                    </p>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label htmlFor="botName">Nome do Bot</Label>
                    <Input
                      id="botName"
                      placeholder="Ex: Carol, Clara, Atendente"
                      value={botStyleSettings.botName}
                      onChange={(e) =>
                        setBotStyleSettings({ ...botStyleSettings, botName: e.target.value })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Nome usado nas saudações humanizadas
                    </p>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Usar Emojis</Label>
                      <p className="text-sm text-muted-foreground">
                        Inclui emojis nas respostas
                      </p>
                    </div>
                    <Switch
                      checked={botStyleSettings.useEmojis}
                      onCheckedChange={(checked) =>
                        setBotStyleSettings({ ...botStyleSettings, useEmojis: checked })
                      }
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Saudações */}
              <Card>
                <CardHeader>
                  <CardTitle>Saudações</CardTitle>
                  <CardDescription>
                    Configure as mensagens de boas-vindas
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label>Estilo de Saudação</Label>
                    <Select
                      value={botStyleSettings.greetingStyle}
                      onValueChange={(v: "time_based" | "simple") =>
                        setBotStyleSettings({ ...botStyleSettings, greetingStyle: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="time_based">Baseada no Horário (Bom dia/tarde/noite)</SelectItem>
                        <SelectItem value="simple">Simples (Olá)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {botStyleSettings.greetingStyle === "time_based" && (
                    <>
                      <div className="space-y-2">
                        <Label>Saudação Manhã (5h-12h)</Label>
                        <Input
                          placeholder="Bom dia! ☀️"
                          value={botStyleSettings.customGreetingMorning}
                          onChange={(e) =>
                            setBotStyleSettings({ ...botStyleSettings, customGreetingMorning: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Saudação Tarde (12h-18h)</Label>
                        <Input
                          placeholder="Boa tarde! 🌤️"
                          value={botStyleSettings.customGreetingAfternoon}
                          onChange={(e) =>
                            setBotStyleSettings({ ...botStyleSettings, customGreetingAfternoon: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Saudação Noite (18h-5h)</Label>
                        <Input
                          placeholder="Boa noite! 🌙"
                          value={botStyleSettings.customGreetingEvening}
                          onChange={(e) =>
                            setBotStyleSettings({ ...botStyleSettings, customGreetingEvening: e.target.value })
                          }
                        />
                      </div>
                    </>
                  )}

                  <Separator />

                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm font-medium mb-2">Preview da Saudação Atual:</p>
                    <p className="text-lg">{getGreetingPreview()}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Regras de Negócio */}
              <Card>
                <CardHeader>
                  <CardTitle>Regras de Negócio</CardTitle>
                  <CardDescription>
                    Configure como o bot lida com informações sensíveis
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label>Divulgação de Preços</Label>
                    <Select
                      value={botStyleSettings.priceDisclosurePolicy}
                      onValueChange={(v: "always" | "never_chat" | "only_general") =>
                        setBotStyleSettings({ ...botStyleSettings, priceDisclosurePolicy: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="always">Sempre informar preços</SelectItem>
                        <SelectItem value="never_chat">Só presencialmente</SelectItem>
                        <SelectItem value="only_general">Apenas valores gerais</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {botStyleSettings.priceDisclosurePolicy === "always" && "Informa tabela de preços completa"}
                      {botStyleSettings.priceDisclosurePolicy === "never_chat" && "Pede para o paciente ir presencialmente"}
                      {botStyleSettings.priceDisclosurePolicy === "only_general" && "Informa faixa de valores sem detalhes"}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Contexto Personalizado */}
              <Card>
                <CardHeader>
                  <CardTitle>Contexto para IA</CardTitle>
                  <CardDescription>
                    Informações adicionais para respostas humanizadas
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="humanizedPromptContext">Contexto Personalizado</Label>
                    <Textarea
                      id="humanizedPromptContext"
                      placeholder="Ex: Somos especializados em ortodontia e implantes. Atendemos convênios Bradesco e Amil. Não trabalhamos aos domingos..."
                      rows={6}
                      value={botStyleSettings.humanizedPromptContext}
                      onChange={(e) =>
                        setBotStyleSettings({ ...botStyleSettings, humanizedPromptContext: e.target.value })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Essas informações são usadas pela IA para responder de forma mais precisa
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Button
              onClick={handleSaveBotStyle}
              disabled={updateSettings.isPending}
              className="w-full"
            >
              {updateSettings.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</>
              ) : (
                <><Save className="mr-2 h-4 w-4" /> Salvar Configurações do Bot</>
              )}
            </Button>
          </TabsContent>

          {/* Aba Respostas Prontas */}
          <TabsContent value="responses" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Respostas Prontas</CardTitle>
                    <CardDescription>
                      Configure respostas automáticas por intenção
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => seedDefaultResponses.mutate()}
                      disabled={seedDefaultResponses.isPending}
                    >
                      {seedDefaultResponses.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <><RefreshCw className="h-4 w-4 mr-2" /> Carregar Padrões</>
                      )}
                    </Button>
                    <Dialog open={newResponseDialogOpen} onOpenChange={setNewResponseDialogOpen}>
                      <DialogTrigger asChild>
                        <Button>
                          <Plus className="h-4 w-4 mr-2" /> Nova Resposta
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Nova Resposta Pronta</DialogTitle>
                          <DialogDescription>
                            Configure uma nova resposta automática
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Intenção</Label>
                              <Select
                                value={newResponse.intent}
                                onValueChange={(v) => setNewResponse({ ...newResponse, intent: v })}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {intents?.data?.map((intent) => (
                                    <SelectItem key={intent.value} value={intent.value}>
                                      {intent.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Nome</Label>
                              <Input
                                value={newResponse.name}
                                onChange={(e) => setNewResponse({ ...newResponse, name: e.target.value })}
                                placeholder="Ex: Saudação Principal"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Conteúdo da Resposta</Label>
                            <Textarea
                              rows={6}
                              value={newResponse.content}
                              onChange={(e) => setNewResponse({ ...newResponse, content: e.target.value })}
                              placeholder="Olá! 👋 Seja bem-vindo(a) à {{company.name}}..."
                            />
                            <p className="text-xs text-muted-foreground">
                              Variáveis: {"{{company.name}}"}, {"{{company.phone}}"}, {"{{settings.googleMapsLink}}"}, etc.
                            </p>
                          </div>
                          <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <Label>Categoria</Label>
                              <Select
                                value={newResponse.category}
                                onValueChange={(v) => setNewResponse({ ...newResponse, category: v })}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="general">Geral</SelectItem>
                                  <SelectItem value="appointment">Agendamento</SelectItem>
                                  <SelectItem value="info">Informações</SelectItem>
                                  <SelectItem value="urgent">Urgente</SelectItem>
                                  <SelectItem value="transfer">Transferência</SelectItem>
                                  <SelectItem value="engagement">Engajamento</SelectItem>
                                  <SelectItem value="fallback">Fallback</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Prioridade</Label>
                              <Input
                                type="number"
                                value={newResponse.priority}
                                onChange={(e) => setNewResponse({ ...newResponse, priority: parseInt(e.target.value) })}
                              />
                            </div>
                            <div className="flex items-center space-x-2 pt-7">
                              <Switch
                                checked={newResponse.isActive}
                                onCheckedChange={(v) => setNewResponse({ ...newResponse, isActive: v })}
                              />
                              <Label>Ativa</Label>
                            </div>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setNewResponseDialogOpen(false)}>
                            Cancelar
                          </Button>
                          <Button
                            onClick={() => createResponse.mutate(newResponse)}
                            disabled={createResponse.isPending}
                          >
                            {createResponse.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingResponses ? (
                  <div className="flex justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Intenção</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cannedResponses?.data?.map((response) => (
                        <TableRow key={response.id}>
                          <TableCell>
                            <Badge variant="outline">{response.intent}</Badge>
                          </TableCell>
                          <TableCell>{response.name}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{response.category}</Badge>
                          </TableCell>
                          <TableCell>
                            {response.isActive ? (
                              <Badge className="bg-green-500/20 text-green-700 dark:text-green-400">Ativa</Badge>
                            ) : (
                              <Badge variant="secondary">Inativa</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditingResponse(response)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteResponse.mutate(response.id)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba Telefones Admin */}
          <TabsContent value="phones" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Telefones Admin</CardTitle>
                    <CardDescription>
                      Configure telefones para receber notificações
                    </CardDescription>
                  </div>
                  <Dialog open={newPhoneDialogOpen} onOpenChange={setNewPhoneDialogOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" /> Novo Telefone
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Novo Telefone Admin</DialogTitle>
                        <DialogDescription>
                          Adicione um telefone para receber notificações
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Nome</Label>
                            <Input
                              value={newPhone.name}
                              onChange={(e) => setNewPhone({ ...newPhone, name: e.target.value })}
                              placeholder="Dr. João"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Telefone</Label>
                            <Input
                              value={newPhone.phone}
                              onChange={(e) => setNewPhone({ ...newPhone, phone: e.target.value })}
                              placeholder="5511999999999"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Cargo</Label>
                          <Select
                            value={newPhone.role}
                            onValueChange={(v) => setNewPhone({ ...newPhone, role: v })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {roles?.data?.map((role) => (
                                <SelectItem key={role.value} value={role.value}>
                                  {role.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Switch
                              checked={newPhone.isActive}
                              onCheckedChange={(v) => setNewPhone({ ...newPhone, isActive: v })}
                            />
                            <Label>Ativo</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Switch
                              checked={newPhone.canReceiveNotifications}
                              onCheckedChange={(v) => setNewPhone({ ...newPhone, canReceiveNotifications: v })}
                            />
                            <Label>Receber Notificações</Label>
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setNewPhoneDialogOpen(false)}>
                          Cancelar
                        </Button>
                        <Button
                          onClick={() => createPhone.mutate(newPhone)}
                          disabled={createPhone.isPending}
                        >
                          {createPhone.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Adicionar"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingPhones ? (
                  <div className="flex justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Cargo</TableHead>
                        <TableHead>Notificações</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {adminPhones?.data?.map((phone) => (
                        <TableRow key={phone.id}>
                          <TableCell>{phone.name}</TableCell>
                          <TableCell>{phone.phone}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{phone.role}</Badge>
                          </TableCell>
                          <TableCell>
                            {phone.canReceiveNotifications ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <X className="h-4 w-4 text-muted-foreground" />
                            )}
                          </TableCell>
                          <TableCell>
                            {phone.isActive ? (
                              <Badge className="bg-green-500/20 text-green-700 dark:text-green-400">Ativo</Badge>
                            ) : (
                              <Badge variant="secondary">Inativo</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditingPhone(phone)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deletePhone.mutate(phone.id)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba Estatísticas */}
          <TabsContent value="stats" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Processamento por Tipo</CardTitle>
                  <CardDescription>
                    Como as mensagens são processadas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {chatStats?.data?.processingDistribution?.map((item) => (
                    <div key={item.processedBy} className="flex justify-between items-center py-2">
                      <span className="flex items-center gap-2">
                        {item.processedBy === 'regex' && <Bot className="h-4 w-4 text-green-500" />}
                        {item.processedBy === 'state_machine' && <Settings2 className="h-4 w-4 text-blue-500" />}
                        {item.processedBy === 'ai' && <Bot className="h-4 w-4 text-purple-500" />}
                        {item.processedBy === 'fallback' && <AlertCircle className="h-4 w-4 text-orange-500" />}
                        {item.processedBy || 'Desconhecido'}
                      </span>
                      <Badge variant="secondary">{item.count}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Top Intenções</CardTitle>
                  <CardDescription>
                    Intenções mais detectadas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {chatStats?.data?.topIntents?.map((item) => (
                    <div key={item.intent} className="flex justify-between items-center py-2">
                      <Badge variant="outline">{item.intent}</Badge>
                      <span className="text-muted-foreground">{item.count}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
