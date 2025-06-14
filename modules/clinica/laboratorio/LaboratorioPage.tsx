import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../../../client/src/components/ui/card';
import { Button } from '../../../client/src/components/ui/button';
import { Badge } from '../../../client/src/components/ui/badge';
import { Input } from '../../../client/src/components/ui/input';
import { Label } from '../../../client/src/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../client/src/components/ui/tabs';
import { 
  Building2, 
  Plus, 
  Search,
  MapPin,
  Phone,
  Mail,
  Star,
  Package,
  Clock,
  DollarSign,
  CheckCircle,
  AlertCircle,
  Edit,
  Trash2
} from 'lucide-react';
import { useToast } from '../../../client/src/hooks/use-toast';

interface Laboratory {
  id: number;
  name: string;
  cnpj: string;
  address: string;
  phone: string;
  email: string;
  website?: string;
  specialties: string[];
  rating: number;
  active: boolean;
  deliveryTime: number; // in days
  priceMultiplier: number; // percentage
}

interface LaboratoryOrder {
  id: number;
  laboratoryId: number;
  laboratoryName: string;
  patientName: string;
  procedure: string;
  orderDate: string;
  expectedDelivery: string;
  actualDelivery?: string;
  status: 'pending' | 'confirmed' | 'in_production' | 'ready' | 'delivered' | 'cancelled';
  price: number;
  notes?: string;
}

interface LaboratoryContract {
  id: number;
  laboratoryId: number;
  procedureType: string;
  basePrice: number;
  deliveryDays: number;
  qualityScore: number;
  active: boolean;
}

