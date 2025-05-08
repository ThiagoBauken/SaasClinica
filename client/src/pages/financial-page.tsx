import { useState } from "react";
import DashboardLayout from "@/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { 
  Dialog, 
  DialogContent, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
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
  FileText, 
  Download, 
  Loader2 
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

// Mock data for the charts
const revenueByMonthData = [
  { month: 'Jan', valor: 18500 },
  { month: 'Fev', valor: 19800 },
  { month: 'Mar', valor: 21200 },
  { month: 'Abr', valor: 20100 },
  { month: 'Mai', valor: 22400 },
  { month: 'Jun', valor: 23500 },
  { month: 'Jul', valor: 24500 },
];

const revenueByTypeData = [
  { name: 'Consultas', value: 35 },
  { name: 'Tratamentos', value: 45 },
  { name: 'Estética', value: 15 },
  { name: 'Outros', value: 5 },
];

const COLORS = ['#1976d2', '#43a047', '#ff5722', '#9c27b0'];

export default function FinancialPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("cashflow");
  const [dateFilter, setDateFilter] = useState("this-month");
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddTransactionOpen, setIsAddTransactionOpen] = useState(false);
  const [newTransaction, setNewTransaction] = useState({
    type: "revenue",
    date: new Date().toISOString().split('T')[0],
    category: "",
    description: "",
    amount: "",
    paymentMethod: "cash",
    status: "paid",
  });

  // Fetch transactions
  const { data: transactions, isLoading } = useQuery({
    queryKey: ["/api/transactions", dateFilter],
    queryFn: async () => {
      // For demonstration, we're returning mock data
      return [
        {
          id: 1,
          type: "revenue",
          date: "2023-08-01",
          category: "Consulta",
          description: "Consulta inicial - Ricardo Almeida",
          amount: 12000, // In cents
          paymentMethod: "credit_card",
          status: "paid",
        },
        {
          id: 2,
          type: "revenue",
          date: "2023-08-03",
          category: "Tratamento",
          description: "Limpeza dental - Mariana Santos",
          amount: 15000,
          paymentMethod: "debit_card",
          status: "paid",
        },
        {
          id: 3,
          type: "expense",
          date: "2023-08-05",
          category: "Material",
          description: "Compra de material de consumo",
          amount: 45000,
          paymentMethod: "bank_transfer",
          status: "paid",
        },
        {
          id: 4,
          type: "revenue",
          date: "2023-08-07",
          category: "Tratamento",
          description: "Tratamento de canal - Bianca Lima",
          amount: 30000,
          paymentMethod: "cash",
          status: "paid",
        },
        {
          id: 5,
          type: "revenue",
          date: "2023-08-10",
          category: "Ortodontia",
          description: "Consulta de rotina - Sofia Martins",
          amount: 20000,
          paymentMethod: "credit_card",
          status: "pending",
        },
        {
          id: 6,
          type: "expense",
          date: "2023-08-12",
          category: "Aluguel",
          description: "Aluguel do mês",
          amount: 250000,
          paymentMethod: "bank_transfer",
          status: "paid",
        },
        {
          id: 7,
          type: "expense",
          date: "2023-08-15",
          category: "Salários",
          description: "Pagamento de funcionários",
          amount: 380000,
          paymentMethod: "bank_transfer",
          status: "paid",
        },
      ];
    },
  });

  // Add transaction mutation
  const addTransactionMutation = useMutation({
    mutationFn: async (transactionData: any) => {
      const res = await apiRequest("POST", "/api/transactions", transactionData);
      return await res.json();
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

  const resetNewTransactionForm = () => {
    setNewTransaction({
      type: "revenue",
      date: new Date().toISOString().split('T')[0],
      category: "",
      description: "",
      amount: "",
      paymentMethod: "cash",
      status: "paid",
    });
  };

  const handleInputChange = (field: string, value: string) => {
    setNewTransaction((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleAddTransaction = () => {
    // Convert amount to cents
    const amountInCents = parseFloat(newTransaction.amount) * 100;
    
    addTransactionMutation.mutate({
      ...newTransaction,
      amount: amountInCents,
    });
  };

  // Calculate financial summaries
  const calculateSummaries = () => {
    if (!transactions) return { revenue: 0, expense: 0, balance: 0 };
    
    const revenue = transactions
      .filter((t) => t.type === "revenue" && t.status === "paid")
      .reduce((sum, t) => sum + t.amount, 0);
      
    const expense = transactions
      .filter((t) => t.type === "expense" && t.status === "paid")
      .reduce((sum, t) => sum + t.amount, 0);
      
    return {
      revenue,
      expense,
      balance: revenue - expense,
    };
  };

  const summaries = calculateSummaries();

  // Filter transactions based on search query
  const filteredTransactions = transactions
    ? transactions.filter((transaction) =>
        transaction.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        transaction.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  return (
    <DashboardLayout title="Financeiro" currentPath="/financial">
      <Tabs defaultValue="cashflow" value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
          <TabsList className="grid grid-cols-3 w-full sm:w-auto">
            <TabsTrigger value="cashflow">Fluxo de Caixa</TabsTrigger>
            <TabsTrigger value="invoices">Faturamento</TabsTrigger>
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
            
            <Button className="bg-primary text-white" onClick={() => setIsAddTransactionOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Transação
            </Button>
          </div>
        </div>
        
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
                  {(summaries.revenue / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
                  {(summaries.expense / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Saldo</CardTitle>
                <CardDescription>Balanço do período</CardDescription>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${summaries.balance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {(summaries.balance / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
            </div>
            
            {isLoading ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions.map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell>
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 text-muted-foreground mr-2" />
                            {new Date(transaction.date).toLocaleDateString('pt-BR')}
                          </div>
                        </TableCell>
                        <TableCell>{transaction.description}</TableCell>
                        <TableCell>{transaction.category}</TableCell>
                        <TableCell className={transaction.type === "revenue" ? "text-green-500" : "text-red-500"}>
                          <div className="flex items-center">
                            {transaction.type === "revenue" ? (
                              <ArrowUp className="h-4 w-4 mr-1" />
                            ) : (
                              <ArrowDown className="h-4 w-4 mr-1" />
                            )}
                            {(transaction.amount / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </div>
                        </TableCell>
                        <TableCell>
                          {transaction.paymentMethod === "credit_card" && "Cartão de Crédito"}
                          {transaction.paymentMethod === "debit_card" && "Cartão de Débito"}
                          {transaction.paymentMethod === "cash" && "Dinheiro"}
                          {transaction.paymentMethod === "bank_transfer" && "Transferência Bancária"}
                        </TableCell>
                        <TableCell>
                          <span 
                            className={`px-2 py-1 rounded text-xs ${
                              transaction.status === "paid" 
                                ? "bg-green-100 text-green-600" 
                                : "bg-amber-100 text-amber-600"
                            }`}
                          >
                            {transaction.status === "paid" ? "Pago" : "Pendente"}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="invoices">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardHeader>
                <CardTitle>Faturamento Mensal</CardTitle>
                <CardDescription>Total faturado nos últimos meses</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={revenueByMonthData}
                      margin={{
                        top: 5,
                        right: 30,
                        left: 20,
                        bottom: 5,
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip 
                        formatter={(value) => [`R$ ${value}`, "Valor"]}
                      />
                      <Legend />
                      <Bar dataKey="valor" fill="#1976d2" />
                    </BarChart>
                  </ResponsiveContainer>
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
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={revenueByTypeData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {revenueByTypeData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Faturamento Pendente</CardTitle>
              <CardDescription>Pagamentos a receber</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Paciente</TableHead>
                    <TableHead>Serviço</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>10/08/2023</TableCell>
                    <TableCell>Sofia Martins</TableCell>
                    <TableCell>Consulta de rotina</TableCell>
                    <TableCell>R$ 200,00</TableCell>
                    <TableCell>17/08/2023</TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm">
                        <FileText className="h-4 w-4 mr-1" />
                        Fatura
                      </Button>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>12/08/2023</TableCell>
                    <TableCell>Lucas Ferreira</TableCell>
                    <TableCell>Clareamento</TableCell>
                    <TableCell>R$ 450,00</TableCell>
                    <TableCell>19/08/2023</TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm">
                        <FileText className="h-4 w-4 mr-1" />
                        Fatura
                      </Button>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>15/08/2023</TableCell>
                    <TableCell>Pedro Oliveira</TableCell>
                    <TableCell>Tratamento de canal</TableCell>
                    <TableCell>R$ 1.200,00</TableCell>
                    <TableCell>22/08/2023</TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm">
                        <FileText className="h-4 w-4 mr-1" />
                        Fatura
                      </Button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="reports">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardHeader>
                <CardTitle>Relatórios Disponíveis</CardTitle>
                <CardDescription>Exporte relatórios financeiros</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-neutral-lightest rounded-md">
                    <div>
                      <h3 className="font-medium">Fluxo de Caixa</h3>
                      <p className="text-sm text-muted-foreground">Resumo de receitas e despesas no período</p>
                    </div>
                    <Button variant="outline">
                      <Download className="h-4 w-4 mr-1" />
                      Exportar
                    </Button>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-neutral-lightest rounded-md">
                    <div>
                      <h3 className="font-medium">Faturamento Detalhado</h3>
                      <p className="text-sm text-muted-foreground">Faturamento por tipo de serviço e profissional</p>
                    </div>
                    <Button variant="outline">
                      <Download className="h-4 w-4 mr-1" />
                      Exportar
                    </Button>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-neutral-lightest rounded-md">
                    <div>
                      <h3 className="font-medium">Contas a Receber</h3>
                      <p className="text-sm text-neutral-medium">Pagamentos pendentes e próximos vencimentos</p>
                    </div>
                    <Button variant="outline">
                      <Download className="h-4 w-4 mr-1" />
                      Exportar
                    </Button>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-neutral-lightest rounded-md">
                    <div>
                      <h3 className="font-medium">Contas a Pagar</h3>
                      <p className="text-sm text-neutral-medium">Despesas pendentes e próximos vencimentos</p>
                    </div>
                    <Button variant="outline">
                      <Download className="h-4 w-4 mr-1" />
                      Exportar
                    </Button>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-neutral-lightest rounded-md">
                    <div>
                      <h3 className="font-medium">Relatório Anual</h3>
                      <p className="text-sm text-neutral-medium">Resumo financeiro consolidado do ano</p>
                    </div>
                    <Button variant="outline">
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
                <form className="space-y-4">
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
                    <Select defaultValue="excel">
                      <SelectTrigger id="format">
                        <SelectValue placeholder="Selecione o formato" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="excel">Excel</SelectItem>
                        <SelectItem value="pdf">PDF</SelectItem>
                        <SelectItem value="csv">CSV</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <Button className="w-full">
                    <Download className="h-4 w-4 mr-1" />
                    Gerar Relatório
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
      
      {/* Add Transaction Dialog */}
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
            <Button onClick={handleAddTransaction} disabled={addTransactionMutation.isPending}>
              {addTransactionMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
