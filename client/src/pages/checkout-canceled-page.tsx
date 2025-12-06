import { useLocation, Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { XCircle, ArrowLeft, HelpCircle, Mail } from "lucide-react";

export default function CheckoutCanceledPage() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full">
        <CardHeader className="text-center pb-8">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-red-100 p-6">
              <XCircle className="h-16 w-16 text-red-600" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold text-red-700">
            Pagamento Cancelado
          </CardTitle>
          <CardDescription className="text-lg mt-2">
            O processo de pagamento foi cancelado
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="bg-muted/50 rounded-lg p-6 space-y-4 text-center">
            <p className="text-muted-foreground">
              Não se preocupe! Nenhuma cobrança foi realizada.
            </p>
            <p className="text-sm text-muted-foreground">
              Você pode tentar novamente a qualquer momento ou escolher um plano diferente.
            </p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm text-amber-800 font-semibold mb-2">
              Por que isso aconteceu?
            </p>
            <ul className="space-y-1 text-sm text-amber-700 list-disc list-inside">
              <li>Você clicou em "Voltar" ou fechou a janela de pagamento</li>
              <li>Houve um problema com os dados do pagamento</li>
              <li>Você decidiu revisar as opções de planos</li>
            </ul>
          </div>

          <div className="space-y-3">
            <div className="text-center">
              <p className="text-sm font-semibold mb-3">O que você gostaria de fazer?</p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <Button
                variant="default"
                className="w-full"
                onClick={() => navigate("/billing")}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Tentar Novamente
              </Button>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate("/landing")}
              >
                <HelpCircle className="h-4 w-4 mr-2" />
                Ver Planos Disponíveis
              </Button>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate("/dashboard")}
              >
                Voltar ao Dashboard
              </Button>
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-blue-800 mb-1">
                    Precisa de ajuda?
                  </p>
                  <p className="text-sm text-blue-700">
                    Entre em contato conosco em{" "}
                    <a
                      href="mailto:suporte@dentalsystem.com"
                      className="font-medium underline"
                    >
                      suporte@dentalsystem.com
                    </a>
                  </p>
                  <p className="text-sm text-blue-700 mt-1">
                    Estamos aqui para ajudar você a escolher o melhor plano!
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center pt-2">
            <p className="text-xs text-muted-foreground">
              Seus dados estão seguros e nenhuma informação de pagamento foi armazenada
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
