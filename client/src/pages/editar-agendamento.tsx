import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import DashboardLayout from "@/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Calendar, Clock, User, MapPin, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const appointmentSchema = z.object({
  title: z.string().min(1, "Título é obrigatório"),
  patientId: z.number().optional(),
  professionalId: z.number().optional(),
  roomId: z.number().optional(),
  startTime: z.string().min(1, "Data e hora de início são obrigatórias"),
  endTime: z.string().min(1, "Data e hora de fim são obrigatórias"),
  status: z.string().default("scheduled"),
  type: z.string().default("appointment"),
  notes: z.string().optional(),
  color: z.string().optional(),
});

type AppointmentForm = z.infer<typeof appointmentSchema>;

export default function EditarAgendamento() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/agenda/:id/editar");
  const appointmentId = params?.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<AppointmentForm>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      title: "",
      status: "scheduled",
      type: "appointment",
      notes: "",
      color: "#3B82F6",
    },
  });

  // Fetch appointment details
  const { data: appointment, isLoading: loadingAppointment } = useQuery({
    queryKey: ["/api/appointments", appointmentId],
    enabled: !!appointmentId,
  });

  // Fetch patients, professionals, and rooms
  const { data: patients = [] } = useQuery({
    queryKey: ["/api/patients"],
  });

  const { data: professionals = [] } = useQuery({
    queryKey: ["/api/professionals"],
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ["/api/rooms"],
  });

  // Update form when appointment data is loaded
  useEffect(() => {
    if (appointment) {
      const appointmentData = appointment as any;
      const startTime = new Date(appointmentData.startTime);
      const endTime = new Date(appointmentData.endTime);
      
      form.reset({
        title: appointmentData.title,
        patientId: appointmentData.patientId,
        professionalId: appointmentData.professionalId,
        roomId: appointmentData.roomId,
        startTime: startTime.toISOString().slice(0, 16),
        endTime: endTime.toISOString().slice(0, 16),
        status: appointmentData.status,
        type: appointmentData.type,
        notes: appointmentData.notes || "",
        color: appointmentData.color || "#3B82F6",
      });
    }
  }, [appointment, form]);

  const updateAppointment = useMutation({
    mutationFn: async (data: AppointmentForm) => {
      const response = await fetch(`/api/appointments/${appointmentId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          startTime: new Date(data.startTime).toISOString(),
          endTime: new Date(data.endTime).toISOString(),
        }),
      });
      
      if (!response.ok) {
        throw new Error("Erro ao atualizar agendamento");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Agendamento atualizado com sucesso!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      setLocation("/agenda");
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar agendamento",
        variant: "destructive",
      });
    },
  });

  const deleteAppointment = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/appointments/${appointmentId}`, {
        method: "DELETE",
      });
      
      if (!response.ok) {
        throw new Error("Erro ao excluir agendamento");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Agendamento excluído com sucesso!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      setLocation("/agenda");
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir agendamento",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: AppointmentForm) => {
    updateAppointment.mutate(data);
  };

  const handleDelete = () => {
    deleteAppointment.mutate();
  };

  if (loadingAppointment) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/agenda")}
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <h1 className="text-2xl font-bold">Carregando...</h1>
        </div>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/agenda")}
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <h1 className="text-2xl font-bold">Agendamento não encontrado</h1>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout title={`Editar Agendamento #${appointmentId}`} currentPath="/agenda">
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/agenda")}
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            <h1 className="text-2xl font-bold">Editar Agendamento #{appointmentId}</h1>
          </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir este agendamento? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteAppointment.isPending ? "Excluindo..." : "Excluir"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Editar Agendamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Título do Agendamento</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Consulta de rotina" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="patientId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Paciente</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(value ? parseInt(value) : undefined)}
                        value={field.value?.toString()}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um paciente" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(patients as any[]).map((patient: any) => (
                            <SelectItem key={patient.id} value={patient.id.toString()}>
                              {patient.fullName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="professionalId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Profissional</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(value ? parseInt(value) : undefined)}
                        value={field.value?.toString()}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um profissional" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(professionals as any[]).map((professional: any) => (
                            <SelectItem key={professional.id} value={professional.id.toString()}>
                              {professional.fullName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="roomId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sala</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(value ? parseInt(value) : undefined)}
                        value={field.value?.toString()}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione uma sala" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(rooms as any[]).map((room: any) => (
                            <SelectItem key={room.id} value={room.id.toString()}>
                              {room.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="startTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data e Hora de Início</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data e Hora de Fim</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="scheduled">Agendado</SelectItem>
                          <SelectItem value="confirmed">Confirmado</SelectItem>
                          <SelectItem value="in_progress">Em Andamento</SelectItem>
                          <SelectItem value="completed">Concluído</SelectItem>
                          <SelectItem value="cancelled">Cancelado</SelectItem>
                          <SelectItem value="no_show">Não Compareceu</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cor</FormLabel>
                      <FormControl>
                        <Input
                          type="color"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Observações adicionais sobre o agendamento..."
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLocation("/agenda")}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={updateAppointment.isPending}
                >
                  {updateAppointment.isPending ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
    </DashboardLayout>
  );
}