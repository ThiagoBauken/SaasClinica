import { useState } from "react";
import { useLocation } from "wouter";
import DashboardLayout from "@/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Plus,
  Search,
  Loader2,
  Trash2,
  CalendarPlus,
  InboxIcon,
  Clock,
  User,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type WaitlistPriority = "low" | "normal" | "high" | "urgent";
type WaitlistStatus = "waiting" | "scheduled" | "cancelled";

interface WaitlistEntry {
  id: number;
  patientId: number;
  patientName: string;
  professionalId: number | null;
  professionalName: string | null;
  procedure: string | null;
  preferredDate: string | null;
  preferredTime: string | null;
  priority: WaitlistPriority;
  status: WaitlistStatus;
  notes: string | null;
  createdAt: string;
}

interface Professional {
  id: number;
  name: string;
}

interface Patient {
  id: number;
  fullName: string;
}

interface WaitlistForm {
  patientId: string;
  professionalId: string;
  procedure: string;
  preferredDate: string;
  preferredTime: string;
  priority: WaitlistPriority;
  notes: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRIORITIES: { value: WaitlistPriority; label: string; className: string }[] = [
  { value: "low", label: "Baixa", className: "bg-gray-100 text-gray-700 border-gray-200" },
  { value: "normal", label: "Normal", className: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "high", label: "Alta", className: "bg-orange-100 text-orange-700 border-orange-200" },
  { value: "urgent", label: "Urgente", className: "bg-red-100 text-red-700 border-red-200" },
];

const EMPTY_FORM: WaitlistForm = {
  patientId: "",
  professionalId: "all",
  procedure: "",
  preferredDate: "",
  preferredTime: "",
  priority: "normal",
  notes: "",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string): string {
  try {
    return format(new Date(dateStr), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return dateStr;
  }
}

function PriorityBadge({ priority }: { priority: WaitlistPriority }) {
  const p = PRIORITIES.find((x) => x.value === priority);
  return (
    <Badge variant="outline" className={p?.className ?? ""}>
      {p?.label ?? priority}
    </Badge>
  );
}

function StatusBadge({ status }: { status: WaitlistStatus }) {
  const map: Record<WaitlistStatus, { label: string; className: string }> = {
    waiting: { label: "Aguardando", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
    scheduled: { label: "Agendado", className: "bg-green-100 text-green-800 border-green-200" },
    cancelled: { label: "Cancelado", className: "bg-gray-100 text-gray-600 border-gray-200" },
  };
  const s = map[status];
  return (
    <Badge variant="outline" className={s.className}>
      {s.label}
    </Badge>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
      <InboxIcon className="h-12 w-12 opacity-30" />
      <p className="text-sm">Lista de espera vazia</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function WaitlistPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [professionalFilter, setProfessionalFilter] = useState<string>("all");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [form, setForm] = useState<WaitlistForm>(EMPTY_FORM);
  const [removeId, setRemoveId] = useState<number | null>(null);

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  const { data: waitlist = [], isLoading } = useQuery<WaitlistEntry[]>({
    queryKey: ["/api/v1/recall/waitlist", priorityFilter, professionalFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (priorityFilter !== "all") params.set("priority", priorityFilter);
      if (professionalFilter !== "all") params.set("professionalId", professionalFilter);
      const qs = params.toString();
      const res = await fetch(
        `/api/v1/recall/waitlist${qs ? `?${qs}` : ""}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Falha ao buscar lista de espera");
      return res.json();
    },
  });

  const { data: professionals = [] } = useQuery<Professional[]>({
    queryKey: ["/api/v1/professionals"],
    queryFn: async () => {
      const res = await fetch("/api/v1/professionals", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: patients = [] } = useQuery<Patient[]>({
    queryKey: ["/api/v1/patients/search"],
    queryFn: async () => {
      const res = await fetch("/api/v1/patients?limit=200", { credentials: "include" });
      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json) ? json : json.patients ?? [];
    },
  });

  // -------------------------------------------------------------------------
  // Filtered list
  // -------------------------------------------------------------------------

  const filtered = waitlist.filter((w) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      w.patientName.toLowerCase().includes(q) ||
      (w.professionalName ?? "").toLowerCase().includes(q) ||
      (w.procedure ?? "").toLowerCase().includes(q)
    );
  });

  // -------------------------------------------------------------------------
  // Mutations
  // -------------------------------------------------------------------------

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/v1/recall/waitlist"] });

  const addMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("POST", "/api/v1/recall/waitlist", data);
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Adicionado", description: "Paciente adicionado a lista de espera." });
      handleCloseDialog();
    },
    onError: (err: Error) =>
      toast({ title: "Erro ao adicionar", description: err.message, variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/v1/recall/waitlist/${id}`);
      return res;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Removido", description: "Entrada removida da lista de espera." });
      setRemoveId(null);
    },
    onError: (err: Error) =>
      toast({ title: "Erro ao remover", description: err.message, variant: "destructive" }),
  });

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  function handleOpenCreate() {
    setForm(EMPTY_FORM);
    setIsDialogOpen(true);
  }

  function handleCloseDialog() {
    setIsDialogOpen(false);
    setForm(EMPTY_FORM);
  }

  function handleSubmit() {
    if (!form.patientId) {
      toast({
        title: "Paciente obrigatorio",
        description: "Selecione um paciente.",
        variant: "destructive",
      });
      return;
    }

    addMutation.mutate({
      patientId: Number(form.patientId),
      professionalId: form.professionalId !== "all" ? Number(form.professionalId) : null,
      procedure: form.procedure || null,
      preferredDate: form.preferredDate || null,
      preferredTime: form.preferredTime || null,
      priority: form.priority,
      notes: form.notes || null,
    });
  }

  async function handleSchedule(entry: WaitlistEntry) {
    // Mark waitlist entry as 'scheduled' before navigating away
    try {
      await apiRequest("PATCH", `/api/v1/recall/waitlist/${entry.id}`, {
        status: "scheduled",
      });
      invalidate();
    } catch (err) {
      console.error("Failed to update waitlist status:", err);
      // Non-blocking: continue to scheduling even if the status update fails
    }

    const params = new URLSearchParams();
    params.set("patientId", String(entry.patientId));
    if (entry.professionalId) params.set("professionalId", String(entry.professionalId));
    if (entry.procedure) params.set("procedure", entry.procedure);
    if (entry.preferredDate) params.set("date", entry.preferredDate);
    navigate(`/agenda/novo?${params.toString()}`);
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <DashboardLayout title="Lista de Espera" currentPath="/agenda/lista-espera">
      <div className="space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {PRIORITIES.map((p) => {
            const count = waitlist.filter(
              (w) => w.priority === p.value && w.status === "waiting"
            ).length;
            return (
              <Card key={p.value}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Prioridade {p.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{count}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle>Lista de Espera</CardTitle>
              <Button onClick={handleOpenCreate} size="sm" className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Adicionar
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar paciente ou procedimento..."
                  className="pl-8"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <Select value={professionalFilter} onValueChange={setProfessionalFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Profissional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos profissionais</SelectItem>
                  {professionals.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Prioridade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Table */}
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Paciente</TableHead>
                      <TableHead>Profissional</TableHead>
                      <TableHead>Procedimento</TableHead>
                      <TableHead>Data Preferida</TableHead>
                      <TableHead>Horario</TableHead>
                      <TableHead>Prioridade</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Adicionado</TableHead>
                      <TableHead className="text-right">Acoes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="font-medium">{entry.patientName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {entry.professionalName ?? "Qualquer"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {entry.procedure ?? "—"}
                        </TableCell>
                        <TableCell>
                          {entry.preferredDate ? formatDate(entry.preferredDate) : "—"}
                        </TableCell>
                        <TableCell>
                          {entry.preferredTime ? (
                            <div className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                              {entry.preferredTime}
                            </div>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          <PriorityBadge priority={entry.priority} />
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={entry.status} />
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatDate(entry.createdAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            {entry.status === "waiting" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                onClick={() => handleSchedule(entry)}
                              >
                                <CalendarPlus className="h-3.5 w-3.5 mr-1" />
                                Agendar
                              </Button>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setRemoveId(entry.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add to Waitlist Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar a Lista de Espera</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Paciente *</Label>
              <Select
                value={form.patientId}
                onValueChange={(v) => setForm((f) => ({ ...f, patientId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar paciente" />
                </SelectTrigger>
                <SelectContent>
                  {patients.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Profissional Desejado</Label>
              <Select
                value={form.professionalId}
                onValueChange={(v) => setForm((f) => ({ ...f, professionalId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Qualquer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Qualquer</SelectItem>
                  {professionals.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wl-procedure">Procedimento Desejado</Label>
              <Input
                id="wl-procedure"
                placeholder="Ex: Limpeza, Extracao..."
                value={form.procedure}
                onChange={(e) => setForm((f) => ({ ...f, procedure: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="wl-date">Data Preferida</Label>
                <Input
                  id="wl-date"
                  type="date"
                  value={form.preferredDate}
                  onChange={(e) => setForm((f) => ({ ...f, preferredDate: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="wl-time">Horario Preferido</Label>
                <Input
                  id="wl-time"
                  type="time"
                  value={form.preferredTime}
                  onChange={(e) => setForm((f) => ({ ...f, preferredTime: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <Select
                value={form.priority}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, priority: v as WaitlistPriority }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wl-notes">Observacoes</Label>
              <Textarea
                id="wl-notes"
                rows={2}
                placeholder="Informacoes adicionais..."
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={addMutation.isPending}>
              {addMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove confirmation */}
      <AlertDialog open={removeId !== null} onOpenChange={(open) => !open && setRemoveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover da lista de espera?</AlertDialogTitle>
            <AlertDialogDescription>
              O paciente sera removido permanentemente da lista de espera.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => removeId !== null && removeMutation.mutate(removeId)}
            >
              {removeMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Remover"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
