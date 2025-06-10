import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, ArrowLeft, Home } from "lucide-react";
import { Link } from "wouter";

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-red-100 rounded-full">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-red-600">
            Acesso Negado
          </CardTitle>
          <CardDescription className="text-base">
            Você não tem permissão para acessar esta página
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            Entre em contato com o administrador do sistema para solicitar as permissões necessárias.
          </p>
          
          <div className="flex flex-col space-y-2">
            <Link href="/dashboard">
              <Button className="w-full" variant="default">
                <Home className="mr-2 h-4 w-4" />
                Voltar ao Dashboard
              </Button>
            </Link>
            
            <Link href="/auth">
              <Button className="w-full" variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Fazer Login Novamente
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}