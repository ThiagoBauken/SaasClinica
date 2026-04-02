import { useState, useEffect } from "react";
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
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import React from "react";
import { format, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Search, Plus, FileText, Edit, Trash2, Calendar as CalendarIcon, Package, PackageOpen, BarChart4, Package2, RefreshCw, AlertTriangle, ArrowDownUp, Check, Filter, ListFilter, Download, Plus as PlusIcon, Minus, Sparkles, Loader2, Tag, Building, Phone, Mail } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import type { InventoryItem, InventoryCategory, InventoryTransaction } from "@shared/schema";

// Mock data removed - all data fetched from real API

export default function InventoryPage() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTab, setSelectedTab] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [showLowStock, setShowLowStock] = useState(false);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [editingCategory, setEditingCategory] = useState<InventoryCategory | null>(null);
  const [transactionType, setTransactionType] = useState<"entrada" | "saida" | "ajuste" | null>(null);
  const [transactionItem, setTransactionItem] = useState<InventoryItem | null>(null);
  const [transactionQuantity, setTransactionQuantity] = useState<number>(1);
  const [transactionReason, setTransactionReason] = useState<string>("");
  const [transactionNotes, setTransactionNotes] = useState<string>("");
  const [itemToDelete, setItemToDelete] = useState<InventoryItem | null>(null);
  const [expirationDate, setExpirationDate] = useState<Date | undefined>(undefined);
  const [lastPurchaseDate, setLastPurchaseDate] = useState<Date | undefined>(undefined);
  const [newCategoryColor, setNewCategoryColor] = useState<string>("#3498db");
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<number[]>([]);
  const [standardProducts, setStandardProducts] = useState<any[]>([]);
  const [productSearchTerm, setProductSearchTerm] = useState("");
  const [selectedProductCategory, setSelectedProductCategory] = useState<string>("all");
  const [isSeedModalOpen, setIsSeedModalOpen] = useState(false);
  const [selectedSeedCategories, setSelectedSeedCategories] = useState<Set<string>>(new Set());
  const [selectedSeedItems, setSelectedSeedItems] = useState<Record<string, Set<string>>>({});
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Quick adjustment state
  const [quickAdjustItem, setQuickAdjustItem] = useState<InventoryItem | null>(null);
  const [quickAdjustValue, setQuickAdjustValue] = useState<number>(0);

  // Supplier state (localStorage fallback)
  interface Supplier {
    id: number;
    name: string;
    contactPerson: string;
    phone: string;
    email: string;
    address: string;
    notes: string;
  }
  const SUPPLIERS_KEY = "inventory_suppliers";
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => {
    try {
      const stored = localStorage.getItem(SUPPLIERS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);
  const [isSupplierDeleteOpen, setIsSupplierDeleteOpen] = useState(false);

  const saveSuppliers = (updated: Supplier[]) => {
    setSuppliers(updated);
    try {
      localStorage.setItem(SUPPLIERS_KEY, JSON.stringify(updated));
    } catch {
      // ignore storage errors
    }
  };

  const handleSaveSupplier = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const supplierData: Supplier = {
      id: editingSupplier ? editingSupplier.id : Date.now(),
      name: formData.get("supplierName") as string,
      contactPerson: formData.get("contactPerson") as string,
      phone: formData.get("phone") as string,
      email: formData.get("email") as string,
      address: formData.get("address") as string,
      notes: formData.get("notes") as string,
    };
    if (editingSupplier) {
      saveSuppliers(suppliers.map(s => s.id === editingSupplier.id ? supplierData : s));
    } else {
      saveSuppliers([...suppliers, supplierData]);
    }
    setIsSupplierModalOpen(false);
    setEditingSupplier(null);
    toast({ title: "Sucesso", description: "Fornecedor salvo com sucesso!" });
  };

  const handleDeleteSupplier = () => {
    if (supplierToDelete) {
      saveSuppliers(suppliers.filter(s => s.id !== supplierToDelete.id));
      setIsSupplierDeleteOpen(false);
      setSupplierToDelete(null);
      toast({ title: "Sucesso", description: "Fornecedor excluído com sucesso!" });
    }
  };

  // Buscar dados do estoque
  const { data: inventoryItems, isLoading: isLoadingItems, error: itemsError } = useQuery<InventoryItem[]>({
    queryKey: ["/api/inventory/items"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/inventory/items");
      if (!res.ok) {
        throw new Error(`Failed to load inventory items: ${res.status}`);
      }
      return await res.json();
    }
  });

  // Buscar categorias
  const { data: inventoryCategories, isLoading: isLoadingCategories, error: categoriesError } = useQuery<InventoryCategory[]>({
    queryKey: ["/api/inventory/categories"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/inventory/categories");
      if (!res.ok) {
        throw new Error(`Failed to load categories: ${res.status}`);
      }
      return await res.json();
    }
  });

  // Buscar produtos odontológicos padrão
  const { data: standardProductsData } = useQuery<any[]>({
    queryKey: ["/api/inventory/standard-products"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/inventory/standard-products");
      if (!res.ok) throw new Error("Falha ao carregar produtos padrão");
      return await res.json();
    }
  });

  // Atualizar produtos padrão quando os dados chegarem
  React.useEffect(() => {
    if (standardProductsData) {
      setStandardProducts(standardProductsData);
    }
  }, [standardProductsData]);

  // Mutation para importar produtos padrão
  const importProductsMutation = useMutation({
    mutationFn: async (productIds: number[]) => {
      const res = await apiRequest("POST", "/api/inventory/import-standard", { productIds });
      if (!res.ok) throw new Error("Falha ao importar produtos");
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/categories"] });
      setIsImportModalOpen(false);
      setSelectedProducts([]);
      toast({
        title: "Sucesso",
        description: `${data.length} produtos foram importados com sucesso!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: `Falha ao importar produtos: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  // Query para buscar dados de seed disponíveis
  const { data: seedData, isLoading: isSeedDataLoading } = useQuery({
    queryKey: ["/api/inventory/seed-defaults"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/inventory/seed-defaults");
      if (!res.ok) throw new Error("Falha ao carregar dados de seed");
      return await res.json();
    },
    enabled: isSeedModalOpen, // Só busca quando o modal está aberto
  });

  // Efeito para inicializar seleção quando os dados de seed são carregados
  useEffect(() => {
    if (seedData?.categories && isSeedModalOpen) {
      // Seleciona todas as categorias e itens por padrão
      const allCategories = new Set<string>(seedData.categories.map((c: any) => c.name));
      setSelectedSeedCategories(allCategories);

      const allItems: Record<string, Set<string>> = {};
      seedData.categories.forEach((cat: any) => {
        allItems[cat.name] = new Set(cat.items.map((item: any) => item.name));
      });
      setSelectedSeedItems(allItems);
    }
  }, [seedData, isSeedModalOpen]);

  // Mutation para popular estoque com dados padrão
  const seedInventoryMutation = useMutation({
    mutationFn: async (selection: { categoryNames: string[]; itemsByCategory: Record<string, string[]> }) => {
      const res = await apiRequest("POST", "/api/inventory/seed-defaults", selection);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Falha ao popular estoque");
      }
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/categories"] });
      setIsSeedModalOpen(false);
      toast({
        title: "Estoque Populado!",
        description: `${data.categoriesCreated} categorias e ${data.itemsCreated} itens foram criados com sucesso!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Mutation para salvar item
  const saveItemMutation = useMutation({
    mutationFn: async (itemData: Partial<InventoryItem>) => {
      try {
        if (itemData.id) {
          // Atualização
          const res = await apiRequest("PATCH", `/api/inventory/items/${itemData.id}`, itemData);
          return await res.json();
        } else {
          // Criação
          const res = await apiRequest("POST", "/api/inventory/items", itemData);
          return await res.json();
        }
      } catch (error) {
        console.error("Erro ao salvar item:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/items"] });
      setIsItemModalOpen(false);
      setEditingItem(null);
      setExpirationDate(undefined);
      setLastPurchaseDate(undefined);
      toast({
        title: "Sucesso",
        description: "Item de estoque salvo com sucesso!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: `Falha ao salvar item: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  // Mutation para salvar categoria
  const saveCategoryMutation = useMutation({
    mutationFn: async (categoryData: Partial<InventoryCategory>) => {
      try {
        if (categoryData.id) {
          // Atualização
          const res = await apiRequest("PATCH", `/api/inventory/categories/${categoryData.id}`, categoryData);
          return await res.json();
        } else {
          // Criação
          const res = await apiRequest("POST", "/api/inventory/categories", categoryData);
          return await res.json();
        }
      } catch (error) {
        console.error("Erro ao salvar categoria:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/categories"] });
      setIsCategoryModalOpen(false);
      setEditingCategory(null);
      setIsCreatingCategory(false);
      toast({
        title: "Sucesso",
        description: "Categoria salva com sucesso!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: `Falha ao salvar categoria: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  // Mutation para registrar transação de estoque
  const transactionMutation = useMutation({
    mutationFn: async (transactionData: Partial<InventoryTransaction>) => {
      try {
        const res = await apiRequest("POST", "/api/inventory/transactions", transactionData);
        return await res.json();
      } catch (error) {
        console.error("Erro ao registrar transação:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/items"] });
      setIsTransactionModalOpen(false);
      setTransactionItem(null);
      setTransactionQuantity(1);
      setTransactionReason("");
      setTransactionNotes("");
      setTransactionType(null);
      toast({
        title: "Sucesso",
        description: "Movimentação de estoque registrada com sucesso!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: `Falha ao registrar movimentação: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  // Mutation para excluir item
  const deleteItemMutation = useMutation({
    mutationFn: async (id: number) => {
      try {
        const res = await apiRequest("DELETE", `/api/inventory/items/${id}`);
        return await res.json();
      } catch (error) {
        console.error("Erro ao excluir item:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/items"] });
      setIsDeleteModalOpen(false);
      setItemToDelete(null);
      toast({
        title: "Sucesso",
        description: "Item excluído com sucesso!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: `Falha ao excluir item: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  // Mutation para ajuste rápido de estoque
  const quickAdjustMutation = useMutation({
    mutationFn: async ({ item, delta }: { item: InventoryItem; delta: number }) => {
      const newStock = Math.max(0, (item.currentStock || 0) + delta);
      const transactionData: Partial<InventoryTransaction> = {
        itemId: item.id,
        type: delta > 0 ? "entrada" : delta < 0 ? "saida" : "ajuste",
        quantity: Math.abs(delta),
        reason: delta > 0 ? "compra" : "consumo",
        notes: "Ajuste rápido",
        previousStock: item.currentStock || 0,
        newStock: newStock,
        userId: 1
      };
      const res = await apiRequest("POST", "/api/inventory/transactions", transactionData);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/items"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: `Falha ao ajustar estoque: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  // Handler para ajuste rápido (+1 ou -1)
  const handleQuickAdjust = (item: InventoryItem, delta: number) => {
    if (delta < 0 && (item.currentStock || 0) + delta < 0) {
      toast({
        title: "Atenção",
        description: "Estoque não pode ficar negativo.",
        variant: "destructive",
      });
      return;
    }
    quickAdjustMutation.mutate({ item, delta });
  };

  // Abrir modal de edição de item
  const handleEditItem = (item: InventoryItem) => {
    setEditingItem(item);
    
    // Converter datas
    if (item.expirationDate) {
      const dateObj = item.expirationDate instanceof Date ? item.expirationDate : new Date(item.expirationDate);
      setExpirationDate(isValid(dateObj) ? dateObj : undefined);
    } else {
      setExpirationDate(undefined);
    }

    if (item.lastPurchaseDate) {
      const dateObj = item.lastPurchaseDate instanceof Date ? item.lastPurchaseDate : new Date(item.lastPurchaseDate);
      setLastPurchaseDate(isValid(dateObj) ? dateObj : undefined);
    } else {
      setLastPurchaseDate(undefined);
    }
    
    setIsItemModalOpen(true);
  };

  // Abrir modal de exclusão
  const handleDeleteItem = (item: InventoryItem) => {
    setItemToDelete(item);
    setIsDeleteModalOpen(true);
  };

  // Abrir modal de transação
  const handleOpenTransactionModal = (type: "entrada" | "saida" | "ajuste", item: InventoryItem) => {
    setTransactionType(type);
    setTransactionItem(item);
    setTransactionQuantity(1);
    setIsTransactionModalOpen(true);
  };

  // Salvar um item
  const handleSaveItem = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    
    // Extrair dados do formulário
    const itemData: Partial<InventoryItem> = {
      name: formData.get("name") as string,
      description: formData.get("description") as string,
      categoryId: parseInt(formData.get("categoryId") as string),
      sku: formData.get("sku") as string,
      barcode: formData.get("barcode") as string,
      brand: formData.get("brand") as string,
      supplier: formData.get("supplier") as string,
      minimumStock: parseInt(formData.get("minimumStock") as string),
      currentStock: parseInt(formData.get("currentStock") as string),
      price: Math.round(parseFloat(formData.get("price") as string) * 100),
      unitOfMeasure: formData.get("unitOfMeasure") as string,
      location: formData.get("location") as string,
      active: formData.get("active") === "on"
    };
    
    // Adicionar datas se existirem
    if (expirationDate) {
      itemData.expirationDate = expirationDate;
    }

    if (lastPurchaseDate) {
      itemData.lastPurchaseDate = lastPurchaseDate;
    }
    
    // Se estiver editando, adicionar ID
    if (editingItem) {
      itemData.id = editingItem.id;
    }
    
    saveItemMutation.mutate(itemData);
  };

  // Salvar categoria
  const handleSaveCategory = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    
    const categoryData: Partial<InventoryCategory> = {
      name: formData.get("name") as string,
      description: formData.get("description") as string,
      color: newCategoryColor
    };
    
    if (editingCategory) {
      categoryData.id = editingCategory.id;
    }
    
    saveCategoryMutation.mutate(categoryData);
  };

  // Registrar transação de estoque
  const handleSaveTransaction = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    if (!transactionItem || !transactionType) return;

    let newStock = transactionItem.currentStock || 0;
    if (transactionType === "entrada") {
      newStock += transactionQuantity;
    } else if (transactionType === "saida") {
      newStock -= transactionQuantity;
    } else {
      // Ajuste: a quantidade informada é o novo valor do estoque
      newStock = transactionQuantity;
    }

    const transactionData: Partial<InventoryTransaction> = {
      itemId: transactionItem.id,
      type: transactionType,
      quantity: transactionQuantity,
      reason: transactionReason,
      notes: transactionNotes,
      previousStock: transactionItem.currentStock || 0,
      newStock: newStock,
      userId: 1 // ID do usuário logado
    };
    
    transactionMutation.mutate(transactionData);
  };

  // Função para retornar a unidade de medida no plural
  const getPluralUnit = (unit: string): string => {
    const pluralMap: Record<string, string> = {
      'unidade': 'unidades',
      'caixa': 'caixas',
      'pacote': 'pacotes',
      'kit': 'kits',
      'rolo': 'rolos',
      'litro': 'litros',
      'pote': 'potes',
      'seringa': 'seringas'
    };
    
    return pluralMap[unit] || `${unit}s`;
  };

  // Filtrar itens com base nos critérios selecionados
  const filteredItems = inventoryItems ? inventoryItems.filter(item => {
    // Filtro por termo de busca
    const matchesSearch = 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.barcode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.brand?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Filtro por categoria
    const matchesCategory = selectedCategory === "all" || 
      item.categoryId === parseInt(selectedCategory);
    
    // Filtro por estoque baixo
    const matchesLowStock = !showLowStock ||
      ((item.currentStock || 0) <= (item.minimumStock || 0));
    
    return matchesSearch && matchesCategory && matchesLowStock;
  }) : [];

  // Filter standard products based on search and category
  const getFilteredStandardProducts = () => {
    if (!standardProducts || standardProducts.length === 0) return [];
    
    return standardProducts.filter(product => {
      const matchesSearch = !productSearchTerm || 
        product.name?.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
        product.description?.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
        product.brand?.toLowerCase().includes(productSearchTerm.toLowerCase());
      
      const matchesCategory = selectedProductCategory === "all" || 
        product.category === selectedProductCategory;
      
      return matchesSearch && matchesCategory;
    });
  };

  // Verificar se o produto está próximo da validade (30 dias)
  const isExpiringProduct = (expiryDate: string | Date | null): boolean => {
    if (!expiryDate) return false;
    
    const expiry = new Date(expiryDate);
    const today = new Date();
    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(today.getDate() + 30);
    
    return expiry <= thirtyDaysLater && expiry >= today;
  };
  
  // Verificar se o produto está vencido
  const isExpiredProduct = (expiryDate: string | Date | null): boolean => {
    if (!expiryDate) return false;
    
    const expiry = new Date(expiryDate);
    const today = new Date();
    
    return expiry < today;
  };

  // Dados de resumo para o dashboard
  const inventorySummary = {
    totalItems: inventoryItems?.length || 0,
    totalCategories: inventoryCategories?.length || 0,
    totalValue: inventoryItems?.reduce((acc, item) => acc + ((item.price || 0) * (item.currentStock || 0)), 0) || 0,
    lowStockItems: inventoryItems?.filter(item => (item.currentStock || 0) <= (item.minimumStock || 0)).length || 0,
    expiringItems: inventoryItems?.filter(item => isExpiringProduct(item.expirationDate)).length || 0,
    expiredItems: inventoryItems?.filter(item => isExpiredProduct(item.expirationDate)).length || 0
  };

  // Alert data derived from inventoryItems
  const lowStockAlerts = inventoryItems
    ? inventoryItems.filter(item => (item.currentStock || 0) <= (item.minimumStock || 0))
    : [];

  const expiryAlerts = inventoryItems
    ? inventoryItems.filter(item => {
        if (!item.expirationDate) return false;
        const expiry = new Date(item.expirationDate);
        const today = new Date();
        const thirtyDaysLater = new Date();
        thirtyDaysLater.setDate(today.getDate() + 30);
        return expiry <= thirtyDaysLater;
      })
    : [];

  const getDaysUntilExpiry = (expiryDate: Date | string | null): number => {
    if (!expiryDate) return Infinity;
    const expiry = new Date(expiryDate);
    const today = new Date();
    return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  return (
    <DashboardLayout title="Controle de Estoque" currentPath="/inventory">
      {/* Dashboard e filtros */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Itens</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{inventorySummary.totalItems}</div>
              <Package className="h-5 w-5 text-primary" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Categorias</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{inventorySummary.totalCategories}</div>
              <PackageOpen className="h-5 w-5 text-primary" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Valor Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
                  .format(inventorySummary.totalValue / 100)}
              </div>
              <BarChart4 className="h-5 w-5 text-primary" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Estoque Baixo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{inventorySummary.lowStockItems}</div>
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Controles de filtro e ações */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-medium" />
          <Input
            placeholder="Buscar item por nome, código, marca..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="lowStock" 
              checked={showLowStock}
              onCheckedChange={(checked) => setShowLowStock(!!checked)} 
            />
            <label
              htmlFor="lowStock"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Apenas estoque baixo
            </label>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Todas as categorias" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {isLoadingCategories ? (
                <SelectItem value="loading" disabled>Carregando categorias...</SelectItem>
              ) : categoriesError ? (
                <SelectItem value="error" disabled>Erro ao carregar categorias</SelectItem>
              ) : inventoryCategories && inventoryCategories.length > 0 ? (
                inventoryCategories.map((category) => (
                  <SelectItem key={category.id} value={category.id.toString()}>
                    {category.name}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="empty" disabled>Nenhuma categoria encontrada</SelectItem>
              )}
            </SelectContent>
          </Select>
          
          <Button variant="outline" onClick={() => {
            setEditingCategory(null);
            setIsCategoryModalOpen(true);
          }}>
            Categorias
          </Button>

          {/* Botão para popular estoque com dados padrão - só mostra se não houver categorias */}
          {(!inventoryCategories || inventoryCategories.length === 0) && (
            <Button
              variant="outline"
              onClick={() => setIsSeedModalOpen(true)}
              className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Popular Estoque
            </Button>
          )}

          <Button variant="outline" onClick={() => setIsImportModalOpen(true)}>
            <Download className="mr-2 h-4 w-4" />
            Importar Produtos
          </Button>
          
          <Button onClick={() => {
            setEditingItem(null);
            setExpirationDate(undefined);
            setLastPurchaseDate(undefined);
            setIsItemModalOpen(true);
          }}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Item
          </Button>
        </div>
      </div>
      
      {/* Tabs principais */}
      <Tabs defaultValue="items" className="w-full">
        <TabsList className="mb-4 flex flex-wrap h-auto gap-1">
          <TabsTrigger value="items" className="flex items-center gap-1">
            <Package className="h-4 w-4" />
            Itens
          </TabsTrigger>
          <TabsTrigger value="suppliers" className="flex items-center gap-1">
            <Building className="h-4 w-4" />
            Fornecedores
          </TabsTrigger>
          <TabsTrigger value="alerts" className="flex items-center gap-1 relative">
            <AlertTriangle className="h-4 w-4" />
            Alertas
            {(lowStockAlerts.length + expiryAlerts.length) > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs">
                {lowStockAlerts.length + expiryAlerts.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Tab: Itens */}
        <TabsContent value="items">
      {/* Tabela de itens */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Estoque Atual</TableHead>
              <TableHead>Estoque Mínimo</TableHead>
              <TableHead>Preço</TableHead>
              <TableHead>Validade</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoadingItems ? (
              <TableRow>
                <TableCell colSpan={8} className="py-16">
                  <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="text-sm">Carregando itens do estoque...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredItems.length === 0 && (inventoryItems?.length ?? 0) > 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12">
                  <div className="flex flex-col items-center justify-center gap-2 text-center">
                    <Search className="h-10 w-10 text-muted-foreground/40" />
                    <p className="text-sm font-medium">Nenhum item corresponde aos filtros aplicados</p>
                    <p className="text-xs text-muted-foreground">Tente ajustar a busca ou remover os filtros ativos.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-0 border-0">
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Package className="h-16 w-16 text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Nenhum item no estoque</h3>
                    <p className="text-muted-foreground mb-4 max-w-md text-sm">
                      Comece importando produtos odontológicos padrão ou adicione itens manualmente.
                    </p>
                    <div className="flex gap-3">
                      <Button variant="outline" onClick={() => setIsSeedModalOpen(true)}>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Popular com Dados Padrão
                      </Button>
                      <Button onClick={() => {
                        setEditingItem(null);
                        setExpirationDate(undefined);
                        setLastPurchaseDate(undefined);
                        setIsItemModalOpen(true);
                      }}>
                        <Plus className="h-4 w-4 mr-2" /> Adicionar Item
                      </Button>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredItems.map((item) => {
                const category = inventoryCategories?.find(c => c.id === item.categoryId);
                const isLowStock = (item.currentStock || 0) <= (item.minimumStock || 0);
                const unit = item.unitOfMeasure || 'unidade';

                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="font-medium">{item.name}</div>
                      <div className="text-sm text-muted-foreground">{item.brand}</div>
                    </TableCell>
                    <TableCell>
                      {category && category.color && (
                        <Badge
                          style={{
                            backgroundColor: `${category.color}20`,
                            color: category.color,
                            borderColor: category.color
                          }}
                          variant="outline"
                        >
                          {category.name}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{item.sku}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => handleQuickAdjust(item, -1)}
                                disabled={(item.currentStock || 0) <= 0 || quickAdjustMutation.isPending}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Diminuir 1</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <div className={`min-w-[40px] text-center font-medium ${isLowStock ? "text-red-500" : ""}`}>
                          {item.currentStock || 0}
                        </div>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => handleQuickAdjust(item, 1)}
                                disabled={quickAdjustMutation.isPending}
                              >
                                <PlusIcon className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Adicionar 1</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <span className="text-xs text-muted-foreground hidden sm:inline">
                          {(item.currentStock || 0) !== 1 ? getPluralUnit(unit) : unit}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{item.minimumStock || 0} {(item.minimumStock || 0) !== 1 ? getPluralUnit(unit) : unit}</TableCell>
                    <TableCell>
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
                        .format((item.price || 0) / 100)}
                    </TableCell>
                    <TableCell>
                      {item.expirationDate ? format(new Date(item.expirationDate), 'dd/MM/yyyy') : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleOpenTransactionModal("entrada", item)}
                        >
                          <ArrowDownUp className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleEditItem(item)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleDeleteItem(item)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
        </TabsContent>

        {/* Tab: Fornecedores */}
        <TabsContent value="suppliers">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">Fornecedores</h2>
              <p className="text-sm text-muted-foreground">
                Gerencie os fornecedores dos produtos do seu estoque.
                <span className="ml-1 text-amber-600">(Dados salvos localmente no navegador)</span>
              </p>
            </div>
            <Button onClick={() => { setEditingSupplier(null); setIsSupplierModalOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Fornecedor
            </Button>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-16">
                      <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
                        <Building className="h-12 w-12 opacity-40" />
                        <p className="text-sm font-medium">Nenhum fornecedor cadastrado</p>
                        <p className="text-xs">Clique em "Novo Fornecedor" para adicionar.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  suppliers.map(supplier => (
                    <TableRow key={supplier.id}>
                      <TableCell className="font-medium">{supplier.name}</TableCell>
                      <TableCell>{supplier.contactPerson || "-"}</TableCell>
                      <TableCell>
                        {supplier.phone ? (
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            {supplier.phone}
                          </div>
                        ) : "-"}
                      </TableCell>
                      <TableCell>
                        {supplier.email ? (
                          <div className="flex items-center gap-1">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            {supplier.email}
                          </div>
                        ) : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => { setEditingSupplier(supplier); setIsSupplierModalOpen(true); }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => { setSupplierToDelete(supplier); setIsSupplierDeleteOpen(true); }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Tab: Alertas */}
        <TabsContent value="alerts">
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Itens com Estoque Baixo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-amber-600">{lowStockAlerts.length}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {lowStockAlerts.filter(i => (i.currentStock || 0) === 0).length} com estoque zerado
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-red-500" />
                  Próximos ao Vencimento
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-600">{expiryAlerts.length}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {expiryAlerts.filter(i => getDaysUntilExpiry(i.expirationDate ?? null) <= 0).length} já vencidos
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Estoque Baixo */}
          <div className="mb-6">
            <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Estoque Baixo
            </h3>
            {lowStockAlerts.length === 0 ? (
              <div className="rounded-md border p-8 text-center text-muted-foreground">
                <Package className="mx-auto h-10 w-10 opacity-40 mb-2" />
                <p className="text-sm">Nenhum item com estoque abaixo do mínimo.</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Estoque Atual</TableHead>
                      <TableHead>Estoque Mínimo</TableHead>
                      <TableHead>Diferença</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lowStockAlerts.map(item => {
                      const diff = (item.currentStock || 0) - (item.minimumStock || 0);
                      const isCritical = (item.currentStock || 0) === 0;
                      return (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="font-medium">{item.name}</div>
                            {item.brand && <div className="text-xs text-muted-foreground">{item.brand}</div>}
                          </TableCell>
                          <TableCell className={isCritical ? "text-red-600 font-bold" : "text-amber-600 font-medium"}>
                            {item.currentStock || 0} {item.unitOfMeasure || "un"}
                          </TableCell>
                          <TableCell>{item.minimumStock || 0} {item.unitOfMeasure || "un"}</TableCell>
                          <TableCell className="text-red-500 font-medium">{diff} {item.unitOfMeasure || "un"}</TableCell>
                          <TableCell>
                            {isCritical ? (
                              <Badge variant="destructive">CRITICO</Badge>
                            ) : (
                              <Badge className="bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-100" variant="outline">BAIXO</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {/* Próximos ao Vencimento */}
          <div>
            <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-red-500" />
              Próximos ao Vencimento (30 dias)
            </h3>
            {expiryAlerts.length === 0 ? (
              <div className="rounded-md border p-8 text-center text-muted-foreground">
                <CalendarIcon className="mx-auto h-10 w-10 opacity-40 mb-2" />
                <p className="text-sm">Nenhum item vencido ou próximo ao vencimento.</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Data de Validade</TableHead>
                      <TableHead>Dias Restantes</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expiryAlerts
                      .slice()
                      .sort((a, b) => getDaysUntilExpiry(a.expirationDate ?? null) - getDaysUntilExpiry(b.expirationDate ?? null))
                      .map(item => {
                        const days = getDaysUntilExpiry(item.expirationDate ?? null);
                        const isExpired = days <= 0;
                        return (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div className="font-medium">{item.name}</div>
                              {item.brand && <div className="text-xs text-muted-foreground">{item.brand}</div>}
                            </TableCell>
                            <TableCell>
                              {item.expirationDate ? format(new Date(item.expirationDate), "dd/MM/yyyy") : "-"}
                            </TableCell>
                            <TableCell className={isExpired ? "text-red-600 font-bold" : "text-amber-600 font-medium"}>
                              {isExpired ? `Vencido há ${Math.abs(days)} dia(s)` : `${days} dia(s)`}
                            </TableCell>
                            <TableCell>
                              {isExpired ? (
                                <Badge variant="destructive">VENCIDO</Badge>
                              ) : (
                                <Badge className="bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-100" variant="outline">PROXIMO</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>

      </Tabs>

      {/* Modal de Novo/Editar Item */}
      <Dialog open={isItemModalOpen} onOpenChange={setIsItemModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Editar Item" : "Novo Item"}</DialogTitle>
            <DialogDescription>
              {editingItem 
                ? "Atualize as informações do item no estoque." 
                : "Adicione um novo item ao estoque."}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSaveItem} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Item*</Label>
                <Input 
                  id="name" 
                  name="name" 
                  placeholder="Nome do produto" 
                  required
                  defaultValue={editingItem?.name || ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="categoryId">Categoria*</Label>
                <Select defaultValue={editingItem?.categoryId?.toString()} name="categoryId" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {inventoryCategories?.map((category) => (
                      <SelectItem key={category.id} value={category.id.toString()}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea 
                id="description" 
                name="description" 
                placeholder="Detalhes sobre o item" 
                defaultValue={editingItem?.description || ""}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sku">Código (SKU)</Label>
                <Input 
                  id="sku" 
                  name="sku" 
                  placeholder="Código do produto" 
                  defaultValue={editingItem?.sku || ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="barcode">Código de Barras</Label>
                <Input 
                  id="barcode" 
                  name="barcode" 
                  placeholder="Código de barras" 
                  defaultValue={editingItem?.barcode || ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="brand">Marca</Label>
                <Input 
                  id="brand" 
                  name="brand" 
                  placeholder="Marca do produto" 
                  defaultValue={editingItem?.brand || ""}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="supplier">Fornecedor</Label>
                <Input 
                  id="supplier" 
                  name="supplier" 
                  placeholder="Nome do fornecedor" 
                  defaultValue={editingItem?.supplier || ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Localização</Label>
                <Input 
                  id="location" 
                  name="location" 
                  placeholder="Local de armazenamento" 
                  defaultValue={editingItem?.location || ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unitOfMeasure">Unidade de Medida*</Label>
                <Select defaultValue={editingItem?.unitOfMeasure || "unidade"} name="unitOfMeasure" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma unidade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unidade">Unidade</SelectItem>
                    <SelectItem value="caixa">Caixa</SelectItem>
                    <SelectItem value="pacote">Pacote</SelectItem>
                    <SelectItem value="kit">Kit</SelectItem>
                    <SelectItem value="rolo">Rolo</SelectItem>
                    <SelectItem value="litro">Litro</SelectItem>
                    <SelectItem value="pote">Pote</SelectItem>
                    <SelectItem value="seringa">Seringa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Preço (R$)*</Label>
                <Input 
                  id="price" 
                  name="price" 
                  type="number" 
                  step="0.01"
                  min="0"
                  placeholder="0,00" 
                  required
                  defaultValue={(editingItem?.price || 0) / 100}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currentStock">Estoque Atual*</Label>
                <Input 
                  id="currentStock" 
                  name="currentStock" 
                  type="number" 
                  min="0"
                  placeholder="0" 
                  required
                  defaultValue={editingItem?.currentStock || 0}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="minimumStock">Estoque Mínimo*</Label>
                <Input 
                  id="minimumStock" 
                  name="minimumStock" 
                  type="number" 
                  min="0"
                  placeholder="0" 
                  required
                  defaultValue={editingItem?.minimumStock || 0}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="expirationDate">Data de Validade</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {expirationDate ? (
                        format(expirationDate, "dd/MM/yyyy")
                      ) : (
                        <span>Selecione a validade</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={expirationDate}
                      onSelect={setExpirationDate}
                      locale={ptBR}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastPurchaseDate">Data da Última Compra</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {lastPurchaseDate ? (
                        format(lastPurchaseDate, "dd/MM/yyyy")
                      ) : (
                        <span>Selecione a data</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={lastPurchaseDate}
                      onSelect={setLastPurchaseDate}
                      locale={ptBR}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="active"
                name="active"
                defaultChecked={editingItem ? (editingItem.active ?? true) : true}
              />
              <label
                htmlFor="active"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Item ativo
              </label>
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsItemModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saveItemMutation.isPending}>
                {saveItemMutation.isPending && (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                )}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Modal de Categorias */}
      <Dialog open={isCategoryModalOpen} onOpenChange={setIsCategoryModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCategory ? "Editar Categoria" : "Gerenciar Categorias"}</DialogTitle>
            <DialogDescription>
              {editingCategory 
                ? "Atualize as informações da categoria." 
                : "Crie e gerencie categorias para organizar seus itens de estoque."}
            </DialogDescription>
          </DialogHeader>
          
          {!editingCategory && (
            <div className="mb-6">
              <div className="rounded-md border mb-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cor</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingCategories ? (
                      <TableRow>
                        <TableCell colSpan={4} className="py-8">
                          <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                            <span className="text-sm">Carregando categorias...</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : !inventoryCategories?.length ? (
                      <TableRow>
                        <TableCell colSpan={4} className="py-10">
                          <div className="flex flex-col items-center justify-center gap-2 text-center">
                            <Tag className="h-10 w-10 text-muted-foreground/40" />
                            <p className="text-sm font-medium">Nenhuma categoria cadastrada</p>
                            <p className="text-xs text-muted-foreground">
                              Use o botão abaixo para criar sua primeira categoria.
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      inventoryCategories.map((category) => (
                        <TableRow key={category.id}>
                          <TableCell>
                            <div
                              className="w-6 h-6 rounded-full"
                              style={{ backgroundColor: category.color || '#3498db' }}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{category.name}</TableCell>
                          <TableCell>{category.description}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditingCategory(category);
                                setNewCategoryColor(category.color || '#3498db');
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              
              <Button 
                variant="outline" 
                onClick={() => {
                  setEditingCategory(null);
                  setIsCreatingCategory(true);
                  setNewCategoryColor("#3498db");
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Nova Categoria
              </Button>
            </div>
          )}
          
          {(editingCategory || isCreatingCategory || !inventoryCategories?.length) && (
            <form onSubmit={handleSaveCategory} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Categoria*</Label>
                <Input 
                  id="name" 
                  name="name" 
                  placeholder="Nome da categoria" 
                  required
                  defaultValue={editingCategory?.name || ""}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea 
                  id="description" 
                  name="description" 
                  placeholder="Descrição da categoria" 
                  defaultValue={editingCategory?.description || ""}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Cor</Label>
                <div className="flex flex-wrap gap-2">
                  {[
                    "#dc2626", // Red
                    "#ea580c", // Orange  
                    "#ca8a04", // Yellow
                    "#16a34a", // Green
                    "#059669", // Emerald
                    "#0891b2", // Cyan
                    "#2563eb", // Blue
                    "#7c3aed", // Violet
                    "#9333ea", // Purple
                    "#c2410c", // Orange Red
                    "#be123c", // Rose
                    "#7c2d12", // Brown
                    "#374151", // Gray
                    "#1f2937", // Dark Gray
                    "#0f172a", // Slate
                    "#ec4899"  // Pink
                  ].map((color) => (
                    <div 
                      key={color}
                      className={`w-8 h-8 rounded-full cursor-pointer transition-all border-2 ${
                        newCategoryColor === color ? 'ring-2 ring-offset-2 ring-primary border-primary' : 'border-border hover:border-muted-foreground'
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => setNewCategoryColor(color)}
                    />
                  ))}
                </div>
                <div className="mt-2">
                  <Label htmlFor="customColor" className="text-sm">Cor personalizada</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      id="customColor"
                      type="color"
                      value={newCategoryColor}
                      onChange={(e) => setNewCategoryColor(e.target.value)}
                      className="w-10 h-8 rounded border cursor-pointer"
                    />
                    <span className="text-sm text-muted-foreground">{newCategoryColor}</span>
                  </div>
                </div>
              </div>
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setEditingCategory(null);
                    setIsCreatingCategory(false);
                    if (inventoryCategories?.length === 0) {
                      setIsCategoryModalOpen(false);
                    }
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={saveCategoryMutation.isPending}>
                  {saveCategoryMutation.isPending && (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Salvar
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Modal de Transação */}
      <Dialog open={isTransactionModalOpen} onOpenChange={setIsTransactionModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {transactionType === "entrada" ? "Entrada de Estoque" : 
               transactionType === "saida" ? "Saída de Estoque" : 
               "Ajuste de Estoque"}
            </DialogTitle>
            <DialogDescription>
              {transactionItem && (
                <span className="font-medium">{transactionItem.name}</span>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSaveTransaction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">
                {transactionType === "ajuste" ? "Novo Valor de Estoque" : "Quantidade"}
              </Label>
              <Input
                id="quantity"
                type="number"
                min={transactionType === "saida" ? 1 : 0}
                max={transactionType === "saida" ? (transactionItem?.currentStock ?? undefined) : undefined}
                value={transactionQuantity}
                onChange={(e) => setTransactionQuantity(parseInt(e.target.value) || 0)}
                required
              />
              {transactionType === "ajuste" && (
                <p className="text-sm text-muted-foreground">
                  Estoque atual: {transactionItem?.currentStock} {transactionItem?.unitOfMeasure}
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="reason">Motivo</Label>
              <Select 
                value={transactionReason} 
                onValueChange={setTransactionReason}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um motivo" />
                </SelectTrigger>
                <SelectContent>
                  {transactionType === "entrada" ? (
                    <>
                      <SelectItem value="compra">Compra</SelectItem>
                      <SelectItem value="devolucao">Devolução</SelectItem>
                      <SelectItem value="transferencia">Transferência</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </>
                  ) : transactionType === "saida" ? (
                    <>
                      <SelectItem value="consumo">Consumo</SelectItem>
                      <SelectItem value="paciente">Consumo em Paciente</SelectItem>
                      <SelectItem value="perda">Perda/Quebra</SelectItem>
                      <SelectItem value="vencimento">Vencimento</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="inventario">Inventário</SelectItem>
                      <SelectItem value="correcao">Correção</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea 
                id="notes" 
                value={transactionNotes}
                onChange={(e) => setTransactionNotes(e.target.value)}
                placeholder="Detalhes adicionais sobre a movimentação"
              />
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsTransactionModalOpen(false)}>
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={
                  transactionMutation.isPending || 
                  (transactionType === "saida" && (transactionQuantity > (transactionItem?.currentStock || 0)))
                }
              >
                {transactionMutation.isPending && (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                )}
                Confirmar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Modal de Confirmação de Exclusão */}
      <AlertDialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Item</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este item do estoque? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (itemToDelete) {
                  deleteItemMutation.mutate(itemToDelete.id);
                }
              }}
              disabled={deleteItemMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteItemMutation.isPending && (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              )}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de Importação de Produtos Padrão */}
      <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Importar Produtos Odontológicos Padrão</DialogTitle>
            <DialogDescription>
              Selecione os produtos odontológicos padrão que deseja adicionar ao seu estoque.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Filtros de pesquisa */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar produtos..."
                  className="pl-9"
                  value={productSearchTerm}
                  onChange={(e) => setProductSearchTerm(e.target.value)}
                />
              </div>
              <Select value={selectedProductCategory} onValueChange={setSelectedProductCategory}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Todas as categorias" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as categorias</SelectItem>
                  <SelectItem value="Materiais Restauradores">Materiais Restauradores</SelectItem>
                  <SelectItem value="Anestésicos">Anestésicos</SelectItem>
                  <SelectItem value="Produtos de Higiene">Produtos de Higiene</SelectItem>
                  <SelectItem value="Instrumentos">Instrumentos</SelectItem>
                  <SelectItem value="Materiais Preventivos">Materiais Preventivos</SelectItem>
                  <SelectItem value="Materiais Cirúrgicos">Materiais Cirúrgicos</SelectItem>
                  <SelectItem value="Materiais Protéticos">Materiais Protéticos</SelectItem>
                  <SelectItem value="Equipamentos">Equipamentos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Lista de produtos */}
            <div className="border rounded-lg max-h-96 overflow-y-auto">
              <div className="p-4 border-b bg-muted/20">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">
                      {selectedProducts.length} produto(s) selecionado(s)
                    </span>
                    {selectedProductCategory !== "all" && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Categoria: {selectedProductCategory} ({getFilteredStandardProducts().length} produtos)
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const filteredProducts = getFilteredStandardProducts();
                        setSelectedProducts(filteredProducts.map(p => p.id));
                      }}
                    >
                      Selecionar Todos Filtrados
                    </Button>
                    {selectedProductCategory !== "all" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const categoryProducts = standardProducts.filter(p => p.category === selectedProductCategory);
                          setSelectedProducts(categoryProducts.map(p => p.id));
                        }}
                      >
                        Selecionar Toda Categoria
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedProducts([])}
                    >
                      Limpar Seleção
                    </Button>
                  </div>
                </div>
              </div>
              
              <div className="p-2 space-y-1">
                {selectedProductCategory === "all" ? (
                  // Group products by category when showing all
                  (Object.entries(
                    getFilteredStandardProducts().reduce((groups, product) => {
                      const category = product.category;
                      if (!groups[category]) groups[category] = [];
                      groups[category].push(product);
                      return groups;
                    }, {} as Record<string, any[]>)
                  ) as [string, any[]][]).map(([category, products]) => (
                    <div key={category} className="mb-4">
                      <div className="flex items-center justify-between p-2 bg-muted/30 rounded-t">
                        <h4 className="font-medium text-sm">{category}</h4>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {products.length} produto(s)
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => {
                              const categoryProductIds = products.map((p: any) => p.id);
                              const allSelected = categoryProductIds.every((id: any) => selectedProducts.includes(id));
                              if (allSelected) {
                                setSelectedProducts(selectedProducts.filter((id: any) => !categoryProductIds.includes(id)));
                              } else {
                                setSelectedProducts(Array.from(new Set([...selectedProducts, ...categoryProductIds])));
                              }
                            }}
                          >
                            {products.every((p: any) => selectedProducts.includes(p.id)) ? "Desmarcar" : "Selecionar"} Categoria
                          </Button>
                        </div>
                      </div>
                      {products.map((product: any) => (
                        <div key={product.id} className="flex items-center space-x-3 p-2 hover:bg-muted/50 rounded border-l-2 border-muted">
                          <Checkbox
                            checked={selectedProducts.includes(product.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedProducts([...selectedProducts, product.id]);
                              } else {
                                setSelectedProducts(selectedProducts.filter(id => id !== product.id));
                              }
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-sm">{product.name}</p>
                                <p className="text-xs text-muted-foreground">{product.description}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-medium">
                                  {new Intl.NumberFormat('pt-BR', { 
                                    style: 'currency', 
                                    currency: 'BRL' 
                                  }).format(product.estimatedPrice / 100)}
                                </p>
                                <p className="text-xs text-muted-foreground">{product.unitOfMeasure}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary" className="text-xs">
                                {product.brand}
                              </Badge>
                              {product.isPopular && (
                                <Badge variant="default" className="text-xs">
                                  Popular
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))
                ) : (
                  // Show products in simple list when filtered by category
                  getFilteredStandardProducts().map((product) => (
                    <div key={product.id} className="flex items-center space-x-3 p-2 hover:bg-muted/50 rounded">
                      <Checkbox
                        checked={selectedProducts.includes(product.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedProducts([...selectedProducts, product.id]);
                          } else {
                            setSelectedProducts(selectedProducts.filter(id => id !== product.id));
                          }
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm">{product.name}</p>
                            <p className="text-xs text-muted-foreground">{product.description}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">
                              {new Intl.NumberFormat('pt-BR', { 
                                style: 'currency', 
                                currency: 'BRL' 
                              }).format(product.estimatedPrice / 100)}
                            </p>
                            <p className="text-xs text-muted-foreground">{product.unitOfMeasure}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {product.category}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {product.brand}
                          </Badge>
                          {product.isPopular && (
                            <Badge variant="default" className="text-xs">
                              Popular
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                
                {getFilteredStandardProducts().length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="mx-auto h-12 w-12 mb-2 opacity-50" />
                    <p>Nenhum produto encontrado</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsImportModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (selectedProducts.length > 0) {
                  importProductsMutation.mutate(selectedProducts);
                }
              }}
              disabled={selectedProducts.length === 0 || importProductsMutation.isPending}
            >
              {importProductsMutation.isPending && (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              )}
              Importar {selectedProducts.length} Produto(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Seleção para Popular Estoque com Dados Padrão */}
      <Dialog open={isSeedModalOpen} onOpenChange={setIsSeedModalOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Popular Estoque com Dados Padrão
            </DialogTitle>
            <DialogDescription>
              Selecione as categorias e itens que deseja adicionar ao seu estoque. Os itens serão criados com estoque inicial zerado.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-2 space-y-3">
            {isSeedDataLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : seedData?.categories ? (
              <>
                {/* Seleção rápida */}
                <div className="flex items-center gap-4 pb-3 border-b">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const allCats = new Set<string>(seedData.categories.map((c: any) => c.name));
                      setSelectedSeedCategories(allCats);
                      const allItems: Record<string, Set<string>> = {};
                      seedData.categories.forEach((cat: any) => {
                        allItems[cat.name] = new Set(cat.items.map((item: any) => item.name));
                      });
                      setSelectedSeedItems(allItems);
                    }}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Selecionar Tudo
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedSeedCategories(new Set());
                      setSelectedSeedItems({});
                    }}
                  >
                    Limpar Seleção
                  </Button>
                  <span className="text-sm text-muted-foreground ml-auto">
                    {selectedSeedCategories.size} categorias selecionadas
                  </span>
                </div>

                {/* Lista de categorias */}
                <div className="space-y-2">
                  {seedData.categories.map((category: any) => {
                    const isSelected = selectedSeedCategories.has(category.name);
                    const isExpanded = expandedCategories.has(category.name);
                    const selectedItemCount = selectedSeedItems[category.name]?.size || 0;
                    const totalItemCount = category.items.length;

                    return (
                      <div key={category.name} className="border rounded-lg overflow-hidden">
                        <div
                          className="flex items-center gap-3 p-3 bg-muted/50 cursor-pointer hover:bg-muted/80"
                          onClick={() => {
                            const newExpanded = new Set(expandedCategories);
                            if (isExpanded) {
                              newExpanded.delete(category.name);
                            } else {
                              newExpanded.add(category.name);
                            }
                            setExpandedCategories(newExpanded);
                          }}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => {
                              const newSelected = new Set(selectedSeedCategories);
                              const newItems = { ...selectedSeedItems };

                              if (checked) {
                                newSelected.add(category.name);
                                newItems[category.name] = new Set(category.items.map((i: any) => i.name));
                              } else {
                                newSelected.delete(category.name);
                                delete newItems[category.name];
                              }

                              setSelectedSeedCategories(newSelected);
                              setSelectedSeedItems(newItems);
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: category.color }}
                          />
                          <div className="flex-1">
                            <div className="font-medium">{category.name}</div>
                            <div className="text-xs text-muted-foreground">{category.description}</div>
                          </div>
                          <Badge variant="secondary" className="mr-2">
                            {selectedItemCount}/{totalItemCount} itens
                          </Badge>
                          <svg
                            className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>

                        {/* Lista de itens expandida */}
                        {isExpanded && isSelected && (
                          <div className="p-3 pt-0 border-t bg-background">
                            <div className="flex items-center gap-2 py-2 mb-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => {
                                  const newItems = { ...selectedSeedItems };
                                  newItems[category.name] = new Set(category.items.map((i: any) => i.name));
                                  setSelectedSeedItems(newItems);
                                }}
                              >
                                Todos
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => {
                                  const newItems = { ...selectedSeedItems };
                                  newItems[category.name] = new Set();
                                  setSelectedSeedItems(newItems);
                                }}
                              >
                                Nenhum
                              </Button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-1 max-h-48 overflow-y-auto">
                              {category.items.map((item: any) => {
                                const itemSelected = selectedSeedItems[category.name]?.has(item.name);
                                return (
                                  <div
                                    key={item.name}
                                    className="flex items-center gap-2 p-2 rounded hover:bg-muted/50"
                                  >
                                    <Checkbox
                                      checked={itemSelected}
                                      onCheckedChange={(checked) => {
                                        const newItems = { ...selectedSeedItems };
                                        if (!newItems[category.name]) {
                                          newItems[category.name] = new Set();
                                        }
                                        if (checked) {
                                          newItems[category.name].add(item.name);
                                        } else {
                                          newItems[category.name].delete(item.name);
                                        }
                                        setSelectedSeedItems(newItems);
                                      }}
                                    />
                                    <div className="flex-1 text-sm">
                                      <span>{item.name}</span>
                                      {item.brand && (
                                        <span className="text-muted-foreground ml-1">({item.brand})</span>
                                      )}
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                      Mín: {item.minimumStock} {item.unitOfMeasure}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                Erro ao carregar dados. Tente novamente.
              </div>
            )}
          </div>

          <DialogFooter className="border-t pt-4">
            <div className="flex items-center gap-2 mr-auto text-sm text-muted-foreground">
              <Package className="h-4 w-4" />
              {selectedSeedCategories.size} categorias •{' '}
              {Object.values(selectedSeedItems).reduce((acc, set) => acc + set.size, 0)} itens selecionados
            </div>
            <Button variant="outline" onClick={() => setIsSeedModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                const categoryNames = Array.from(selectedSeedCategories);
                const itemsByCategory: Record<string, string[]> = {};
                Object.entries(selectedSeedItems).forEach(([cat, items]) => {
                  if (items.size > 0) {
                    itemsByCategory[cat] = Array.from(items);
                  }
                });
                seedInventoryMutation.mutate({ categoryNames, itemsByCategory });
              }}
              disabled={seedInventoryMutation.isPending || selectedSeedCategories.size === 0}
              className="bg-primary hover:bg-primary/90"
            >
              {seedInventoryMutation.isPending && (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              )}
              <Sparkles className="mr-2 h-4 w-4" />
              Popular Estoque
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Modal de Novo/Editar Fornecedor */}
      <Dialog open={isSupplierModalOpen} onOpenChange={(open) => { setIsSupplierModalOpen(open); if (!open) setEditingSupplier(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingSupplier ? "Editar Fornecedor" : "Novo Fornecedor"}</DialogTitle>
            <DialogDescription>
              {editingSupplier ? "Atualize os dados do fornecedor." : "Cadastre um novo fornecedor para o estoque."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveSupplier} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="supplierName">Nome do Fornecedor*</Label>
              <Input
                id="supplierName"
                name="supplierName"
                placeholder="Razão social ou nome comercial"
                required
                defaultValue={editingSupplier?.name || ""}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contactPerson">Pessoa de Contato</Label>
              <Input
                id="contactPerson"
                name="contactPerson"
                placeholder="Nome do responsável"
                defaultValue={editingSupplier?.contactPerson || ""}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  name="phone"
                  placeholder="(00) 00000-0000"
                  defaultValue={editingSupplier?.phone || ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="email@fornecedor.com"
                  defaultValue={editingSupplier?.email || ""}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Endereço</Label>
              <Input
                id="address"
                name="address"
                placeholder="Rua, número, cidade"
                defaultValue={editingSupplier?.address || ""}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                name="notes"
                placeholder="Informações adicionais sobre o fornecedor"
                defaultValue={editingSupplier?.notes || ""}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setIsSupplierModalOpen(false); setEditingSupplier(null); }}>
                Cancelar
              </Button>
              <Button type="submit">Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmar exclusão de fornecedor */}
      <AlertDialog open={isSupplierDeleteOpen} onOpenChange={setIsSupplierDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Fornecedor</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o fornecedor <strong>{supplierToDelete?.name}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSupplier}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </DashboardLayout>
  );
}