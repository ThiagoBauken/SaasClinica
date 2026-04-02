import { useState } from "react";
import DashboardLayout from "@/layouts/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, CreditCard, Banknote, QrCode, Building2, Percent, Settings2 } from "lucide-react";

interface PaymentMethods {
  dinheiro: boolean;
  cartaoCredito: boolean;
  cartaoDebito: boolean;
  pix: boolean;
  boleto: boolean;
  transferencia: boolean;
}

interface PixConfig {
  tipoChave: string;
  chave: string;
}

interface InstallmentConfig {
  maxParcelas: number;
  valorMinimoParcela: number;
}

interface TaxConfig {
  taxaCartao: number;
}

interface BankAccount {
  banco: string;
  agencia: string;
  conta: string;
}

interface FinancialSettings {
  paymentMethods: PaymentMethods;
  pix: PixConfig;
  installments: InstallmentConfig;
  taxes: TaxConfig;
  bankAccount: BankAccount;
}

const defaultSettings: FinancialSettings = {
  paymentMethods: {
    dinheiro: true,
    cartaoCredito: true,
    cartaoDebito: true,
    pix: true,
    boleto: false,
    transferencia: false,
  },
  pix: {
    tipoChave: "cpf",
    chave: "",
  },
  installments: {
    maxParcelas: 12,
    valorMinimoParcela: 50,
  },
  taxes: {
    taxaCartao: 2.5,
  },
  bankAccount: {
    banco: "",
    agencia: "",
    conta: "",
  },
};

export default function ConfiguracoesFinanceiroPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<FinancialSettings>(defaultSettings);

  const { isLoading } = useQuery<FinancialSettings>({
    queryKey: ["/api/v1/settings/financial"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/v1/settings/financial");
        const data = await res.json();
        setSettings(data);
        return data;
      } catch {
        return defaultSettings;
      }
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: FinancialSettings) => {
      const res = await apiRequest("PUT", "/api/v1/settings/financial", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v1/settings/financial"] });
      toast({ title: "Configurações salvas", description: "As configurações financeiras foram salvas com sucesso." });
    },
    onError: () => {
      toast({ title: "Erro ao salvar", description: "Não foi possível salvar as configurações. Tente novamente.", variant: "destructive" });
    },
  });

  const updatePaymentMethod = (key: keyof PaymentMethods, value: boolean) => {
    setSettings((prev) => ({ ...prev, paymentMethods: { ...prev.paymentMethods, [key]: value } }));
  };

  const updatePix = (key: keyof PixConfig, value: string) => {
    setSettings((prev) => ({ ...prev, pix: { ...prev.pix, [key]: value } }));
  };

  const updateInstallments = (key: keyof InstallmentConfig, value: number) => {
    setSettings((prev) => ({ ...prev, installments: { ...prev.installments, [key]: value } }));
  };

  const updateTaxes = (key: keyof TaxConfig, value: number) => {
    setSettings((prev) => ({ ...prev, taxes: { ...prev.taxes, [key]: value } }));
  };

  const updateBankAccount = (key: keyof BankAccount, value: string) => {
    setSettings((prev) => ({ ...prev, bankAccount: { ...prev.bankAccount, [key]: value } }));
  };

  if (isLoading) {
    return (
      <DashboardLayout title="Configurações Financeiras" currentPath="/settings/financial">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Configurações Financeiras" currentPath="/settings/financial">
      <div className="max-w-3xl mx-auto py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configurações Financeiras</h1>
          <p className="text-muted-foreground mt-1">Gerencie formas de pagamento, PIX, parcelamento e dados bancários.</p>
        </div>

        {/* Payment Methods */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Formas de Pagamento</CardTitle>
            </div>
            <CardDescription>Ative ou desative as formas de pagamento aceitas pela clínica.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { key: "dinheiro" as keyof PaymentMethods, label: "Dinheiro", description: "Pagamento em espécie" },
              { key: "cartaoCredito" as keyof PaymentMethods, label: "Cartão de Crédito", description: "Visa, Mastercard, Elo e outros" },
              { key: "cartaoDebito" as keyof PaymentMethods, label: "Cartão de Débito", description: "Débito à vista" },
              { key: "pix" as keyof PaymentMethods, label: "PIX", description: "Transferência instantânea" },
              { key: "boleto" as keyof PaymentMethods, label: "Boleto Bancário", description: "Vencimento em até 3 dias úteis" },
              { key: "transferencia" as keyof PaymentMethods, label: "Transferência Bancária", description: "TED ou DOC" },
            ].map(({ key, label, description }) => (
              <div key={key} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
                <Switch
                  checked={settings.paymentMethods[key]}
                  onCheckedChange={(checked) => updatePaymentMethod(key, checked)}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* PIX Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Configuração do PIX</CardTitle>
            </div>
            <CardDescription>Configure a chave PIX para recebimento de pagamentos.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pixTipoChave">Tipo de Chave</Label>
                <Select value={settings.pix.tipoChave} onValueChange={(value) => updatePix("tipoChave", value)}>
                  <SelectTrigger id="pixTipoChave">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cpf">CPF</SelectItem>
                    <SelectItem value="cnpj">CNPJ</SelectItem>
                    <SelectItem value="email">E-mail</SelectItem>
                    <SelectItem value="telefone">Telefone</SelectItem>
                    <SelectItem value="aleatoria">Chave Aleatória</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pixChave">Chave PIX</Label>
                <Input
                  id="pixChave"
                  placeholder="Digite sua chave PIX"
                  value={settings.pix.chave}
                  onChange={(e) => updatePix("chave", e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Installment Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Configurações de Parcelamento</CardTitle>
            </div>
            <CardDescription>Defina as regras de parcelamento para pagamentos no cartão.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="maxParcelas">Número Máximo de Parcelas</Label>
                <Input
                  id="maxParcelas"
                  type="number"
                  min={1}
                  max={48}
                  value={settings.installments.maxParcelas}
                  onChange={(e) => updateInstallments("maxParcelas", parseInt(e.target.value) || 1)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="valorMinimo">Valor Mínimo por Parcela (R$)</Label>
                <Input
                  id="valorMinimo"
                  type="number"
                  min={0}
                  step={0.01}
                  value={settings.installments.valorMinimoParcela}
                  onChange={(e) => updateInstallments("valorMinimoParcela", parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tax Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Percent className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Taxas e Encargos</CardTitle>
            </div>
            <CardDescription>Configure as taxas cobradas nas transações com cartão.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-w-xs">
              <Label htmlFor="taxaCartao">Taxa do Cartão (%)</Label>
              <div className="relative">
                <Input
                  id="taxaCartao"
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={settings.taxes.taxaCartao}
                  onChange={(e) => updateTaxes("taxaCartao", parseFloat(e.target.value) || 0)}
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
              </div>
              <p className="text-xs text-muted-foreground">Taxa média cobrada pelas operadoras de cartão de crédito/débito.</p>
            </div>
          </CardContent>
        </Card>

        {/* Bank Account */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Dados Bancários</CardTitle>
            </div>
            <CardDescription>Informe os dados da conta bancária para recebimentos e transferências.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="banco">Banco</Label>
              <Input
                id="banco"
                placeholder="Ex: Banco do Brasil, Itaú, Bradesco..."
                value={settings.bankAccount.banco}
                onChange={(e) => updateBankAccount("banco", e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="agencia">Agência</Label>
                <Input
                  id="agencia"
                  placeholder="0000-0"
                  value={settings.bankAccount.agencia}
                  onChange={(e) => updateBankAccount("agencia", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="conta">Conta</Label>
                <Input
                  id="conta"
                  placeholder="00000-0"
                  value={settings.bankAccount.conta}
                  onChange={(e) => updateBankAccount("conta", e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Separator />

        <div className="flex justify-end">
          <Button
            onClick={() => saveMutation.mutate(settings)}
            disabled={saveMutation.isPending}
            className="min-w-[140px]"
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar Configurações"
            )}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
