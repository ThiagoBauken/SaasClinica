import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/core/AuthProvider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreditCard, QrCode, FileText, DollarSign, Plus, Loader2, Copy, Check, ExternalLink, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import DashboardLayout from "@/layouts/DashboardLayout";

interface PaymentRecord {
  id: number;
  patient_name: string;
  amount: number;
  description: string;
  payment_method: string;
  status: string;
  pix_qr_code?: string;
  boleto_url?: string;
  created_at: string;
  paid_at?: string;
}

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendente", variant: "secondary" },
  approved: { label: "Pago", variant: "default" },
  rejected: { label: "Recusado", variant: "destructive" },
  cancelled: { label: "Cancelado", variant: "destructive" },
  in_process: { label: "Processando", variant: "outline" },
};

const methodIcons: Record<string, any> = {
  pix: QrCode,
  boleto: FileText,
  credit_card: CreditCard,
};

export default function PatientPaymentsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [newPayment, setNewPayment] = useState({
    patientId: "",
    amount: "",
    description: "",
    paymentMethod: "pix",
    installments: "1",
  });

  const { data: paymentsData, isLoading } = useQuery<any>({
    queryKey: ["/api/v1/patient-payments"],
  });

  const { data: patients = [] } = useQuery<any[]>({ queryKey: ["/api/v1/patients?limit=200"] });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/v1/patient-payments/create", data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/v1/patient-payments"] });
      toast({ title: "Cobranca criada!", description: `Metodo: ${newPayment.paymentMethod.toUpperCase()}` });
      setIsDialogOpen(false);
      setNewPayment({ patientId: "", amount: "", description: "", paymentMethod: "pix", installments: "1" });
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const handleCreate = () => {
    if (!newPayment.patientId || !newPayment.amount || !newPayment.description) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      patientId: parseInt(newPayment.patientId),
      amount: Math.round(parseFloat(newPayment.amount) * 100),
      description: newPayment.description,
      paymentMethod: newPayment.paymentMethod,
      installments: parseInt(newPayment.installments),
    });
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copiado!" });
  };

  const payments: PaymentRecord[] = Array.isArray(paymentsData) ? paymentsData : paymentsData?.payments || [];

  const pendingPayments = payments.filter(p => p.status === "pending" || p.status === "in_process");
  const completedPayments = payments.filter(p => p.status === "approved");
  const totalReceived = completedPayments.reduce((sum, p) => sum + p.amount, 0);
  const totalPending = pendingPayments.reduce((sum, p) => sum + p.amount, 0);

  const formatCurrency = (cents: number) => `R$ ${(cents / 100).toFixed(2)}`;

  return (
    <DashboardLayout title="Pagamentos" currentPath="/pagamentos-paciente">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Pagamentos de Pacientes</h2>
            <p className="text-muted-foreground">PIX, Boleto e Cartao de Credito</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Nova Cobranca</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Criar Cobranca</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <Label>Paciente</Label>
                  <Select value={newPayment.patientId} onValueChange={(v) => setNewPayment(p => ({ ...p, patientId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione o paciente" /></SelectTrigger>
                    <SelectContent>
                      {(Array.isArray(patients) ? patients : []).map((p: any) => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.fullName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Valor (R$)</Label>
                  <Input type="number" step="0.01" min="0" value={newPayment.amount} onChange={(e) => setNewPayment(p => ({ ...p, amount: e.target.value }))} placeholder="150.00" />
                </div>
                <div>
                  <Label>Descricao</Label>
                  <Input value={newPayment.description} onChange={(e) => setNewPayment(p => ({ ...p, description: e.target.value }))} placeholder="Ex: Limpeza dental, Clareamento..." />
                </div>
                <div>
                  <Label>Metodo de Pagamento</Label>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    {[
                      { id: "pix", label: "PIX", icon: QrCode },
                      { id: "boleto", label: "Boleto", icon: FileText },
                      { id: "credit_card", label: "Cartao", icon: CreditCard },
                    ].map((method) => {
                      const Icon = method.icon;
                      const isSelected = newPayment.paymentMethod === method.id;
                      return (
                        <button
                          key={method.id}
                          onClick={() => setNewPayment(p => ({ ...p, paymentMethod: method.id }))}
                          className={`p-3 rounded-lg border-2 text-center transition-all ${isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                        >
                          <Icon className={`h-5 w-5 mx-auto mb-1 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                          <span className="text-xs font-medium">{method.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                {newPayment.paymentMethod === "credit_card" && (
                  <div>
                    <Label>Parcelas</Label>
                    <Select value={newPayment.installments} onValueChange={(v) => setNewPayment(p => ({ ...p, installments: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[1,2,3,4,5,6,7,8,9,10,11,12].map(n => (
                          <SelectItem key={n} value={String(n)}>{n}x {newPayment.amount ? `de R$ ${(parseFloat(newPayment.amount) / n).toFixed(2)}` : ""}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Button onClick={handleCreate} disabled={createMutation.isPending} className="w-full">
                  {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DollarSign className="mr-2 h-4 w-4" />}
                  Gerar Cobranca
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                  <DollarSign className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Recebido</p>
                  <p className="text-xl font-bold">{formatCurrency(totalReceived)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                  <Clock className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pendente</p>
                  <p className="text-xl font-bold">{formatCurrency(totalPending)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <CreditCard className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Cobrancas</p>
                  <p className="text-xl font-bold">{payments.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payments List */}
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">Todas ({payments.length})</TabsTrigger>
            <TabsTrigger value="pending">Pendentes ({pendingPayments.length})</TabsTrigger>
            <TabsTrigger value="paid">Pagas ({completedPayments.length})</TabsTrigger>
          </TabsList>

          {["all", "pending", "paid"].map((tab) => (
            <TabsContent key={tab} value={tab}>
              {isLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
              ) : (
                <div className="space-y-3">
                  {(tab === "all" ? payments : tab === "pending" ? pendingPayments : completedPayments).length === 0 ? (
                    <Card>
                      <CardContent className="flex flex-col items-center justify-center py-12">
                        <DollarSign className="h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">Nenhuma cobranca {tab === "pending" ? "pendente" : tab === "paid" ? "paga" : ""}</p>
                      </CardContent>
                    </Card>
                  ) : (
                    (tab === "all" ? payments : tab === "pending" ? pendingPayments : completedPayments).map((payment) => {
                      const status = statusMap[payment.status] || statusMap.pending;
                      const MethodIcon = methodIcons[payment.payment_method] || DollarSign;
                      return (
                        <Card key={payment.id}>
                          <CardContent className="flex items-center justify-between p-4">
                            <div className="flex items-center gap-4">
                              <div className="p-2.5 rounded-lg bg-muted">
                                <MethodIcon className="h-5 w-5 text-muted-foreground" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-medium">{payment.patient_name}</p>
                                  <Badge variant={status.variant}>{status.label}</Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">{payment.description}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {new Date(payment.created_at).toLocaleDateString("pt-BR")} - {payment.payment_method.toUpperCase()}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-lg font-bold">{formatCurrency(payment.amount)}</span>
                              {payment.pix_qr_code && (
                                <Button variant="outline" size="sm" onClick={() => handleCopy(payment.pix_qr_code!)}>
                                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                </Button>
                              )}
                              {payment.boleto_url && (
                                <Button variant="outline" size="sm" onClick={() => window.open(payment.boleto_url, "_blank")}>
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
