/**
 * Chat Inbox - Atendimento da Secretária
 * Interface para gerenciar conversas de WhatsApp
 */

import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import DashboardLayout from "@/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Loader2,
  Send,
  MessageCircle,
  User,
  Bot,
  Clock,
  Phone,
  Search,
  MoreVertical,
  UserCheck,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Zap,
  ArrowLeft,
  Calendar,
  FileText,
  ExternalLink,
  TrendingUp,
  Activity,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { AI_STAGE_LABELS, AI_STAGE_COLORS } from "@/types/crm";

// Tipos
interface ChatSession {
  id: number;
  phone: string;
  userType: string;
  patientId?: number;
  status: string;
  currentState?: string;
  lastMessageAt: string;
  createdAt: string;
  updatedAt?: string;
  patientName?: string;
  lastMessage?: {
    content: string;
    role: string;
    createdAt: string;
  };
  unreadCount: number;
  needsAttention: boolean;
  // CRM fields (enriched via pipeline or session detail)
  crmStage?: string | null;
  crmStageName?: string | null;
  crmOpportunityId?: number | null;
}

interface ChatMessage {
  id: number;
  sessionId: number;
  role: string;
  content: string;
  messageType: string;
  processedBy?: string;
  intent?: string;
  confidence?: number;
  tokensUsed?: number;
  wuzapiMessageId?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

interface QuickReply {
  id: string;
  label: string;
  message: string;
}

interface SessionsResponse {
  success: boolean;
  data: ChatSession[];
  counts: {
    active: number;
    waitingHuman: number;
    closed: number;
    total: number;
  };
  pagination: {
    limit: number;
    offset: number;
  };
}

interface PatientInfo {
  id: number;
  fullName: string;
  phone?: string;
  birthDate?: string;
  email?: string;
  appointmentCount?: number;
  lastVisit?: string;
}

interface SessionDetailResponse {
  success: boolean;
  data: {
    session: ChatSession;
    messages: ChatMessage[];
    patient?: PatientInfo;
  };
}

interface CrmOpportunity {
  id: number;
  chatSessionId?: number | null;
  aiStage?: string | null;
  aiStageLabel?: string | null;
  stageId: number;
  patientId?: number;
}

interface CrmPipelineResponse {
  stages: Array<{
    id: number;
    name: string;
    code: string;
    opportunities: CrmOpportunity[];
  }>;
}

// Helper: retorna a oportunidade CRM linkada a uma sessão
function findOpportunityForSession(
  pipelineData: CrmPipelineResponse | undefined,
  sessionId: number
): CrmOpportunity | undefined {
  if (!pipelineData?.stages) return undefined;
  for (const stage of pipelineData.stages) {
    const opp = stage.opportunities.find(
      (o) => o.chatSessionId === sessionId
    );
    if (opp) return opp;
  }
  return undefined;
}

// Helper: retorna o nome do estágio CRM a partir do pipelineData
function findStageNameForOpportunity(
  pipelineData: CrmPipelineResponse | undefined,
  stageId: number
): string | undefined {
  return pipelineData?.stages.find((s) => s.id === stageId)?.name;
}

export default function ChatInboxPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Buscar sessões
  const { data: sessionsData, isLoading: sessionsLoading, refetch: refetchSessions } = useQuery<SessionsResponse>({
    queryKey: ["chat-sessions", statusFilter],
    queryFn: async () => {
      const res = await fetch(`/api/v1/chat/sessions?status=${statusFilter}&limit=100`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch sessions");
      return res.json();
    },
    refetchInterval: 5000,
  });

  // Buscar detalhes da sessão selecionada
  const { data: sessionDetail, isLoading: sessionLoading } = useQuery<SessionDetailResponse>({
    queryKey: ["chat-session", selectedSessionId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/chat/sessions/${selectedSessionId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch session");
      return res.json();
    },
    enabled: !!selectedSessionId,
    refetchInterval: 3000,
  });

  // Buscar dados do CRM pipeline para cruzar com sessões
  const { data: pipelineData } = useQuery<CrmPipelineResponse>({
    queryKey: ["crm-pipeline-inbox"],
    queryFn: async () => {
      const res = await fetch("/api/v1/crm/pipeline", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch CRM pipeline");
      return res.json();
    },
    refetchInterval: 15000,
  });

  // Buscar respostas rápidas
  const { data: quickRepliesData } = useQuery<{ success: boolean; data: QuickReply[] }>({
    queryKey: ["chat-quick-replies", selectedSessionId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/chat/sessions/${selectedSessionId}/quick-replies`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch quick replies");
      return res.json();
    },
    enabled: !!selectedSessionId,
  });

  // Mutation para enviar mensagem
  const sendMessageMutation = useMutation({
    mutationFn: (data: { content: string; activateTakeover?: boolean }) =>
      apiRequest("POST", `/api/v1/chat/sessions/${selectedSessionId}/send`, data),
    onSuccess: () => {
      setMessageInput("");
      queryClient.invalidateQueries({ queryKey: ["chat-session", selectedSessionId] });
      queryClient.invalidateQueries({ queryKey: ["chat-sessions"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao enviar mensagem",
        description: error.message || "Não foi possível enviar a mensagem",
        variant: "destructive",
      });
    },
  });

  // Mutation para assumir conversa
  const takeoverMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/v1/chat/sessions/${selectedSessionId}/takeover`),
    onSuccess: () => {
      toast({
        title: "Atendimento assumido",
        description: "A IA não responderá por 30 minutos.",
      });
      queryClient.invalidateQueries({ queryKey: ["chat-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["chat-session", selectedSessionId] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation para liberar para IA
  const releaseMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/v1/chat/sessions/${selectedSessionId}/release`),
    onSuccess: () => {
      toast({
        title: "Conversa liberada",
        description: "A IA voltará a responder automaticamente.",
      });
      queryClient.invalidateQueries({ queryKey: ["chat-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["chat-session", selectedSessionId] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation para fechar sessão
  const closeSessionMutation = useMutation({
    mutationFn: () =>
      apiRequest("PUT", `/api/v1/chat/sessions/${selectedSessionId}/close`),
    onSuccess: () => {
      toast({
        title: "Sessão encerrada",
        description: "A conversa foi fechada.",
      });
      setSelectedSessionId(null);
      queryClient.invalidateQueries({ queryKey: ["chat-sessions"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Scroll para última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sessionDetail?.data?.messages]);

  // Filtrar sessões por busca
  const filteredSessions = sessionsData?.data?.filter((session) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      session.phone.includes(search) ||
      session.patientName?.toLowerCase().includes(search)
    );
  }) || [];

  // Enviar mensagem
  const handleSendMessage = () => {
    if (!messageInput.trim()) return;
    sendMessageMutation.mutate({ content: messageInput });
  };

  // Usar resposta rápida
  const handleQuickReply = (reply: QuickReply) => {
    setMessageInput(reply.message);
  };

  // Abrir WhatsApp Web com o número do paciente
  const handleOpenWhatsApp = (phone: string) => {
    const cleaned = phone.replace(/\D/g, "");
    window.open(`https://wa.me/${cleaned}`, "_blank");
  };

  // Renderizar badge de status AI/Humano - versão grande para header
  const renderStatusBadgeLarge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge className="bg-blue-600 hover:bg-blue-700 text-white border-0 px-3 py-1 text-sm font-medium">
            <Bot className="w-4 h-4 mr-1.5" />
            IA Atendendo
          </Badge>
        );
      case "waiting_human":
        return (
          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white border-0 px-3 py-1 text-sm font-medium">
            <UserCheck className="w-4 h-4 mr-1.5" />
            Humano Atendendo
          </Badge>
        );
      case "closed":
        return (
          <Badge className="bg-slate-500 hover:bg-slate-600 text-white border-0 px-3 py-1 text-sm font-medium">
            <CheckCircle2 className="w-4 h-4 mr-1.5" />
            Encerrado
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-sm">
            {status}
          </Badge>
        );
    }
  };

  // Renderizar badge de status AI/Humano - versão compacta para lista
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge className="bg-blue-600 hover:bg-blue-700 text-white border-0 text-[10px] px-1.5 py-0.5 font-medium">
            <Bot className="w-3 h-3 mr-1" />
            IA Atendendo
          </Badge>
        );
      case "waiting_human":
        return (
          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white border-0 text-[10px] px-1.5 py-0.5 font-medium">
            <UserCheck className="w-3 h-3 mr-1" />
            Humano Atendendo
          </Badge>
        );
      case "closed":
        return (
          <Badge className="bg-slate-500 hover:bg-slate-600 text-white border-0 text-[10px] px-1.5 py-0.5 font-medium">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Encerrado
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-[10px]">
            {status}
          </Badge>
        );
    }
  };

  // Renderizar badge de estágio CRM
  const renderCrmStageBadge = (aiStage?: string | null, stageName?: string | null) => {
    if (!aiStage && !stageName) return null;

    const label = aiStage ? (AI_STAGE_LABELS[aiStage] ?? stageName) : stageName;
    const colorClass = aiStage ? (AI_STAGE_COLORS[aiStage] ?? "bg-violet-500") : "bg-violet-500";

    return (
      <Badge
        className={cn(
          "text-white border-0 text-[10px] px-1.5 py-0.5 font-medium",
          colorClass
        )}
      >
        <TrendingUp className="w-3 h-3 mr-1" />
        {label}
      </Badge>
    );
  };

  // Renderizar ícone do remetente
  const renderSenderIcon = (role: string, processedBy?: string) => {
    if (role === "user") {
      return (
        <Avatar className="h-8 w-8 bg-blue-500/20">
          <AvatarFallback className="text-blue-600 dark:text-blue-400 bg-transparent">
            <User className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      );
    }
    if (role === "system") {
      return (
        <Avatar className="h-8 w-8 bg-muted">
          <AvatarFallback className="text-muted-foreground bg-transparent">
            <AlertCircle className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      );
    }
    if (processedBy === "human") {
      return (
        <Avatar className="h-8 w-8 bg-emerald-500/20">
          <AvatarFallback className="text-emerald-600 dark:text-emerald-400 bg-transparent">
            <UserCheck className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      );
    }
    return (
      <Avatar className="h-8 w-8 bg-blue-500/20">
        <AvatarFallback className="text-blue-600 dark:text-blue-400 bg-transparent">
          <Bot className="h-4 w-4" />
        </AvatarFallback>
      </Avatar>
    );
  };

  // Dados da sessão e paciente atualmente selecionados
  const currentSession = sessionDetail?.data?.session;
  const currentPatient = sessionDetail?.data?.patient;
  const currentOpportunity = selectedSessionId
    ? findOpportunityForSession(pipelineData, selectedSessionId)
    : undefined;
  const currentCrmStageName = currentOpportunity
    ? findStageNameForOpportunity(pipelineData, currentOpportunity.stageId)
    : undefined;

  return (
    <DashboardLayout title="Atendimento WhatsApp" currentPath="/atendimento">
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* Header da página */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold">Atendimento WhatsApp</h1>
          </div>
          <div className="flex items-center gap-2">
            {sessionsData?.counts && (
              <div className="flex gap-2 text-sm">
                <Badge className="bg-blue-600 text-white border-0">
                  <Bot className="w-3 h-3 mr-1" />
                  {sessionsData.counts.active} IA
                </Badge>
                <Badge className="bg-emerald-600 text-white border-0">
                  <UserCheck className="w-3 h-3 mr-1" />
                  {sessionsData.counts.waitingHuman} Humano
                </Badge>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchSessions()}
              disabled={sessionsLoading}
            >
              <RefreshCw className={cn("h-4 w-4", sessionsLoading && "animate-spin")} />
            </Button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Lista de conversas */}
          <div className="w-80 border-r flex flex-col">
            {/* Busca */}
            <div className="p-3 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou telefone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Filtros */}
            <div className="p-2 border-b">
              <Tabs value={statusFilter} onValueChange={setStatusFilter}>
                <TabsList className="w-full">
                  <TabsTrigger value="all" className="flex-1 text-xs">Todas</TabsTrigger>
                  <TabsTrigger value="active" className="flex-1 text-xs">IA</TabsTrigger>
                  <TabsTrigger value="waiting_human" className="flex-1 text-xs">Humano</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Lista */}
            <ScrollArea className="flex-1">
              {sessionsLoading ? (
                <LoadingState variant="list" rows={5} label="Carregando conversas..." />
              ) : filteredSessions.length === 0 ? (
                <EmptyState
                  icon={MessageCircle}
                  title="Nenhuma conversa encontrada"
                  description={
                    statusFilter === "all"
                      ? "As conversas do WhatsApp aparecerão aqui quando pacientes entrarem em contato."
                      : "Nenhuma conversa corresponde ao filtro selecionado."
                  }
                />
              ) : (
                <div className="divide-y">
                  {filteredSessions.map((session) => {
                    const opp = findOpportunityForSession(pipelineData, session.id);
                    return (
                      <button
                        key={session.id}
                        onClick={() => setSelectedSessionId(session.id)}
                        className={cn(
                          "w-full p-3 text-left hover:bg-muted/50 transition-colors",
                          selectedSessionId === session.id && "bg-muted",
                          session.needsAttention && "bg-orange-500/5 border-l-2 border-orange-500"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <Avatar className="h-10 w-10 shrink-0">
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {session.patientName?.[0] || <User className="h-5 w-5" />}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium truncate text-sm">
                                {session.patientName || session.phone}
                              </span>
                              {session.unreadCount > 0 && (
                                <Badge className="bg-primary text-primary-foreground ml-2 shrink-0">
                                  {session.unreadCount}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1.5">
                              <Phone className="h-3 w-3" />
                              <span>{session.phone}</span>
                            </div>
                            {session.lastMessage && (
                              <p className="text-xs text-muted-foreground truncate mb-1.5">
                                {session.lastMessage.role === "user" ? "" : "Você: "}
                                {session.lastMessage.content}
                              </p>
                            )}
                            {/* Badges de status e CRM */}
                            <div className="flex flex-wrap items-center gap-1 mt-1">
                              {renderStatusBadge(session.status)}
                              {opp && renderCrmStageBadge(opp.aiStage, opp.aiStageLabel ?? undefined)}
                            </div>
                            <div className="flex justify-end mt-1">
                              <span className="text-[10px] text-muted-foreground">
                                {session.lastMessageAt &&
                                  formatDistanceToNow(new Date(session.lastMessageAt), {
                                    addSuffix: true,
                                    locale: ptBR,
                                  })}
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Área de conversa */}
          <div className="flex-1 flex flex-col min-w-0">
            {selectedSessionId ? (
              <>
                {/* Header da conversa */}
                <div className="p-4 border-b flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="md:hidden shrink-0"
                      onClick={() => setSelectedSessionId(null)}
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {currentPatient?.fullName?.[0] || <User className="h-5 w-5" />}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <h2 className="font-semibold truncate">
                        {currentPatient?.fullName || currentSession?.phone}
                      </h2>
                      <div className="flex items-center flex-wrap gap-2 mt-0.5">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {currentSession?.phone}
                        </span>
                        {/* Badge de status AI/Humano grande e visível */}
                        {currentSession?.status && renderStatusBadgeLarge(currentSession.status)}
                        {/* Badge de estágio CRM */}
                        {currentOpportunity && renderCrmStageBadge(
                          currentOpportunity.aiStage,
                          currentOpportunity.aiStageLabel ?? currentCrmStageName
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {currentSession?.status === "active" && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => takeoverMutation.mutate()}
                              disabled={takeoverMutation.isPending}
                            >
                              {takeoverMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <UserCheck className="h-4 w-4 mr-1" />
                                  Assumir
                                </>
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Assumir atendimento (IA para de responder)</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    {currentSession?.status === "waiting_human" && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => releaseMutation.mutate()}
                              disabled={releaseMutation.isPending}
                            >
                              {releaseMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <Bot className="h-4 w-4 mr-1" />
                                  Devolver à IA
                                </>
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Liberar para IA responder automaticamente</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-5 w-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => closeSessionMutation.mutate()}
                          className="text-destructive"
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Encerrar conversa
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Barra de ações rápidas */}
                <div className="px-4 py-2 border-b bg-muted/30 flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground font-medium mr-1">Ações:</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1.5"
                    onClick={() => navigate("/agenda")}
                  >
                    <Calendar className="h-3.5 w-3.5" />
                    Agendar
                  </Button>
                  {currentPatient?.id && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1.5"
                      onClick={() => navigate(`/patients/${currentPatient.id}/record`)}
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Prontuário
                    </Button>
                  )}
                  {currentSession?.phone && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1.5 text-green-700 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-950"
                      onClick={() => handleOpenWhatsApp(currentSession.phone)}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      WhatsApp Web
                    </Button>
                  )}
                  {currentOpportunity && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1.5 text-violet-700 border-violet-300 hover:bg-violet-50 dark:text-violet-400 dark:border-violet-800 dark:hover:bg-violet-950"
                      onClick={() => navigate("/crm")}
                    >
                      <TrendingUp className="h-3.5 w-3.5" />
                      Ver no CRM
                    </Button>
                  )}
                </div>

                {/* Layout de mensagens + sidebar de informações */}
                <div className="flex flex-1 overflow-hidden">
                  {/* Mensagens */}
                  <div className="flex flex-col flex-1 min-w-0">
                    <ScrollArea className="flex-1 p-4">
                      {sessionLoading ? (
                        <div className="flex items-center justify-center h-full">
                          <Loader2 className="h-8 w-8 animate-spin" />
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {sessionDetail?.data?.messages?.map((message) => (
                            <div
                              key={message.id}
                              className={cn(
                                "flex gap-3",
                                message.role === "user" ? "justify-start" : "justify-end"
                              )}
                            >
                              {message.role === "user" && renderSenderIcon(message.role)}
                              <div
                                className={cn(
                                  "max-w-[70%] rounded-lg p-3",
                                  message.role === "user"
                                    ? "bg-muted"
                                    : message.role === "system"
                                    ? "bg-muted/50 text-muted-foreground italic text-sm"
                                    : message.processedBy === "human"
                                    ? "bg-emerald-500/20 text-foreground"
                                    : "bg-blue-600 text-white"
                                )}
                              >
                                <p className="whitespace-pre-wrap">{message.content}</p>
                                <div
                                  className={cn(
                                    "flex items-center gap-2 mt-1 text-xs",
                                    message.role === "user"
                                      ? "text-muted-foreground"
                                      : message.role === "system"
                                      ? "text-muted-foreground"
                                      : message.processedBy === "human"
                                      ? "text-emerald-700 dark:text-emerald-400"
                                      : "text-blue-100"
                                  )}
                                >
                                  <Clock className="h-3 w-3" />
                                  {format(new Date(message.createdAt), "HH:mm", { locale: ptBR })}
                                  {message.processedBy && message.role !== "user" && message.role !== "system" && (
                                    <span className="opacity-80">
                                      {message.processedBy === "human" ? "(Secretária)" : "(IA)"}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {message.role !== "user" && renderSenderIcon(message.role, message.processedBy)}
                            </div>
                          ))}
                          <div ref={messagesEndRef} />
                        </div>
                      )}
                    </ScrollArea>

                    {/* Respostas rápidas */}
                    {quickRepliesData?.data && quickRepliesData.data.length > 0 && (
                      <div className="p-2 border-t">
                        <ScrollArea className="whitespace-nowrap">
                          <div className="flex gap-2">
                            {quickRepliesData.data.map((reply) => (
                              <Button
                                key={reply.id}
                                variant="outline"
                                size="sm"
                                onClick={() => handleQuickReply(reply)}
                                className="flex-shrink-0"
                              >
                                <Zap className="h-3 w-3 mr-1" />
                                {reply.label}
                              </Button>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    )}

                    {/* Input de mensagem */}
                    <div className="p-4 border-t">
                      <div className="flex gap-2">
                        <Input
                          placeholder="Digite sua mensagem..."
                          value={messageInput}
                          onChange={(e) => setMessageInput(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleSendMessage();
                            }
                          }}
                          disabled={sendMessageMutation.isPending}
                        />
                        <Button
                          onClick={handleSendMessage}
                          disabled={!messageInput.trim() || sendMessageMutation.isPending}
                        >
                          {sendMessageMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Ao enviar uma mensagem, você assume o atendimento automaticamente (IA para de responder por 30 min)
                      </p>
                    </div>
                  </div>

                  {/* Sidebar de informações do paciente */}
                  <div className="w-64 border-l flex flex-col overflow-y-auto shrink-0 hidden lg:flex">
                    <div className="p-3 border-b bg-muted/20">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        Informações
                      </h3>
                    </div>

                    {/* Card do paciente */}
                    <div className="p-3">
                      {sessionLoading ? (
                        <div className="flex justify-center py-4">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : currentPatient ? (
                        <Card className="border-border/60">
                          <CardHeader className="p-3 pb-2">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-9 w-9">
                                <AvatarFallback className="bg-primary/10 text-primary text-sm">
                                  {currentPatient.fullName[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <CardTitle className="text-sm leading-tight truncate">
                                  {currentPatient.fullName}
                                </CardTitle>
                                <p className="text-xs text-muted-foreground mt-0.5">Paciente</p>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="p-3 pt-0 space-y-2">
                            {currentPatient.phone && (
                              <div className="flex items-center gap-2 text-xs">
                                <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <span className="truncate">{currentPatient.phone}</span>
                              </div>
                            )}
                            {currentPatient.lastVisit && (
                              <div className="flex items-center gap-2 text-xs">
                                <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <span>
                                  Última visita:{" "}
                                  {format(new Date(currentPatient.lastVisit), "dd/MM/yyyy", { locale: ptBR })}
                                </span>
                              </div>
                            )}
                            {typeof currentPatient.appointmentCount === "number" && (
                              <div className="flex items-center gap-2 text-xs">
                                <Activity className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <span>
                                  {currentPatient.appointmentCount}{" "}
                                  {currentPatient.appointmentCount === 1 ? "consulta" : "consultas"}
                                </span>
                              </div>
                            )}
                            <Separator className="my-2" />
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full h-7 text-xs"
                              onClick={() => navigate(`/patients/${currentPatient.id}/record`)}
                            >
                              <FileText className="h-3.5 w-3.5 mr-1.5" />
                              Ver prontuário completo
                            </Button>
                          </CardContent>
                        </Card>
                      ) : (
                        <div className="text-center text-xs text-muted-foreground py-4 space-y-1">
                          <User className="h-8 w-8 mx-auto opacity-30 mb-2" />
                          <p>Nenhum paciente vinculado</p>
                          <p className="text-[11px]">
                            Este contato ainda não está associado a um paciente
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Card de CRM se houver oportunidade */}
                    {currentOpportunity && (
                      <div className="p-3 pt-0">
                        <Card className="border-violet-200 dark:border-violet-900 bg-violet-50/50 dark:bg-violet-950/20">
                          <CardHeader className="p-3 pb-2">
                            <CardTitle className="text-xs flex items-center gap-1.5 text-violet-700 dark:text-violet-400">
                              <TrendingUp className="h-3.5 w-3.5" />
                              Pipeline CRM
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="p-3 pt-0 space-y-2">
                            <div className="text-xs space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Estágio:</span>
                                <span className="font-medium">
                                  {currentCrmStageName || "—"}
                                </span>
                              </div>
                              {currentOpportunity.aiStage && (
                                <div className="flex items-center justify-between">
                                  <span className="text-muted-foreground">Fase IA:</span>
                                  <span className="font-medium">
                                    {AI_STAGE_LABELS[currentOpportunity.aiStage] ?? currentOpportunity.aiStage}
                                  </span>
                                </div>
                              )}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full h-7 text-xs border-violet-300 text-violet-700 hover:bg-violet-100 dark:border-violet-800 dark:text-violet-400 dark:hover:bg-violet-950"
                              onClick={() => navigate("/crm")}
                            >
                              <TrendingUp className="h-3.5 w-3.5 mr-1.5" />
                              Abrir no CRM
                            </Button>
                          </CardContent>
                        </Card>
                      </div>
                    )}

                    {/* Sessão info */}
                    <div className="p-3 pt-0">
                      <Card className="border-border/60">
                        <CardHeader className="p-3 pb-2">
                          <CardTitle className="text-xs text-muted-foreground">Sessão</CardTitle>
                        </CardHeader>
                        <CardContent className="p-3 pt-0 space-y-1.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Status:</span>
                            {currentSession?.status && renderStatusBadge(currentSession.status)}
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Início:</span>
                            <span>
                              {currentSession?.createdAt
                                ? format(new Date(currentSession.createdAt), "dd/MM HH:mm", { locale: ptBR })
                                : "—"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Última msg:</span>
                            <span>
                              {currentSession?.lastMessageAt
                                ? formatDistanceToNow(new Date(currentSession.lastMessageAt), {
                                    addSuffix: true,
                                    locale: ptBR,
                                  })
                                : "—"}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                <MessageCircle className="h-16 w-16 mb-4 opacity-50" />
                <h2 className="text-xl font-medium mb-2">Selecione uma conversa</h2>
                <p className="text-sm">Clique em uma conversa para iniciar o atendimento</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
