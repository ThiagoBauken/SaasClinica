import { useState } from "react";
import DashboardLayout from "@/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { AgingReport } from "@/components/financial/AgingReport";
import {
  Plus,
  Search,
  Loader2,
  CheckCircle,
  Pencil,
  Trash2,
  InboxIcon,
  Calendar,
  User,
  CreditCard,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ReceivableStatus = "pending" | "paid" | "overdue" | "cancelled";

interface AccountReceivable {
  id: number;
  patientId: number;
  patientName: string;
  description: string;
  amount: number;
  dueDate: string;
  paidAt: string | null;
  status: ReceivableStatus;
  installmentNumber: number | null;
  totalInstallments: number | null;
  notes: string | null;
}

interface RecordPaymentForm {
  paymentMethod: string;
  paidAt: string;
  notes: string;
}

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

function StatusBadge({ status }: { status: ReceivableStatus }) {
  const map: Record<ReceivableStatus, { label: string; className: string }> = {
    pending: { label: "Pendente", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
    paid: { label: "Recebido", className: "bg-green-100 text-green-800 border-green-200" },
    overdue: { label: "Vencido", className: "bg-red-100 text-red-800 border-red-200" },
    cancelled: { label: "Cancelado", className: "bg-gray-100 text-gray-600 border-gray-200" },
  };
  const v = map[status];
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
      <p className="text-sm">Nenhum recebivel encontrado</p>
    </div>
  );
}

const PAYMENT_METHODS = [
  { value: "cash", label: "Dinheiro" },
  { value: "pix", label: "PIX" },
  { value: "credit_card", label: "Cartao de Credito" },
  { value: "debit_card", label: "Cartao de Debito" },
  { value: "bank_transfer", label: "Transferencia Bancaria" },
  { value: "check", label: "Cheque" },
];

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AccountsReceivablePage() {
  const { toast } = useToast();

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Payment dialog
  const [payingId, setPayingId] = useState<number | null>(null);
  const [paymentForm, setPaymentForm] = useState<RecordPaymentForm>({
    paymentMethod: "pix",
    paidAt: new Date().toISOString().split("T")[0],
    notes: "",
  });

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  const queryParams = new URLSearchParams();
  if (statusFilter !== "all") queryParams.set("status", statusFilter);
  if (startDate) queryParams.set("startDate", startDate);
  if (endDate) queryParams.set("endDate", endDate);
  const queryString = queryParams.toString();

  const { data: receivables = [], isLoading } = useQuery<AccountReceivable[]>({
    queryKey: ["/api/v1/accounts-receivable", statusFilter, startDate, endDate],
    queryFn: async () => {
      const res = await fetch(
        `/api/v1/accounts-receivable${queryString ? `?${queryString}` : ""}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Falha ao buscar contas a receber");
      return res.json();
    },
  });

  const { data: agingData } = useQuery({
    queryKey: ["/api/v1/accounts-receivable/aging"],
    queryFn: async () => {
      const res = await fetch("/api/v1/accounts-receivable/aging", { credentials: "include" });
      if (!res.ok) throw new Error("Falha ao buscar aging report");
      return res.json();
    },
  });

  // -------------------------------------------------------------------------
  // Filtered list
  // -------------------------------------------------------------------------

  const filtered = receivables.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.patientName.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q)
    );
  });

  // -------------------------------------------------------------------------
  // Summary totals
  // -------------------------------------------------------------------------

  const totalPending = receivables
    .filter((r) => r.status === "pending")
    .reduce((s, r) => s + r.amount, 0);

  const totalOverdue = receivables
    .filter((r) => r.status === "overdue")
    .reduce((s, r) => s + r.amount, 0);

  const currentMonthStart = new Date();
  currentMonthStart.setDate(1);
  currentMonthStart.setHours(0, 0, 0, 0);

  const totalReceivedThisMonth = receivables
    .filter((r) => {
      if (r.status !== "paid" || !r.paidAt) return false;
      return new Date(r.paidAt) >= currentMonthStart;
    })
    .reduce((s, r) => s + r.amount, 0);

  // -------------------------------------------------------------------------
  // Mutations
  // -------------------------------------------------------------------------

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/v1/accounts-receivable"] });

  const recordPaymentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, unknown> }) => {
      const res = await apiRequest("POST", `/api/v1/accounts-receivable/${id}/pay`, data);
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Pagamento registrado", description: "Recebimento registrado com sucesso." });
      setPayingId(null);
    },
    onError: (err: Error) =>
      toast({ title: "Erro ao registrar", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/v1/accounts-receivable/${id}`);
      return res;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Recebivel removido" });
      setDeleteId(null);
    },
    onError: (err: Error) =>
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" }),
  });

  function handleRecordPayment() {
    if (!payingId) return;
    recordPaymentMutation.mutate({
      id: payingId,
      data: {
        paymentMethod: paymentForm.paymentMethod,
        paidAt: paymentForm.paidAt,
        notes: paymentForm.notes || null,
      },
    });
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <DashboardLayout title="Contas a Receber" currentPath="/financeiro/contas-receber">
      <div className="space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-yellow-500" />
                Total a Receber
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-yellow-600">{formatBRL(totalPending)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4 text-red-500" />
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
                Recebido Este Mes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">
                {formatBRL(totalReceivedThisMonth)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Aging report */}
        {agingData && <AgingReport data={agingData} />}

        {/* Receivables table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle>Recebiveis</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar paciente ou descricao..."
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
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="paid">Recebido</SelectItem>
                  <SelectItem value="overdue">Vencido</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
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
                      <TableHead>Descricao</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Parcela</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Acoes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="font-medium">{r.patientName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{r.description}</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatBRL(r.amount)}
                        </TableCell>
                        <TableCell>{formatDate(r.dueDate)}</TableCell>
                        <TableCell>
                          {r.installmentNumber && r.totalInstallments ? (
                            <Badge variant="outline" className="font-mono">
                              {r.installmentNumber}/{r.totalInstallments}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={r.status} />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            {(r.status === "pending" || r.status === "overdue") && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                onClick={() => {
                                  setPayingId(r.id);
                                  setPaymentForm({
                                    paymentMethod: "pix",
                                    paidAt: new Date().toISOString().split("T")[0],
                                    notes: "",
                                  });
                                }}
                              >
                                <CheckCircle className="h-3.5 w-3.5 mr-1" />
                                Receber
                              </Button>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setDeleteId(r.id)}
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

      {/* Record Payment Dialog */}
      <Dialog open={payingId !== null} onOpenChange={(open) => !open && setPayingId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Recebimento</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Forma de Pagamento</Label>
              <Select
                value={paymentForm.paymentMethod}
                onValueChange={(v) => setPaymentForm((f) => ({ ...f, paymentMethod: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="paid-at">Data do Recebimento</Label>
              <Input
                id="paid-at"
                type="date"
                value={paymentForm.paidAt}
                onChange={(e) => setPaymentForm((f) => ({ ...f, paidAt: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pay-notes">Observacoes</Label>
              <Textarea
                id="pay-notes"
                rows={2}
                placeholder="Notas opcionais..."
                value={paymentForm.notes}
                onChange={(e) => setPaymentForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPayingId(null)}>
              Cancelar
            </Button>
            <Button
              onClick={handleRecordPayment}
              disabled={recordPaymentMutation.isPending}
            >
              {recordPaymentMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Confirmar Recebimento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir recebivel?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acao nao pode ser desfeita.
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
