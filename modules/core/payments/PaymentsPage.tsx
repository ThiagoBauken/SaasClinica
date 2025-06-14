import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../../../client/src/components/ui/card';
import { Button } from '../../../client/src/components/ui/button';
import { Badge } from '../../../client/src/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../client/src/components/ui/tabs';
import { 
  CreditCard, 
  DollarSign, 
  Calendar, 
  CheckCircle,
  XCircle,
  Clock,
  Receipt,
  Download,
  Plus
} from 'lucide-react';
import { useToast } from '../../../client/src/hooks/use-toast';

interface Subscription {
  id: string;
  planId: string;
  planName: string;
  status: 'active' | 'canceled' | 'pending' | 'expired';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  nextBillingDate: string;
}

interface Payment {
  id: string;
  subscriptionId: string;
  amount: number;
  currency: string;
  status: 'approved' | 'pending' | 'rejected' | 'cancelled';
  paymentDate: string;
  paymentMethod: string;
  mercadoPagoId?: string;
  description: string;
}

interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  interval: 'monthly' | 'yearly';
  features: string[];
  isPopular?: boolean;
}

export function PaymentsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  const { data: currentSubscription, isLoading: subscriptionLoading } = useQuery({
    queryKey: ['/api/payments/subscription'],
    select: (data: Subscription) => data
  });

  const { data: payments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ['/api/payments/history'],
    select: (data: Payment[]) => data || []
  });

  const { data: availablePlans = [], isLoading: plansLoading } = useQuery({
    queryKey: ['/api/payments/plans'],
    select: (data: Plan[]) => data || []
  });

  const subscribeMutation = useMutation({
    mutationFn: async (planId: string) => {
      const response = await fetch('/api/payments/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId })
      });
      if (!response.ok) throw new Error('Falha ao processar assinatura');
      return response.json();
    },
    onSuccess: (data) => {
      if (data.initPoint) {
        // Redirecionar para Mercado Pago
        window.location.href = data.initPoint;
      } else {
        queryClient.invalidateQueries({ queryKey: ['/api/payments/subscription'] });
        toast({
          title: "Assinatura criada",
          description: "Sua assinatura foi processada com sucesso.",
        });
      }
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao processar assinatura.",
        variant: "destructive",
      });
    }
  });

  const cancelSubscriptionMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/payments/cancel', {
        method: 'POST'
      });
      if (!response.ok) throw new Error('Falha ao cancelar assinatura');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/payments/subscription'] });
      toast({
        title: "Assinatura cancelada",
        description: "Sua assinatura foi cancelada com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao cancelar assinatura.",
        variant: "destructive",
      });
    }
  });

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { label: 'Ativa', variant: 'default' as const, icon: CheckCircle },
      pending: { label: 'Pendente', variant: 'secondary' as const, icon: Clock },
      canceled: { label: 'Cancelada', variant: 'destructive' as const, icon: XCircle },
      expired: { label: 'Expirada', variant: 'destructive' as const, icon: XCircle },
      approved: { label: 'Aprovado', variant: 'default' as const, icon: CheckCircle },
      rejected: { label: 'Rejeitado', variant: 'destructive' as const, icon: XCircle }
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

  const formatCurrency = (amount: number, currency: string = 'BRL') => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency
    }).format(amount / 100);
  };

  const isLoading = subscriptionLoading || paymentsLoading || plansLoading;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pagamentos e Assinatura</h1>
          <p className="text-muted-foreground">
            Gerencie sua assinatura e histórico de pagamentos
          </p>
        </div>
      </div>

      <Tabs defaultValue="subscription" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="subscription">Assinatura Atual</TabsTrigger>
          <TabsTrigger value="plans">Planos Disponíveis</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>

        {/* Current Subscription */}
        <TabsContent value="subscription" className="space-y-4">
          {currentSubscription ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Plano {currentSubscription.planName}</span>
                  {getStatusBadge(currentSubscription.status)}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Valor Mensal</label>
                    <div className="text-2xl font-bold">
                      {formatCurrency(currentSubscription.amount, currentSubscription.currency)}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Próximo Pagamento</label>
                    <div className="text-lg font-semibold">
                      {new Date(currentSubscription.nextBillingDate).toLocaleDateString('pt-BR')}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Método de Pagamento</label>
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      {currentSubscription.paymentMethod}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Período Atual</label>
                    <div className="text-sm">
                      {new Date(currentSubscription.currentPeriodStart).toLocaleDateString('pt-BR')} até{' '}
                      {new Date(currentSubscription.currentPeriodEnd).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                </div>

                {currentSubscription.status === 'active' && (
                  <div className="flex space-x-4">
                    <Button variant="outline">
                      <CreditCard className="mr-2 h-4 w-4" />
                      Alterar Método de Pagamento
                    </Button>
                    <Button 
                      variant="destructive" 
                      onClick={() => cancelSubscriptionMutation.mutate()}
                      disabled={cancelSubscriptionMutation.isPending}
                    >
                      {cancelSubscriptionMutation.isPending ? "Cancelando..." : "Cancelar Assinatura"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <CreditCard className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 text-lg font-semibold">Nenhuma assinatura ativa</h3>
                  <p className="mt-2 text-muted-foreground">
                    Escolha um plano para começar a usar o sistema.
                  </p>
                  <Button className="mt-4">
                    <Plus className="mr-2 h-4 w-4" />
                    Ver Planos Disponíveis
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Available Plans */}
        <TabsContent value="plans" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {availablePlans.map((plan) => (
              <Card key={plan.id} className={`relative ${plan.isPopular ? 'border-blue-500 shadow-lg' : ''}`}>
                {plan.isPopular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-blue-500">Mais Popular</Badge>
                  </div>
                )}
                
                <CardHeader>
                  <CardTitle className="text-center">
                    <div className="text-xl font-bold">{plan.name}</div>
                    <div className="text-3xl font-bold mt-2">
                      {formatCurrency(plan.price, plan.currency)}
                      <span className="text-sm font-normal text-muted-foreground">
                        /{plan.interval === 'monthly' ? 'mês' : 'ano'}
                      </span>
                    </div>
                  </CardTitle>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <p className="text-center text-muted-foreground">{plan.description}</p>
                  
                  <ul className="space-y-2">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button 
                    className="w-full"
                    onClick={() => subscribeMutation.mutate(plan.id)}
                    disabled={subscribeMutation.isPending || currentSubscription?.planId === plan.id}
                  >
                    {currentSubscription?.planId === plan.id 
                      ? "Plano Atual" 
                      : subscribeMutation.isPending ? "Processando..." : "Assinar Plano"
                    }
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Payment History */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Histórico de Pagamentos</span>
                <Button variant="outline" size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  Exportar
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <div className="text-center py-8">
                  <Receipt className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 text-lg font-semibold">Nenhum pagamento encontrado</h3>
                  <p className="mt-2 text-muted-foreground">
                    Seus pagamentos aparecerão aqui quando processados.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {payments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                          {getStatusBadge(payment.status)}
                        </div>
                        
                        <div className="space-y-1">
                          <div className="font-semibold">{payment.description}</div>
                          <div className="text-sm text-muted-foreground">
                            {new Date(payment.paymentDate).toLocaleDateString('pt-BR')} • {payment.paymentMethod}
                          </div>
                          {payment.mercadoPagoId && (
                            <div className="text-xs text-muted-foreground">
                              ID: {payment.mercadoPagoId}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-bold">
                          {formatCurrency(payment.amount, payment.currency)}
                        </div>
                        <Button variant="ghost" size="sm" className="mt-1">
                          <Receipt className="h-4 w-4 mr-1" />
                          Recibo
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default PaymentsPage;