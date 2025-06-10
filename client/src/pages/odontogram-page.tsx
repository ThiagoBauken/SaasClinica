import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Activity, Search, Plus, FileText } from 'lucide-react';

export default function OdontogramPage() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Activity className="h-8 w-8 text-blue-600" />
          Odontograma Digital
        </h1>
        <p className="text-muted-foreground mt-2">
          Sistema de mapeamento dental digital para registro e acompanhamento
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Odontograma Interativo</CardTitle>
              <CardDescription>
                Clique nos dentes para adicionar procedimentos e anotações
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-50 rounded-lg p-8 min-h-96 flex items-center justify-center">
                <div className="text-center">
                  <Activity className="h-16 w-16 mx-auto text-blue-300 mb-4" />
                  <p className="text-gray-500">Odontograma será carregado aqui</p>
                  <p className="text-sm text-gray-400 mt-2">
                    Interface interativa em desenvolvimento
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Buscar Paciente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Button className="w-full">
                  <Search className="h-4 w-4 mr-2" />
                  Selecionar Paciente
                </Button>
                <div className="text-sm text-muted-foreground">
                  Nenhum paciente selecionado
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Procedimentos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Button variant="outline" size="sm" className="w-full justify-start">
                  Restauração
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  Extração
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  Canal
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  Limpeza
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Histórico
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                Selecione um paciente para ver o histórico
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}