import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import DashboardLayout from "@/layouts/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  CreditCard,
  Calendar,
  TrendingUp,
  Users,
  FileText,
  Download,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowUpCircle,
  Loader2,
  ExternalLink
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Types for billing data
interface BillingPlan {
  id: number;
  name: string;
  price: number;
  interval: 'month' | 'year';
  features: string[];
  // Flat limits for backwards compatibility
  maxUsers: number;
  maxPatients: number;
  maxAppointmentsPerMonth: number;
  maxStorageGb: number;
}

interface BillingSubscription {
  id: number;
  planId: number;
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'trial';
  trialEndsAt?: string;
  currentPeriodEnd?: string;
}

interface BillingUsage {
  users: { current: number; limit: number };
  patients: { current: number; limit: number };
  appointments: { current: number; limit: number };
  storage: { current: number; limit: number };
}

interface BillingInvoice {
  id: string;
  date: string;
  amount: number;
  status: 'paid' | 'pending' | 'failed';
  pdfUrl?: string;
}

export default function BillingPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isUpgradeDialogOpen, setIsUpgradeDialogOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);

  // Fetch subscription data
  const { data: subscription, isLoading: loadingSubscription } = useQuery<BillingSubscription>({
    queryKey: ["/api/billing/subscription"],
  });

  // Fetch available plans
  const { data: plans, isLoading: loadingPlans } = useQuery<BillingPlan[]>({
    queryKey: ["/api/billing/plans"],
  });

  // Fetch usage metrics
  const { data: usage, isLoading: loadingUsage } = useQuery<BillingUsage>({
    queryKey: ["/api/billing/usage"],
  });

  // Fetch invoices
  const { data: invoices, isLoading: loadingInvoices } = useQuery<BillingInvoice[]>({
    queryKey: ["/api/billing/invoices"],
  });

  // Create portal session mutation
  const createPortalSession = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/stripe/create-portal-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Failed to create portal session");
      return response.json();
    },
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível abrir o portal de cobrança",
        variant: "destructive",
      });
    },
  });

  // Change plan mutation
  const changePlan = useMutation({
    mutationFn: async (newPlanId: number) => {
      const response = await fetch("/api/billing/subscription/plan", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPlanId }),
      });
      if (!response.ok) throw new Error("Failed to change plan");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/billing/subscription"] });
      setIsUpgradeDialogOpen(false);
      toast({
        title: "Plano alterado",
        description: "Seu plano foi alterado com sucesso!",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível alterar o plano",
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      trial: { label: "Período de Teste", variant: "secondary" },
      active: { label: "Ativo", variant: "default" },
      past_due: { label: "Pagamento Pendente", variant: "destructive" },
      canceled: { label: "Cancelado", variant: "outline" },
      incomplete: { label: "Incompleto", variant: "destructive" },
    };
    const config = statusMap[status] || { label: status, variant: "outline" };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(amount);
  };

  const calculateUsagePercentage = (current: number, max: number) => {
    if (max === -1) return 0; // Ilimitado
    return Math.min((current / max) * 100, 100);
  };

  if (loadingSubscription || loadingPlans) {
    return (
      <DashboardLayout title="Assinatura e Cobrança" currentPath="/billing">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const currentPlan = plans?.find((p: any) => p.id === subscription?.planId);
  const daysLeftInTrial = subscription?.trialEndsAt
    ? Math.ceil((new Date(subscription.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <DashboardLayout title="Assinatura e Cobrança" currentPath="/billing">
      <div className="space-y-6">
        {/* Trial Alert */}
        {subscription?.status === "trial" && daysLeftInTrial > 0 && (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <Clock className="h-5 w-5 text-orange-600 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-orange-900">
                    {daysLeftInTrial} {daysLeftInTrial === 1 ? "dia" : "dias"} restantes no período de teste
                  </h3>
                  <p className="text-sm text-orange-700 mt-1">
                    Seu período de teste expira em {subscription.trialEndsAt ? format(new Date(subscription.trialEndsAt), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : 'em breve'}.
                    Após isso, sua assinatura será cobrada automaticamente.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Current Subscription */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Plano Atual</CardTitle>
                <CardDescription>Gerencie sua assinatura e método de pagamento</CardDescription>
              </div>
              {getStatusBadge(subscription?.status || "unknown")}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <div className="text-sm text-muted-foreground">Plano</div>
                <div className="text-2xl font-bold mt-1">{currentPlan?.name || "N/A"}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Valor Mensal</div>
                <div className="text-2xl font-bold mt-1">
                  {currentPlan?.price ? formatCurrency(currentPlan.price) : "N/A"}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Próxima Cobrança</div>
                <div className="text-2xl font-bold mt-1">
                  {subscription?.currentPeriodEnd
                    ? format(new Date(subscription.currentPeriodEnd), "dd/MM/yyyy")
                    : "N/A"}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setIsUpgradeDialogOpen(true)}
                disabled={subscription?.status === "canceled"}
              >
                <ArrowUpCircle className="h-4 w-4 mr-2" />
                Alterar Plano
              </Button>
              <Button
                variant="outline"
                onClick={() => createPortalSession.mutate()}
                disabled={createPortalSession.isPending}
              >
                {createPortalSession.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CreditCard className="h-4 w-4 mr-2" />
                )}
                Gerenciar Pagamento
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Usage Metrics */}
        <Card>
          <CardHeader>
            <CardTitle>Uso do Plano</CardTitle>
            <CardDescription>Acompanhe o uso dos recursos do seu plano</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {loadingUsage ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <>
                {/* Users */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Usuários</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {usage?.users?.current || 0} / {currentPlan?.maxUsers === -1 ? "∞" : currentPlan?.maxUsers || 0}
                    </span>
                  </div>
                  <Progress
                    value={calculateUsagePercentage(usage?.users?.current || 0, currentPlan?.maxUsers || 0)}
                  />
                </div>

                {/* Patients */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Pacientes</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {usage?.patients?.current || 0} / {currentPlan?.maxPatients === -1 ? "∞" : currentPlan?.maxPatients || 0}
                    </span>
                  </div>
                  <Progress
                    value={calculateUsagePercentage(usage?.patients?.current || 0, currentPlan?.maxPatients || 0)}
                  />
                </div>

                {/* Appointments this month */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Agendamentos (este mês)</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {usage?.appointments?.current || 0} / {currentPlan?.maxAppointmentsPerMonth === -1 ? "∞" : currentPlan?.maxAppointmentsPerMonth || 0}
                    </span>
                  </div>
                  <Progress
                    value={calculateUsagePercentage(usage?.appointments?.current || 0, currentPlan?.maxAppointmentsPerMonth || 0)}
                  />
                </div>

                {/* Storage */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Armazenamento</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {usage?.storage?.current || 0} GB / {currentPlan?.maxStorageGb === -1 ? "∞" : currentPlan?.maxStorageGb || 0} GB
                    </span>
                  </div>
                  <Progress
                    value={calculateUsagePercentage(usage?.storage?.current || 0, currentPlan?.maxStorageGb || 0)}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Invoices */}
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Faturas</CardTitle>
            <CardDescription>Todas as suas faturas e pagamentos</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingInvoices ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : invoices && invoices.length > 0 ? (
              <div className="space-y-4">
                {invoices.map((invoice: any) => (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-full ${invoice.status === 'paid' ? 'bg-green-100' : 'bg-orange-100'}`}>
                        {invoice.status === 'paid' ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-orange-600" />
                        )}
                      </div>
                      <div>
                        <div className="font-medium">
                          {format(new Date(invoice.createdAt), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Fatura #{invoice.invoiceNumber || invoice.id}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-semibold">{formatCurrency(invoice.amount)}</div>
                        <div className="text-sm text-muted-foreground capitalize">{invoice.status}</div>
                      </div>
                      {invoice.invoiceUrl && (
                        <Button variant="ghost" size="sm" asChild>
                          <a href={invoice.invoiceUrl} target="_blank" rel="noopener noreferrer">
                            <Download className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>Nenhuma fatura encontrada</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upgrade Dialog */}
        <Dialog open={isUpgradeDialogOpen} onOpenChange={setIsUpgradeDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Alterar Plano</DialogTitle>
              <DialogDescription>
                Escolha o novo plano para sua assinatura
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-3">
                {plans?.map((plan: any) => (
                  <div
                    key={plan.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedPlanId === plan.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                    } ${plan.id === subscription?.planId ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={() => {
                      if (plan.id !== subscription?.planId) {
                        setSelectedPlanId(plan.id);
                      }
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold">{plan.name}</div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {plan.maxUsers === -1 ? 'Usuários ilimitados' : `Até ${plan.maxUsers} usuários`}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg">{formatCurrency(plan.price)}</div>
                        <div className="text-sm text-muted-foreground">/mês</div>
                      </div>
                    </div>
                    {plan.id === subscription?.planId && (
                      <Badge variant="secondary" className="mt-2">Plano Atual</Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => {
                  if (selectedPlanId) {
                    changePlan.mutate(selectedPlanId);
                  }
                }}
                disabled={!selectedPlanId || changePlan.isPending}
              >
                {changePlan.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Alterando...
                  </>
                ) : (
                  "Confirmar Alteração"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
