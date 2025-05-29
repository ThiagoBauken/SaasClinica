import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Clock, User } from 'lucide-react';

export default function AgendaModular() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Calendar className="h-8 w-8" />
          Agenda Modular
        </h1>
        <p className="text-muted-foreground mt-2">
          Nova versão modular do sistema de agendamento
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Próximos Agendamentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Maria Silva</span>
                  <span className="text-sm text-muted-foreground">09:00</span>
                </div>
                <p className="text-sm text-muted-foreground">Limpeza</p>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="font-medium">João Santos</span>
                  <span className="text-sm text-muted-foreground">10:30</span>
                </div>
                <p className="text-sm text-muted-foreground">Consulta</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profissionais Hoje
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span>Dr. Ana Costa</span>
                <span className="text-sm text-green-600">Disponível</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Dr. Carlos Lima</span>
                <span className="text-sm text-yellow-600">Ocupado</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resumo do Dia</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Total de consultas:</span>
                <span className="font-medium">12</span>
              </div>
              <div className="flex justify-between">
                <span>Concluídas:</span>
                <span className="font-medium text-green-600">8</span>
              </div>
              <div className="flex justify-between">
                <span>Pendentes:</span>
                <span className="font-medium text-blue-600">4</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h3 className="font-medium text-blue-900 mb-2">🚀 Versão Modular Ativa</h3>
        <p className="text-sm text-blue-700">
          Esta é a nova versão modular da agenda. As funcionalidades estão sendo migradas gradualmente 
          do sistema atual para esta nova arquitetura modular.
        </p>
      </div>
    </div>
  );
}