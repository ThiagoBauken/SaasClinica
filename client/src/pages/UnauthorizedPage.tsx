import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldXIcon, ArrowLeftIcon } from "lucide-react";
import { useAuth } from "@/core/AuthProvider";

export default function UnauthorizedPage() {
  const { logoutMutation } = useAuth();

  const handleGoBack = () => {
    window.history.back();
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <ShieldXIcon className="h-8 w-8 text-red-600" />
          </div>
          <CardTitle className="text-xl font-semibold">Acesso Negado</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-gray-600">
            Você não tem permissão para acessar esta página.
          </p>
          <p className="text-sm text-gray-500">
            Entre em contato com o administrador do sistema se você acredita que deveria ter acesso.
          </p>
          <div className="flex flex-col gap-3 pt-4">
            <Button onClick={handleGoBack} variant="outline" className="w-full">
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <Button onClick={handleLogout} className="w-full">
              Fazer Logout
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}