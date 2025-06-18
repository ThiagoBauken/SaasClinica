import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../../../client/src/components/ui/card';
import { Button } from '../../../client/src/components/ui/button';
import { Badge } from '../../../client/src/components/ui/badge';
import { Input } from '../../../client/src/components/ui/input';
import { 
  Smile, 
  Search,
  Users,
  Calendar,
  AlertCircle,
  CheckCircle,
  Clock,
  FileText,
  Edit,
  Eye,
  Plus
} from 'lucide-react';
import { useToast } from '../../../client/src/hooks/use-toast';

interface OdontogramEntry {
  id: number;
  patientId: number;
  patientName: string;
  toothNumber: number;
  procedure: string;
  status: 'planned' | 'in_progress' | 'completed';
  notes?: string;
  date: string;
  professionalId: number;
  professionalName: string;
}

interface Patient {
  id: number;
  name: string;
  cpf: string;
  lastVisit?: string;
  odontogramEntries: number;
}

export function OdontogramaPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  const { data: patients = [], isLoading: patientsLoading } = useQuery({
    queryKey: ['/api/patients'],
    select: (data: Patient[]) => data || []
  });

  const { data: odontogramEntries = [], isLoading: entriesLoading } = useQuery({
    queryKey: ['/api/odontogram/entries', selectedPatient?.id],
    select: (data: OdontogramEntry[]) => data || [],
    enabled: !!selectedPatient
  });

  const createEntryMutation = useMutation({
    mutationFn: async (entryData: Partial<OdontogramEntry>) => {
      const response = await fetch('/api/odontogram/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entryData)
      });
      if (!response.ok) throw new Error('Failed to create entry');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/odontogram/entries'] });
      toast({
        title: "Entrada criada",
        description: "Nova entrada no odontograma foi registrada.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao criar entrada no odontograma.",
        variant: "destructive",
      });
    }
  });

  const updateEntryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<OdontogramEntry> }) => {
      const response = await fetch(`/api/odontogram/entries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to update entry');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/odontogram/entries'] });
      toast({
        title: "Entrada atualizada",
        description: "Entrada do odontograma foi atualizada.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao atualizar entrada.",
        variant: "destructive",
      });
    }
  });

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      planned: { label: 'Planejado', variant: 'outline' as const, icon: Clock },
      in_progress: { label: 'Em Andamento', variant: 'default' as const, icon: AlertCircle },
      completed: { label: 'Concluído', variant: 'secondary' as const, icon: CheckCircle }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.planned;
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getOdontogramStats = () => {
    return {
      totalEntries: odontogramEntries.length,
      planned: odontogramEntries.filter(e => e.status === 'planned').length,
      inProgress: odontogramEntries.filter(e => e.status === 'in_progress').length,
      completed: odontogramEntries.filter(e => e.status === 'completed').length
    };
  };

  const filteredPatients = patients.filter(patient =>
    patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.cpf.includes(searchTerm)
  );

  const stats = selectedPatient ? getOdontogramStats() : null;
  const isLoading = patientsLoading || entriesLoading;

  if (isLoading && !selectedPatient) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Carregando odontogramas...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Odontograma Digital</h1>
          <p className="text-muted-foreground">
            Visualize e gerencie tratamentos odontológicos por paciente
          </p>
        </div>
        {selectedPatient && (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nova Entrada
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Patient Selection Panel */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Selecionar Paciente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar paciente por nome ou CPF..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredPatients.length === 0 ? (
                <div className="text-center py-4">
                  <Users className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mt-2">
                    {searchTerm ? 'Nenhum paciente encontrado' : 'Nenhum paciente cadastrado'}
                  </p>
                </div>
              ) : (
                filteredPatients.map((patient) => (
                  <div
                    key={patient.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedPatient?.id === patient.id 
                        ? 'bg-primary text-primary-foreground' 
                        : 'hover:bg-accent'
                    }`}
                    onClick={() => setSelectedPatient(patient)}
                  >
                    <div className="font-medium">{patient.name}</div>
                    <div className="text-sm opacity-75">CPF: {patient.cpf}</div>
                    {patient.lastVisit && (
                      <div className="text-sm opacity-75">
                        Última visita: {new Date(patient.lastVisit).toLocaleDateString()}
                      </div>
                    )}
                    <div className="flex items-center gap-1 mt-1">
                      <FileText className="h-4 w-4" />
                      <span className="text-sm">{patient.odontogramEntries || 0} entradas</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Odontogram Content Panel */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smile className="h-5 w-5" />
              {selectedPatient ? `Odontograma - ${selectedPatient.name}` : 'Selecione um Paciente'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedPatient ? (
              <div className="text-center py-12">
                <Smile className="mx-auto h-16 w-16 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">Nenhum paciente selecionado</h3>
                <p className="mt-2 text-muted-foreground">
                  Selecione um paciente na lista ao lado para visualizar seu odontograma.
                </p>
              </div>
            ) : (
              <>
                {/* Statistics for selected patient */}
                {stats && (
                  <div className="grid gap-4 md:grid-cols-4 mb-6">
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total</CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{stats.totalEntries}</div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Planejados</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-blue-600">{stats.planned}</div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Em Andamento</CardTitle>
                        <AlertCircle className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-yellow-600">{stats.inProgress}</div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Concluídos</CardTitle>
                        <CheckCircle className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Odontogram entries */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Entradas do Odontograma</h3>
                  
                  {odontogramEntries.length === 0 ? (
                    <div className="text-center py-8">
                      <Smile className="mx-auto h-12 w-12 text-muted-foreground" />
                      <h4 className="mt-4 text-lg font-semibold">Nenhuma entrada registrada</h4>
                      <p className="mt-2 text-muted-foreground">
                        Comece criando a primeira entrada no odontograma deste paciente.
                      </p>
                      <Button className="mt-4">
                        <Plus className="mr-2 h-4 w-4" />
                        Criar Primeira Entrada
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {odontogramEntries.map((entry) => (
                        <div
                          key={entry.id}
                          className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                        >
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-2">
                              <Badge variant="outline">Dente {entry.toothNumber}</Badge>
                              {getStatusBadge(entry.status)}
                            </div>
                            
                            <div className="space-y-1">
                              <div className="font-semibold">{entry.procedure}</div>
                              <div className="text-sm text-muted-foreground">
                                Dr(a). {entry.professionalName}
                              </div>
                              {entry.notes && (
                                <div className="text-sm text-muted-foreground">
                                  {entry.notes}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center space-x-4">
                            <div className="text-right space-y-1">
                              <div className="flex items-center space-x-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm">{new Date(entry.date).toLocaleDateString()}</span>
                              </div>
                            </div>
                            
                            <div className="flex space-x-2">
                              <Button variant="ghost" size="sm">
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm">
                                <Edit className="h-4 w-4" />
                              </Button>
                              {entry.status === 'planned' && (
                                <Button 
                                  size="sm"
                                  onClick={() => updateEntryMutation.mutate({ 
                                    id: entry.id, 
                                    data: { status: 'in_progress' } 
                                  })}
                                  disabled={updateEntryMutation.isPending}
                                >
                                  Iniciar
                                </Button>
                              )}
                              {entry.status === 'in_progress' && (
                                <Button 
                                  size="sm"
                                  onClick={() => updateEntryMutation.mutate({ 
                                    id: entry.id, 
                                    data: { status: 'completed' } 
                                  })}
                                  disabled={updateEntryMutation.isPending}
                                >
                                  Concluir
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default OdontogramaPage;