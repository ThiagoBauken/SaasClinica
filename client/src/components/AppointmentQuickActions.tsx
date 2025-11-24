import { Button } from "@/components/ui/button";
import { Phone, MessageCircle, FileText, Check, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";

interface AppointmentQuickActionsProps {
  appointmentId: number;
  patientPhone?: string;
  patientId: number;
  currentStatus: string;
  onStatusChange?: (newStatus: string) => void;
}

export default function AppointmentQuickActions({
  appointmentId,
  patientPhone,
  patientId,
  currentStatus,
  onStatusChange,
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

  return (
    <div className="flex gap-1">
      {/* WhatsApp */}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
        onClick={handleWhatsApp}
        title="Enviar WhatsApp"
      >
        <MessageCircle className="h-3.5 w-3.5" />
      </Button>

      {/* Ligar */}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
        onClick={handleCall}
        title="Ligar"
      >
        <Phone className="h-3.5 w-3.5" />
      </Button>

      {/* Ver Prontuário */}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
        onClick={handleViewRecord}
        title="Ver Prontuário"
      >
        <FileText className="h-3.5 w-3.5" />
      </Button>

      {/* Confirmar Presença / Avançar Status */}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
        onClick={handleConfirmPresence}
        title={
          currentStatus === "scheduled" ? "Confirmar" :
          currentStatus === "confirmed" ? "Iniciar Atendimento" :
          currentStatus === "in_progress" ? "Concluir" :
          "Sem ação"
        }
        disabled={updateStatusMutation.isPending || currentStatus === "completed"}
      >
        {currentStatus === "scheduled" && <Check className="h-3.5 w-3.5" />}
        {currentStatus === "confirmed" && <Calendar className="h-3.5 w-3.5" />}
        {currentStatus === "in_progress" && <Check className="h-3.5 w-3.5" />}
        {(currentStatus === "completed" || currentStatus === "cancelled" || currentStatus === "no_show") && <Check className="h-3.5 w-3.5 opacity-50" />}
      </Button>
    </div>
  );
}
