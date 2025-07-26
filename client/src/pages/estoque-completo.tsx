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
  Package,
  Plus,
  Edit,
  Trash2,
  ArrowDown,
  ArrowUp,
  TrendingDown,
  AlertTriangle,
  Building,
  BarChart3,
  Search,
  Calendar,
  FileDown
} from "lucide-react";

export default function EstoqueCompleto() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("produtos");
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [showSupplierDialog, setShowSupplierDialog] = useState(false);
  const [showEntryDialog, setShowEntryDialog] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);

  // Mock data for demonstration
  const [products, setProducts] = useState([
    { 
      id: 1, 
      name: "Anestésico Lidocaína", 
      category: "Anestésicos", 
      stock: 15, 
      minStock: 20, 
      price: 45.00, 
      supplier: "Dental Plus",
      expiryDate: "2025-06-15",
      status: "baixo"
    },
    { 
      id: 2, 
      name: "Resina Composta", 
      category: "Materiais Restauradores", 
      stock: 8, 
      minStock: 10, 
      price: 120.00, 
      supplier: "OdontoMed",
      expiryDate: "2026-03-20",
      status: "baixo"
    },
    { 
      id: 3, 
      name: "Luvas Descartáveis", 
      category: "EPIs", 
      stock: 50, 
      minStock: 30, 
      price: 25.00, 
      supplier: "SafeMed",
      expiryDate: "2027-12-31",
      status: "ok"
    }
  ]);

  const [suppliers, setSuppliers] = useState([
    { id: 1, name: "Dental Plus", contact: "João Silva", phone: "(11) 99999-1111", email: "contato@dentalplus.com" },
    { id: 2, name: "OdontoMed", contact: "Maria Santos", phone: "(11) 99999-2222", email: "vendas@odontomed.com" },
    { id: 3, name: "SafeMed", contact: "Carlos Lima", phone: "(11) 99999-3333", email: "pedidos@safemed.com" }
  ]);

  const [movements, setMovements] = useState([
    { id: 1, type: "entrada", product: "Anestésico Lidocaína", quantity: 10, date: "2024-01-15", user: "Dr. João", note: "Compra mensal" },
    { id: 2, type: "saida", product: "Resina Composta", quantity: 2, date: "2024-01-14", user: "Dra. Maria", note: "Procedimento paciente" },
    { id: 3, type: "entrada", product: "Luvas Descartáveis", quantity: 100, date: "2024-01-10", user: "Ana Costa", note: "Reposição estoque" }
  ]);

  return (
    <DashboardLayout title="Controle de Estoque" currentPath="/estoque">
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Controle de Estoque</h1>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-6 mb-6">
            <TabsTrigger value="produtos" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Produtos
            </TabsTrigger>
            <TabsTrigger value="entradas" className="flex items-center gap-2">
              <ArrowDown className="h-4 w-4" />
              Entradas
            </TabsTrigger>
            <TabsTrigger value="saidas" className="flex items-center gap-2">
              <ArrowUp className="h-4 w-4" />
              Saídas
            </TabsTrigger>
            <TabsTrigger value="fornecedores" className="flex items-center gap-2">
              <Building className="h-4 w-4" />
              Fornecedores
            </TabsTrigger>
            <TabsTrigger value="alertas" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Alertas
            </TabsTrigger>
            <TabsTrigger value="relatorios" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Relatórios
            </TabsTrigger>
          </TabsList>

          {/* Tab: Produtos/Materiais */}
          <TabsContent value="produtos">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      Produtos e Materiais
                    </CardTitle>
                    <CardDescription>
                      Gerencie todos os produtos do estoque
                    </CardDescription>
                  </div>
                  <Dialog open={showProductDialog} onOpenChange={setShowProductDialog}>
                    <DialogTrigger asChild>
                      <Button className="flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        Novo Produto
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Adicionar Produto</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="productName">Nome do Produto</Label>
                          <Input id="productName" placeholder="Ex: Anestésico Lidocaína" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="productCategory">Categoria</Label>
                          <Select>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a categoria" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="anestesicos">Anestésicos</SelectItem>
                              <SelectItem value="materiais">Materiais Restauradores</SelectItem>
                              <SelectItem value="epis">EPIs</SelectItem>
                              <SelectItem value="instrumentos">Instrumentos</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="productPrice">Preço Unitário</Label>
                            <Input id="productPrice" type="number" placeholder="45.00" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="productMinStock">Estoque Mínimo</Label>
                            <Input id="productMinStock" type="number" placeholder="10" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="productSupplier">Fornecedor</Label>
                          <Select>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o fornecedor" />
                            </SelectTrigger>
                            <SelectContent>
                              {suppliers.map(supplier => (
                                <SelectItem key={supplier.id} value={supplier.name}>
                                  {supplier.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => setShowProductDialog(false)}>
                            Cancelar
                          </Button>
                          <Button onClick={() => setShowProductDialog(false)}>
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
                      placeholder="Buscar produtos..."
                      className="pl-9"
                    />
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Estoque Atual</TableHead>
                      <TableHead>Estoque Mínimo</TableHead>
                      <TableHead>Preço</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell>{product.category}</TableCell>
                        <TableCell>{product.stock}</TableCell>
                        <TableCell>{product.minStock}</TableCell>
                        <TableCell>R$ {product.price.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant={product.status === 'ok' ? 'default' : 'destructive'}>
                            {product.status === 'ok' ? 'Normal' : 'Estoque Baixo'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
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

          {/* Tab: Entradas */}
          <TabsContent value="entradas">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <ArrowDown className="h-5 w-5" />
                      Controle de Entradas
                    </CardTitle>
                    <CardDescription>
                      Registre entradas de produtos no estoque
                    </CardDescription>
                  </div>
                  <Dialog open={showEntryDialog} onOpenChange={setShowEntryDialog}>
                    <DialogTrigger asChild>
                      <Button className="flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        Nova Entrada
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Registrar Entrada</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="entryProduct">Produto</Label>
                          <Select>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o produto" />
                            </SelectTrigger>
                            <SelectContent>
                              {products.map(product => (
                                <SelectItem key={product.id} value={product.name}>
                                  {product.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="entryQuantity">Quantidade</Label>
                          <Input id="entryQuantity" type="number" placeholder="10" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="entryNote">Observações</Label>
                          <Input id="entryNote" placeholder="Ex: Compra mensal, Doação" />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => setShowEntryDialog(false)}>
                            Cancelar
                          </Button>
                          <Button onClick={() => setShowEntryDialog(false)}>
                            Registrar Entrada
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Quantidade</TableHead>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Observações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements.filter(m => m.type === 'entrada').map((movement) => (
                      <TableRow key={movement.id}>
                        <TableCell>{movement.date}</TableCell>
                        <TableCell className="font-medium">{movement.product}</TableCell>
                        <TableCell className="text-green-600">+{movement.quantity}</TableCell>
                        <TableCell>{movement.user}</TableCell>
                        <TableCell>{movement.note}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Saídas */}
          <TabsContent value="saidas">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <ArrowUp className="h-5 w-5" />
                      Controle de Saídas
                    </CardTitle>
                    <CardDescription>
                      Registre saídas de produtos do estoque
                    </CardDescription>
                  </div>
                  <Dialog open={showExitDialog} onOpenChange={setShowExitDialog}>
                    <DialogTrigger asChild>
                      <Button className="flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        Nova Saída
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Registrar Saída</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="exitProduct">Produto</Label>
                          <Select>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o produto" />
                            </SelectTrigger>
                            <SelectContent>
                              {products.map(product => (
                                <SelectItem key={product.id} value={product.name}>
                                  {product.name} (Estoque: {product.stock})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="exitQuantity">Quantidade</Label>
                          <Input id="exitQuantity" type="number" placeholder="2" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="exitNote">Motivo/Observações</Label>
                          <Input id="exitNote" placeholder="Ex: Procedimento paciente, Perda" />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => setShowExitDialog(false)}>
                            Cancelar
                          </Button>
                          <Button onClick={() => setShowExitDialog(false)}>
                            Registrar Saída
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Quantidade</TableHead>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Observações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements.filter(m => m.type === 'saida').map((movement) => (
                      <TableRow key={movement.id}>
                        <TableCell>{movement.date}</TableCell>
                        <TableCell className="font-medium">{movement.product}</TableCell>
                        <TableCell className="text-red-600">-{movement.quantity}</TableCell>
                        <TableCell>{movement.user}</TableCell>
                        <TableCell>{movement.note}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Fornecedores */}
          <TabsContent value="fornecedores">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Building className="h-5 w-5" />
                      Fornecedores
                    </CardTitle>
                    <CardDescription>
                      Gerencie fornecedores de produtos
                    </CardDescription>
                  </div>
                  <Dialog open={showSupplierDialog} onOpenChange={setShowSupplierDialog}>
                    <DialogTrigger asChild>
                      <Button className="flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        Novo Fornecedor
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Adicionar Fornecedor</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="supplierName">Nome da Empresa</Label>
                          <Input id="supplierName" placeholder="Ex: Dental Plus" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="supplierContact">Pessoa de Contato</Label>
                          <Input id="supplierContact" placeholder="Nome do responsável" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="supplierPhone">Telefone</Label>
                            <Input id="supplierPhone" placeholder="(11) 99999-9999" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="supplierEmail">E-mail</Label>
                            <Input id="supplierEmail" type="email" placeholder="contato@empresa.com" />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => setShowSupplierDialog(false)}>
                            Cancelar
                          </Button>
                          <Button onClick={() => setShowSupplierDialog(false)}>
                            Adicionar
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Contato</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suppliers.map((supplier) => (
                      <TableRow key={supplier.id}>
                        <TableCell className="font-medium">{supplier.name}</TableCell>
                        <TableCell>{supplier.contact}</TableCell>
                        <TableCell>{supplier.phone}</TableCell>
                        <TableCell>{supplier.email}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
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

          {/* Tab: Alertas */}
          <TabsContent value="alertas">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Alertas de Estoque
                  </CardTitle>
                  <CardDescription>
                    Produtos com estoque baixo e próximos ao vencimento
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="border rounded-lg p-4 bg-yellow-50 border-yellow-200">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingDown className="h-5 w-5 text-yellow-600" />
                        <h3 className="font-medium text-yellow-800">Estoque Baixo</h3>
                      </div>
                      <div className="space-y-2">
                        {products.filter(p => p.status === 'baixo').map(product => (
                          <div key={product.id} className="flex justify-between items-center">
                            <span className="text-sm">{product.name}</span>
                            <Badge variant="outline" className="text-yellow-700 border-yellow-300">
                              {product.stock} unidades (mín: {product.minStock})
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="border rounded-lg p-4 bg-red-50 border-red-200">
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="h-5 w-5 text-red-600" />
                        <h3 className="font-medium text-red-800">Próximos ao Vencimento</h3>
                      </div>
                      <div className="space-y-2">
                        {products.filter(p => new Date(p.expiryDate) < new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)).map(product => (
                          <div key={product.id} className="flex justify-between items-center">
                            <span className="text-sm">{product.name}</span>
                            <Badge variant="outline" className="text-red-700 border-red-300">
                              Vence em {product.expiryDate}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
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
                    <BarChart3 className="h-5 w-5" />
                    Relatórios de Estoque
                  </CardTitle>
                  <CardDescription>
                    Análises e relatórios do controle de estoque
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">Total de Produtos</p>
                            <p className="text-2xl font-bold">{products.length}</p>
                          </div>
                          <Package className="h-8 w-8 text-blue-500" />
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">Estoque Baixo</p>
                            <p className="text-2xl font-bold text-yellow-600">
                              {products.filter(p => p.status === 'baixo').length}
                            </p>
                          </div>
                          <TrendingDown className="h-8 w-8 text-yellow-500" />
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">Valor Total</p>
                            <p className="text-2xl font-bold">
                              R$ {products.reduce((sum, p) => sum + (p.stock * p.price), 0).toFixed(2)}
                            </p>
                          </div>
                          <BarChart3 className="h-8 w-8 text-green-500" />
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">Fornecedores</p>
                            <p className="text-2xl font-bold">{suppliers.length}</p>
                          </div>
                          <Building className="h-8 w-8 text-purple-500" />
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="flex gap-4">
                    <Button className="flex items-center gap-2">
                      <FileDown className="h-4 w-4" />
                      Exportar Relatório de Estoque
                    </Button>
                    <Button variant="outline" className="flex items-center gap-2">
                      <FileDown className="h-4 w-4" />
                      Relatório de Movimentações
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