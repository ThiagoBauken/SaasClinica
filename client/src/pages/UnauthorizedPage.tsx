import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { useAuth } from "@/core/AuthProvider";

export default function UnauthorizedPage() {
  const { logout } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <CardTitle className="text-xl font-semibold text-gray-900">
            Acesso Negado
          </CardTitle>
          <CardDescription className="text-gray-600">
            Você não tem permissão para acessar esta página
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-500 text-center">
            Entre em contato com o administrador do sistema para solicitar acesso.
          </p>
          <div className="flex flex-col gap-3">
            <Button 
              onClick={() => window.history.back()} 
              variant="outline" 
              className="w-full"
            >
              Voltar
            </Button>
            <Button 
              onClick={logout} 
              className="w-full"
            >
              Fazer Logout
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}