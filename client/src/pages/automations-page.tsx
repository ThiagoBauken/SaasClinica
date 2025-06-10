import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bot, MessageSquare, Calendar, DollarSign, Settings } from 'lucide-react';

export default function AutomationsPage() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Bot className="h-8 w-8 text-purple-600" />
          Automações e Integrações
        </h1>
        <p className="text-muted-foreground mt-2">
          Configure automações e integrações externas para otimizar seu fluxo de trabalho
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-green-600" />
              WhatsApp Business
            </CardTitle>
            <CardDescription>
              Envio automático de lembretes e confirmações
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Status da conexão</span>
                <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                  Não configurado
                </span>
              </div>
              <Button variant="outline" className="w-full">
                Configurar WhatsApp
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              Lembretes Automáticos
            </CardTitle>
            <CardDescription>
              Configurar lembretes de consultas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Lembretes ativos</span>
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                  Ativo
                </span>
              </div>
              <Button variant="outline" className="w-full">
                Gerenciar Lembretes
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-emerald-600" />
              Cobrança Automática
            </CardTitle>
            <CardDescription>
              Automação de cobranças e faturas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Sistema de cobrança</span>
                <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">
                  Desativado
                </span>
              </div>
              <Button variant="outline" className="w-full">
                Configurar Cobrança
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-gray-600" />
              Configurações Gerais
            </CardTitle>
            <CardDescription>
              Configurações globais das automações
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">
              Acessar Configurações
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}