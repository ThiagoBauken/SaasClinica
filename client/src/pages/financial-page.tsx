import { useState } from "react";
import DashboardLayout from "@/layouts/DashboardLayout";
import CashRegister from "@/components/financial/CashRegister";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  CardDescription,
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Calendar,
  ArrowUp,
  ArrowDown,
  Search,
  Plus,
  Download,
  Loader2,
  CheckCircle,
  InboxIcon,
  Receipt,
  ExternalLink,
  Copy,
  X,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const COLORS = ["#1976d2", "#43a047", "#ff5722", "#9c27b0"];

interface Transaction {
  id: number;
  type: "revenue" | "expense";
  date: string;
  dueDate?: string;
  category: string;
  description: string;
  amount: number;
  paymentMethod: string;
  status: "paid" | "pending" | "cancelled";
  patientName?: string;
  procedure?: string;
  isFixedCost?: boolean;
  frequency?: string;
}

interface ChartEntry {
  name: string;
  value: number;
}

// ---------------------------------------------------------------------------
// CSV export helper
// ---------------------------------------------------------------------------
function exportCSV(data: Record<string, unknown>[], filename: string) {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]).join(",");
  const rows = data.map((row) =>
    Object.values(row)
      .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
      .join(",")
  );
  const csv = [headers, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Payment method label helper
// ---------------------------------------------------------------------------
function paymentMethodLabel(method: string): string {
  const map: Record<string, string> = {
    credit_card: "Cartão de Crédito",
    debit_card: "Cartão de Débito",
    cash: "Dinheiro",
    bank_transfer: "Transferência Bancária",
    pix: "PIX",
  };
  return map[method] ?? method;
}

// ---------------------------------------------------------------------------
// Empty state component
// ---------------------------------------------------------------------------
function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
      <InboxIcon className="h-12 w-12 opacity-30" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function FinancialPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("cashflow");
  const [dateFilter, setDateFilter] = useState("this-month");
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddTransactionOpen, setIsAddTransactionOpen] = useState(false);
  const [nfseDialogOpen, setNfseDialogOpen] = useState(false);
  const [nfseResult, setNfseResult] = useState<{ number: string; validationUrl?: string; xml?: string } | null>(null);
  const [nfseEmitting, setNfseEmitting] = useState<number | null>(null);
  const [newTransaction, setNewTransaction] = useState({
    type: "revenue",
    date: new Date().toISOString().split("T")[0],
    category: "",
    description: "",
    amount: "",
    paymentMethod: "cash",
    status: "paid",
    isFixedCost: false,
    frequency: "monthly",
  });

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------
  const { data: transactions = [], isLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions", dateFilter],
    queryFn: async () => {
      const res = await fetch(`/api/transactions?filter=${dateFilter}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha ao buscar transações");
      return res.json();
    },
  });

  const { data: revenueByMonthData = [] } = useQuery({
    queryKey: ["/api/financial/revenue-by-month"],
    queryFn: async () => {
      const res = await fetch("/api/financial/revenue-by-month", {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: revenueByTypeData = [] } = useQuery<ChartEntry[]>({
    queryKey: ["/api/financial/revenue-by-type"],
    queryFn: async () => {
      const res = await fetch("/api/financial/revenue-by-type", {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // -------------------------------------------------------------------------
  // Mutations
  // -------------------------------------------------------------------------
  const addTransactionMutation = useMutation({
    mutationFn: async (transactionData: Record<string, unknown>) => {
      const res = await apiRequest("POST", "/api/transactions", transactionData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      toast({
        title: "Transação adicionada",
        description: "A transação foi adicionada com sucesso!",
      });
      setIsAddTransactionOpen(false);
      resetNewTransactionForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao adicionar transação",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const markAsPaidMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/transactions/${id}`, {
        status: "paid",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      toast({
        title: "Pagamento registrado",
        description: "A transação foi marcada como paga.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar transação",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const emitNfseMutation = useMutation({
    mutationFn: async (transaction: Transaction) => {
      const res = await apiRequest("POST", "/api/v1/financial/nfse/emit", {
        transactionId: transaction.id,
        description: transaction.description,
        amount: transaction.amount,
        date: transaction.date,
        patientName: transaction.patientName,
        procedure: transaction.procedure,
        category: transaction.category,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setNfseResult({
        number: data.number ?? data.nfseNumber ?? data.id ?? "—",
        validationUrl: data.validationUrl ?? data.url ?? undefined,
        xml: data.xml ?? undefined,
      });
      setNfseDialogOpen(true);
      setNfseEmitting(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao emitir NFS-e",
        description: error.message,
        variant: "destructive",
      });
      setNfseEmitting(null);
    },
  });

  const handleEmitNfse = (transaction: Transaction) => {
    setNfseEmitting(transaction.id);
    emitNfseMutation.mutate(transaction);
  };

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------
  const resetNewTransactionForm = () => {
    setNewTransaction({
      type: "revenue",
      date: new Date().toISOString().split("T")[0],
      category: "",
      description: "",
      amount: "",
      paymentMethod: "cash",
      status: "paid",
      isFixedCost: false,
      frequency: "monthly",
    });
  };

  const handleInputChange = (field: string, value: string) => {
    setNewTransaction((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddTransaction = () => {
    const amountInCents = parseFloat(newTransaction.amount) * 100;
    addTransactionMutation.mutate({
      ...newTransaction,
      amount: amountInCents,
    });
  };

  // -------------------------------------------------------------------------
  // Derived data
  // -------------------------------------------------------------------------
  const summaries = (() => {
    const revenue = transactions
      .filter((t) => t.type === "revenue" && t.status === "paid")
      .reduce((sum, t) => sum + t.amount, 0);
    const expense = transactions
      .filter((t) => t.type === "expense" && t.status === "paid")
      .reduce((sum, t) => sum + t.amount, 0);
    return { revenue, expense, balance: revenue - expense };
  })();

  const filteredTransactions = transactions.filter(
    (t) =>
      t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Contas a Receber = receitas pendentes
  const contasAReceber = transactions.filter(
    (t) => t.type === "revenue" && t.status === "pending"
  );

  // Contas a Pagar = despesas pendentes
  const contasAPagar = transactions.filter(
    (t) => t.type === "expense" && t.status === "pending"
  );

  // Fixed costs = expenses with isFixedCost flag
  const fixedCosts = transactions.filter(
    (t) => t.type === "expense" && t.isFixedCost
  );

  // Summary cards for fixed costs
  const totalFixedMonthly = fixedCosts
    .filter((t) => t.frequency !== "annual" && t.frequency !== "yearly")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalFixedAnnual = fixedCosts
    .filter((t) => t.frequency === "annual" || t.frequency === "yearly")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalAnnualCost = totalFixedMonthly * 12 + totalFixedAnnual;

  // -------------------------------------------------------------------------
  // CSV export wrappers
  // -------------------------------------------------------------------------
  const handleExportCashflow = () => {
    const data = filteredTransactions.map((t) => ({
      Data: new Date(t.date).toLocaleDateString("pt-BR"),
      Tipo: t.type === "revenue" ? "Receita" : "Despesa",
      Descrição: t.description,
      Categoria: t.category,
      Valor: (t.amount / 100).toFixed(2),
      "Método de Pagamento": paymentMethodLabel(t.paymentMethod),
      Status: t.status === "paid" ? "Pago" : t.status === "pending" ? "Pendente" : "Cancelado",
    }));
    exportCSV(data, "fluxo-de-caixa");
  };

  const handleExportRecebiveis = () => {
    const data = contasAReceber.map((t) => ({
      Data: new Date(t.date).toLocaleDateString("pt-BR"),
      Paciente: t.patientName ?? "",
      Procedimento: t.procedure ?? t.description,
      Categoria: t.category,
      Valor: (t.amount / 100).toFixed(2),
      Vencimento: t.dueDate ? new Date(t.dueDate).toLocaleDateString("pt-BR") : "",
    }));
    exportCSV(data, "contas-a-receber");
  };

  const handleExportPagaveis = () => {
    const data = contasAPagar.map((t) => ({
      Data: new Date(t.date).toLocaleDateString("pt-BR"),
      Descrição: t.description,
      Categoria: t.category,
      Valor: (t.amount / 100).toFixed(2),
      Vencimento: t.dueDate ? new Date(t.dueDate).toLocaleDateString("pt-BR") : "",
    }));
    exportCSV(data, "contas-a-pagar");
  };

  const handleExportFaturamento = () => {
    const data = transactions
      .filter((t) => t.type === "revenue")
      .map((t) => ({
        Data: new Date(t.date).toLocaleDateString("pt-BR"),
        Descrição: t.description,
        Categoria: t.category,
        Valor: (t.amount / 100).toFixed(2),
        Status: t.status === "paid" ? "Pago" : "Pendente",
      }));
    exportCSV(data, "faturamento-detalhado");
  };

  const handleExportRelatorioAnual = () => {
    const data = transactions.map((t) => ({
      Data: new Date(t.date).toLocaleDateString("pt-BR"),
      Tipo: t.type === "revenue" ? "Receita" : "Despesa",
      Descrição: t.description,
      Categoria: t.category,
      Valor: (t.amount / 100).toFixed(2),
      Status: t.status === "paid" ? "Pago" : t.status === "pending" ? "Pendente" : "Cancelado",
    }));
    exportCSV(data, "relatorio-anual");
  };

  // -------------------------------------------------------------------------
  // Currency formatter
  // -------------------------------------------------------------------------
  const brl = (cents: number) =>
    (cents / 100).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <DashboardLayout title="Financeiro" currentPath="/financial">
      <Tabs defaultValue="cashflow" value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
          <TabsList className="grid grid-cols-3 sm:grid-cols-7 w-full sm:w-auto">
            <TabsTrigger value="cashflow">Fluxo de Caixa</TabsTrigger>
            <TabsTrigger value="invoices">Faturamento</TabsTrigger>
            <TabsTrigger value="receivables">Contas a Receber</TabsTrigger>
            <TabsTrigger value="payables">Contas a Pagar</TabsTrigger>
            <TabsTrigger value="fixed-costs">Custos Fixos</TabsTrigger>
            <TabsTrigger value="caixa">Caixa</TabsTrigger>
            <TabsTrigger value="reports">Relatórios</TabsTrigger>
          </TabsList>

          <div className="flex flex-col sm:flex-row gap-2">
            <Select defaultValue="this-month" onValueChange={setDateFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Selecione o período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="this-week">Esta semana</SelectItem>
                <SelectItem value="this-month">Este mês</SelectItem>
                <SelectItem value="last-month">Mês passado</SelectItem>
                <SelectItem value="this-year">Este ano</SelectItem>
              </SelectContent>
            </Select>

            <Button
              className="bg-primary text-white"
              onClick={() => setIsAddTransactionOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Nova Transação
            </Button>
          </div>
        </div>

        {/* ================================================================= */}
        {/* TAB: FLUXO DE CAIXA                                               */}
        {/* ================================================================= */}
        <TabsContent value="cashflow">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center">
                  <ArrowUp className="h-4 w-4 text-green-500 mr-2" />
                  Receitas
                </CardTitle>
                <CardDescription>Total de receitas no período</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-500">
                  {brl(summaries.revenue)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center">
                  <ArrowDown className="h-4 w-4 text-red-500 mr-2" />
                  Despesas
                </CardTitle>
                <CardDescription>Total de despesas no período</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-500">
                  {brl(summaries.expense)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Saldo</CardTitle>
                <CardDescription>Balanço do período</CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  className={`text-3xl font-bold ${
                    summaries.balance >= 0 ? "text-green-500" : "text-red-500"
                  }`}
                >
                  {brl(summaries.balance)}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mb-6">
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="relative w-full sm:w-96">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar transação"
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button variant="outline" size="sm" onClick={handleExportCashflow}>
                <Download className="h-4 w-4 mr-1" />
                Exportar CSV
              </Button>
            </div>

            {isLoading ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredTransactions.length === 0 ? (
              <EmptyState message="Nenhuma transação encontrada no período selecionado." />
            ) : (
              <div className="bg-card rounded-lg shadow-sm border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Método de Pagamento</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions.map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell>
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 text-muted-foreground mr-2" />
                            {new Date(transaction.date).toLocaleDateString("pt-BR")}
                          </div>
                        </TableCell>
                        <TableCell>{transaction.description}</TableCell>
                        <TableCell>{transaction.category}</TableCell>
                        <TableCell
                          className={
                            transaction.type === "revenue"
                              ? "text-green-500"
                              : "text-red-500"
                          }
                        >
                          <div className="flex items-center">
                            {transaction.type === "revenue" ? (
                              <ArrowUp className="h-4 w-4 mr-1" />
                            ) : (
                              <ArrowDown className="h-4 w-4 mr-1" />
                            )}
                            {brl(transaction.amount)}
                          </div>
                        </TableCell>
                        <TableCell>
                          {paymentMethodLabel(transaction.paymentMethod)}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`px-2 py-1 rounded text-xs ${
                              transaction.status === "paid"
                                ? "bg-green-100 text-green-600"
                                : transaction.status === "cancelled"
                                ? "bg-gray-100 text-gray-500"
                                : "bg-amber-100 text-amber-600"
                            }`}
                          >
                            {transaction.status === "paid"
                              ? "Pago"
                              : transaction.status === "cancelled"
                              ? "Cancelado"
                              : "Pendente"}
                          </span>
                        </TableCell>
                        <TableCell>
                          {transaction.type === "revenue" && transaction.status === "paid" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              disabled={nfseEmitting === transaction.id}
                              onClick={() => handleEmitNfse(transaction)}
                            >
                              {nfseEmitting === transaction.id ? (
                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                              ) : (
                                <Receipt className="h-3 w-3 mr-1" />
                              )}
                              NFS-e
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ================================================================= */}
        {/* TAB: FATURAMENTO                                                   */}
        {/* ================================================================= */}
        <TabsContent value="invoices">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardHeader>
                <CardTitle>Faturamento Mensal</CardTitle>
                <CardDescription>Total faturado nos últimos meses</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  {revenueByMonthData.length === 0 ? (
                    <EmptyState message="Sem dados de faturamento mensal disponíveis." />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={revenueByMonthData}
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip formatter={(value) => [`R$ ${value}`, "Valor"]} />
                        <Legend />
                        <Bar dataKey="valor" fill="#1976d2" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Faturamento por Tipo</CardTitle>
                <CardDescription>Distribuição por categoria de serviço</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  {revenueByTypeData.length === 0 ? (
                    <EmptyState message="Sem dados por tipo de serviço disponíveis." />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={revenueByTypeData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) =>
                            `${name}: ${(percent * 100).toFixed(0)}%`
                          }
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {revenueByTypeData.map((_, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[index % COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle>Faturamento por Período</CardTitle>
                <CardDescription>Receitas registradas no período selecionado</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={handleExportFaturamento}>
                <Download className="h-4 w-4 mr-1" />
                Exportar CSV
              </Button>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center items-center h-32">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : transactions.filter((t) => t.type === "revenue").length === 0 ? (
                <EmptyState message="Nenhuma receita registrada no período selecionado." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>NFS-e</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions
                      .filter((t) => t.type === "revenue")
                      .map((t) => (
                        <TableRow key={t.id}>
                          <TableCell>
                            <div className="flex items-center">
                              <Calendar className="h-4 w-4 text-muted-foreground mr-2" />
                              {new Date(t.date).toLocaleDateString("pt-BR")}
                            </div>
                          </TableCell>
                          <TableCell>{t.description}</TableCell>
                          <TableCell>{t.category}</TableCell>
                          <TableCell className="text-green-500">
                            {brl(t.amount)}
                          </TableCell>
                          <TableCell>
                            <span
                              className={`px-2 py-1 rounded text-xs ${
                                t.status === "paid"
                                  ? "bg-green-100 text-green-600"
                                  : "bg-amber-100 text-amber-600"
                              }`}
                            >
                              {t.status === "paid" ? "Pago" : "Pendente"}
                            </span>
                          </TableCell>
                          <TableCell>
                            {t.status === "paid" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                disabled={nfseEmitting === t.id}
                                onClick={() => handleEmitNfse(t)}
                              >
                                {nfseEmitting === t.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                ) : (
                                  <Receipt className="h-3 w-3 mr-1" />
                                )}
                                Emitir NFS-e
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================================================================= */}
        {/* TAB: CONTAS A RECEBER                                              */}
        {/* ================================================================= */}
        <TabsContent value="receivables">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle>Contas a Receber</CardTitle>
                <CardDescription>
                  Receitas pendentes — pagamentos ainda não recebidos
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportRecebiveis}
                disabled={contasAReceber.length === 0}
              >
                <Download className="h-4 w-4 mr-1" />
                Exportar CSV
              </Button>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center items-center h-32">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : contasAReceber.length === 0 ? (
                <EmptyState message="Nenhuma conta a receber no período selecionado." />
              ) : (
                <div className="overflow-hidden rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Paciente / Descrição</TableHead>
                        <TableHead>Procedimento</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contasAReceber.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell>
                            <div className="flex items-center">
                              <Calendar className="h-4 w-4 text-muted-foreground mr-2" />
                              {new Date(t.date).toLocaleDateString("pt-BR")}
                            </div>
                          </TableCell>
                          <TableCell>
                            {t.patientName ? (
                              <span className="font-medium">{t.patientName}</span>
                            ) : (
                              t.description
                            )}
                          </TableCell>
                          <TableCell>
                            {t.procedure ?? t.category}
                          </TableCell>
                          <TableCell className="text-green-600 font-medium">
                            {brl(t.amount)}
                          </TableCell>
                          <TableCell>
                            {t.dueDate
                              ? new Date(t.dueDate).toLocaleDateString("pt-BR")
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <span className="px-2 py-1 rounded text-xs bg-amber-100 text-amber-600">
                              Pendente
                            </span>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-green-600 border-green-300 hover:bg-green-50"
                              disabled={markAsPaidMutation.isPending}
                              onClick={() => markAsPaidMutation.mutate(t.id)}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Marcar como Pago
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {contasAReceber.length > 0 && (
                <div className="mt-4 flex items-center justify-end gap-2 text-sm text-muted-foreground">
                  <span>Total pendente:</span>
                  <span className="font-bold text-green-600 text-base">
                    {brl(contasAReceber.reduce((s, t) => s + t.amount, 0))}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================================================================= */}
        {/* TAB: CONTAS A PAGAR                                                */}
        {/* ================================================================= */}
        <TabsContent value="payables">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle>Contas a Pagar</CardTitle>
                <CardDescription>
                  Despesas pendentes — pagamentos ainda não realizados
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPagaveis}
                disabled={contasAPagar.length === 0}
              >
                <Download className="h-4 w-4 mr-1" />
                Exportar CSV
              </Button>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center items-center h-32">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : contasAPagar.length === 0 ? (
                <EmptyState message="Nenhuma conta a pagar no período selecionado." />
              ) : (
                <div className="overflow-hidden rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Descrição / Fornecedor</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contasAPagar.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell>
                            <div className="flex items-center">
                              <Calendar className="h-4 w-4 text-muted-foreground mr-2" />
                              {new Date(t.date).toLocaleDateString("pt-BR")}
                            </div>
                          </TableCell>
                          <TableCell>{t.description}</TableCell>
                          <TableCell>{t.category}</TableCell>
                          <TableCell className="text-red-500 font-medium">
                            {brl(t.amount)}
                          </TableCell>
                          <TableCell>
                            {t.dueDate
                              ? new Date(t.dueDate).toLocaleDateString("pt-BR")
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <span className="px-2 py-1 rounded text-xs bg-amber-100 text-amber-600">
                              Pendente
                            </span>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-green-600 border-green-300 hover:bg-green-50"
                              disabled={markAsPaidMutation.isPending}
                              onClick={() => markAsPaidMutation.mutate(t.id)}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Marcar como Pago
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {contasAPagar.length > 0 && (
                <div className="mt-4 flex items-center justify-end gap-2 text-sm text-muted-foreground">
                  <span>Total pendente:</span>
                  <span className="font-bold text-red-500 text-base">
                    {brl(contasAPagar.reduce((s, t) => s + t.amount, 0))}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================================================================= */}
        {/* TAB: CUSTOS FIXOS                                                  */}
        {/* ================================================================= */}
        <TabsContent value="fixed-costs">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle>Custos Fixos do Consultório</CardTitle>
                <CardDescription>
                  Despesas recorrentes cadastradas como custo fixo
                </CardDescription>
              </div>
              <Button
                className="bg-primary text-white"
                onClick={() => setIsAddTransactionOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Novo Custo Fixo
              </Button>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center items-center h-32">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : fixedCosts.length === 0 ? (
                <EmptyState message="Nenhum custo fixo cadastrado. Adicione uma transação do tipo Despesa marcando-a como custo fixo." />
              ) : (
                <div className="overflow-hidden rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Frequência</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fixedCosts.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell>{t.description}</TableCell>
                          <TableCell>{t.category}</TableCell>
                          <TableCell className="text-red-500">
                            {brl(t.amount)}
                          </TableCell>
                          <TableCell>
                            {t.frequency === "monthly"
                              ? "Mensal"
                              : t.frequency === "annual" || t.frequency === "yearly"
                              ? "Anual"
                              : t.frequency ?? "—"}
                          </TableCell>
                          <TableCell>
                            <span
                              className={`px-2 py-1 rounded text-xs ${
                                t.status === "paid"
                                  ? "bg-green-100 text-green-600"
                                  : "bg-amber-100 text-amber-600"
                              }`}
                            >
                              {t.status === "paid" ? "Ativo" : "Pendente"}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {fixedCosts.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-lg font-medium mb-4">Resumo de Custos Fixos</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Total Mensal</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-red-500">
                          {brl(totalFixedMonthly)}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Total Anual (taxas anuais)</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-red-500">
                          {brl(totalFixedAnnual)}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Custo Anual Total</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-red-500">
                          {brl(totalAnnualCost)}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================================================================= */}
        {/* TAB: RELATÓRIOS                                                    */}
        {/* ================================================================= */}
        <TabsContent value="reports">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardHeader>
                <CardTitle>Relatórios Disponíveis</CardTitle>
                <CardDescription>Exporte relatórios financeiros em CSV</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-md">
                    <div>
                      <h3 className="font-medium">Fluxo de Caixa</h3>
                      <p className="text-sm text-muted-foreground">
                        Resumo de receitas e despesas no período
                      </p>
                    </div>
                    <Button variant="outline" onClick={handleExportCashflow}>
                      <Download className="h-4 w-4 mr-1" />
                      Exportar
                    </Button>
                  </div>

                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-md">
                    <div>
                      <h3 className="font-medium">Faturamento Detalhado</h3>
                      <p className="text-sm text-muted-foreground">
                        Faturamento por tipo de serviço e profissional
                      </p>
                    </div>
                    <Button variant="outline" onClick={handleExportFaturamento}>
                      <Download className="h-4 w-4 mr-1" />
                      Exportar
                    </Button>
                  </div>

                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-md">
                    <div>
                      <h3 className="font-medium">Contas a Receber</h3>
                      <p className="text-sm text-muted-foreground">
                        Pagamentos pendentes e próximos vencimentos
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={handleExportRecebiveis}
                      disabled={contasAReceber.length === 0}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Exportar
                    </Button>
                  </div>

                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-md">
                    <div>
                      <h3 className="font-medium">Contas a Pagar</h3>
                      <p className="text-sm text-muted-foreground">
                        Despesas pendentes e próximos vencimentos
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={handleExportPagaveis}
                      disabled={contasAPagar.length === 0}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Exportar
                    </Button>
                  </div>

                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-md">
                    <div>
                      <h3 className="font-medium">Relatório Anual</h3>
                      <p className="text-sm text-muted-foreground">
                        Resumo financeiro consolidado do ano
                      </p>
                    </div>
                    <Button variant="outline" onClick={handleExportRelatorioAnual}>
                      <Download className="h-4 w-4 mr-1" />
                      Exportar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Relatório Personalizado</CardTitle>
                <CardDescription>Crie um relatório com filtros específicos</CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    // Export current cashflow data as a custom report baseline
                    handleExportCashflow();
                  }}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="start-date">Data Inicial</Label>
                      <Input id="start-date" type="date" />
                    </div>
                    <div>
                      <Label htmlFor="end-date">Data Final</Label>
                      <Input id="end-date" type="date" />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="report-type">Tipo de Relatório</Label>
                    <Select defaultValue="cashflow">
                      <SelectTrigger id="report-type">
                        <SelectValue placeholder="Selecione o tipo de relatório" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cashflow">Fluxo de Caixa</SelectItem>
                        <SelectItem value="revenue">Receitas</SelectItem>
                        <SelectItem value="expenses">Despesas</SelectItem>
                        <SelectItem value="receivables">Contas a Receber</SelectItem>
                        <SelectItem value="payables">Contas a Pagar</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="group-by">Agrupar por</Label>
                    <Select defaultValue="day">
                      <SelectTrigger id="group-by">
                        <SelectValue placeholder="Selecione o agrupamento" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="day">Dia</SelectItem>
                        <SelectItem value="week">Semana</SelectItem>
                        <SelectItem value="month">Mês</SelectItem>
                        <SelectItem value="category">Categoria</SelectItem>
                        <SelectItem value="payment-method">Método de Pagamento</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="format">Formato</Label>
                    <Select defaultValue="csv">
                      <SelectTrigger id="format">
                        <SelectValue placeholder="Selecione o formato" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="csv">CSV</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button type="submit" className="w-full">
                    <Download className="h-4 w-4 mr-1" />
                    Gerar Relatório
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ================================================================= */}
        {/* TAB: CAIXA (Cash Register)                                        */}
        {/* ================================================================= */}
        <TabsContent value="caixa">
          <CashRegister />
        </TabsContent>
      </Tabs>

      {/* ------------------------------------------------------------------- */}
      {/* Dialog: NFS-e Result                                                 */}
      {/* ------------------------------------------------------------------- */}
      <Dialog open={nfseDialogOpen} onOpenChange={setNfseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-blue-600" />
              NFS-e Emitida com Sucesso
            </DialogTitle>
          </DialogHeader>
          {nfseResult && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-green-50 border border-green-200 p-4 space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Número da NFS-e</p>
                  <p className="text-2xl font-bold text-green-700 mt-0.5">{nfseResult.number}</p>
                </div>
                {nfseResult.validationUrl && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">URL de Validação</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs bg-white border rounded px-2 py-1 truncate">
                        {nfseResult.validationUrl}
                      </code>
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0 h-7 px-2"
                        onClick={() => {
                          navigator.clipboard.writeText(nfseResult.validationUrl!);
                          toast({ title: "URL copiada!" });
                        }}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0 h-7 px-2"
                        onClick={() => window.open(nfseResult.validationUrl, "_blank")}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              {nfseResult.xml && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">XML</p>
                  <pre className="text-xs bg-muted rounded p-3 overflow-x-auto max-h-32">{nfseResult.xml}</pre>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setNfseDialogOpen(false)}>
              <X className="h-4 w-4 mr-1" />
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------------- */}
      {/* Dialog: Nova Transação                                               */}
      {/* ------------------------------------------------------------------- */}
      <Dialog open={isAddTransactionOpen} onOpenChange={setIsAddTransactionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Transação</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Tipo</Label>
                <Select
                  value={newTransaction.type}
                  onValueChange={(value) => handleInputChange("type", value)}
                >
                  <SelectTrigger id="type">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="revenue">Receita</SelectItem>
                    <SelectItem value="expense">Despesa</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">Data</Label>
                <Input
                  id="date"
                  type="date"
                  value={newTransaction.date}
                  onChange={(e) => handleInputChange("date", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Categoria</Label>
              <Input
                id="category"
                placeholder="Ex: Consulta, Material, Aluguel"
                value={newTransaction.category}
                onChange={(e) => handleInputChange("category", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                placeholder="Descreva a transação"
                value={newTransaction.description}
                onChange={(e) => handleInputChange("description", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Valor (R$)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={newTransaction.amount}
                onChange={(e) => handleInputChange("amount", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="payment-method">Método de Pagamento</Label>
                <Select
                  value={newTransaction.paymentMethod}
                  onValueChange={(value) => handleInputChange("paymentMethod", value)}
                >
                  <SelectTrigger id="payment-method">
                    <SelectValue placeholder="Selecione o método" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Dinheiro</SelectItem>
                    <SelectItem value="credit_card">Cartão de Crédito</SelectItem>
                    <SelectItem value="debit_card">Cartão de Débito</SelectItem>
                    <SelectItem value="bank_transfer">Transferência Bancária</SelectItem>
                    <SelectItem value="pix">PIX</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={newTransaction.status}
                  onValueChange={(value) => handleInputChange("status", value)}
                >
                  <SelectTrigger id="status">
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">Pago</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddTransactionOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleAddTransaction}
              disabled={addTransactionMutation.isPending}
            >
              {addTransactionMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
