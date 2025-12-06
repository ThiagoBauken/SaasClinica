/**
 * Chat Inbox - Atendimento da Secretária
 * Interface para gerenciar conversas de WhatsApp
 */

import { useState, useEffect, useRef } from "react";
import DashboardLayout from "@/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
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

interface SessionDetailResponse {
  success: boolean;
  data: {
    session: ChatSession;
    messages: ChatMessage[];
    patient?: any;
  };
}

export default function ChatInboxPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
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
    refetchInterval: 5000, // Auto-refresh a cada 5 segundos
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
    refetchInterval: 3000, // Atualizar mensagens a cada 3s
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

  // Renderizar status badge
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30">
            <Bot className="w-3 h-3 mr-1" />
            IA
          </Badge>
        );
      case "waiting_human":
        return (
          <Badge variant="outline" className="bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30">
            <UserCheck className="w-3 h-3 mr-1" />
            Humano
          </Badge>
        );
      case "closed":
        return (
          <Badge variant="outline" className="bg-muted text-muted-foreground border-border">
            <XCircle className="w-3 h-3 mr-1" />
            Fechada
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
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
        <Avatar className="h-8 w-8 bg-orange-500/20">
          <AvatarFallback className="text-orange-600 dark:text-orange-400 bg-transparent">
            <UserCheck className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      );
    }
    return (
      <Avatar className="h-8 w-8 bg-green-500/20">
        <AvatarFallback className="text-green-600 dark:text-green-400 bg-transparent">
          <Bot className="h-4 w-4" />
        </AvatarFallback>
      </Avatar>
    );
  };

  return (
    <DashboardLayout title="Atendimento WhatsApp" currentPath="/atendimento">
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold">Atendimento WhatsApp</h1>
          </div>
          <div className="flex items-center gap-2">
            {sessionsData?.counts && (
              <div className="flex gap-2 text-sm">
                <Badge variant="secondary">
                  {sessionsData.counts.active} ativas
                </Badge>
                <Badge variant="outline" className="bg-orange-500/10 text-orange-600 dark:text-orange-400">
                  {sessionsData.counts.waitingHuman} aguardando
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
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : filteredSessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
                  <MessageCircle className="h-12 w-12 mb-2 opacity-50" />
                  <p>Nenhuma conversa encontrada</p>
                </div>
              ) : (
                <div className="divide-y">
                  {filteredSessions.map((session) => (
                    <button
                      key={session.id}
                      onClick={() => setSelectedSessionId(session.id)}
                      className={cn(
                        "w-full p-3 text-left hover:bg-muted/50 transition-colors",
                        selectedSessionId === session.id && "bg-muted",
                        session.needsAttention && "bg-orange-500/10"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {session.patientName?.[0] || <User className="h-5 w-5" />}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium truncate">
                              {session.patientName || session.phone}
                            </span>
                            {session.unreadCount > 0 && (
                              <Badge className="bg-primary text-primary-foreground ml-2">
                                {session.unreadCount}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mb-1">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">{session.phone}</span>
                          </div>
                          {session.lastMessage && (
                            <p className="text-sm text-muted-foreground truncate">
                              {session.lastMessage.role === "user" ? "" : "Você: "}
                              {session.lastMessage.content}
                            </p>
                          )}
                          <div className="flex items-center justify-between mt-1">
                            {renderStatusBadge(session.status)}
                            <span className="text-xs text-muted-foreground">
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
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Área de conversa */}
          <div className="flex-1 flex flex-col">
            {selectedSessionId ? (
              <>
                {/* Header da conversa */}
                <div className="p-4 border-b flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="md:hidden"
                      onClick={() => setSelectedSessionId(null)}
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {sessionDetail?.data?.patient?.fullName?.[0] || <User className="h-5 w-5" />}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h2 className="font-semibold">
                        {sessionDetail?.data?.patient?.fullName ||
                          sessionDetail?.data?.session?.phone}
                      </h2>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {sessionDetail?.data?.session?.phone}
                        {renderStatusBadge(sessionDetail?.data?.session?.status || "")}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {sessionDetail?.data?.session?.status === "active" && (
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
                    {sessionDetail?.data?.session?.status === "waiting_human" && (
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

                {/* Mensagens */}
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
                                ? "bg-orange-500/20 text-foreground"
                                : "bg-primary text-primary-foreground"
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
                                  ? "text-orange-600 dark:text-orange-400"
                                  : "text-primary-foreground/70"
                              )}
                            >
                              <Clock className="h-3 w-3" />
                              {format(new Date(message.createdAt), "HH:mm", { locale: ptBR })}
                              {message.processedBy && message.role !== "user" && message.role !== "system" && (
                                <span className="opacity-70">
                                  {message.processedBy === "human" ? "(Secretária)" : `(${message.processedBy})`}
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
