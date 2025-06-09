import { useState } from "react";
import DashboardLayout from "@/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Search, 
  Plus, 
  Package, 
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  BarChart3
} from "lucide-react";

export default function EstoquePage() {
  const { toast } = useToast();
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");

  // Fetch inventory items
  const {
    data: items = [],
    isLoading: isLoadingItems,
  } = useQuery({
    queryKey: ["/api/inventory/items"],
  });

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ["/api/inventory/categories"],
  });

  // Create item mutation
  const createItemMutation = useMutation({
    mutationFn: (newItem: any) => apiRequest("/api/inventory/items", "POST", newItem),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/items"] });
      setIsAddItemOpen(false);
      toast({
        title: "Sucesso",
        description: "Item adicionado ao estoque com sucesso!",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao adicionar item ao estoque",
        variant: "destructive",
      });
    },
  });

  // Handle form submission
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    
    const itemData = {
      name: formData.get("name"),
      description: formData.get("description"),
      quantity: parseInt(formData.get("quantity") as string),
      minQuantity: parseInt(formData.get("minQuantity") as string),
      unit: formData.get("unit"),
      price: parseFloat(formData.get("price") as string),
      supplier: formData.get("supplier"),
      category: formData.get("category"),
    };

    createItemMutation.mutate(itemData);
  };

  // Filter items
  const filteredItems = items.filter((item: any) => {
    const matchesSearch = item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === "all" || item.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  // Calculate stats
  const lowStockItems = items.filter((item: any) => item.quantity <= item.minQuantity);
  const totalValue = items.reduce((sum: number, item: any) => sum + (item.quantity * item.price || 0), 0);

  return (
    <DashboardLayout title="Controle de Estoque" currentPath="/inventory">
      <div className="space-y-6">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Itens</CardTitle>
              <Package className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{items.length}</div>
              <p className="text-xs text-muted-foreground">Itens cadastrados</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Estoque Baixo</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{lowStockItems.length}</div>
              <p className="text-xs text-muted-foreground">Itens com estoque baixo</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
              <BarChart3 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">Valor do estoque</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Categorias</CardTitle>
              <Package className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{categories.length}</div>
              <p className="text-xs text-muted-foreground">Categorias ativas</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Actions */}
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar itens..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-64"
              />
            </div>
            
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtrar por categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {categories.map((category: any) => (
                  <SelectItem key={category.id} value={category.name}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Dialog open={isAddItemOpen} onOpenChange={setIsAddItemOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo Item
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Adicionar Novo Item ao Estoque</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Nome do Item</Label>
                    <Input
                      id="name"
                      name="name"
                      placeholder="Nome do item"
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="category">Categoria</Label>
                    <Select name="category" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category: any) => (
                          <SelectItem key={category.id} value={category.name}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="description">Descrição</Label>
                  <Input
                    id="description"
                    name="description"
                    placeholder="Descrição do item"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="quantity">Quantidade</Label>
                    <Input
                      id="quantity"
                      name="quantity"
                      type="number"
                      min="0"
                      placeholder="0"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="minQuantity">Estoque Mínimo</Label>
                    <Input
                      id="minQuantity"
                      name="minQuantity"
                      type="number"
                      min="0"
                      placeholder="0"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="unit">Unidade</Label>
                    <Select name="unit" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Unidade" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="un">Unidade</SelectItem>
                        <SelectItem value="cx">Caixa</SelectItem>
                        <SelectItem value="pc">Pacote</SelectItem>
                        <SelectItem value="kg">Quilograma</SelectItem>
                        <SelectItem value="l">Litro</SelectItem>
                        <SelectItem value="ml">Mililitro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="price">Preço Unitário (R$)</Label>
                    <Input
                      id="price"
                      name="price"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0,00"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="supplier">Fornecedor</Label>
                    <Input
                      id="supplier"
                      name="supplier"
                      placeholder="Nome do fornecedor"
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsAddItemOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createItemMutation.isPending}>
                    {createItemMutation.isPending ? "Salvando..." : "Salvar"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Inventory Table */}
        <Card>
          <CardHeader>
            <CardTitle>Itens do Estoque</CardTitle>
            <CardDescription>Controle de materiais e suprimentos</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingItems ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-sm text-gray-500">Carregando itens...</div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Quantidade</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Estoque Mínimo</TableHead>
                    <TableHead>Preço Unit.</TableHead>
                    <TableHead>Valor Total</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-gray-500 py-8">
                        Nenhum item encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredItems.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{item.name}</div>
                            {item.description && (
                              <div className="text-sm text-gray-500">{item.description}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="capitalize">{item.category}</TableCell>
                        <TableCell>
                          <span className={item.quantity <= item.minQuantity ? "text-orange-600 font-medium" : ""}>
                            {item.quantity}
                          </span>
                        </TableCell>
                        <TableCell>{item.unit}</TableCell>
                        <TableCell>{item.minQuantity}</TableCell>
                        <TableCell>R$ {item.price?.toFixed(2) || '0,00'}</TableCell>
                        <TableCell>R$ {((item.quantity * item.price) || 0).toFixed(2)}</TableCell>
                        <TableCell>
                          {item.quantity <= item.minQuantity ? (
                            <div className="flex items-center text-orange-600">
                              <AlertTriangle className="h-4 w-4 mr-1" />
                              <span className="text-sm font-medium">Baixo</span>
                            </div>
                          ) : item.quantity <= item.minQuantity * 2 ? (
                            <div className="flex items-center text-yellow-600">
                              <TrendingDown className="h-4 w-4 mr-1" />
                              <span className="text-sm">Atenção</span>
                            </div>
                          ) : (
                            <div className="flex items-center text-green-600">
                              <TrendingUp className="h-4 w-4 mr-1" />
                              <span className="text-sm">OK</span>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}