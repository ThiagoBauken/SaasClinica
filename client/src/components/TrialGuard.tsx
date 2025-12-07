import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/core/AuthProvider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CreditCard, LogOut } from "lucide-react";

// Rotas que podem ser acessadas mesmo com trial expirado
const ALLOWED_ROUTES_WHEN_EXPIRED = [
  "/billing",
  "/settings/billing",
  "/configuracoes/assinatura",
  "/perfil",
  "/auth",
  "/login",
];

interface TrialGuardProps {
  children: React.ReactNode;
}

export function TrialGuard({ children }: TrialGuardProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const [showExpiredDialog, setShowExpiredDialog] = useState(false);

  useEffect(() => {
    if (!user) return;

    // Verificar se o trial expirou
    const trialEnd = user.trialEndsAt ? new Date(user.trialEndsAt) : null;
    const isExpired = trialEnd && trialEnd < new Date();

    // Se expirou e nao esta em uma rota permitida
    if (isExpired) {
      const isAllowedRoute = ALLOWED_ROUTES_WHEN_EXPIRED.some(
        (route) => location.startsWith(route)
      );

      if (!isAllowedRoute) {
        setShowExpiredDialog(true);
      }
    } else {
      setShowExpiredDialog(false);
    }
  }, [user, location]);

  const handleGoToBilling = () => {
    setShowExpiredDialog(false);
    setLocation("/billing");
  };

  const handleLogout = () => {
    setShowExpiredDialog(false);
    logout();
  };

  return (
    <>
      {children}

      <AlertDialog open={showExpiredDialog} onOpenChange={setShowExpiredDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="mx-auto w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mb-4">
              <AlertTriangle className="h-8 w-8 text-orange-600" />
            </div>
            <AlertDialogTitle className="text-center text-xl">
              Seu periodo de teste expirou
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              Para continuar usando o DentCare, por favor escolha um plano de assinatura.
              Seus dados estao salvos e você nao perdera nada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-col gap-2">
            <Button onClick={handleGoToBilling} className="w-full" size="lg">
              <CreditCard className="h-4 w-4 mr-2" />
              Ver Planos e Assinar
            </Button>
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="w-full text-muted-foreground"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sair da Conta
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default TrialGuard;
