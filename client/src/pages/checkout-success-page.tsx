import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight, Download, CreditCard } from "lucide-react";
import confetti from "canvas-confetti";

export default function CheckoutSuccessPage() {
  const [, navigate] = useLocation();
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Pegar session_id da URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sid = params.get("session_id");
    setSessionId(sid);

    // Efeito de confetti
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    });
  }, []);

  // Buscar dados da assinatura
  const { data: subscription, isLoading } = useQuery({
    queryKey: ["/api/billing/subscription"],
    queryFn: async () => {
      const response = await fetch("/api/billing/subscription");
      if (!response.ok) throw new Error("Erro ao carregar assinatura");
      return response.json();
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full">
        <CardHeader className="text-center pb-8">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-green-100 p-6">
              <CheckCircle2 className="h-16 w-16 text-green-600" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold text-green-700">
            Pagamento Confirmado!
          </CardTitle>
          <CardDescription className="text-lg mt-2">
            Sua assinatura foi ativada com sucesso
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando detalhes da assinatura...
            </div>
          ) : subscription ? (
            <>
              <div className="bg-muted/50 rounded-lg p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Plano:</span>
                  <span className="font-semibold text-lg">{subscription.planName}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Valor:</span>
                  <span className="font-semibold text-lg">
                    {new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }).format(subscription.amount)}
                    <span className="text-sm text-muted-foreground ml-1">
                      /{subscription.billingCycle === "yearly" ? "ano" : "mês"}
                    </span>
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Status:</span>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                    {subscription.status === "active" ? "Ativa" : subscription.status}
                  </span>
                </div>

                {subscription.currentPeriodEnd && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Próxima cobrança:</span>
                    <span className="font-medium">
                      {new Date(subscription.currentPeriodEnd).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                )}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Próximos passos:</strong>
                </p>
                <ul className="mt-2 space-y-1 text-sm text-blue-700 list-disc list-inside">
                  <li>Um email de confirmação foi enviado para você</li>
                  <li>Sua fatura está disponível na página de assinatura</li>
                  <li>Você pode gerenciar sua assinatura a qualquer momento</li>
                </ul>
              </div>
            </>
          ) : (
            <div className="bg-muted/50 rounded-lg p-6 text-center">
              <p className="text-muted-foreground">
                Seu pagamento foi processado com sucesso! <br />
                Você receberá um email de confirmação em breve.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate("/billing")}
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Ver Assinatura
            </Button>

            <Button className="w-full" onClick={() => navigate("/dashboard")}>
              Ir para o Dashboard
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>

          <div className="text-center pt-4">
            <p className="text-sm text-muted-foreground">
              Obrigado por escolher o DentalSystem!
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
