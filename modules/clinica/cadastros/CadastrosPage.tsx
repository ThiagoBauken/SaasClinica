import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../../../client/src/components/ui/card';
import { Button } from '../../../client/src/components/ui/button';
import { Input } from '../../../client/src/components/ui/input';
import { Label } from '../../../client/src/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../client/src/components/ui/tabs';
import { 
  Users, 
  UserPlus, 
  Building, 
  Stethoscope, 
  Plus,
  Edit,
  Trash2,
  Search,
  Archive
} from 'lucide-react';
import { useToast } from '../../../client/src/hooks/use-toast';

interface Professional {
  id: number;
  name: string;
  speciality: string;
  cro: string;
  phone: string;
  email: string;
  active: boolean;
}

interface Room {
  id: number;
  name: string;
  description: string;
  active: boolean;
}

interface Procedure {
  id: number;
  name: string;
  description: string;
  duration: number;
  price: number;
  category: string;
  active: boolean;
}

export function CadastrosPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('professionals');

  const { data: professionals = [], isLoading: professionalsLoading } = useQuery({
    queryKey: ['/api/professionals'],
    select: (data: Professional[]) => data || []
  });

  const { data: rooms = [], isLoading: roomsLoading } = useQuery({
    queryKey: ['/api/rooms'],
    select: (data: Room[]) => data || []
  });

  const { data: procedures = [], isLoading: proceduresLoading } = useQuery({
    queryKey: ['/api/procedures'],
    select: (data: Procedure[]) => data || []
  });

  const createProfessionalMutation = useMutation({
    mutationFn: async (professionalData: Partial<Professional>) => {
      const response = await fetch('/api/professionals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(professionalData)
      });
      if (!response.ok) throw new Error('Failed to create professional');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/professionals'] });
      toast({
        title: "Profissional criado",
        description: "Novo profissional foi adicionado com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao criar profissional.",
        variant: "destructive",
      });
    }
  });

  const createRoomMutation = useMutation({
    mutationFn: async (roomData: Partial<Room>) => {
      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(roomData)
      });
      if (!response.ok) throw new Error('Failed to create room');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rooms'] });
      toast({
        title: "Sala criada",
        description: "Nova sala foi adicionada com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao criar sala.",
        variant: "destructive",
      });
    }
  });

  const createProcedureMutation = useMutation({
    mutationFn: async (procedureData: Partial<Procedure>) => {
      const response = await fetch('/api/procedures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(procedureData)
      });
      if (!response.ok) throw new Error('Failed to create procedure');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/procedures'] });
      toast({
        title: "Procedimento criado",
        description: "Novo procedimento foi adicionado com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao criar procedimento.",
        variant: "destructive",
      });
    }
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ type, id, active }: { type: string; id: number; active: boolean }) => {
      const response = await fetch(`/api/${type}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active })
      });
      if (!response.ok) throw new Error(`Failed to update ${type}`);
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/api/${variables.type}`] });
      toast({
        title: "Status atualizado",
        description: "Item foi atualizado com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao atualizar item.",
        variant: "destructive",
      });
    }
  });

  const filteredProfessionals = professionals.filter(prof =>
    prof.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    prof.speciality.toLowerCase().includes(searchTerm.toLowerCase()) ||
    prof.cro.includes(searchTerm)
  );

  const filteredRooms = rooms.filter(room =>
    room.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (room.description && room.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredProcedures = procedures.filter(proc =>
    proc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    proc.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isLoading = professionalsLoading || roomsLoading || proceduresLoading;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cadastros</h1>
          <p className="text-muted-foreground">
            Gerencie profissionais, salas e procedimentos da clínica
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar em todos os cadastros..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="professionals" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Profissionais
          </TabsTrigger>
          <TabsTrigger value="rooms" className="flex items-center gap-2">
            <Building className="h-4 w-4" />
            Salas
          </TabsTrigger>
          <TabsTrigger value="procedures" className="flex items-center gap-2">
            <Stethoscope className="h-4 w-4" />
            Procedimentos
          </TabsTrigger>
        </TabsList>

        {/* Professionals Tab */}
        <TabsContent value="professionals" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Profissionais</h2>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novo Profissional
            </Button>
          </div>

          <Card>
            <CardContent className="pt-6">
              {filteredProfessionals.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 text-lg font-semibold">
                    {searchTerm ? 'Nenhum profissional encontrado' : 'Nenhum profissional cadastrado'}
                  </h3>
                  <p className="mt-2 text-muted-foreground">
                    {searchTerm 
                      ? 'Tente ajustar os termos de busca.'
                      : 'Comece adicionando o primeiro profissional da clínica.'
                    }
                  </p>
                  {!searchTerm && (
                    <Button className="mt-4">
                      <UserPlus className="mr-2 h-4 w-4" />
                      Adicionar Primeiro Profissional
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredProfessionals.map((professional) => (
                    <div
                      key={professional.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="space-y-1">
                          <div className="font-semibold">{professional.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {professional.speciality} • CRO: {professional.cro}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {professional.phone} • {professional.email}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => toggleActiveMutation.mutate({ 
                            type: 'professionals', 
                            id: professional.id, 
                            active: !professional.active 
                          })}
                          disabled={toggleActiveMutation.isPending}
                        >
                          {professional.active ? <Archive className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rooms Tab */}
        <TabsContent value="rooms" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Salas</h2>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nova Sala
            </Button>
          </div>

          <Card>
            <CardContent className="pt-6">
              {filteredRooms.length === 0 ? (
                <div className="text-center py-8">
                  <Building className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 text-lg font-semibold">
                    {searchTerm ? 'Nenhuma sala encontrada' : 'Nenhuma sala cadastrada'}
                  </h3>
                  <p className="mt-2 text-muted-foreground">
                    {searchTerm 
                      ? 'Tente ajustar os termos de busca.'
                      : 'Comece adicionando a primeira sala da clínica.'
                    }
                  </p>
                  {!searchTerm && (
                    <Button className="mt-4">
                      <Plus className="mr-2 h-4 w-4" />
                      Adicionar Primeira Sala
                    </Button>
                  )}
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredRooms.map((room) => (
                    <Card key={room.id}>
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <span>{room.name}</span>
                          <div className="flex space-x-2">
                            <Button variant="ghost" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">
                          {room.description || 'Sem descrição'}
                        </p>
                        <div className="mt-4 flex items-center justify-between">
                          <span className={`text-sm ${room.active ? 'text-green-600' : 'text-red-600'}`}>
                            {room.active ? 'Ativa' : 'Inativa'}
                          </span>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => toggleActiveMutation.mutate({ 
                              type: 'rooms', 
                              id: room.id, 
                              active: !room.active 
                            })}
                            disabled={toggleActiveMutation.isPending}
                          >
                            {room.active ? 'Desativar' : 'Ativar'}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Procedures Tab */}
        <TabsContent value="procedures" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Procedimentos</h2>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novo Procedimento
            </Button>
          </div>

          <Card>
            <CardContent className="pt-6">
              {filteredProcedures.length === 0 ? (
                <div className="text-center py-8">
                  <Stethoscope className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 text-lg font-semibold">
                    {searchTerm ? 'Nenhum procedimento encontrado' : 'Nenhum procedimento cadastrado'}
                  </h3>
                  <p className="mt-2 text-muted-foreground">
                    {searchTerm 
                      ? 'Tente ajustar os termos de busca.'
                      : 'Comece adicionando o primeiro procedimento da clínica.'
                    }
                  </p>
                  {!searchTerm && (
                    <Button className="mt-4">
                      <Plus className="mr-2 h-4 w-4" />
                      Adicionar Primeiro Procedimento
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredProcedures.map((procedure) => (
                    <div
                      key={procedure.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="space-y-1">
                          <div className="font-semibold">{procedure.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {procedure.category} • {procedure.duration} min
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {procedure.description}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <div className="font-semibold">
                            R$ {(procedure.price / 100).toFixed(2)}
                          </div>
                          <div className={`text-sm ${procedure.active ? 'text-green-600' : 'text-red-600'}`}>
                            {procedure.active ? 'Ativo' : 'Inativo'}
                          </div>
                        </div>
                        
                        <div className="flex space-x-2">
                          <Button variant="ghost" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => toggleActiveMutation.mutate({ 
                              type: 'procedures', 
                              id: procedure.id, 
                              active: !procedure.active 
                            })}
                            disabled={toggleActiveMutation.isPending}
                          >
                            {procedure.active ? <Archive className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default CadastrosPage;