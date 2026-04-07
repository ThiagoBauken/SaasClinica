import { useState } from "react";
import DashboardLayout from "@/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
  Pencil,
  InboxIcon,
  CalendarOff,
  RefreshCw,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BlockReason =
  | "Ferias"
  | "Folga"
  | "Compromisso"
  | "Manutencao"
  | "Feriado";

interface ScheduleBlock {
  id: number;
  title: string;
  reason: BlockReason;
  professionalId: number | null;
  professionalName: string | null;
  roomId: number | null;
  roomName: string | null;
  startDatetime: string;
  endDatetime: string;
  allDay: boolean;
  recurring: boolean;
  notes: string | null;
}

interface Professional {
  id: number;
  name: string;
}

interface Room {
  id: number;
  name: string;
}

interface BlockForm {
  title: string;
  reason: BlockReason;
  professionalId: string;
  roomId: string;
  startDatetime: string;
  endDatetime: string;
  allDay: boolean;
  recurring: boolean;
  notes: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REASONS: { value: BlockReason; label: string; color: string }[] = [
  { value: "Ferias", label: "Ferias", color: "bg-blue-100 text-blue-800 border-blue-200" },
  { value: "Folga", label: "Folga", color: "bg-purple-100 text-purple-800 border-purple-200" },
  { value: "Compromisso", label: "Compromisso", color: "bg-orange-100 text-orange-800 border-orange-200" },
  { value: "Manutencao", label: "Manutencao", color: "bg-gray-100 text-gray-800 border-gray-200" },
  { value: "Feriado", label: "Feriado", color: "bg-red-100 text-red-800 border-red-200" },
];

const today = new Date();
const todayStr = today.toISOString().slice(0, 16);

const EMPTY_FORM: BlockForm = {
  title: "",
  reason: "Folga",
  professionalId: "all",
  roomId: "all",
  startDatetime: todayStr,
  endDatetime: todayStr,
  allDay: false,
  recurring: false,
  notes: "",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDatetime(dt: string, allDay: boolean): string {
  try {
    if (allDay) return format(new Date(dt), "dd/MM/yyyy", { locale: ptBR });
    return format(new Date(dt), "dd/MM/yyyy HH:mm", { locale: ptBR });
  } catch {
    return dt;
  }
}

function ReasonBadge({ reason }: { reason: BlockReason }) {
  const r = REASONS.find((x) => x.value === reason);
  return (
    <Badge variant="outline" className={r?.color ?? ""}>
      {r?.label ?? reason}
    </Badge>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
      <InboxIcon className="h-12 w-12 opacity-30" />
      <p className="text-sm">Nenhum bloqueio cadastrado</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ScheduleBlocksPage() {
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [reasonFilter, setReasonFilter] = useState<string>("all");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<BlockForm>(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  const { data: blocks = [], isLoading } = useQuery<ScheduleBlock[]>({
    queryKey: ["/api/v1/schedule-blocks"],
    queryFn: async () => {
      const res = await fetch("/api/v1/schedule-blocks", { credentials: "include" });
      if (!res.ok) throw new Error("Falha ao buscar bloqueios");
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

  const { data: rooms = [] } = useQuery<Room[]>({
    queryKey: ["/api/v1/rooms"],
    queryFn: async () => {
      const res = await fetch("/api/v1/rooms", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // -------------------------------------------------------------------------
  // Filtered list
  // -------------------------------------------------------------------------

  const filtered = blocks.filter((b) => {
    const matchSearch =
      !search ||
      b.title.toLowerCase().includes(search.toLowerCase()) ||
      (b.professionalName ?? "").toLowerCase().includes(search.toLowerCase());

    const matchReason = reasonFilter === "all" || b.reason === reasonFilter;

    return matchSearch && matchReason;
  });

  // -------------------------------------------------------------------------
  // Mutations
  // -------------------------------------------------------------------------

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/v1/schedule-blocks"] });

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("POST", "/api/v1/schedule-blocks", data);
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Bloqueio criado", description: "Bloqueio de agenda cadastrado." });
      handleCloseDialog();
    },
    onError: (err: Error) =>
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, unknown> }) => {
      const res = await apiRequest("PATCH", `/api/v1/schedule-blocks/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Bloqueio atualizado" });
      handleCloseDialog();
    },
    onError: (err: Error) =>
      toast({ title: "Erro ao atualizar", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/v1/schedule-blocks/${id}`);
      return res;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Bloqueio removido" });
      setDeleteId(null);
    },
    onError: (err: Error) =>
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" }),
  });

  // -------------------------------------------------------------------------
  // Dialog handlers
  // -------------------------------------------------------------------------

  function handleOpenCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setIsDialogOpen(true);
  }

  function handleOpenEdit(block: ScheduleBlock) {
    setEditingId(block.id);
    setForm({
      title: block.title,
      reason: block.reason,
      professionalId: block.professionalId ? String(block.professionalId) : "all",
      roomId: block.roomId ? String(block.roomId) : "all",
      startDatetime: block.startDatetime.slice(0, 16),
      endDatetime: block.endDatetime.slice(0, 16),
      allDay: block.allDay,
      recurring: block.recurring,
      notes: block.notes ?? "",
    });
    setIsDialogOpen(true);
  }

  function handleCloseDialog() {
    setIsDialogOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function buildPayload() {
    return {
      title: form.title,
      reason: form.reason,
      professionalId: form.professionalId !== "all" ? Number(form.professionalId) : null,
      roomId: form.roomId !== "all" ? Number(form.roomId) : null,
      startDatetime: form.startDatetime,
      endDatetime: form.endDatetime,
      allDay: form.allDay,
      recurring: form.recurring,
      notes: form.notes || null,
    };
  }

  function handleSubmit() {
    if (!form.title || !form.startDatetime || !form.endDatetime) {
      toast({
        title: "Campos obrigatorios",
        description: "Preencha titulo, inicio e fim.",
        variant: "destructive",
      });
      return;
    }

    if (editingId !== null) {
      updateMutation.mutate({ id: editingId, data: buildPayload() });
    } else {
      createMutation.mutate(buildPayload());
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <DashboardLayout title="Bloqueios de Agenda" currentPath="/agenda/bloqueios">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle>Bloqueios de Agenda</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Gerencie ferias, feriados, manutencoes e outros bloqueios
                </p>
              </div>
              <Button onClick={handleOpenCreate} size="sm" className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Novo Bloqueio
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por titulo ou profissional..."
                  className="pl-8"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <Select value={reasonFilter} onValueChange={setReasonFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Motivo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os motivos</SelectItem>
                  {REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
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
                      <TableHead>Titulo</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Profissional</TableHead>
                      <TableHead>Sala</TableHead>
                      <TableHead>Inicio</TableHead>
                      <TableHead>Fim</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Acoes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((block) => (
                      <TableRow key={block.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <CalendarOff className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            {block.title}
                          </div>
                        </TableCell>
                        <TableCell>
                          <ReasonBadge reason={block.reason} />
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {block.professionalName ?? "Todos"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {block.roomName ?? "Todas"}
                        </TableCell>
                        <TableCell>
                          {formatDatetime(block.startDatetime, block.allDay)}
                        </TableCell>
                        <TableCell>
                          {formatDatetime(block.endDatetime, block.allDay)}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {block.allDay && (
                              <Badge variant="secondary" className="text-xs">
                                Dia inteiro
                              </Badge>
                            )}
                            {block.recurring && (
                              <Badge
                                variant="secondary"
                                className="text-xs flex items-center gap-1"
                              >
                                <RefreshCw className="h-3 w-3" />
                                Recorrente
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleOpenEdit(block)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setDeleteId(block.id)}
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

      {/* Create / Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar Bloqueio" : "Novo Bloqueio de Agenda"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="sb-title">Titulo *</Label>
              <Input
                id="sb-title"
                placeholder="Ex: Ferias de julho"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Motivo *</Label>
              <Select
                value={form.reason}
                onValueChange={(v) => setForm((f) => ({ ...f, reason: v as BlockReason }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Profissional</Label>
                <Select
                  value={form.professionalId}
                  onValueChange={(v) => setForm((f) => ({ ...f, professionalId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {professionals.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Sala</Label>
                <Select
                  value={form.roomId}
                  onValueChange={(v) => setForm((f) => ({ ...f, roomId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {rooms.map((r) => (
                      <SelectItem key={r.id} value={String(r.id)}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* All day toggle */}
            <div className="flex items-center gap-3">
              <Switch
                id="sb-allday"
                checked={form.allDay}
                onCheckedChange={(v) => setForm((f) => ({ ...f, allDay: v }))}
              />
              <Label htmlFor="sb-allday" className="cursor-pointer">
                Dia inteiro
              </Label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sb-start">Inicio *</Label>
                <Input
                  id="sb-start"
                  type={form.allDay ? "date" : "datetime-local"}
                  value={
                    form.allDay
                      ? form.startDatetime.split("T")[0]
                      : form.startDatetime
                  }
                  onChange={(e) => {
                    const val = form.allDay ? `${e.target.value}T00:00` : e.target.value;
                    setForm((f) => ({ ...f, startDatetime: val }));
                  }}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sb-end">Fim *</Label>
                <Input
                  id="sb-end"
                  type={form.allDay ? "date" : "datetime-local"}
                  value={
                    form.allDay
                      ? form.endDatetime.split("T")[0]
                      : form.endDatetime
                  }
                  onChange={(e) => {
                    const val = form.allDay ? `${e.target.value}T23:59` : e.target.value;
                    setForm((f) => ({ ...f, endDatetime: val }));
                  }}
                />
              </div>
            </div>

            {/* Recurring toggle */}
            <div className="flex items-center gap-3">
              <Switch
                id="sb-recurring"
                checked={form.recurring}
                onCheckedChange={(v) => setForm((f) => ({ ...f, recurring: v }))}
              />
              <Label htmlFor="sb-recurring" className="cursor-pointer">
                Recorrente
              </Label>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sb-notes">Observacoes</Label>
              <Textarea
                id="sb-notes"
                rows={2}
                placeholder="Notas adicionais..."
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingId ? "Salvar Alteracoes" : "Criar Bloqueio"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir bloqueio?</AlertDialogTitle>
            <AlertDialogDescription>
              O bloqueio sera permanentemente removido da agenda.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId !== null && deleteMutation.mutate(deleteId)}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Excluir"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
