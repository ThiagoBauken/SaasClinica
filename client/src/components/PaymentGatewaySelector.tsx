import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { CreditCard, Bitcoin, Smartphone, QrCode, Loader2, Tag, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PaymentGatewaySelectorProps {
  planId: number;
  planName: string;
  amount: number;
  billingCycle: "monthly" | "yearly";
  onSuccess?: () => void;
}

export function PaymentGatewaySelector({
  planId,
  planName,
  amount,
  billingCycle,
  onSuccess,
}: PaymentGatewaySelectorProps) {
  const [open, setOpen] = useState(false);
  const [gateway, setGateway] = useState<"stripe" | "crypto" | "mercadopago" | null>(null);
  const [cryptoCurrency, setCryptoCurrency] = useState<string>("btc");
  const [mercadopagoMethod, setMercadopagoMethod] = useState<"pix" | "boleto">("pix");
  const [loading, setLoading] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponValidating, setCouponValidating] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [finalAmount, setFinalAmount] = useState(amount);
  const { toast } = useToast();

  const handleValidateCoupon = async () => {
    if (!couponCode.trim()) return;

    setCouponValidating(true);
    try {
      const response = await fetch("/api/v1/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: couponCode.toUpperCase(),
          planId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Cupom inválido");
      }

      const result = await response.json();

      if (!result.valid) {
        throw new Error(result.reason || "Cupom inválido");
      }

      setAppliedCoupon(result.coupon);
      setFinalAmount(result.finalAmount);

      toast({
        title: "Cupom aplicado!",
        description: `Desconto de ${result.discountAmount} aplicado`,
      });
    } catch (error: any) {
      toast({
        title: "Cupom inválido",
        description: error.message,
        variant: "destructive",
      });
      setAppliedCoupon(null);
      setFinalAmount(amount);
    } finally {
      setCouponValidating(false);
    }
  };

  const handleRemoveCoupon = () => {
    setCouponCode("");
    setAppliedCoupon(null);
    setFinalAmount(amount);
  };

  const handleStripeCheckout = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          billingCycle,
          couponCode: appliedCoupon ? couponCode.toUpperCase() : undefined,
          successUrl: `${window.location.origin}/checkout-success`,
          cancelUrl: `${window.location.origin}/checkout-canceled`,
        }),
      });

      if (!response.ok) throw new Error("Failed to create checkout session");

      const { url } = await response.json();
      window.location.href = url;
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível criar a sessão de pagamento",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCryptoPayment = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/v1/payment-gateways/nowpayments/create-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          currency: cryptoCurrency,
          billingCycle,
        }),
      });

      if (!response.ok) throw new Error("Failed to create crypto payment");

      const payment = await response.json();

      // Abrir página de pagamento em nova aba
      if (payment.invoice_url) {
        window.open(payment.invoice_url, "_blank");
      } else {
        // Mostrar endereço e QR code
        toast({
          title: "Pagamento Crypto Criado",
          description: `Envie ${payment.pay_amount} ${payment.pay_currency.toUpperCase()} para: ${payment.pay_address}`,
        });
      }

      setOpen(false);
      onSuccess?.();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível criar o pagamento crypto",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMercadoPagoPayment = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/v1/payment-gateways/mercadopago/create-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          amount,
          paymentMethod: mercadopagoMethod,
          email: "user@example.com", // TODO: Pegar do usuário logado
          description: `Assinatura ${planName} - ${billingCycle === "yearly" ? "Anual" : "Mensal"}`,
        }),
      });

      if (!response.ok) throw new Error("Failed to create MercadoPago payment");

      const payment = await response.json();

      if (mercadopagoMethod === "pix" && payment.qrCode) {
        // Mostrar QR Code do Pix
        toast({
          title: "Pix Gerado",
          description: "Escaneie o QR Code para realizar o pagamento",
        });
        // TODO: Mostrar modal com QR Code
      } else if (mercadopagoMethod === "boleto" && payment.ticketUrl) {
        // Abrir boleto em nova aba
        window.open(payment.ticketUrl, "_blank");
      }

      setOpen(false);
      onSuccess?.();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível criar o pagamento",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    switch (gateway) {
      case "stripe":
        await handleStripeCheckout();
        break;
      case "crypto":
        await handleCryptoPayment();
        break;
      case "mercadopago":
        await handleMercadoPagoPayment();
        break;
      default:
        toast({
          title: "Erro",
          description: "Selecione um método de pagamento",
          variant: "destructive",
        });
    }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} className="w-full">
        Assinar Agora - {new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL",
        }).format(finalAmount)}
        {appliedCoupon && (
          <span className="ml-2 text-xs line-through opacity-70">
            {new Intl.NumberFormat("pt-BR", {
              style: "currency",
              currency: "BRL",
            }).format(amount)}
          </span>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Escolha o Método de Pagamento</DialogTitle>
            <DialogDescription>
              Selecione como deseja pagar pela assinatura {planName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Cupom de desconto */}
            <div className="border rounded-lg p-4 bg-muted/50">
              <Label htmlFor="coupon" className="flex items-center gap-2 mb-2">
                <Tag className="h-4 w-4" />
                Cupom de Desconto (opcional)
              </Label>
              <div className="flex gap-2">
                <Input
                  id="coupon"
                  placeholder="Digite o código"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  disabled={!!appliedCoupon}
                  className="flex-1"
                />
                {appliedCoupon ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRemoveCoupon}
                    className="text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleValidateCoupon}
                    disabled={!couponCode.trim() || couponValidating}
                  >
                    {couponValidating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Aplicar"
                    )}
                  </Button>
                )}
              </div>
              {appliedCoupon && (
                <div className="mt-2 flex items-center gap-2 text-sm text-green-600">
                  <Check className="h-4 w-4" />
                  Cupom aplicado! Desconto de{" "}
                  {appliedCoupon.discountType === "percentage"
                    ? `${appliedCoupon.discountValue}%`
                    : new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(parseFloat(appliedCoupon.discountValue))}
                </div>
              )}
            </div>

            {/* Resumo do valor */}
            {appliedCoupon && (
              <div className="border rounded-lg p-3 bg-green-50 border-green-200">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Valor original:</span>
                  <span className="line-through">
                    {new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }).format(amount)}
                  </span>
                </div>
                <div className="flex justify-between font-bold text-green-700">
                  <span>Valor final:</span>
                  <span>
                    {new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }).format(finalAmount)}
                  </span>
                </div>
              </div>
            )}
            {/* Stripe (Cartão) */}
            <div
              className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                gateway === "stripe" ? "border-primary bg-primary/5" : "hover:bg-muted/50"
              }`}
              onClick={() => setGateway("stripe")}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded">
                  <CreditCard className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <div className="font-semibold">Cartão de Crédito</div>
                  <div className="text-sm text-muted-foreground">Via Stripe - Internacional</div>
                </div>
              </div>
            </div>

            {/* Crypto (NOWPayments) */}
            <div
              className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                gateway === "crypto" ? "border-primary bg-primary/5" : "hover:bg-muted/50"
              }`}
              onClick={() => setGateway("crypto")}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded">
                  <Bitcoin className="h-5 w-5 text-orange-600" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold">Criptomoeda</div>
                  <div className="text-sm text-muted-foreground">Bitcoin, Ethereum, USDT, etc.</div>
                </div>
              </div>
              {gateway === "crypto" && (
                <div className="mt-3">
                  <Select value={cryptoCurrency} onValueChange={setCryptoCurrency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="btc">Bitcoin (BTC)</SelectItem>
                      <SelectItem value="eth">Ethereum (ETH)</SelectItem>
                      <SelectItem value="usdt">Tether (USDT)</SelectItem>
                      <SelectItem value="bnb">Binance Coin (BNB)</SelectItem>
                      <SelectItem value="ltc">Litecoin (LTC)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* MercadoPago (Pix/Boleto) */}
            <div
              className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                gateway === "mercadopago" ? "border-primary bg-primary/5" : "hover:bg-muted/50"
              }`}
              onClick={() => setGateway("mercadopago")}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded">
                  <Smartphone className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold">Pix ou Boleto</div>
                  <div className="text-sm text-muted-foreground">Via MercadoPago - Brasil</div>
                </div>
              </div>
              {gateway === "mercadopago" && (
                <div className="mt-3">
                  <Select value={mercadopagoMethod} onValueChange={(v: any) => setMercadopagoMethod(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pix">
                        <div className="flex items-center gap-2">
                          <QrCode className="h-4 w-4" />
                          Pix (Instantâneo)
                        </div>
                      </SelectItem>
                      <SelectItem value="boleto">Boleto (1-3 dias úteis)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={handlePayment}
              disabled={!gateway || loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                "Continuar para Pagamento"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
