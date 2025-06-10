import { Shield, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from 'wouter';

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <Shield className="h-6 w-6 text-red-600" />
          </div>
          <CardTitle className="text-2xl">Acesso Negado</CardTitle>
          <CardDescription>
            Você não tem permissão para acessar esta página
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-sm text-muted-foreground mb-6">
            Entre em contato com o administrador do sistema para solicitar as permissões necessárias.
          </p>
          <Link href="/dashboard">
            <Button className="w-full">
              <Home className="h-4 w-4 mr-2" />
              Voltar ao Dashboard
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}