export function LaboratorioPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('laboratories');

  const { data: laboratories = [], isLoading: labsLoading } = useQuery({
    queryKey: ['/api/laboratories'],
    select: (data: Laboratory[]) => data || []
  });

  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['/api/laboratory/orders'],
    select: (data: LaboratoryOrder[]) => data || []
  });

  const { data: contracts = [], isLoading: contractsLoading } = useQuery({
    queryKey: ['/api/laboratory/contracts'],
    select: (data: LaboratoryContract[]) => data || []
  });

  const createOrderMutation = useMutation({
    mutationFn: async (orderData: Partial<LaboratoryOrder>) => {
      const response = await fetch('/api/laboratory/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      });
      if (!response.ok) throw new Error('Failed to create order');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/laboratory/orders'] });
      toast({
        title: "Pedido criado",
        description: "Novo pedido para laboratório foi registrado.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao criar pedido.",
        variant: "destructive",
      });
    }
  });

  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const response = await fetch(`/api/laboratory/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (!response.ok) throw new Error('Failed to update order');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/laboratory/orders'] });
      toast({
        title: "Status atualizado",
        description: "Status do pedido foi atualizado.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao atualizar status.",
        variant: "destructive",
      });
    }
  });

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: 'Pendente', variant: 'secondary' as const, icon: Clock },
      confirmed: { label: 'Confirmado', variant: 'default' as const, icon: CheckCircle },
      in_production: { label: 'Em Produção', variant: 'default' as const, icon: Package },
      ready: { label: 'Pronto', variant: 'outline' as const, icon: CheckCircle },
      delivered: { label: 'Entregue', variant: 'destructive' as const, icon: CheckCircle },
      cancelled: { label: 'Cancelado', variant: 'destructive' as const, icon: AlertCircle }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getOrderStats = () => {
    return {
      total: orders.length,
      pending: orders.filter(o => o.status === 'pending').length,
      inProduction: orders.filter(o => o.status === 'in_production').length,
      ready: orders.filter(o => o.status === 'ready').length,
      delivered: orders.filter(o => o.status === 'delivered').length
    };
  };

  const filteredLaboratories = laboratories.filter(lab =>
    lab.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lab.specialties.some(s => s.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredOrders = orders.filter(order =>
    order.laboratoryName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.procedure.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = getOrderStats();
  const isLoading = labsLoading || ordersLoading || contractsLoading;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestão de Laboratórios</h1>
          <p className="text-muted-foreground">
            Gerencie laboratórios parceiros e pedidos de próteses
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Novo Pedido
        </Button>
      </div>

      {/* Search Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar laboratórios, pedidos ou pacientes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pedidos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Produção</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.inProduction}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prontos</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.ready}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Entregues</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{stats.delivered}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="laboratories">Laboratórios</TabsTrigger>
          <TabsTrigger value="orders">Pedidos</TabsTrigger>
          <TabsTrigger value="contracts">Contratos</TabsTrigger>
        </TabsList>

        {/* Laboratories Tab */}
        <TabsContent value="laboratories" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Laboratórios Parceiros</CardTitle>
            </CardHeader>
            <CardContent>
              {filteredLaboratories.length === 0 ? (
                <div className="text-center py-8">
                  <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 text-lg font-semibold">
                    {searchTerm ? 'Nenhum laboratório encontrado' : 'Nenhum laboratório cadastrado'}
                  </h3>
                  <p className="mt-2 text-muted-foreground">
                    {searchTerm 
                      ? 'Tente ajustar os termos de busca.'
                      : 'Comece cadastrando o primeiro laboratório parceiro.'
                    }
                  </p>
                  {!searchTerm && (
                    <Button className="mt-4">
                      <Plus className="mr-2 h-4 w-4" />
                      Cadastrar Primeiro Laboratório
                    </Button>
                  )}
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredLaboratories.map((lab) => (
                    <Card key={lab.id} className={lab.active ? '' : 'opacity-60'}>
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <span className="truncate">{lab.name}</span>
                          <div className="flex items-center space-x-1">
                            <Star className="h-4 w-4 text-yellow-500 fill-current" />
                            <span className="text-sm">{lab.rating.toFixed(1)}</span>
                          </div>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-start space-x-2">
                          <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <span className="text-sm text-muted-foreground">{lab.address}</span>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{lab.phone}</span>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{lab.email}</span>
                        </div>

                        <div className="space-y-2">
                          <Label>Especialidades:</Label>
                          <div className="flex flex-wrap gap-1">
                            {lab.specialties.slice(0, 3).map((specialty, index) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {specialty}
                              </Badge>
                            ))}
                            {lab.specialties.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{lab.specialties.length - 3}
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="flex items-center space-x-1">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span>{lab.deliveryTime} dias</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                            <span>{lab.priceMultiplier}%</span>
                          </div>
                        </div>

                        <div className="flex justify-between items-center pt-2">
                          <Badge variant={lab.active ? "default" : "secondary"}>
                            {lab.active ? "Ativo" : "Inativo"}
                          </Badge>
                          <div className="flex space-x-2">
                            <Button variant="ghost" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
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

        {/* Orders Tab */}
        <TabsContent value="orders" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pedidos de Laboratório</CardTitle>
            </CardHeader>
            <CardContent>
              {filteredOrders.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 text-lg font-semibold">
                    {searchTerm ? 'Nenhum pedido encontrado' : 'Nenhum pedido registrado'}
                  </h3>
                  <p className="mt-2 text-muted-foreground">
                    {searchTerm 
                      ? 'Tente ajustar os termos de busca.'
                      : 'Comece criando o primeiro pedido para laboratório.'
                    }
                  </p>
                  {!searchTerm && (
                    <Button className="mt-4">
                      <Plus className="mr-2 h-4 w-4" />
                      Criar Primeiro Pedido
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredOrders.map((order) => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                          {getStatusBadge(order.status)}
                        </div>
                        
                        <div className="space-y-1">
                          <div className="font-semibold">{order.patientName}</div>
                          <div className="text-sm text-muted-foreground">
                            {order.procedure} • {order.laboratoryName}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Pedido: {new Date(order.orderDate).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4">
                        <div className="text-right space-y-1">
                          <div className="font-semibold">
                            R$ {(order.price / 100).toFixed(2)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Previsão: {new Date(order.expectedDelivery).toLocaleDateString()}
                          </div>
                          {order.actualDelivery && (
                            <div className="text-sm text-green-600">
                              Entregue: {new Date(order.actualDelivery).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                        
                        <div className="flex flex-col space-y-2">
                          {order.status === 'pending' && (
                            <Button 
                              size="sm"
                              onClick={() => updateOrderStatusMutation.mutate({ 
                                id: order.id, 
                                status: 'confirmed' 
                              })}
                              disabled={updateOrderStatusMutation.isPending}
                            >
                              Confirmar
                            </Button>
                          )}
                          {order.status === 'ready' && (
                            <Button 
                              size="sm"
                              onClick={() => updateOrderStatusMutation.mutate({ 
                                id: order.id, 
                                status: 'delivered' 
                              })}
                              disabled={updateOrderStatusMutation.isPending}
                            >
                              Entregar
                            </Button>
                          )}
                          <div className="flex space-x-1">
                            <Button variant="ghost" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contracts Tab */}
        <TabsContent value="contracts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Contratos e Preços</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">Gestão de Contratos</h3>
                <p className="mt-2 text-muted-foreground">
                  Em desenvolvimento - gestão de contratos e tabelas de preços será implementada em breve.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default LaboratorioPage;