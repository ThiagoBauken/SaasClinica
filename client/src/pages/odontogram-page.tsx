import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Activity, Search, User, Sparkles } from 'lucide-react';
import InteractiveOdontogram from '@/components/odontogram/InteractiveOdontogram';
import ClinicalAssistant from '@/components/clinical/ClinicalAssistant';

interface PatientResult {
  id: number;
  fullName: string;
  phone?: string;
  cellphone?: string;
}

export default function OdontogramPage() {
  const [selectedPatient, setSelectedPatient] = useState<PatientResult | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: patients = [] } = useQuery<PatientResult[]>({
    queryKey: ['/api/patients', { search: searchQuery }],
    enabled: searchQuery.length >= 2,
  });

  const filteredPatients = Array.isArray(patients)
    ? patients.filter((p: PatientResult) =>
        p.fullName?.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 20)
    : [];

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-[1400px]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Activity className="h-7 w-7 text-blue-600" />
            Odontograma Digital
          </h1>
          <p className="text-muted-foreground mt-1">
            Mapeamento dental interativo com histórico completo
          </p>
        </div>
      </div>

      {/* Patient selector */}
      <Card className="mb-6">
        <CardContent className="py-4">
          <div className="flex items-center gap-4">
            {selectedPatient ? (
              <>
                <div className="flex items-center gap-2">
                  <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <User className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold">{selectedPatient.fullName}</p>
                    <p className="text-xs text-muted-foreground">{selectedPatient.phone || selectedPatient.cellphone || 'Sem telefone'}</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => setSearchOpen(true)}>
                  Trocar Paciente
                </Button>
              </>
            ) : (
              <Button onClick={() => setSearchOpen(true)} className="w-full md:w-auto">
                <Search className="h-4 w-4 mr-2" />
                Selecionar Paciente
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Odontogram + Clinical Assistant */}
      {selectedPatient ? (
        <Tabs defaultValue="odontogram" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="odontogram" className="flex items-center gap-1.5">
              <Activity className="h-4 w-4" />
              Odontograma
            </TabsTrigger>
            <TabsTrigger value="ai-assistant" className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4" />
              Assistente IA
            </TabsTrigger>
          </TabsList>

          <TabsContent value="odontogram">
            <InteractiveOdontogram
              patientId={selectedPatient.id}
              patientName={selectedPatient.fullName}
            />
          </TabsContent>

          <TabsContent value="ai-assistant">
            <ClinicalAssistant
              patientId={selectedPatient.id}
              patientName={selectedPatient.fullName}
            />
          </TabsContent>
        </Tabs>
      ) : (
        <Card>
          <CardContent className="py-16">
            <div className="text-center">
              <Activity className="h-16 w-16 mx-auto text-blue-200 mb-4" />
              <p className="text-lg text-gray-500">Selecione um paciente para iniciar</p>
              <p className="text-sm text-gray-400 mt-1">
                O odontograma e o assistente clinico com IA serao carregados com o historico do paciente
              </p>
              <Button className="mt-4" onClick={() => setSearchOpen(true)}>
                <Search className="h-4 w-4 mr-2" /> Buscar Paciente
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Patient search dialog */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Buscar Paciente</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Digite o nome do paciente..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
          <ScrollArea className="max-h-72">
            {filteredPatients.length === 0 && searchQuery.length >= 2 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum paciente encontrado</p>
            )}
            <div className="space-y-1">
              {filteredPatients.map((p: PatientResult) => (
                <button
                  key={p.id}
                  className="w-full text-left p-3 rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-3"
                  onClick={() => {
                    setSelectedPatient(p);
                    setSearchOpen(false);
                    setSearchQuery('');
                  }}
                >
                  <div className="h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <User className="h-4 w-4 text-blue-500" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{p.fullName}</p>
                    <p className="text-xs text-muted-foreground">{p.phone || p.cellphone || ''}</p>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
