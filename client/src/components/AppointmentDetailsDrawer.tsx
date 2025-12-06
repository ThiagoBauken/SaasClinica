import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import PaymentStatusBadge, { PaymentStatus } from "@/components/PaymentStatusBadge";
import {
  Calendar,
  Clock,
  User,
  Stethoscope,
  MapPin,
  Phone,
  MessageCircle,
  FileText,
  Edit,
  Trash2,
  CheckCircle,
  X,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface Appointment {
  id: number;
  date: Date;
  startTime: string;
  endTime: string;
  patientName: string;
  patientPhone?: string;
  professionalName: string;
  procedure: string;
  room?: string;
  status: string;
  notes?: string;
  paymentStatus?: PaymentStatus;
  paymentAmount?: number;
  paidAmount?: number;
}

interface AppointmentDetailsDrawerProps {
  appointment: Appointment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (appointment: Appointment) => void;
  onDelete?: (appointmentId: number) => void;
  onConfirm?: (appointmentId: number) => void;
  onWhatsApp?: (phone: string) => void;
  onViewRecord?: (appointmentId: number) => void;
}

export default function AppointmentDetailsDrawer({
  appointment,
  open,
  onOpenChange,
  onEdit,
  onDelete,
  onConfirm,
  onWhatsApp,
  onViewRecord,
}: AppointmentDetailsDrawerProps) {
  if (!appointment) return null;

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'confirmado':
        return { label: 'Confirmado', color: 'bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30' };
      case 'agendado':
        return { label: 'Agendado', color: 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30' };
      case 'cancelado':
        return { label: 'Cancelado', color: 'bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30' };
      case 'concluido':
        return { label: 'Concluído', color: 'bg-muted text-muted-foreground border-border' };
      default:
        return { label: 'Agendado', color: 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30' };
    }
  };

  const statusConfig = getStatusConfig(appointment.status);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DrawerTitle className="text-xl">Detalhes do Agendamento</DrawerTitle>
              <DrawerDescription className="mt-1">
                {format(new Date(appointment.date), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </DrawerDescription>
            </div>
            <Badge variant="outline" className={statusConfig.color}>
              {statusConfig.label}
            </Badge>
          </div>
        </DrawerHeader>

        <div className="overflow-y-auto px-4 pb-4">
          {/* Informações do Paciente */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Paciente</p>
                <p className="font-semibold">{appointment.patientName}</p>
              </div>
            </div>

            {appointment.patientPhone && (
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Phone className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Telefone</p>
                  <p className="font-medium">{appointment.patientPhone}</p>
                </div>
              </div>
            )}

            <Separator />

            {/* Horário */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Horário</p>
                <p className="font-semibold">
                  {appointment.startTime} - {appointment.endTime}
                </p>
              </div>
            </div>

            {/* Profissional */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Stethoscope className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Profissional</p>
                <p className="font-medium">{appointment.professionalName}</p>
              </div>
            </div>

            {/* Procedimento */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Procedimento</p>
                <p className="font-medium">{appointment.procedure}</p>
              </div>
            </div>

            {/* Sala */}
            {appointment.room && (
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <MapPin className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Sala</p>
                  <p className="font-medium">{appointment.room}</p>
                </div>
              </div>
            )}

            {/* Status de Pagamento */}
            {appointment.paymentStatus && appointment.paymentStatus !== 'not_required' && (
              <>
                <Separator />
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Status de Pagamento</p>
                  <PaymentStatusBadge
                    status={appointment.paymentStatus}
                    amount={appointment.paymentAmount}
                    paidAmount={appointment.paidAmount}
                    compact={false}
                  />
                </div>
              </>
            )}

            {/* Observações */}
            {appointment.notes && (
              <>
                <Separator />
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Observações</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{appointment.notes}</p>
                </div>
              </>
            )}
          </div>
        </div>

        <DrawerFooter className="pt-4">
          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            {appointment.patientPhone && onWhatsApp && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => onWhatsApp(appointment.patientPhone!)}
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                WhatsApp
              </Button>
            )}
            {onViewRecord && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => onViewRecord(appointment.id)}
              >
                <FileText className="h-4 w-4 mr-2" />
                Prontuário
              </Button>
            )}
          </div>

          {/* Main Actions */}
          <div className="grid grid-cols-3 gap-2">
            {onConfirm && appointment.status !== 'confirmado' && appointment.status !== 'concluido' && (
              <Button
                variant="default"
                size="sm"
                className="bg-green-600 hover:bg-green-700"
                onClick={() => {
                  onConfirm(appointment.id);
                  onOpenChange(false);
                }}
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Confirmar
              </Button>
            )}
            {onEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onEdit(appointment);
                  onOpenChange(false);
                }}
              >
                <Edit className="h-4 w-4 mr-1" />
                Editar
              </Button>
            )}
            {onDelete && (
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 dark:text-red-400 border-red-500/30 hover:bg-red-500/10"
                onClick={() => {
                  if (confirm('Tem certeza que deseja excluir este agendamento?')) {
                    onDelete(appointment.id);
                    onOpenChange(false);
                  }
                }}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Excluir
              </Button>
            )}
          </div>

          <DrawerClose asChild>
            <Button variant="outline" className="w-full">
              <X className="h-4 w-4 mr-2" />
              Fechar
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
