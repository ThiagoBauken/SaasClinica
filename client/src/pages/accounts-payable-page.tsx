import { useState } from "react";
import DashboardLayout from "@/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  CheckCircle,
  Pencil,
  Trash2,
  InboxIcon,
  TrendingDown,
  AlertCircle,
  Calendar,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AccountPayableStatus = "pending" | "paid" | "overdue" | "cancelled";

interface AccountPayable {
  id: number;
  description: string;
  supplier: string | null;
  category: string;
  amount: number;
  dueDate: string;
  paidAt: string | null;
  status: AccountPayableStatus;
  notes: string | null;
}

interface AccountPayableForm {
  description: string;
  supplier: string;
  category: string;
  amount: string;
  dueDate: string;
  status: AccountPayableStatus;
  notes: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORIES = [
  "Aluguel",
  "Materiais",
  "Salarios",
  "Laboratorio",
  "Equipamentos",
  "Marketing",
  "Impostos",
  "Outros",
] as const;

const STATUS_OPTIONS: { value: AccountPayableStatus; label: string }[] = [
  { value: "pending", label: "Pendente" },
  { value: "paid", label: "Pago" },
  { value: "overdue", label: "Vencido" },
  { value: "cancelled", label: "Cancelado" },
];

const EMPTY_FORM: AccountPayableForm = {
  description: "",
  supplier: "",
  category: "Outros",
  amount: "",
  dueDate: new Date().toISOString().split("T")[0],
  status: "pending",
  notes: "",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function formatDate(dateStr: string): string {
  try {
    return format(new Date(dateStr), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return dateStr;
  }
}

function StatusBadge({ status }: { status: AccountPayableStatus }) {
  const variants: Record<AccountPayableStatus, { label: string; className: string }> = {
    pending: { label: "Pendente", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
    paid: { label: "Pago", className: "bg-green-100 text-green-800 border-green-200" },
    overdue: { label: "Vencido", className: "bg-red-100 text-red-800 border-red-200" },
    cancelled: { label: "Cancelado", className: "bg-gray-100 text-gray-600 border-gray-200" },
  };
  const v = variants[status];
  return (
    <Badge variant="outline" className={v.className}>
      {v.label}
    </Badge>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
      <InboxIcon className="h-12 w-12 opacity-30" />
      <p className="text-sm">Nenhuma conta encontrada</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AccountsPayablePage() {
  const { toast } = useToast();

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<AccountPayableForm>(EMPTY_FORM);

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // -------------------------------------------------------------------------
  // Query
  // -------------------------------------------------------------------------

  const queryParams = new URLSearchParams();
  if (statusFilter !== "all") queryParams.set("status", statusFilter);
  if (categoryFilter !== "all") queryParams.set("category", categoryFilter);
  if (startDate) queryParams.set("startDate", startDate);
  if (endDate) queryParams.set("endDate", endDate);

  const queryString = queryParams.toString();

  const { data: accounts = [], isLoading } = useQuery<AccountPayable[]>({
    queryKey: [`/api/v1/accounts-payable`, statusFilter, categoryFilter, startDate, endDate],
    queryFn: async () => {
      const res = await fetch(
        `/api/v1/accounts-payable${queryString ? `?${queryString}` : ""}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Falha ao buscar contas a pagar");
      return res.json();
    },
  });

  // -------------------------------------------------------------------------
  // Derived summary data
  // -------------------------------------------------------------------------

  const totalPending = accounts
    .filter((a) => a.status === "pending")
    .reduce((s, a) => s + a.amount, 0);

  const totalOverdue = accounts
    .filter((a) => a.status === "overdue")
    .reduce((s, a) => s + a.amount, 0);

  const currentMonthStart = new Date();
  currentMonthStart.setDate(1);
  currentMonthStart.setHours(0, 0, 0, 0);

  const totalPaidThisMonth = accounts
    .filter((a) => {
      if (a.status !== "paid" || !a.paidAt) return false;
      return new Date(a.paidAt) >= currentMonthStart;
    })
    .reduce((s, a) => s + a.amount, 0);

  // -------------------------------------------------------------------------
  // Filtered list
  // -------------------------------------------------------------------------

  const filtered = accounts.filter((a) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      a.description.toLowerCase().includes(q) ||
      (a.supplier ?? "").toLowerCase().includes(q) ||
      a.category.toLowerCase().includes(q)
    );
  });

  // -------------------------------------------------------------------------
  // Mutations
  // -------------------------------------------------------------------------

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/v1/accounts-payable"] });

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("POST", "/api/v1/accounts-payable", data);
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Conta adicionada", description: "Conta a pagar cadastrada com sucesso." });
      handleCloseDialog();
    },
    onError: (err: Error) =>
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, unknown> }) => {
      const res = await apiRequest("PATCH", `/api/v1/accounts-payable/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Conta atualizada", description: "Alteracoes salvas com sucesso." });
      handleCloseDialog();
    },
    onError: (err: Error) =>
      toast({ title: "Erro ao atualizar", description: err.message, variant: "destructive" }),
  });

  const markAsPaidMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/v1/accounts-payable/${id}/pay`, {});
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Pagamento registrado", description: "Conta marcada como paga." });
    },
    onError: (err: Error) =>
      toast({ title: "Erro ao registrar pagamento", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/v1/accounts-payable/${id}`);
      return res;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Conta removida", description: "A conta foi excluida." });
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

  function handleOpenEdit(account: AccountPayable) {
    setEditingId(account.id);
    setForm({
      description: account.description,
      supplier: account.supplier ?? "",
      category: account.category,
      amount: (account.amount / 100).toFixed(2),
      dueDate: account.dueDate.split("T")[0],
      status: account.status,
      notes: account.notes ?? "",
    });
    setIsDialogOpen(true);
  }

  function handleCloseDialog() {
    setIsDialogOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function handleSubmit() {
    const payload = {
      description: form.description,
      supplier: form.supplier || null,
      category: form.category,
      amount: Math.round(parseFloat(form.amount) * 100),
      dueDate: form.dueDate,
      status: form.status,
      notes: form.notes || null,
    };

    if (!form.description || !form.amount || !form.dueDate) {
      toast({
        title: "Campos obrigatorios",
        description: "Preencha descricao, valor e vencimento.",
        variant: "destructive",
      });
      return;
    }

    if (editingId !== null) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <DashboardLayout title="Contas a Pagar" currentPath="/financeiro/contas-pagar">
      <div className="space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-500" />
                Total Pendente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-yellow-600">{formatBRL(totalPending)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-red-500" />
                Total Vencido
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-600">{formatBRL(totalOverdue)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Pago Este Mes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">{formatBRL(totalPaidThisMonth)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters + action */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle>Contas a Pagar</CardTitle>
              <Button onClick={handleOpenCreate} size="sm" className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Nova Conta
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filter row */}
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar descricao ou fornecedor..."
                  className="pl-8"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as categorias</SelectItem>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-[140px]"
                />
                <span className="text-muted-foreground text-sm">ate</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-[140px]"
                />
              </div>
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
                      <TableHead>Descricao</TableHead>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Acoes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((account) => (
                      <TableRow key={account.id}>
                        <TableCell className="font-medium">{account.description}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {account.supplier ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{account.category}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatBRL(account.amount)}
                        </TableCell>
                        <TableCell>{formatDate(account.dueDate)}</TableCell>
                        <TableCell>
                          <StatusBadge status={account.status} />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            {(account.status === "pending" || account.status === "overdue") && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                onClick={() => markAsPaidMutation.mutate(account.id)}
                                disabled={markAsPaidMutation.isPending}
                              >
                                <CheckCircle className="h-3.5 w-3.5 mr-1" />
                                Pagar
                              </Button>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleOpenEdit(account)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setDeleteId(account.id)}
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
            <DialogTitle>{editingId ? "Editar Conta" : "Nova Conta a Pagar"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="ap-description">Descricao *</Label>
                <Input
                  id="ap-description"
                  placeholder="Ex: Aluguel sala junho"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ap-supplier">Fornecedor</Label>
                <Input
                  id="ap-supplier"
                  placeholder="Nome do fornecedor"
                  value={form.supplier}
                  onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Categoria *</Label>
                  <Select
                    value={form.category}
                    onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="ap-amount">Valor (R$) *</Label>
                  <Input
                    id="ap-amount"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ap-dueDate">Vencimento *</Label>
                  <Input
                    id="ap-dueDate"
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, status: v as AccountPayableStatus }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ap-notes">Observacoes</Label>
                <Textarea
                  id="ap-notes"
                  placeholder="Notas adicionais..."
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingId ? "Salvar Alteracoes" : "Adicionar Conta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acao nao pode ser desfeita. A conta sera permanentemente removida.
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
