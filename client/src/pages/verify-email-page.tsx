import { useEffect, useState } from "react";
import { Link } from "wouter";
import { CheckCircle2, AlertTriangle, Clock, Loader2, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme/theme-toggle";

type Status = "loading" | "success" | "already" | "expired" | "invalid" | "missing";

const STATUS_FROM_QUERY: Record<string, Status> = {
  success: "success",
  already: "already",
  expired: "expired",
  invalid: "invalid",
  missing: "missing",
};

export default function VerifyEmailPage() {
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryStatus = params.get("status");
    if (queryStatus && STATUS_FROM_QUERY[queryStatus]) {
      setStatus(STATUS_FROM_QUERY[queryStatus]);
      return;
    }
    // Sem status: o servidor faz GET /api/auth/verify-email e redireciona.
    // Se chegamos aqui sem status, considera link inválido.
    setStatus("missing");
  }, []);

  const content = (() => {
    switch (status) {
      case "loading":
        return {
          icon: <Loader2 className="h-10 w-10 text-primary animate-spin" />,
          title: "Verificando...",
          description: "Aguarde enquanto confirmamos seu e-mail.",
          variant: "info" as const,
        };
      case "success":
        return {
          icon: <CheckCircle2 className="h-10 w-10 text-green-600" />,
          title: "E-mail verificado!",
          description:
            "Seu e-mail foi confirmado com sucesso. Agora você pode acessar todos os recursos da plataforma.",
          variant: "success" as const,
        };
      case "already":
        return {
          icon: <CheckCircle2 className="h-10 w-10 text-green-600" />,
          title: "E-mail já verificado",
          description: "Sua conta já está confirmada. Pode fazer login normalmente.",
          variant: "success" as const,
        };
      case "expired":
        return {
          icon: <Clock className="h-10 w-10 text-amber-600" />,
          title: "Link expirado",
          description:
            "Este link de verificação expirou. Faça login e solicite um novo e-mail de confirmação.",
          variant: "warning" as const,
        };
      case "missing":
      case "invalid":
      default:
        return {
          icon: <AlertTriangle className="h-10 w-10 text-destructive" />,
          title: "Link inválido",
          description:
            "Este link de verificação não é válido. Verifique se o link está completo ou solicite um novo.",
          variant: "error" as const,
        };
    }
  })();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4 relative">
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            {content.icon}
          </div>
          <CardTitle className="text-2xl">{content.title}</CardTitle>
          <CardDescription>{content.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Link href="/auth">
            <Button className="w-full">Ir para o login</Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="outline" className="w-full">
              <Mail className="mr-2 h-4 w-4" />
              Acessar minha conta
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
