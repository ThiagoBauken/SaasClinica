import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/core/AuthProvider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Video, Plus, ExternalLink, Clock, User, Calendar, Loader2, Phone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import DashboardLayout from "@/layouts/DashboardLayout";

interface Teleconsultation {
  id: number;
  patient_name: string;
  professional_name: string;
  scheduled_at: string;
  status: string;
  jitsi_room_name: string;
  jitsi_url: string;
  notes?: string;
  started_at?: string;
  ended_at?: string;
}

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  scheduled: { label: "Agendada", variant: "secondary" },
  in_progress: { label: "Em andamento", variant: "default" },
  completed: { label: "Concluida", variant: "outline" },
  cancelled: { label: "Cancelada", variant: "destructive" },
};

export default function TeleconsultaPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newConsult, setNewConsult] = useState({ patientId: "", professionalId: "", scheduledAt: "", notes: "" });

  const { data: teleconsults = [], isLoading } = useQuery<Teleconsultation[]>({
    queryKey: ["/api/v1/teleconsultations"],
  });

  const { data: patients = [] } = useQuery<any[]>({ queryKey: ["/api/v1/patients?limit=200"] });
  const { data: professionals = [] } = useQuery<any[]>({ queryKey: ["/api/v1/professionals"] });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/v1/teleconsultations", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v1/teleconsultations"] });
      toast({ title: "Teleconsulta criada!" });
      setIsDialogOpen(false);
      setNewConsult({ patientId: "", professionalId: "", scheduledAt: "", notes: "" });
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const startMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/v1/teleconsultations/${id}/start`);
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/v1/teleconsultations"] }),
  });

  const endMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/v1/teleconsultations/${id}/end`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v1/teleconsultations"] });
      toast({ title: "Teleconsulta finalizada" });
    },
  });

  const handleCreate = () => {
    if (!newConsult.patientId || !newConsult.professionalId || !newConsult.scheduledAt) {
      toast({ title: "Preencha todos os campos obrigatorios", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      patientId: parseInt(newConsult.patientId),
      professionalId: parseInt(newConsult.professionalId),
      scheduledAt: new Date(newConsult.scheduledAt).toISOString(),
      notes: newConsult.notes,
    });
  };

  const handleJoin = (consult: Teleconsultation) => {
    if (consult.status === "scheduled") {
      startMutation.mutate(consult.id);
    }
    window.open(consult.jitsi_url, "_blank");
  };

  return (
    <DashboardLayout title="Teleconsulta" currentPath="/teleconsulta">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Teleconsultas</h2>
            <p className="text-muted-foreground">Consultas por video via Jitsi Meet</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Nova Teleconsulta</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Agendar Teleconsulta</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <Label>Paciente</Label>
                  <Select value={newConsult.patientId} onValueChange={(v) => setNewConsult(p => ({ ...p, patientId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione o paciente" /></SelectTrigger>
                    <SelectContent>
                      {(Array.isArray(patients) ? patients : []).map((p: any) => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.fullName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Profissional</Label>
                  <Select value={newConsult.professionalId} onValueChange={(v) => setNewConsult(p => ({ ...p, professionalId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione o profissional" /></SelectTrigger>
                    <SelectContent>
                      {(Array.isArray(professionals) ? professionals : []).map((p: any) => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.fullName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Data e Hora</Label>
                  <Input type="datetime-local" value={newConsult.scheduledAt} onChange={(e) => setNewConsult(p => ({ ...p, scheduledAt: e.target.value }))} />
                </div>
                <div>
                  <Label>Observacoes (opcional)</Label>
                  <Textarea value={newConsult.notes} onChange={(e) => setNewConsult(p => ({ ...p, notes: e.target.value }))} placeholder="Notas sobre a teleconsulta..." />
                </div>
                <Button onClick={handleCreate} disabled={createMutation.isPending} className="w-full">
                  {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Video className="mr-2 h-4 w-4" />}
                  Agendar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : (Array.isArray(teleconsults) ? teleconsults : []).length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Video className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">Nenhuma teleconsulta</p>
              <p className="text-muted-foreground">Agende a primeira teleconsulta clicando no botao acima</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {(Array.isArray(teleconsults) ? teleconsults : []).map((consult) => {
              const status = statusMap[consult.status] || statusMap.scheduled;
              const date = new Date(consult.scheduled_at);
              return (
                <Card key={consult.id}>
                  <CardContent className="flex items-center justify-between p-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-primary/10">
                        <Video className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{consult.patient_name}</p>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" /> {consult.professional_name}</span>
                          <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {date.toLocaleDateString("pt-BR")}</span>
                          <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                        {consult.notes && <p className="text-sm text-muted-foreground mt-1">{consult.notes}</p>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {(consult.status === "scheduled" || consult.status === "in_progress") && (
                        <Button onClick={() => handleJoin(consult)} variant={consult.status === "in_progress" ? "default" : "outline"}>
                          <ExternalLink className="mr-2 h-4 w-4" />
                          {consult.status === "in_progress" ? "Entrar na sala" : "Iniciar"}
                        </Button>
                      )}
                      {consult.status === "in_progress" && (
                        <Button variant="outline" onClick={() => endMutation.mutate(consult.id)}>
                          <Phone className="mr-2 h-4 w-4" /> Finalizar
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
