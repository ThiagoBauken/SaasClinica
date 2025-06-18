import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../../../client/src/components/ui/card';
import { Button } from '../../../client/src/components/ui/button';
import { Badge } from '../../../client/src/components/ui/badge';
import { Input } from '../../../client/src/components/ui/input';
import { 
  Package, 
  Plus, 
  Search,
  AlertTriangle,
  CheckCircle,
  TrendingDown,
  TrendingUp,
  Calendar,
  Archive,
  Edit,
  Trash2
} from 'lucide-react';
import { useToast } from '../../../client/src/hooks/use-toast';

interface InventoryItem {
  id: number;
  name: string;
  category: string;
  currentStock: number;
  minimumStock: number;
  maximumStock: number;
  unit: string;
  costPerUnit: number;
  expirationDate?: string;
  supplier: string;
  location: string;
  status: 'in_stock' | 'low_stock' | 'out_of_stock' | 'expired';
}

interface InventoryCategory {
  id: number;
  name: string;
  description: string;
  itemCount: number;
}

export function EstoquePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['/api/inventory/items'],
    select: (data: InventoryItem[]) => data || []
  });

  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ['/api/inventory/categories'],
    select: (data: InventoryCategory[]) => data || []
  });

  const createItemMutation = useMutation({
    mutationFn: async (itemData: Partial<InventoryItem>) => {
      const response = await fetch('/api/inventory/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(itemData)
      });
      if (!response.ok) throw new Error('Failed to create item');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/items'] });
      toast({
        title: "Item criado",
        description: "Novo item foi adicionado ao estoque.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao criar item.",
        variant: "destructive",
      });
    }
  });

  const updateStockMutation = useMutation({
    mutationFn: async ({ id, quantity, type }: { id: number; quantity: number; type: 'add' | 'remove' }) => {
      const response = await fetch(`/api/inventory/items/${id}/stock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity, type })
      });
      if (!response.ok) throw new Error('Failed to update stock');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/items'] });
      toast({
        title: "Estoque atualizado",
        description: "Quantidade em estoque foi atualizada.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao atualizar estoque.",
        variant: "destructive",
      });
    }
  });

  const getStatusBadge = (item: InventoryItem) => {
    if (item.expirationDate && new Date(item.expirationDate) < new Date()) {
      return <Badge variant="destructive" className="flex items-center gap-1">
        <AlertTriangle className="h-3 w-3" />
        Vencido
      </Badge>;
    }
    
    if (item.currentStock === 0) {
      return <Badge variant="destructive" className="flex items-center gap-1">
        <AlertTriangle className="h-3 w-3" />
        Sem Estoque
      </Badge>;
    }
    
    if (item.currentStock <= item.minimumStock) {
      return <Badge variant="secondary" className="flex items-center gap-1">
        <TrendingDown className="h-3 w-3" />
        Estoque Baixo
      </Badge>;
    }
    
    return <Badge variant="default" className="flex items-center gap-1">
      <CheckCircle className="h-3 w-3" />
      Em Estoque
    </Badge>;
  };

  const getInventoryStats = () => {
    return {
      total: items.length,
      inStock: items.filter(item => item.currentStock > item.minimumStock).length,
      lowStock: items.filter(item => item.currentStock <= item.minimumStock && item.currentStock > 0).length,
      outOfStock: items.filter(item => item.currentStock === 0).length,
      expired: items.filter(item => item.expirationDate && new Date(item.expirationDate) < new Date()).length
    };
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.supplier.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const stats = getInventoryStats();
  const isLoading = itemsLoading || categoriesLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Carregando estoque...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Controle de Estoque</h1>
          <p className="text-muted-foreground">
            Gerencie materiais, equipamentos e insumos odontológicos
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Novo Item
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Itens</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Estoque</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.inStock}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estoque Baixo</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.lowStock}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sem Estoque</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.outOfStock}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vencidos</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{stats.expired}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros e Busca</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, categoria ou fornecedor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="border rounded-md px-3 py-2"
            >
              <option value="all">Todas as Categorias</option>
              {categories.map(category => (
                <option key={category.id} value={category.name}>
                  {category.name} ({category.itemCount})
                </option>
              ))}
            </select>
            <Button variant="outline">Relatório</Button>
          </div>
        </CardContent>
      </Card>

      {/* Inventory Items List */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Itens</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredItems.length === 0 ? (
            <div className="text-center py-8">
              <Package className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">
                {searchTerm || selectedCategory !== 'all' ? 'Nenhum item encontrado' : 'Nenhum item no estoque'}
              </h3>
              <p className="mt-2 text-muted-foreground">
                {searchTerm || selectedCategory !== 'all'
                  ? 'Tente ajustar os filtros de busca.'
                  : 'Comece adicionando os primeiros itens ao estoque.'
                }
              </p>
              {!searchTerm && selectedCategory === 'all' && (
                <Button className="mt-4">
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar Primeiro Item
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      {getStatusBadge(item)}
                    </div>
                    
                    <div className="space-y-1">
                      <div className="font-semibold">{item.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {item.category} • {item.supplier}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Localização: {item.location}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-6">
                    <div className="text-right space-y-1">
                      <div className="font-semibold">
                        {item.currentStock} {item.unit}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Min: {item.minimumStock} • Max: {item.maximumStock}
                      </div>
                      <div className="text-sm font-medium">
                        R$ {(item.costPerUnit / 100).toFixed(2)}/{item.unit}
                      </div>
                      {item.expirationDate && (
                        <div className="text-sm text-muted-foreground">
                          Vence: {new Date(item.expirationDate).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex flex-col space-y-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => updateStockMutation.mutate({ id: item.id, quantity: 1, type: 'add' })}
                        disabled={updateStockMutation.isPending}
                      >
                        <TrendingUp className="h-4 w-4 mr-1" />
                        Adicionar
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => updateStockMutation.mutate({ id: item.id, quantity: 1, type: 'remove' })}
                        disabled={updateStockMutation.isPending || item.currentStock === 0}
                      >
                        <TrendingDown className="h-4 w-4 mr-1" />
                        Remover
                      </Button>
                    </div>

                    <div className="flex space-x-2">
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default EstoquePage;