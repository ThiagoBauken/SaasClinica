import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Mail, X, Loader2 } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/core/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { getCsrfHeaders } from "@/lib/csrf";

export function EmailVerificationBanner() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [dismissed, setDismissed] = useState(false);

  const resendMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: getCsrfHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Falha ao reenviar e-mail.");
      return data;
    },
    onSuccess: () => {
      toast({
        title: "E-mail reenviado",
        description: "Verifique sua caixa de entrada (e o spam) em alguns instantes.",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Não foi possível reenviar",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // Esconde se: não logado, email já verificado, ou usuário fechou nesta sessão.
  if (!user || user.emailVerified || dismissed) return null;

  return (
    <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 mb-4">
      <Mail className="h-4 w-4 text-amber-700 dark:text-amber-400" />
      <div className="flex items-start justify-between gap-4 w-full">
        <div className="flex-1">
          <AlertTitle className="text-amber-900 dark:text-amber-200">
            Confirme seu e-mail
          </AlertTitle>
          <AlertDescription className="text-amber-800 dark:text-amber-300">
            Enviamos um link de confirmação para <strong>{user.email}</strong>. Confirme
            para garantir o acesso completo à plataforma.
          </AlertDescription>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={() => resendMutation.mutate()}
            disabled={resendMutation.isPending}
          >
            {resendMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                Reenviando...
              </>
            ) : (
              "Reenviar e-mail"
            )}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={() => setDismissed(true)}
            aria-label="Dispensar"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Alert>
  );
}
