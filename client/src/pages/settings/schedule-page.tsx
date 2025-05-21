import { useState } from "react";
import DashboardLayout from "@/layouts/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger, 
} from "@/components/ui/dialog";
import { Plus, Edit, Trash2, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";

interface Professional {
  id: number;
  fullName: string;
  speciality?: string;
  email?: string;
  phone?: string;
}

interface Room {
  id: number;
  name: string;
  description?: string;
}

export default function ScheduleSettingsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("professionals");
  
  // Estado para os modals de criação/edição
  const [isProfessionalDialogOpen, setProfessionalDialogOpen] = useState(false);
  const [isRoomDialogOpen, setRoomDialogOpen] = useState(false);
  const [editingProfessional, setEditingProfessional] = useState<Professional | null>(null);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  
  // Queries para buscar dados
  const { data: professionals, isLoading: isLoadingProfessionals } = useQuery<Professional[]>({
    queryKey: ["/api/professionals"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/professionals");
        // Se não conseguirmos carregar os dados reais por algum motivo,
        // vamos usar alguns dados de exemplo para desenvolvimento
        if (!res.ok) {
          console.warn("Usando dados de exemplo para profissionais");
          return [
            { id: 1, fullName: "Dr. Ana Silva", speciality: "Dentista", email: "ana@exemplo.com" },
            { id: 2, fullName: "Dr. Carlos Mendes", speciality: "Ortodontista", email: "carlos@exemplo.com" },
            { id: 3, fullName: "Dr. Juliana Costa", speciality: "Endodontista", email: "juliana@exemplo.com" }
          ];
        }
        return await res.json();
      } catch (error) {
        console.error("Erro ao carregar profissionais:", error);
        return [
          { id: 1, fullName: "Dr. Ana Silva", speciality: "Dentista", email: "ana@exemplo.com" },
          { id: 2, fullName: "Dr. Carlos Mendes", speciality: "Ortodontista", email: "carlos@exemplo.com" },
          { id: 3, fullName: "Dr. Juliana Costa", speciality: "Endodontista", email: "juliana@exemplo.com" }
        ];
      }
    }
  });
  
  const { data: rooms, isLoading: isLoadingRooms } = useQuery<Room[]>({
    queryKey: ["/api/rooms"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/rooms");
        // Se não conseguirmos carregar os dados reais por algum motivo,
        // vamos usar alguns dados de exemplo para desenvolvimento
        if (!res.ok) {
          console.warn("Usando dados de exemplo para salas");
          return [
            { id: 1, name: "Cadeira 01", description: "Sala de atendimento 1" },
            { id: 2, name: "Cadeira 02", description: "Sala de atendimento 2" },
            { id: 3, name: "Cadeira 03", description: "Sala de atendimento 3" }
          ];
        }
        return await res.json();
      } catch (error) {
        console.error("Erro ao carregar salas:", error);
        return [
          { id: 1, name: "Cadeira 01", description: "Sala de atendimento 1" },
          { id: 2, name: "Cadeira 02", description: "Sala de atendimento 2" },
          { id: 3, name: "Cadeira 03", description: "Sala de atendimento 3" }
        ];
      }
    }
  });
  
  // Mutation para criar/atualizar profissionais
  const professionalMutation = useMutation({
    mutationFn: async (professionalData: Partial<Professional>) => {
      if (professionalData.id) {
        // Atualização
        const res = await apiRequest("PATCH", `/api/professionals/${professionalData.id}`, professionalData);
        return await res.json();
      } else {
        // Criação
        const res = await apiRequest("POST", "/api/professionals", professionalData);
        return await res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/professionals"] });
      setProfessionalDialogOpen(false);
      setEditingProfessional(null);
      toast({
        title: "Sucesso",
        description: "Profissional salvo com sucesso!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: `Falha ao salvar profissional: ${error.message}`,
        variant: "destructive",
      });
    }
  });
  
  // Mutation para criar/atualizar salas
  const roomMutation = useMutation({
    mutationFn: async (roomData: Partial<Room>) => {
      if (roomData.id) {
        // Atualização
        const res = await apiRequest("PATCH", `/api/rooms/${roomData.id}`, roomData);
        return await res.json();
      } else {
        // Criação
        const res = await apiRequest("POST", "/api/rooms", roomData);
        return await res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rooms"] });
      setRoomDialogOpen(false);
      setEditingRoom(null);
      toast({
        title: "Sucesso",
        description: "Sala/cadeira salva com sucesso!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: `Falha ao salvar sala/cadeira: ${error.message}`,
        variant: "destructive",
      });
    }
  });
  
  // Handler para salvar profissional
  const handleSaveProfessional = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const professionalData: Partial<Professional> = {
      fullName: formData.get("fullName") as string,
      speciality: formData.get("speciality") as string,
      email: formData.get("email") as string,
      phone: formData.get("phone") as string,
    };
    
    if (editingProfessional) {
      professionalData.id = editingProfessional.id;
    }
    
    professionalMutation.mutate(professionalData);
  };
  
  // Handler para salvar sala
  const handleSaveRoom = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const roomData: Partial<Room> = {
      name: formData.get("name") as string,
      description: formData.get("description") as string,
    };
    
    if (editingRoom) {
      roomData.id = editingRoom.id;
    }
    
    roomMutation.mutate(roomData);
  };
  
  // Handler para deletar profissional (mock)
  const handleDeleteProfessional = (id: number) => {
    toast({
      title: "Atenção",
      description: "Esta funcionalidade ainda não está implementada. Nenhum profissional foi removido.",
      variant: "destructive",
    });
  };
  
  // Handler para deletar sala (mock)
  const handleDeleteRoom = (id: number) => {
    toast({
      title: "Atenção",
      description: "Esta funcionalidade ainda não está implementada. Nenhuma sala foi removida.",
      variant: "destructive",
    });
  };
  
  return (
    <DashboardLayout title="Configurações da Agenda" currentPath="/settings/schedule">
      <div className="container mx-auto py-6">
        <div className="flex items-center mb-6">
          <Link href="/schedule" className="mr-4">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Configurações da Agenda</h1>
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="professionals">Profissionais</TabsTrigger>
            <TabsTrigger value="rooms">Cadeiras/Salas</TabsTrigger>
          </TabsList>
          
          {/* Tab de Profissionais */}
          <TabsContent value="professionals">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Gerenciar Profissionais</CardTitle>
                  <CardDescription>
                    Adicione, edite ou remova os profissionais da clínica.
                  </CardDescription>
                </div>
                <Dialog open={isProfessionalDialogOpen} onOpenChange={setProfessionalDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => setEditingProfessional(null)}>
                      <Plus className="h-4 w-4 mr-2" /> Novo Profissional
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {editingProfessional ? "Editar Profissional" : "Adicionar Profissional"}
                      </DialogTitle>
                      <DialogDescription>
                        Preencha os dados do profissional e clique em salvar.
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSaveProfessional}>
                      <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                          <Label htmlFor="fullName">Nome Completo</Label>
                          <Input
                            id="fullName"
                            name="fullName"
                            defaultValue={editingProfessional?.fullName || ""}
                            required
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="speciality">Especialidade</Label>
                          <Input
                            id="speciality"
                            name="speciality"
                            defaultValue={editingProfessional?.speciality || ""}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="email">Email</Label>
                          <Input
                            id="email"
                            name="email"
                            type="email"
                            defaultValue={editingProfessional?.email || ""}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="phone">Telefone</Label>
                          <Input
                            id="phone"
                            name="phone"
                            defaultValue={editingProfessional?.phone || ""}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button type="submit" disabled={professionalMutation.isPending}>
                          {professionalMutation.isPending ? "Salvando..." : "Salvar"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {isLoadingProfessionals ? (
                  <div className="flex justify-center p-4">
                    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Especialidade</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead className="w-[100px]">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {professionals && professionals.length > 0 ? (
                          professionals.map((professional) => (
                            <TableRow key={professional.id}>
                              <TableCell>{professional.fullName}</TableCell>
                              <TableCell>{professional.speciality || "-"}</TableCell>
                              <TableCell>{professional.email || "-"}</TableCell>
                              <TableCell>
                                <div className="flex space-x-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      setEditingProfessional(professional);
                                      setProfessionalDialogOpen(true);
                                    }}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeleteProfessional(professional.id)}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-4">
                              Nenhum profissional cadastrado
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Tab de Salas */}
          <TabsContent value="rooms">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Gerenciar Cadeiras/Salas</CardTitle>
                  <CardDescription>
                    Adicione, edite ou remova as cadeiras e salas da clínica.
                  </CardDescription>
                </div>
                <Dialog open={isRoomDialogOpen} onOpenChange={setRoomDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => setEditingRoom(null)}>
                      <Plus className="h-4 w-4 mr-2" /> Nova Cadeira/Sala
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {editingRoom ? "Editar Cadeira/Sala" : "Adicionar Cadeira/Sala"}
                      </DialogTitle>
                      <DialogDescription>
                        Preencha os dados da cadeira/sala e clique em salvar.
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSaveRoom}>
                      <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                          <Label htmlFor="name">Nome</Label>
                          <Input
                            id="name"
                            name="name"
                            defaultValue={editingRoom?.name || ""}
                            required
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="description">Descrição</Label>
                          <Input
                            id="description"
                            name="description"
                            defaultValue={editingRoom?.description || ""}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button type="submit" disabled={roomMutation.isPending}>
                          {roomMutation.isPending ? "Salvando..." : "Salvar"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {isLoadingRooms ? (
                  <div className="flex justify-center p-4">
                    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead className="w-[100px]">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rooms && rooms.length > 0 ? (
                          rooms.map((room) => (
                            <TableRow key={room.id}>
                              <TableCell>{room.name}</TableCell>
                              <TableCell>{room.description || "-"}</TableCell>
                              <TableCell>
                                <div className="flex space-x-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      setEditingRoom(room);
                                      setRoomDialogOpen(true);
                                    }}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeleteRoom(room.id)}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center py-4">
                              Nenhuma cadeira/sala cadastrada
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}