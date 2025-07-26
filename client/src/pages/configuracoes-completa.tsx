import { useState } from "react";
import DashboardLayout from "@/layouts/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Settings, 
  Building2, 
  Users2, 
  Stethoscope,
  MapPin,
  Shield,
  Save,
  Plus,
  Edit,
  Trash2,
  UserPlus
} from "lucide-react";

export default function ConfiguracoesCompleta() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("clinica");
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [showProcedureDialog, setShowProcedureDialog] = useState(false);

  // Mock data for demonstration
  const [clinicData, setClinicData] = useState({
    name: "DentCare Clínica Odontológica",
    cnpj: "12.345.678/0001-90",
    address: "Rua das Flores, 123",
    neighborhood: "Centro",
    city: "São Paulo",
    state: "SP",
    zipCode: "01234-567",
    phone: "(11) 99999-9999",
    email: "contato@dentcare.com.br",
    website: "www.dentcare.com.br",
    workingHours: "08:00 - 18:00",
    workingDays: "Segunda a Sexta"
  });

  const [users, setUsers] = useState([
    { id: 1, name: "Dr. João Silva", email: "joao@dentcare.com", role: "admin", specialty: "Ortodontia", active: true },
    { id: 2, name: "Dra. Maria Santos", email: "maria@dentcare.com", role: "dentist", specialty: "Endodontia", active: true },
    { id: 3, name: "Ana Costa", email: "ana@dentcare.com", role: "staff", specialty: "Recepção", active: true }
  ]);

  const [procedures, setProcedures] = useState([
    { id: 1, name: "Consulta", price: 150.00, duration: 30, category: "Geral" },
    { id: 2, name: "Limpeza", price: 120.00, duration: 45, category: "Preventiva" },
    { id: 3, name: "Obturação", price: 200.00, duration: 60, category: "Restauradora" },
    { id: 4, name: "Canal", price: 800.00, duration: 90, category: "Endodontia" }
  ]);

  const [rooms, setRooms] = useState([
    { id: 1, name: "Consultório 1", type: "Geral", equipment: "Cadeira odontológica, Raio-X", active: true },
    { id: 2, name: "Consultório 2", type: "Cirurgia", equipment: "Cadeira cirúrgica, Sugador", active: true },
    { id: 3, name: "Sala de Raio-X", type: "Diagnóstico", equipment: "Aparelho de Raio-X digital", active: true }
  ]);

  const handleSaveClinic = () => {
    toast({
      title: "Dados salvos",
      description: "As informações da clínica foram atualizadas com sucesso.",
    });
  };

  return (
    <DashboardLayout title="Configurações" currentPath="/configuracoes">
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-6 mb-6">
            <TabsTrigger value="clinica" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Clínica
            </TabsTrigger>
            <TabsTrigger value="usuarios" className="flex items-center gap-2">
              <Users2 className="h-4 w-4" />
              Usuários
            </TabsTrigger>
            <TabsTrigger value="procedimentos" className="flex items-center gap-2">
              <Stethoscope className="h-4 w-4" />
              Procedimentos
            </TabsTrigger>
            <TabsTrigger value="salas" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Salas
            </TabsTrigger>
            <TabsTrigger value="especialidades" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Especialidades
            </TabsTrigger>
            <TabsTrigger value="sistema" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Sistema
            </TabsTrigger>
          </TabsList>

          {/* Tab: Configurações da Clínica */}
          <TabsContent value="clinica">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Informações da Clínica
                </CardTitle>
                <CardDescription>
                  Configure os dados básicos da sua clínica
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome da Clínica</Label>
                    <Input
                      id="name"
                      value={clinicData.name}
                      onChange={(e) => setClinicData({...clinicData, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cnpj">CNPJ</Label>
                    <Input
                      id="cnpj"
                      value={clinicData.cnpj}
                      onChange={(e) => setClinicData({...clinicData, cnpj: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="address">Endereço</Label>
                    <Input
                      id="address"
                      value={clinicData.address}
                      onChange={(e) => setClinicData({...clinicData, address: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="neighborhood">Bairro</Label>
                    <Input
                      id="neighborhood"
                      value={clinicData.neighborhood}
                      onChange={(e) => setClinicData({...clinicData, neighborhood: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">Cidade</Label>
                    <Input
                      id="city"
                      value={clinicData.city}
                      onChange={(e) => setClinicData({...clinicData, city: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">Estado</Label>
                    <Select
                      value={clinicData.state}
                      onValueChange={(value) => setClinicData({...clinicData, state: value})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SP">São Paulo</SelectItem>
                        <SelectItem value="RJ">Rio de Janeiro</SelectItem>
                        <SelectItem value="MG">Minas Gerais</SelectItem>
                        <SelectItem value="RS">Rio Grande do Sul</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="zipCode">CEP</Label>
                    <Input
                      id="zipCode"
                      value={clinicData.zipCode}
                      onChange={(e) => setClinicData({...clinicData, zipCode: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <Input
                      id="phone"
                      value={clinicData.phone}
                      onChange={(e) => setClinicData({...clinicData, phone: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input
                      id="email"
                      type="email"
                      value={clinicData.email}
                      onChange={(e) => setClinicData({...clinicData, email: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="website">Website</Label>
                    <Input
                      id="website"
                      value={clinicData.website}
                      onChange={(e) => setClinicData({...clinicData, website: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="workingHours">Horário de Funcionamento</Label>
                    <Input
                      id="workingHours"
                      value={clinicData.workingHours}
                      onChange={(e) => setClinicData({...clinicData, workingHours: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="workingDays">Dias de Funcionamento</Label>
                    <Input
                      id="workingDays"
                      value={clinicData.workingDays}
                      onChange={(e) => setClinicData({...clinicData, workingDays: e.target.value})}
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSaveClinic} className="flex items-center gap-2">
                    <Save className="h-4 w-4" />
                    Salvar Alterações
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Usuários e Permissões */}
          <TabsContent value="usuarios">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users2 className="h-5 w-5" />
                      Usuários e Permissões
                    </CardTitle>
                    <CardDescription>
                      Gerencie usuários e suas permissões no sistema
                    </CardDescription>
                  </div>
                  <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
                    <DialogTrigger asChild>
                      <Button className="flex items-center gap-2">
                        <UserPlus className="h-4 w-4" />
                        Novo Usuário
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Adicionar Usuário</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="newUserName">Nome</Label>
                          <Input id="newUserName" placeholder="Nome completo" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="newUserEmail">E-mail</Label>
                          <Input id="newUserEmail" type="email" placeholder="email@exemplo.com" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="newUserRole">Função</Label>
                          <Select>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a função" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Administrador</SelectItem>
                              <SelectItem value="dentist">Dentista</SelectItem>
                              <SelectItem value="staff">Funcionário</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="newUserSpecialty">Especialidade</Label>
                          <Input id="newUserSpecialty" placeholder="Ex: Ortodontia, Endodontia" />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => setShowUserDialog(false)}>
                            Cancelar
                          </Button>
                          <Button onClick={() => setShowUserDialog(false)}>
                            Adicionar
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Função</TableHead>
                      <TableHead>Especialidade</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Badge variant={user.role === 'admin' ? 'default' : user.role === 'dentist' ? 'secondary' : 'outline'}>
                            {user.role === 'admin' ? 'Admin' : user.role === 'dentist' ? 'Dentista' : 'Funcionário'}
                          </Badge>
                        </TableCell>
                        <TableCell>{user.specialty}</TableCell>
                        <TableCell>
                          <Badge variant={user.active ? 'default' : 'destructive'}>
                            {user.active ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Procedimentos e Preços */}
          <TabsContent value="procedimentos">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Stethoscope className="h-5 w-5" />
                      Procedimentos e Preços
                    </CardTitle>
                    <CardDescription>
                      Configure os procedimentos disponíveis e seus valores
                    </CardDescription>
                  </div>
                  <Dialog open={showProcedureDialog} onOpenChange={setShowProcedureDialog}>
                    <DialogTrigger asChild>
                      <Button className="flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        Novo Procedimento
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Adicionar Procedimento</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="newProcedureName">Nome do Procedimento</Label>
                          <Input id="newProcedureName" placeholder="Ex: Consulta, Limpeza" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="newProcedurePrice">Preço (R$)</Label>
                          <Input id="newProcedurePrice" type="number" placeholder="150.00" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="newProcedureDuration">Duração (minutos)</Label>
                          <Input id="newProcedureDuration" type="number" placeholder="30" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="newProcedureCategory">Categoria</Label>
                          <Select>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a categoria" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="geral">Geral</SelectItem>
                              <SelectItem value="preventiva">Preventiva</SelectItem>
                              <SelectItem value="restauradora">Restauradora</SelectItem>
                              <SelectItem value="endodontia">Endodontia</SelectItem>
                              <SelectItem value="cirurgia">Cirurgia</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => setShowProcedureDialog(false)}>
                            Cancelar
                          </Button>
                          <Button onClick={() => setShowProcedureDialog(false)}>
                            Adicionar
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Procedimento</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Preço</TableHead>
                      <TableHead>Duração</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {procedures.map((procedure) => (
                      <TableRow key={procedure.id}>
                        <TableCell className="font-medium">{procedure.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{procedure.category}</Badge>
                        </TableCell>
                        <TableCell>R$ {procedure.price.toFixed(2)}</TableCell>
                        <TableCell>{procedure.duration} min</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Salas/Consultórios */}
          <TabsContent value="salas">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      Salas e Consultórios
                    </CardTitle>
                    <CardDescription>
                      Configure as salas e consultórios da clínica
                    </CardDescription>
                  </div>
                  <Button className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Nova Sala
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Equipamentos</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rooms.map((room) => (
                      <TableRow key={room.id}>
                        <TableCell className="font-medium">{room.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{room.type}</Badge>
                        </TableCell>
                        <TableCell>{room.equipment}</TableCell>
                        <TableCell>
                          <Badge variant={room.active ? 'default' : 'destructive'}>
                            {room.active ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Especialidades */}
          <TabsContent value="especialidades">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      Especialidades
                    </CardTitle>
                    <CardDescription>
                      Configure as especialidades odontológicas disponíveis
                    </CardDescription>
                  </div>
                  <Button className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Nova Especialidade
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {['Ortodontia', 'Endodontia', 'Periodontia', 'Implantodontia', 'Cirurgia Oral', 'Odontopediatria'].map((specialty, index) => (
                    <Card key={index}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <h3 className="font-medium">{specialty}</h3>
                            <p className="text-sm text-muted-foreground">Ativa</p>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Configurações do Sistema */}
          <TabsContent value="sistema">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Configurações Gerais
                  </CardTitle>
                  <CardDescription>
                    Configure as opções gerais do sistema
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Notificações por E-mail</h4>
                      <p className="text-sm text-muted-foreground">Receber notificações por e-mail</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Backup Automático</h4>
                      <p className="text-sm text-muted-foreground">Fazer backup dos dados diariamente</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Modo Escuro</h4>
                      <p className="text-sm text-muted-foreground">Usar tema escuro no sistema</p>
                    </div>
                    <Switch />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Integrações</CardTitle>
                  <CardDescription>
                    Configure integrações com serviços externos
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">WhatsApp Business</h4>
                      <p className="text-sm text-muted-foreground">Integração com WhatsApp para mensagens</p>
                    </div>
                    <Switch />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Google Calendar</h4>
                      <p className="text-sm text-muted-foreground">Sincronizar agenda com Google Calendar</p>
                    </div>
                    <Switch />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Stripe Pagamentos</h4>
                      <p className="text-sm text-muted-foreground">Processar pagamentos online</p>
                    </div>
                    <Switch />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}