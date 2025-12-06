import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Phone, MessageCircle, FileText, Check, Calendar, Edit, Trash2, MoreVertical, UserCheck, UserX, XCircle, Clock, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";

interface AppointmentQuickActionsProps {
  appointmentId: number;
  patientPhone?: string;
  patientId: number;
  currentStatus: string;
  onStatusChange?: (newStatus: string) => void;
  onEdit?: (appointmentId: number) => void;
  onDelete?: (appointmentId: number) => void;
}

export default function AppointmentQuickActions({
  appointmentId,
  patientPhone,
  patientId,
  currentStatus,
  onStatusChange,
  onEdit,
  onDelete,
}: AppointmentQuickActionsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Mutation para atualizar status
  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const response = await fetch(`/api/v1/appointments/${appointmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!response.ok) throw new Error("Erro ao atualizar status");
      return response.json();
    },
    onSuccess: (data, newStatus) => {
      queryClient.invalidateQueries({ queryKey: ["/api/v1/appointments"] });
      toast({
        title: "Status atualizado",
        description: `Agendamento marcado como ${getStatusLabel(newStatus)}`,
      });
      onStatusChange?.(newStatus);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status",
        variant: "destructive",
      });
    },
  });

  // Mutation para criar/buscar sessão de chat (WuzAPI)
  const openChatMutation = useMutation({
    mutationFn: async (phone: string) => {
      const response = await fetch("/api/v1/chat/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phone }),
      });
      if (!response.ok) throw new Error("Erro ao abrir chat");
      return response.json();
    },
    onSuccess: (data) => {
      // Redireciona para o chat inbox com a sessão aberta
      const sessionId = data.data?.id;
      if (sessionId) {
        setLocation(`/chat-inbox?session=${sessionId}`);
      } else {
        setLocation("/chat-inbox");
      }
      toast({
        title: "Atendimento aberto",
        description: "Abrindo conversa no painel de atendimento",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível abrir o atendimento. Verifique se o WhatsApp está configurado.",
        variant: "destructive",
      });
    },
  });

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      scheduled: "Agendado",
      confirmed: "Confirmado",
      in_progress: "Em Andamento",
      completed: "Concluído",
      cancelled: "Cancelado",
      no_show: "Faltou",
    };
    return labels[status] || status;
  };

  const handleWhatsApp = () => {
    if (!patientPhone) {
      toast({
        title: "Telefone não disponível",
        description: "O paciente não tem número de telefone cadastrado",
        variant: "destructive",
      });
      return;
    }

    // Remove caracteres não numéricos
    const cleanPhone = patientPhone.replace(/\D/g, "");

    // Formata com código do Brasil se necessário
    const formattedPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;

    const message = encodeURIComponent("Olá! Estamos entrando em contato sobre seu agendamento na clínica.");
    const whatsappUrl = `https://wa.me/${formattedPhone}?text=${message}`;

    window.open(whatsappUrl, "_blank");

    toast({
      title: "WhatsApp aberto",
      description: "Abrindo conversa com o paciente",
    });
  };

  const handleCall = () => {
    if (!patientPhone) {
      toast({
        title: "Telefone não disponível",
        description: "O paciente não tem número de telefone cadastrado",
        variant: "destructive",
      });
      return;
    }

    // Abre o discador do sistema
    window.location.href = `tel:${patientPhone}`;

    toast({
      title: "Ligação iniciada",
      description: `Ligando para ${patientPhone}`,
    });
  };

  const handleViewRecord = () => {
    setLocation(`/patients/${patientId}/record`);
    toast({
      title: "Prontuário",
      description: "Abrindo prontuário do paciente",
    });
  };

  // Abrir atendimento no chat inbox (WuzAPI)
  const handleOpenChatInbox = () => {
    if (!patientPhone) {
      toast({
        title: "Telefone não disponível",
        description: "O paciente não tem número de telefone cadastrado",
        variant: "destructive",
      });
      return;
    }

    // Remove caracteres não numéricos e formata o telefone
    const cleanPhone = patientPhone.replace(/\D/g, "");
    const formattedPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;

    openChatMutation.mutate(formattedPhone);
  };

  const handleConfirmPresence = () => {
    const nextStatus = currentStatus === "scheduled" ? "confirmed" :
                       currentStatus === "confirmed" ? "in_progress" :
                       currentStatus === "in_progress" ? "completed" :
                       currentStatus;

    if (nextStatus !== currentStatus) {
      updateStatusMutation.mutate(nextStatus);
    } else {
      toast({
        title: "Sem ação disponível",
        description: "O agendamento já está no estado final",
      });
    }
  };

  // Marcar como compareceu (concluído)
  const handleMarkAttended = () => {
    updateStatusMutation.mutate("completed");
  };

  // Marcar como não compareceu
  const handleMarkNoShow = () => {
    updateStatusMutation.mutate("no_show");
  };

  // Cancelar agendamento
  const handleCancel = () => {
    updateStatusMutation.mutate("cancelled");
  };

  // Marcar como em andamento
  const handleMarkInProgress = () => {
    updateStatusMutation.mutate("in_progress");
  };

  // Verificar se pode mostrar opções de comparecimento
  const canShowAttendanceOptions = currentStatus === "scheduled" || currentStatus === "confirmed";
  const isFinalized = currentStatus === "completed" || currentStatus === "cancelled" || currentStatus === "no_show";

  return (
    <div className="flex gap-1">
      {/* Atendimento Chat Inbox (WuzAPI) */}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950"
        onClick={handleOpenChatInbox}
        title="Abrir Atendimento (Chat)"
        disabled={openChatMutation.isPending}
      >
        <MessageSquare className="h-3.5 w-3.5" />
      </Button>

      {/* WhatsApp Externo */}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950"
        onClick={handleWhatsApp}
        title="WhatsApp Externo"
      >
        <MessageCircle className="h-3.5 w-3.5" />
      </Button>

      {/* Ligar */}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950"
        onClick={handleCall}
        title="Ligar"
      >
        <Phone className="h-3.5 w-3.5" />
      </Button>

      {/* Ver Prontuário */}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950"
        onClick={handleViewRecord}
        title="Ver Prontuário"
      >
        <FileText className="h-3.5 w-3.5" />
      </Button>

      {/* Confirmar Presença / Avançar Status */}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950"
        onClick={handleConfirmPresence}
        title={
          currentStatus === "scheduled" ? "Confirmar" :
          currentStatus === "confirmed" ? "Iniciar Atendimento" :
          currentStatus === "in_progress" ? "Concluir" :
          "Sem ação"
        }
        disabled={updateStatusMutation.isPending || isFinalized}
      >
        {currentStatus === "scheduled" && <Check className="h-3.5 w-3.5" />}
        {currentStatus === "confirmed" && <Calendar className="h-3.5 w-3.5" />}
        {currentStatus === "in_progress" && <Check className="h-3.5 w-3.5" />}
        {isFinalized && <Check className="h-3.5 w-3.5 opacity-50" />}
      </Button>

      {/* Editar */}
      {onEdit && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950"
          onClick={() => onEdit(appointmentId)}
          title="Editar Agendamento"
        >
          <Edit className="h-3.5 w-3.5" />
        </Button>
      )}

      {/* Deletar */}
      {onDelete && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
          onClick={() => onDelete(appointmentId)}
          title="Deletar Agendamento"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}

      {/* Menu de Comparecimento - Ações da Secretaria */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted"
            title="Mais opções"
            disabled={updateStatusMutation.isPending}
          >
            <MoreVertical className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {/* Opções de status para agendamentos não finalizados */}
          {!isFinalized && (
            <>
              {currentStatus === "scheduled" && (
                <DropdownMenuItem onClick={() => updateStatusMutation.mutate("confirmed")}>
                  <Check className="h-4 w-4 mr-2 text-blue-600" />
                  <span>Confirmar Agendamento</span>
                </DropdownMenuItem>
              )}

              {(currentStatus === "scheduled" || currentStatus === "confirmed") && (
                <DropdownMenuItem onClick={handleMarkInProgress}>
                  <Clock className="h-4 w-4 mr-2 text-orange-600" />
                  <span>Iniciar Atendimento</span>
                </DropdownMenuItem>
              )}

              {currentStatus === "in_progress" && (
                <DropdownMenuItem onClick={handleMarkAttended}>
                  <UserCheck className="h-4 w-4 mr-2 text-green-600" />
                  <span>Finalizar Atendimento</span>
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator />

              {/* Opções de comparecimento - principais para secretaria */}
              {canShowAttendanceOptions && (
                <>
                  <DropdownMenuItem onClick={handleMarkAttended} className="text-green-600 dark:text-green-400">
                    <UserCheck className="h-4 w-4 mr-2" />
                    <span>Compareceu ✓</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem onClick={handleMarkNoShow} className="text-amber-600 dark:text-amber-400">
                    <UserX className="h-4 w-4 mr-2" />
                    <span>Não Compareceu</span>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />
                </>
              )}

              <DropdownMenuItem onClick={handleCancel} className="text-red-600 dark:text-red-400">
                <XCircle className="h-4 w-4 mr-2" />
                <span>Cancelar Agendamento</span>
              </DropdownMenuItem>
            </>
          )}

          {/* Para agendamentos já finalizados, mostrar opção de reabrir */}
          {isFinalized && (
            <>
              <DropdownMenuItem
                onClick={() => updateStatusMutation.mutate("scheduled")}
                className="text-blue-600 dark:text-blue-400"
              >
                <Calendar className="h-4 w-4 mr-2" />
                <span>Reagendar (voltar para agendado)</span>
              </DropdownMenuItem>

              {currentStatus !== "completed" && (
                <DropdownMenuItem onClick={handleMarkAttended} className="text-green-600 dark:text-green-400">
                  <UserCheck className="h-4 w-4 mr-2" />
                  <span>Marcar como Compareceu</span>
                </DropdownMenuItem>
              )}

              {currentStatus !== "no_show" && (
                <DropdownMenuItem onClick={handleMarkNoShow} className="text-amber-600 dark:text-amber-400">
                  <UserX className="h-4 w-4 mr-2" />
                  <span>Marcar como Não Compareceu</span>
                </DropdownMenuItem>
              )}

              {currentStatus !== "cancelled" && (
                <DropdownMenuItem onClick={handleCancel} className="text-red-600 dark:text-red-400">
                  <XCircle className="h-4 w-4 mr-2" />
                  <span>Cancelar</span>
                </DropdownMenuItem>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
