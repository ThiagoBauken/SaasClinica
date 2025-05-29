import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Search, Package, AlertTriangle, TrendingUp, TrendingDown, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const inventoryFormSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  category: z.string().min(1, "Categoria é obrigatória"),
  quantity: z.number().min(0, "Quantidade não pode ser negativa"),
  minQuantity: z.number().min(0, "Quantidade mínima não pode ser negativa"),
  maxQuantity: z.number().min(0, "Quantidade máxima não pode ser negativa"),
  unitPrice: z.number().min(0, "Preço unitário não pode ser negativo"),
  supplier: z.string().optional(),
  description: z.string().optional(),
  expirationDate: z.string().optional(),
});

type InventoryFormData = z.infer<typeof inventoryFormSchema>;

const movementFormSchema = z.object({
  itemId: z.number().min(1, "Item é obrigatório"),
  type: z.enum(["in", "out"]),
  quantity: z.number().min(1, "Quantidade deve ser maior que zero"),
  reason: z.string().min(2, "Motivo é obrigatório"),
  notes: z.string().optional(),
});

type MovementFormData = z.infer<typeof movementFormSchema>;

export default function EstoqueModular() {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [isMovementDialogOpen, setIsMovementDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const itemForm = useForm<InventoryFormData>({
    resolver: zodResolver(inventoryFormSchema),
    defaultValues: {
      name: "",
      category: "",
      quantity: 0,
      minQuantity: 0,
      maxQuantity: 0,
      unitPrice: 0,
      supplier: "",
      description: "",
      expirationDate: "",
    },
  });

  const movementForm = useForm<MovementFormData>({
    resolver: zodResolver(movementFormSchema),
    defaultValues: {
      itemId: 0,
      type: "in",
      quantity: 1,
      reason: "",
      notes: "",
    },
  });

  // Buscar itens do estoque
  const { data: inventoryItems = [], isLoading } = useQuery({
    queryKey: ["/api/inventory"],
  });

  // Buscar movimentações
  const { data: movements = [] } = useQuery({
    queryKey: ["/api/inventory/movements"],
  });

  // Criar/atualizar item
  const itemMutation = useMutation({
    mutationFn: async (data: InventoryFormData) => {
      const url = editingItem ? `/api/inventory/${editingItem.id}` : "/api/inventory";
      const method = editingItem ? "PATCH" : "POST";
      return apiRequest(url, { method, body: JSON.stringify(data) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      setIsItemDialogOpen(false);
      setEditingItem(null);
      itemForm.reset();
      toast({
        title: "Sucesso!",
        description: editingItem ? "Item atualizado com sucesso!" : "Item cadastrado com sucesso!",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao salvar item. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  // Registrar movimentação
  const movementMutation = useMutation({
    mutationFn: async (data: MovementFormData) => {
      return apiRequest("/api/inventory/movements", { 
        method: "POST", 
        body: JSON.stringify(data) 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/movements"] });
      setIsMovementDialogOpen(false);
      movementForm.reset();
      toast({
        title: "Sucesso!",
        description: "Movimentação registrada com sucesso!",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao registrar movimentação. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  // Deletar item
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/inventory/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      toast({
        title: "Sucesso!",
        description: "Item removido com sucesso!",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao remover item. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (item: any) => {
    setEditingItem(item);
    itemForm.reset({
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      minQuantity: item.minQuantity,
      maxQuantity: item.maxQuantity,
      unitPrice: item.unitPrice,
      supplier: item.supplier || "",
      description: item.description || "",
      expirationDate: item.expirationDate || "",
    });
    setIsItemDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("Tem certeza que deseja remover este item?")) {
      deleteMutation.mutate(id);
    }
  };

  const onItemSubmit = (data: InventoryFormData) => {
    itemMutation.mutate(data);
  };

  const onMovementSubmit = (data: MovementFormData) => {
    movementMutation.mutate(data);
  };

  // Filtrar itens
  const filteredItems = inventoryItems.filter((item: any) => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Estatísticas
  const lowStockItems = inventoryItems.filter((item: any) => item.quantity <= item.minQuantity);
  const totalValue = inventoryItems.reduce((sum: number, item: any) => sum + (item.quantity * item.unitPrice), 0);
  const categories = [...new Set(inventoryItems.map((item: any) => item.category))];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getStockStatus = (item: any) => {
    if (item.quantity <= item.minQuantity) return { status: "low", color: "destructive" };
    if (item.quantity >= item.maxQuantity) return { status: "high", color: "secondary" };
    return { status: "normal", color: "default" };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Controle de Estoque</h1>
          <p className="text-neutral-medium">Gerencie materiais e equipamentos da clínica</p>
        </div>
        
        <div className="flex space-x-2">
          <Dialog open={isMovementDialogOpen} onOpenChange={setIsMovementDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" onClick={() => movementForm.reset()}>
                <TrendingUp className="h-4 w-4 mr-2" />
                Movimentação
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Registrar Movimentação</DialogTitle>
                <DialogDescription>
                  Registre entrada ou saída de materiais do estoque
                </DialogDescription>
              </DialogHeader>
              
              <Form {...movementForm}>
                <form onSubmit={movementForm.handleSubmit(onMovementSubmit)} className="space-y-4">
                  <FormField
                    control={movementForm.control}
                    name="itemId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Item</FormLabel>
                        <Select onValueChange={(value) => field.onChange(parseInt(value))}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o item" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {inventoryItems.map((item: any) => (
                              <SelectItem key={item.id} value={item.id.toString()}>
                                {item.name} (Estoque: {item.quantity})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={movementForm.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="in">Entrada</SelectItem>
                              <SelectItem value="out">Saída</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={movementForm.control}
                      name="quantity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Quantidade</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={movementForm.control}
                    name="reason"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Motivo</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ex: Compra, Uso em procedimento, Vencimento" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={movementForm.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Observações</FormLabel>
                        <FormControl>
                          <Textarea {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => setIsMovementDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={movementMutation.isPending}>
                      {movementMutation.isPending ? "Registrando..." : "Registrar"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          <Dialog open={isItemDialogOpen} onOpenChange={setIsItemDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditingItem(null); itemForm.reset(); }}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Item
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingItem ? "Editar Item" : "Novo Item"}</DialogTitle>
                <DialogDescription>
                  {editingItem ? "Atualize as informações do item" : "Cadastre um novo item no estoque"}
                </DialogDescription>
              </DialogHeader>
              
              <Form {...itemForm}>
                <form onSubmit={itemForm.handleSubmit(onItemSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={itemForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome do Item</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={itemForm.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Categoria</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione a categoria" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="materiais_consumo">Materiais de Consumo</SelectItem>
                              <SelectItem value="instrumentos">Instrumentos</SelectItem>
                              <SelectItem value="equipamentos">Equipamentos</SelectItem>
                              <SelectItem value="medicamentos">Medicamentos</SelectItem>
                              <SelectItem value="protese">Prótese</SelectItem>
                              <SelectItem value="ortodontia">Ortodontia</SelectItem>
                              <SelectItem value="limpeza">Limpeza</SelectItem>
                              <SelectItem value="outros">Outros</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={itemForm.control}
                      name="quantity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Quantidade Atual</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={itemForm.control}
                      name="minQuantity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Estoque Mínimo</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={itemForm.control}
                      name="maxQuantity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Estoque Máximo</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={itemForm.control}
                      name="unitPrice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Preço Unitário (R$)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01"
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={itemForm.control}
                      name="supplier"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Fornecedor</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={itemForm.control}
                    name="expirationDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data de Validade</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={itemForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descrição</FormLabel>
                        <FormControl>
                          <Textarea {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => setIsItemDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={itemMutation.isPending}>
                      {itemMutation.isPending ? "Salvando..." : editingItem ? "Atualizar" : "Cadastrar"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-medium">Total de Itens</p>
                <p className="text-2xl font-bold">{inventoryItems.length}</p>
              </div>
              <Package className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-medium">Estoque Baixo</p>
                <p className="text-2xl font-bold text-red-600">{lowStockItems.length}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-medium">Valor Total</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(totalValue)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-medium">Categorias</p>
                <p className="text-2xl font-bold">{categories.length}</p>
              </div>
              <Package className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex space-x-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-medium h-4 w-4" />
          <Input
            placeholder="Buscar itens..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category} value={category}>
                {category.replace('_', ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Low Stock Alert */}
      {lowStockItems.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
              <CardTitle className="text-red-800">Alerta de Estoque Baixo</CardTitle>
            </div>
            <CardDescription className="text-red-700">
              {lowStockItems.length} item(ns) com estoque abaixo do mínimo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {lowStockItems.slice(0, 3).map((item: any) => (
                <div key={item.id} className="flex justify-between items-center">
                  <span className="font-medium">{item.name}</span>
                  <Badge variant="destructive">
                    {item.quantity} / {item.minQuantity} mín
                  </Badge>
                </div>
              ))}
              {lowStockItems.length > 3 && (
                <p className="text-sm text-red-600">
                  E mais {lowStockItems.length - 3} itens...
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Inventory Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-300 rounded mb-4"></div>
                <div className="h-3 bg-gray-200 rounded mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item: any) => {
            const stockStatus = getStockStatus(item);
            return (
              <Card key={item.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{item.name}</CardTitle>
                      <CardDescription>{item.category.replace('_', ' ')}</CardDescription>
                    </div>
                    <div className="flex space-x-1">
                      <Button size="sm" variant="outline" onClick={() => handleEdit(item)}>
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => handleDelete(item.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-neutral-medium">Estoque:</span>
                    <Badge variant={stockStatus.color as any}>
                      {item.quantity} unidades
                    </Badge>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-neutral-medium">Valor unitário:</span>
                    <span className="font-medium">{formatCurrency(item.unitPrice)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-neutral-medium">Valor total:</span>
                    <span className="font-bold text-green-600">
                      {formatCurrency(item.quantity * item.unitPrice)}
                    </span>
                  </div>
                  
                  {item.supplier && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-neutral-medium">Fornecedor:</span>
                      <span className="text-sm">{item.supplier}</span>
                    </div>
                  )}
                  
                  {item.expirationDate && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-neutral-medium">Validade:</span>
                      <span className="text-sm">
                        {new Date(item.expirationDate).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {!isLoading && filteredItems.length === 0 && (
        <div className="text-center py-12">
          <Package className="h-12 w-12 text-neutral-medium mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Nenhum item encontrado</h3>
          <p className="text-neutral-medium mb-4">
            {searchTerm || categoryFilter !== "all" 
              ? "Tente ajustar seus filtros" 
              : "Comece cadastrando seu primeiro item"}
          </p>
          {!searchTerm && categoryFilter === "all" && (
            <Button onClick={() => setIsItemDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Cadastrar Primeiro Item
            </Button>
          )}
        </div>
      )}
    </div>
  );
}