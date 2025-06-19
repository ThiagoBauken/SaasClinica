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
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Search, Plus, FileText, Edit, Trash2, Package, PackageOpen, Package2, RefreshCw, AlertTriangle, ArrowDownUp } from "lucide-react";

// Interfaces para produtos padrão
interface StandardDentalProduct {
  id: number;
  name: string;
  description: string;
  category: string;
  brand: string;
  unitOfMeasure: string;
  estimatedPrice: number;
  tags: string[];
  isPopular: boolean;
  active: boolean;
}

export default function InventoryPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("items");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isStandardProductsDialogOpen, setIsStandardProductsDialogOpen] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<Set<number>>(new Set());
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Buscar dados reais do banco
  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ["/api/inventory/categories"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/inventory/categories");
      if (!res.ok) throw new Error("Falha ao carregar categorias");
      return res.json();
    }
  });

  const { data: items = [], isLoading: itemsLoading, refetch: refetchItems } = useQuery({
    queryKey: ["/api/inventory/items"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/inventory/items");
      if (!res.ok) throw new Error("Falha ao carregar itens");
      return res.json();
    }
  });

  const { data: standardProducts = [], isLoading: standardProductsLoading } = useQuery({
    queryKey: ["/api/inventory/standard-products"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/inventory/standard-products");
      if (!res.ok) throw new Error("Falha ao carregar produtos padrão");
      return res.json();
    }
  });

  const { data: transactions = [], isLoading: transactionsLoading } = useQuery({
    queryKey: ["/api/inventory/transactions"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/inventory/transactions");
      if (!res.ok) throw new Error("Falha ao carregar transações");
      return res.json();
    }
  });

  // Mutation para importar produtos padrão
  const importStandardProductsMutation = useMutation({
    mutationFn: async (productIds: number[]) => {
      const res = await apiRequest("POST", "/api/inventory/import-standard", {
        productIds
      });
      if (!res.ok) throw new Error("Falha ao importar produtos");
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Produtos importados com sucesso",
      });
      refetchItems();
      setSelectedProducts(new Set());
      setIsStandardProductsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Organizar produtos padrão por categoria
  const productsByCategory = standardProducts.reduce((acc: Record<string, StandardDentalProduct[]>, product: StandardDentalProduct) => {
    if (!acc[product.category]) {
      acc[product.category] = [];
    }
    acc[product.category].push(product);
    return acc;
  }, {});

  // Filtrar produtos por categoria selecionada
  const filteredProducts = categoryFilter === "all" 
    ? standardProducts 
    : standardProducts.filter((p: StandardDentalProduct) => p.category === categoryFilter);

  const handleImportSelectedProducts = () => {
    if (selectedProducts.size === 0) {
      toast({
        title: "Aviso",
        description: "Selecione pelo menos um produto para importar",
        variant: "destructive",
      });
      return;
    }
    
    importStandardProductsMutation.mutate(Array.from(selectedProducts));
  };

  const toggleProductSelection = (productId: number) => {
    const newSelection = new Set(selectedProducts);
    if (newSelection.has(productId)) {
      newSelection.delete(productId);
    } else {
      newSelection.add(productId);
    }
    setSelectedProducts(newSelection);
  };

  const selectAllInCategory = (category: string) => {
    const categoryProducts = productsByCategory[category] || [];
    const newSelection = new Set(selectedProducts);
    categoryProducts.forEach((product: StandardDentalProduct) => newSelection.add(product.id));
    setSelectedProducts(newSelection);
  };

  const unselectAllInCategory = (category: string) => {
    const categoryProducts = productsByCategory[category] || [];
    const newSelection = new Set(selectedProducts);
    categoryProducts.forEach((product: StandardDentalProduct) => newSelection.delete(product.id));
    setSelectedProducts(newSelection);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Controle de Estoque</h1>
            <p className="text-muted-foreground">
              Gerencie materiais, equipamentos e produtos odontológicos
            </p>
          </div>
          <div className="flex gap-2">
            <Dialog open={isStandardProductsDialogOpen} onOpenChange={setIsStandardProductsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Package2 className="mr-2 h-4 w-4" />
                  Importar Produtos Padrão
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Produtos Odontológicos Padrão</DialogTitle>
                  <DialogDescription>
                    Selecione os produtos que deseja importar para seu estoque
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  {/* Filtro por categoria */}
                  <div className="flex items-center space-x-2">
                    <Label>Filtrar por categoria:</Label>
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Todas as categorias" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as categorias</SelectItem>
                        {Object.keys(productsByCategory).map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Contador de selecionados */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {selectedProducts.size} produtos selecionados
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedProducts(new Set())}
                    >
                      Limpar seleção
                    </Button>
                  </div>

                  {/* Lista de produtos por categoria */}
                  {standardProductsLoading ? (
                    <div className="text-center py-4">Carregando produtos...</div>
                  ) : (
                    <div className="space-y-6">
                      {Object.entries(productsByCategory).map(([category, products]) => {
                        if (categoryFilter !== "all" && categoryFilter !== category) return null;
                        
                        const categorySelected = products.every((p: StandardDentalProduct) => selectedProducts.has(p.id));
                        const categoryPartiallySelected = products.some((p: StandardDentalProduct) => selectedProducts.has(p.id)) && !categorySelected;

                        return (
                          <div key={category} className="border rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="font-semibold text-lg">{category}</h3>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => selectAllInCategory(category)}
                                  disabled={categorySelected}
                                >
                                  Selecionar todos
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => unselectAllInCategory(category)}
                                  disabled={!categoryPartiallySelected && !categorySelected}
                                >
                                  Desmarcar todos
                                </Button>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {products.map((product: StandardDentalProduct) => (
                                <div
                                  key={product.id}
                                  className={`border rounded p-3 cursor-pointer transition-colors ${
                                    selectedProducts.has(product.id)
                                      ? "border-primary bg-primary/5"
                                      : "border-border hover:border-primary/50"
                                  }`}
                                  onClick={() => toggleProductSelection(product.id)}
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <Checkbox
                                          checked={selectedProducts.has(product.id)}
                                          onCheckedChange={() => toggleProductSelection(product.id)}
                                        />
                                        <h4 className="font-medium">{product.name}</h4>
                                        {product.isPopular && (
                                          <Badge variant="secondary">Popular</Badge>
                                        )}
                                      </div>
                                      {product.description && (
                                        <p className="text-sm text-muted-foreground mt-1">
                                          {product.description}
                                        </p>
                                      )}
                                      <div className="flex gap-2 mt-2">
                                        {product.brand && (
                                          <Badge variant="outline">{product.brand}</Badge>
                                        )}
                                        <Badge variant="outline">{product.unitOfMeasure}</Badge>
                                        {product.estimatedPrice && (
                                          <Badge variant="outline">
                                            R$ {(product.estimatedPrice / 100).toFixed(2)}
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsStandardProductsDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleImportSelectedProducts}
                    disabled={selectedProducts.size === 0 || importStandardProductsMutation.isPending}
                  >
                    {importStandardProductsMutation.isPending ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Importando...
                      </>
                    ) : (
                      <>
                        <Package className="mr-2 h-4 w-4" />
                        Importar {selectedProducts.size} produtos
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="items">Itens</TabsTrigger>
            <TabsTrigger value="categories">Categorias</TabsTrigger>
            <TabsTrigger value="transactions">Movimentações</TabsTrigger>
          </TabsList>

          <TabsContent value="items" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Itens em Estoque
                </CardTitle>
                <CardDescription>
                  Gerencie os produtos e materiais do seu estoque
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar itens..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8 w-[300px]"
                      />
                    </div>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Todas as categorias" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as categorias</SelectItem>
                        {categories.map((category: any) => (
                          <SelectItem key={category.id} value={category.id.toString()}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {itemsLoading ? (
                  <div className="text-center py-4">Carregando itens...</div>
                ) : items.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold">Nenhum item encontrado</h3>
                    <p className="text-muted-foreground">
                      Comece importando produtos padrão ou adicionando itens manualmente
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Marca</TableHead>
                        <TableHead>Estoque Atual</TableHead>
                        <TableHead>Estoque Mínimo</TableHead>
                        <TableHead>Unidade</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item: any) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{item.name}</div>
                              {item.description && (
                                <div className="text-sm text-muted-foreground">
                                  {item.description}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {item.categoryName && (
                              <Badge
                                variant="outline"
                                style={{ borderColor: item.categoryColor }}
                              >
                                {item.categoryName}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>{item.brand || "-"}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {item.currentStock}
                              {item.currentStock <= item.minimumStock && (
                                <AlertTriangle className="h-4 w-4 text-red-500" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{item.minimumStock}</TableCell>
                          <TableCell>{item.unitOfMeasure}</TableCell>
                          <TableCell>
                            {item.currentStock <= item.minimumStock ? (
                              <Badge variant="destructive">Estoque baixo</Badge>
                            ) : (
                              <Badge variant="secondary">Normal</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline">
                                <ArrowDownUp className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="outline">
                                <Edit className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="categories" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Categorias</CardTitle>
                <CardDescription>
                  Organize seus produtos em categorias
                </CardDescription>
              </CardHeader>
              <CardContent>
                {categoriesLoading ? (
                  <div className="text-center py-4">Carregando categorias...</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {categories.map((category: any) => (
                      <Card key={category.id}>
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-4 h-4 rounded"
                              style={{ backgroundColor: category.color }}
                            />
                            <div>
                              <h3 className="font-medium">{category.name}</h3>
                              <p className="text-sm text-muted-foreground">
                                {category.description}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="transactions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Movimentações</CardTitle>
                <CardDescription>
                  Histórico de entradas e saídas do estoque
                </CardDescription>
              </CardHeader>
              <CardContent>
                {transactionsLoading ? (
                  <div className="text-center py-4">Carregando movimentações...</div>
                ) : transactions.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold">Nenhuma movimentação encontrada</h3>
                    <p className="text-muted-foreground">
                      As movimentações de estoque aparecerão aqui
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Quantidade</TableHead>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Motivo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((transaction: any) => (
                        <TableRow key={transaction.id}>
                          <TableCell>
                            {format(new Date(transaction.createdAt), "dd/MM/yyyy HH:mm", {
                              locale: ptBR,
                            })}
                          </TableCell>
                          <TableCell>{transaction.itemName}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                transaction.type === "entrada"
                                  ? "default"
                                  : transaction.type === "saida"
                                  ? "destructive"
                                  : "secondary"
                              }
                            >
                              {transaction.type}
                            </Badge>
                          </TableCell>
                          <TableCell>{transaction.quantity}</TableCell>
                          <TableCell>{transaction.userName}</TableCell>
                          <TableCell>{transaction.reason || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}