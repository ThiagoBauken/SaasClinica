import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../../../client/src/components/ui/card';
import { Button } from '../../../client/src/components/ui/button';
import { Badge } from '../../../client/src/components/ui/badge';
import { Input } from '../../../client/src/components/ui/input';
import { 
  Smile, 
  Plus, 
  Search,
  Calendar,
  User,
  Building,
  CheckCircle,
  Clock,
  AlertCircle,
  Package
} from 'lucide-react';
import { useToast } from '../../../client/src/hooks/use-toast';

interface Prosthesis {
  id: number;
  patientName: string;
  procedure: string;
  laboratoryName: string;
  requestDate: string;
  deliveryDate?: string;
  status: 'pending' | 'in_progress' | 'ready' | 'delivered';
  notes?: string;
  cost: number;
}

export function ProtesesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');

  const { data: prostheses = [], isLoading } = useQuery({
    queryKey: ['/api/prosthesis'],
    select: (data: Prosthesis[]) => data || []
  });

  const createMutation = useMutation({
    mutationFn: async (prosthesisData: Partial<Prosthesis>) => {
      const response = await fetch('/api/prosthesis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prosthesisData)
      });
      if (!response.ok) throw new Error('Failed to create prosthesis');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/prosthesis'] });
      toast({
        title: "Prótese criada",
        description: "Nova prótese foi registrada com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao criar prótese.",
        variant: "destructive",
      });
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const response = await fetch(`/api/prosthesis/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (!response.ok) throw new Error('Failed to update prosthesis');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/prosthesis'] });
      toast({
        title: "Status atualizado",
        description: "Status da prótese foi atualizado com sucesso.",
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
      in_progress: { label: 'Em Produção', variant: 'default' as const, icon: Package },
      ready: { label: 'Pronta', variant: 'outline' as const, icon: CheckCircle },
      delivered: { label: 'Entregue', variant: 'destructive' as const, icon: CheckCircle }
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

  const getStatusStats = () => {
    return {
      total: prostheses.length,
      pending: prostheses.filter(p => p.status === 'pending').length,
      inProgress: prostheses.filter(p => p.status === 'in_progress').length,
      ready: prostheses.filter(p => p.status === 'ready').length,
      delivered: prostheses.filter(p => p.status === 'delivered').length
    };
  };

  const filteredProstheses = prostheses.filter(prosthesis =>
    prosthesis.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    prosthesis.procedure.toLowerCase().includes(searchTerm.toLowerCase()) ||
    prosthesis.laboratoryName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = getStatusStats();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Carregando próteses...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Controle de Próteses</h1>
          <p className="text-muted-foreground">
            Gerencie o processo de fabricação e entrega de próteses
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Nova Prótese
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Smile className="h-4 w-4 text-muted-foreground" />
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
            <div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prontas</CardTitle>
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
                placeholder="Buscar por paciente, procedimento ou laboratório..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline">Filtrar por Status</Button>
            <Button variant="outline">Filtrar por Data</Button>
          </div>
        </CardContent>
      </Card>

      {/* Prostheses List */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Próteses</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredProstheses.length === 0 ? (
            <div className="text-center py-8">
              <Smile className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">
                {searchTerm ? 'Nenhuma prótese encontrada' : 'Nenhuma prótese cadastrada'}
              </h3>
              <p className="mt-2 text-muted-foreground">
                {searchTerm 
                  ? 'Tente ajustar os filtros de busca.'
                  : 'Comece registrando a primeira prótese do sistema.'
                }
              </p>
              {!searchTerm && (
                <Button className="mt-4">
                  <Plus className="mr-2 h-4 w-4" />
                  Registrar Primeira Prótese
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredProstheses.map((prosthesis) => (
                <div
                  key={prosthesis.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      {getStatusBadge(prosthesis.status)}
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold">{prosthesis.patientName}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Smile className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">{prosthesis.procedure}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Building className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">{prosthesis.laboratoryName}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="text-right space-y-1">
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">Solicitado: {new Date(prosthesis.requestDate).toLocaleDateString()}</span>
                      </div>
                      {prosthesis.deliveryDate && (
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">Entrega: {new Date(prosthesis.deliveryDate).toLocaleDateString()}</span>
                        </div>
                      )}
                      <div className="text-sm font-semibold">
                        R$ {(prosthesis.cost / 100).toFixed(2)}
                      </div>
                    </div>
                    
                    <div className="flex flex-col space-y-2">
                      {prosthesis.status === 'pending' && (
                        <Button 
                          size="sm" 
                          onClick={() => updateStatusMutation.mutate({ id: prosthesis.id, status: 'in_progress' })}
                          disabled={updateStatusMutation.isPending}
                        >
                          Iniciar Produção
                        </Button>
                      )}
                      {prosthesis.status === 'in_progress' && (
                        <Button 
                          size="sm" 
                          onClick={() => updateStatusMutation.mutate({ id: prosthesis.id, status: 'ready' })}
                          disabled={updateStatusMutation.isPending}
                        >
                          Marcar como Pronta
                        </Button>
                      )}
                      {prosthesis.status === 'ready' && (
                        <Button 
                          size="sm" 
                          onClick={() => updateStatusMutation.mutate({ id: prosthesis.id, status: 'delivered' })}
                          disabled={updateStatusMutation.isPending}
                        >
                          Marcar como Entregue
                        </Button>
                      )}
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

export default ProtesesPage;