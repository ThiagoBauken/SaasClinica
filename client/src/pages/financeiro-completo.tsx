import { useState } from "react";
import DashboardLayout from "@/layouts/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  DollarSign,
  Plus,
  Edit,
  Trash2,
  TrendingUp,
  TrendingDown,
  Calendar,
  CreditCard,
  Receipt,
  BarChart3,
  Search,
  FileDown,
  AlertCircle,
  CheckCircle
} from "lucide-react";

export default function FinanceiroCompleto() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("receber");
  const [showReceivableDialog, setShowReceivableDialog] = useState(false);
  const [showPayableDialog, setShowPayableDialog] = useState(false);

  // Mock data for demonstration
  const [receivables, setReceivables] = useState([
    { 
      id: 1, 
      patient: "João Silva", 
      procedure: "Limpeza + Restauração", 
      amount: 350.00, 
      dueDate: "2024-02-15", 
      status: "pendente",
      paymentMethod: "Dinheiro"
    },
    { 
      id: 2, 
      patient: "Maria Santos", 
      procedure: "Canal", 
      amount: 800.00, 
      dueDate: "2024-02-10", 
      status: "vencido",
      paymentMethod: "Cartão"
    },
    { 
      id: 3, 
      patient: "Carlos Lima", 
      procedure: "Implante", 
      amount: 2500.00, 
      dueDate: "2024-02-20", 
      status: "pago",
      paymentMethod: "PIX"
    }
  ]);

  const [payables, setPayables] = useState([
    { 
      id: 1, 
      supplier: "Dental Plus", 
      description: "Materiais de restauração", 
      amount: 1200.00, 
      dueDate: "2024-02-12", 
      status: "pendente",
      category: "Materiais"
    },
    { 
      id: 2, 
      supplier: "Clínica Verde", 
      description: "Aluguel do consultório", 
      amount: 3500.00, 
      dueDate: "2024-02-05", 
      status: "pago",
      category: "Aluguel"
    },
    { 
      id: 3, 
      supplier: "Tech Lab", 
      description: "Próteses laboratoriais", 
      amount: 950.00, 
      dueDate: "2024-02-18", 
      status: "pendente",
      category: "Laboratório"
    }
  ]);

  const [cashFlow, setCashFlow] = useState([
    { id: 1, date: "2024-01-31", type: "entrada", description: "Consulta - João Silva", amount: 200.00 },
    { id: 2, date: "2024-01-30", type: "saida", description: "Compra materiais", amount: -450.00 },
    { id: 3, date: "2024-01-29", type: "entrada", description: "Procedimento - Maria Santos", amount: 800.00 },
    { id: 4, date: "2024-01-28", type: "saida", description: "Aluguel consultório", amount: -3500.00 }
  ]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pago':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Pago</Badge>;
      case 'pendente':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Pendente</Badge>;
      case 'vencido':
        return <Badge className="bg-red-100 text-red-800 border-red-200">Vencido</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <DashboardLayout title="Gestão Financeira" currentPath="/financeiro">
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Gestão Financeira</h1>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="receber" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Contas a Receber
            </TabsTrigger>
            <TabsTrigger value="pagar" className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              Contas a Pagar
            </TabsTrigger>
            <TabsTrigger value="fluxo" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Fluxo de Caixa
            </TabsTrigger>
            <TabsTrigger value="relatorios" className="flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Relatórios
            </TabsTrigger>
          </TabsList>

          {/* Tab: Contas a Receber */}
          <TabsContent value="receber">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Contas a Receber
                    </CardTitle>
                    <CardDescription>
                      Gerencie pagamentos de pacientes e procedimentos
                    </CardDescription>
                  </div>
                  <Dialog open={showReceivableDialog} onOpenChange={setShowReceivableDialog}>
                    <DialogTrigger asChild>
                      <Button className="flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        Nova Conta
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Adicionar Conta a Receber</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="receivablePatient">Paciente</Label>
                          <Input id="receivablePatient" placeholder="Nome do paciente" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="receivableProcedure">Procedimento/Descrição</Label>
                          <Input id="receivableProcedure" placeholder="Ex: Limpeza, Canal, Implante" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="receivableAmount">Valor</Label>
                            <Input id="receivableAmount" type="number" placeholder="350.00" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="receivableDueDate">Data de Vencimento</Label>
                            <Input id="receivableDueDate" type="date" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="receivablePaymentMethod">Forma de Pagamento</Label>
                          <Select>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a forma" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="dinheiro">Dinheiro</SelectItem>
                              <SelectItem value="cartao">Cartão</SelectItem>
                              <SelectItem value="pix">PIX</SelectItem>
                              <SelectItem value="transferencia">Transferência</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => setShowReceivableDialog(false)}>
                            Cancelar
                          </Button>
                          <Button onClick={() => setShowReceivableDialog(false)}>
                            Adicionar
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por paciente ou procedimento..."
                      className="pl-9"
                    />
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Paciente</TableHead>
                      <TableHead>Procedimento</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Forma de Pagamento</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receivables.map((receivable) => (
                      <TableRow key={receivable.id}>
                        <TableCell className="font-medium">{receivable.patient}</TableCell>
                        <TableCell>{receivable.procedure}</TableCell>
                        <TableCell>R$ {receivable.amount.toFixed(2)}</TableCell>
                        <TableCell>{receivable.dueDate}</TableCell>
                        <TableCell>{receivable.paymentMethod}</TableCell>
                        <TableCell>{getStatusBadge(receivable.status)}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {receivable.status === 'pendente' && (
                              <Button variant="outline" size="sm" className="text-green-600">
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            )}
                            <Button variant="outline" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Contas a Pagar */}
          <TabsContent value="pagar">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingDown className="h-5 w-5" />
                      Contas a Pagar
                    </CardTitle>
                    <CardDescription>
                      Gerencie despesas e fornecedores
                    </CardDescription>
                  </div>
                  <Dialog open={showPayableDialog} onOpenChange={setShowPayableDialog}>
                    <DialogTrigger asChild>
                      <Button className="flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        Nova Conta
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Adicionar Conta a Pagar</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="payableSupplier">Fornecedor</Label>
                          <Input id="payableSupplier" placeholder="Nome do fornecedor" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="payableDescription">Descrição</Label>
                          <Input id="payableDescription" placeholder="Ex: Materiais, Aluguel, Laboratório" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="payableAmount">Valor</Label>
                            <Input id="payableAmount" type="number" placeholder="1200.00" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="payableDueDate">Data de Vencimento</Label>
                            <Input id="payableDueDate" type="date" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="payableCategory">Categoria</Label>
                          <Select>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a categoria" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="materiais">Materiais</SelectItem>
                              <SelectItem value="aluguel">Aluguel</SelectItem>
                              <SelectItem value="laboratorio">Laboratório</SelectItem>
                              <SelectItem value="equipamentos">Equipamentos</SelectItem>
                              <SelectItem value="outros">Outros</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => setShowPayableDialog(false)}>
                            Cancelar
                          </Button>
                          <Button onClick={() => setShowPayableDialog(false)}>
                            Adicionar
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por fornecedor ou descrição..."
                      className="pl-9"
                    />
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payables.map((payable) => (
                      <TableRow key={payable.id}>
                        <TableCell className="font-medium">{payable.supplier}</TableCell>
                        <TableCell>{payable.description}</TableCell>
                        <TableCell>R$ {payable.amount.toFixed(2)}</TableCell>
                        <TableCell>{payable.dueDate}</TableCell>
                        <TableCell>{payable.category}</TableCell>
                        <TableCell>{getStatusBadge(payable.status)}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {payable.status === 'pendente' && (
                              <Button variant="outline" size="sm" className="text-green-600">
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            )}
                            <Button variant="outline" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Fluxo de Caixa */}
          <TabsContent value="fluxo">
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Entradas do Mês</p>
                        <p className="text-2xl font-bold text-green-600">
                          R$ {receivables.filter(r => r.status === 'pago').reduce((sum, r) => sum + r.amount, 0).toFixed(2)}
                        </p>
                      </div>
                      <TrendingUp className="h-8 w-8 text-green-500" />
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Saídas do Mês</p>
                        <p className="text-2xl font-bold text-red-600">
                          R$ {payables.filter(p => p.status === 'pago').reduce((sum, p) => sum + p.amount, 0).toFixed(2)}
                        </p>
                      </div>
                      <TrendingDown className="h-8 w-8 text-red-500" />
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Saldo</p>
                        <p className="text-2xl font-bold">
                          R$ {(
                            receivables.filter(r => r.status === 'pago').reduce((sum, r) => sum + r.amount, 0) -
                            payables.filter(p => p.status === 'pago').reduce((sum, p) => sum + p.amount, 0)
                          ).toFixed(2)}
                        </p>
                      </div>
                      <DollarSign className="h-8 w-8 text-blue-500" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Movimentações Recentes
                  </CardTitle>
                  <CardDescription>
                    Histórico de entradas e saídas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cashFlow.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.date}</TableCell>
                          <TableCell>
                            <Badge variant={item.type === 'entrada' ? 'default' : 'destructive'}>
                              {item.type === 'entrada' ? 'Entrada' : 'Saída'}
                            </Badge>
                          </TableCell>
                          <TableCell>{item.description}</TableCell>
                          <TableCell className={item.type === 'entrada' ? 'text-green-600' : 'text-red-600'}>
                            R$ {Math.abs(item.amount).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab: Relatórios */}
          <TabsContent value="relatorios">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Receipt className="h-5 w-5" />
                    Relatórios Financeiros
                  </CardTitle>
                  <CardDescription>
                    Análises e relatórios da gestão financeira
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">Total a Receber</p>
                            <p className="text-2xl font-bold">
                              R$ {receivables.filter(r => r.status !== 'pago').reduce((sum, r) => sum + r.amount, 0).toFixed(2)}
                            </p>
                          </div>
                          <TrendingUp className="h-8 w-8 text-green-500" />
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">Total a Pagar</p>
                            <p className="text-2xl font-bold">
                              R$ {payables.filter(p => p.status !== 'pago').reduce((sum, p) => sum + p.amount, 0).toFixed(2)}
                            </p>
                          </div>
                          <TrendingDown className="h-8 w-8 text-red-500" />
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">Contas Vencidas</p>
                            <p className="text-2xl font-bold text-red-600">
                              {receivables.filter(r => r.status === 'vencido').length + payables.filter(p => p.status === 'vencido').length}
                            </p>
                          </div>
                          <AlertCircle className="h-8 w-8 text-red-500" />
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">Faturamento Mês</p>
                            <p className="text-2xl font-bold">
                              R$ {receivables.reduce((sum, r) => sum + r.amount, 0).toFixed(2)}
                            </p>
                          </div>
                          <DollarSign className="h-8 w-8 text-blue-500" />
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="flex gap-4">
                    <Button className="flex items-center gap-2">
                      <FileDown className="h-4 w-4" />
                      Relatório de Faturamento
                    </Button>
                    <Button variant="outline" className="flex items-center gap-2">
                      <FileDown className="h-4 w-4" />
                      Fluxo de Caixa
                    </Button>
                    <Button variant="outline" className="flex items-center gap-2">
                      <FileDown className="h-4 w-4" />
                      Contas em Atraso
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}