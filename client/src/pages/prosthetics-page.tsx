import { useState, useEffect } from "react";
import DashboardLayout from "@/layouts/DashboardLayout";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, Plus, X, AlertCircle, Paperclip, Printer, Calendar, RotateCcw, ExternalLink, MessageSquare, History, Share2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";

// Tipo de dados para próteses
interface Label {
  id: number;
  name: string;
  color: string;
}

interface Movement {
  id: number;
  date: string;
  from: string;
  to: string;
  user: string;
}

interface Prosthetic {
  id: number;
  patientName: string;
  patientId: number;
  createdAt: string;
  description: string;
  professional: string;
  status: "pre-lab" | "sent" | "lab" | "approved" | "completed";
  phone?: string;
  laboratory?: string;
  sentDate?: string;
  deliveryDate?: string;
  notes?: string[];
  color?: string;
  labelId?: number;
  additionalInfo?: string;
  movements?: Movement[];
}

// Estados para o controle de próteses
const statusLabels = {
  "pre-lab": "Pré-laboratório",
  "sent": "Envio",
  "lab": "Laboratório",
  "approved": "Aprovado",
  "completed": "Realizado"
};

export default function ProstheticsPage() {
  const [location] = useLocation();
  const [prosthetics, setProsthetics] = useState<Prosthetic[]>([
    {
      id: 1,
      patientName: "Marcos Silva",
      patientId: 101,
      createdAt: new Date(2023, 5, 15).toISOString(),
      description: "Prótese total superior",
      professional: "Dr. Ana Silva",
      status: "pre-lab",
      phone: "+55 47 98475 6013",
      laboratory: "Laboratório não informado",
      notes: ["Paciente alérgico a metal, utilizar material cerâmico"]
    },
    {
      id: 2,
      patientName: "João Pereira",
      patientId: 102,
      createdAt: new Date(2023, 5, 20).toISOString(),
      description: "Coroa unitária - dente 26",
      professional: "Dr. Carlos Mendes",
      status: "sent",
      phone: "+55 11 98765 4321",
      laboratory: "Laboratório Dental Tech",
      sentDate: new Date(2023, 5, 22).toISOString(),
      notes: ["Paciente solicitou que a cor seja o mais natural possível"]
    },
    {
      id: 3,
      patientName: "Maria Oliveira",
      patientId: 103,
      createdAt: new Date(2023, 6, 5).toISOString(),
      description: "Prótese parcial removível inferior",
      professional: "Dr. Ana Silva",
      status: "lab",
      phone: "+55 21 97654 3210",
      laboratory: "Laboratório Odontolab",
      sentDate: new Date(2023, 6, 7).toISOString(),
      notes: ["Prótese com ganchos em acrílico conforme solicitado pela paciente", "Utilizar material hipoalergênico"],
      movements: [
        {
          id: 1,
          date: new Date(2023, 6, 5, 14, 30).toISOString(),
          from: "Pré-laboratório",
          to: "Envio",
          user: "Dr. Ana Silva"
        },
        {
          id: 2,
          date: new Date(2023, 6, 7, 9, 15).toISOString(),
          from: "Envio",
          to: "Laboratório",
          user: "Dr. Ana Silva"
        }
      ]
    },
    {
      id: 4,
      patientName: "Paulo Santos",
      patientId: 104,
      createdAt: new Date(2023, 6, 10).toISOString(),
      description: "Facetas de porcelana - dentes 11 e 21",
      professional: "Dr. Juliana Costa",
      status: "approved",
      phone: "+55 31 96543 2109",
      laboratory: "Premier Laboratório Dental",
      sentDate: new Date(2023, 6, 12).toISOString(),
      deliveryDate: new Date(2023, 6, 28).toISOString(),
      notes: ["Paciente deseja cor A1", "Aprovado após primeira prova"]
    },
    {
      id: 5,
      patientName: "Carla Sousa",
      patientId: 105,
      createdAt: new Date(2023, 6, 15).toISOString(),
      description: "Implante com coroa - dente 36",
      professional: "Dr. Carlos Mendes",
      status: "completed",
      phone: "+55 81 95432 1098",
      laboratory: "Dental Lab Express",
      sentDate: new Date(2023, 6, 17).toISOString(),
      deliveryDate: new Date(2023, 7, 5).toISOString(),
      notes: ["Implante de titânio com coroa metal-free", "Paciente satisfeito com o resultado final"]
    }
  ]);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
  const [isEditServiceModalOpen, setIsEditServiceModalOpen] = useState(false);
  const [selectedProsthetic, setSelectedProsthetic] = useState<Prosthetic | null>(null);
  const [labels, setLabels] = useState<Label[]>([
    { id: 1, name: "Urgente", color: "#dc2626" },
    { id: 2, name: "Prioridade", color: "#ea580c" },
    { id: 3, name: "Normal", color: "#16a34a" },
    { id: 4, name: "Espera", color: "#2563eb" }
  ]);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("#3b82f6");
  const [selectedLabelId, setSelectedLabelId] = useState<number | null>(null);
  const [newProsthetic, setNewProsthetic] = useState({
    patientName: "",
    description: "",
    professional: ""
  });
  const [draggedItem, setDraggedItem] = useState<Prosthetic | null>(null);
  const [newNote, setNewNote] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");

  // Filtrar próteses pelo termo de busca
  const filteredProsthetics = prosthetics.filter(
    (item) =>
      item.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.professional.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Agrupar por status
  const groupedProsthetics = {
    "pre-lab": filteredProsthetics.filter((p) => p.status === "pre-lab"),
    "sent": filteredProsthetics.filter((p) => p.status === "sent"),
    "lab": filteredProsthetics.filter((p) => p.status === "lab"),
    "approved": filteredProsthetics.filter((p) => p.status === "approved"),
    "completed": filteredProsthetics.filter((p) => p.status === "completed")
  };

  // Manipuladores para os modais
  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);
  
  const openDetailModal = (prosthetic: Prosthetic) => {
    setSelectedProsthetic(prosthetic);
    setIsDetailModalOpen(true);
  };
  
  const closeDetailModal = () => {
    setIsDetailModalOpen(false);
    setSelectedProsthetic(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewProsthetic((prev) => ({ ...prev, [name]: value }));
  };
  
  // Adicionar nova anotação
  const handleAddNote = () => {
    if (!newNote.trim() || !selectedProsthetic) return;
    
    const updatedProsthetics = prosthetics.map(p => {
      if (p.id === selectedProsthetic.id) {
        const updatedNotes = p.notes ? [...p.notes, newNote] : [newNote];
        return { ...p, notes: updatedNotes };
      }
      return p;
    });
    
    setProsthetics(updatedProsthetics);
    
    // Atualiza o prosthetic selecionado para refletir a mudança no modal
    const updatedSelected = updatedProsthetics.find(p => p.id === selectedProsthetic.id);
    if (updatedSelected) {
      setSelectedProsthetic(updatedSelected);
    }
    
    setNewNote("");
    
    toast({
      title: "Anotação adicionada",
      description: "A anotação foi adicionada com sucesso",
    });
  };
  
  // Atualizar datas
  const handleUpdateDates = (type: 'sentDate' | 'deliveryDate') => {
    if (!selectedProsthetic) return;
    
    const date = new Date().toISOString();
    
    const updatedProsthetics = prosthetics.map(p => {
      if (p.id === selectedProsthetic.id) {
        return { ...p, [type]: date };
      }
      return p;
    });
    
    setProsthetics(updatedProsthetics);
    
    // Atualiza o prosthetic selecionado para refletir a mudança no modal
    const updatedSelected = updatedProsthetics.find(p => p.id === selectedProsthetic.id);
    if (updatedSelected) {
      setSelectedProsthetic(updatedSelected);
    }
    
    toast({
      title: type === 'sentDate' ? "Data de envio registrada" : "Data de entrega registrada",
      description: `A data de ${type === 'sentDate' ? 'envio' : 'entrega'} foi registrada com sucesso`,
    });
  };
  
  // Retornar serviço
  const handleReturnService = () => {
    if (!selectedProsthetic) return;
    
    // Move o serviço para o status anterior
    let newStatus: "pre-lab" | "sent" | "lab" | "approved" | "completed" = "pre-lab";
    
    switch (selectedProsthetic.status) {
      case "sent":
        newStatus = "pre-lab";
        break;
      case "lab":
        newStatus = "sent";
        break;
      case "approved":
        newStatus = "lab";
        break;
      case "completed":
        newStatus = "approved";
        break;
      default:
        newStatus = "pre-lab";
    }
    
    const updatedProsthetics = prosthetics.map(p => {
      if (p.id === selectedProsthetic.id) {
        return { ...p, status: newStatus };
      }
      return p;
    });
    
    setProsthetics(updatedProsthetics);
    closeDetailModal();
    
    toast({
      title: "Serviço retornado",
      description: `O serviço foi movido para "${statusLabels[newStatus]}"`,
    });
  };

  // Adicionar nova prótese
  const handleAddProsthetic = () => {
    // Validar campos
    if (!newProsthetic.patientName || !newProsthetic.professional || !newProsthetic.description) {
      toast({
        title: "Erro ao adicionar",
        description: "Todos os campos são obrigatórios",
        variant: "destructive"
      });
      return;
    }

    const newItem: Prosthetic = {
      id: prosthetics.length > 0 ? Math.max(...prosthetics.map(p => p.id)) + 1 : 1,
      patientName: newProsthetic.patientName,
      patientId: Math.floor(Math.random() * 1000) + 100, // ID fictício para demonstração
      createdAt: new Date().toISOString(),
      description: newProsthetic.description,
      professional: newProsthetic.professional,
      status: "pre-lab"
    };

    setProsthetics([...prosthetics, newItem]);
    setNewProsthetic({
      patientName: "",
      description: "",
      professional: ""
    });
    closeModal();
    
    toast({
      title: "Serviço criado",
      description: "O serviço de prótese foi criado com sucesso",
    });
  };

  // Manipuladores para arrastar e soltar
  const handleDragStart = (prosthetic: Prosthetic) => {
    setDraggedItem(prosthetic);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (status: "pre-lab" | "sent" | "lab" | "approved" | "completed") => {
    if (draggedItem) {
      const updatedProsthetics = prosthetics.map(p => {
        if (p.id === draggedItem.id) {
          return { ...p, status };
        }
        return p;
      });
      
      setProsthetics(updatedProsthetics);
      setDraggedItem(null);
      
      toast({
        title: "Status atualizado",
        description: `Serviço movido para "${statusLabels[status]}"`,
      });
    }
  };
  
  // Manipular rótulos
  const openLabelModal = () => {
    setIsLabelModalOpen(true);
  };
  
  const closeLabelModal = () => {
    setIsLabelModalOpen(false);
    setSelectedLabelId(null);
  };
  
  const handleAddLabel = () => {
    if (!newLabelName.trim()) return;
    
    const newLabel: Label = {
      id: labels.length > 0 ? Math.max(...labels.map(l => l.id)) + 1 : 1,
      name: newLabelName,
      color: newLabelColor
    };
    
    setLabels([...labels, newLabel]);
    setNewLabelName("");
    
    toast({
      title: "Rótulo adicionado",
      description: "O novo rótulo foi adicionado com sucesso",
    });
  };
  
  const handleSelectLabel = (labelId: number) => {
    if (!selectedProsthetic) return;
    
    // Se o mesmo rótulo for selecionado novamente, remove o rótulo
    const shouldRemoveLabel = selectedProsthetic.labelId === labelId;
    
    const updatedProsthetics = prosthetics.map(p => {
      if (p.id === selectedProsthetic.id) {
        return { 
          ...p, 
          labelId: shouldRemoveLabel ? undefined : labelId,
          color: shouldRemoveLabel ? undefined : labels.find(l => l.id === labelId)?.color
        };
      }
      return p;
    });
    
    setProsthetics(updatedProsthetics);
    
    // Atualiza o prosthetic selecionado para refletir a mudança no modal
    const updatedSelected = updatedProsthetics.find(p => p.id === selectedProsthetic.id);
    if (updatedSelected) {
      setSelectedProsthetic(updatedSelected);
    }
    
    setIsLabelModalOpen(false);
    
    toast({
      title: shouldRemoveLabel ? "Rótulo removido" : "Rótulo aplicado",
      description: shouldRemoveLabel 
        ? "O rótulo foi removido do serviço" 
        : `O rótulo "${labels.find(l => l.id === labelId)?.name}" foi aplicado ao serviço`,
    });
  };
  
  // Editar informações adicionais do serviço
  const openEditServiceModal = () => {
    if (selectedProsthetic) {
      setAdditionalInfo(selectedProsthetic.additionalInfo || "");
      setIsEditServiceModalOpen(true);
    }
  };
  
  const closeEditServiceModal = () => {
    setIsEditServiceModalOpen(false);
    setAdditionalInfo("");
  };
  
  const handleSaveAdditionalInfo = () => {
    if (!selectedProsthetic) return;
    
    const updatedProsthetics = prosthetics.map(p => {
      if (p.id === selectedProsthetic.id) {
        return { ...p, additionalInfo };
      }
      return p;
    });
    
    setProsthetics(updatedProsthetics);
    
    // Atualiza o prosthetic selecionado para refletir a mudança no modal
    const updatedSelected = updatedProsthetics.find(p => p.id === selectedProsthetic.id);
    if (updatedSelected) {
      setSelectedProsthetic(updatedSelected);
    }
    
    closeEditServiceModal();
    
    toast({
      title: "Informações atualizadas",
      description: "As informações adicionais foram atualizadas com sucesso",
    });
  };

  return (
    <DashboardLayout title="Controle de Próteses" currentPath={location}>
      <div className="mb-6 flex justify-between items-center">
        <div className="relative w-64">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-neutral-medium" />
          <Input
            placeholder="Pesquisar por paciente, tratamento, laboratório..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <Button onClick={openModal} className="flex items-center gap-1">
          <Plus className="h-4 w-4" />
          <span>Criar Serviço</span>
        </Button>
      </div>

      <div className="grid grid-cols-5 gap-0">
        {Object.entries(groupedProsthetics).map(([status, items], index, array) => (
          <div 
            key={status}
            className="min-h-[500px] flex flex-col"
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(status as any)}
          >
            {/* Cabeçalho da coluna */}
            <div className="bg-neutral-light p-2 px-4 flex items-center justify-between">
              <h3 className="font-medium text-base text-neutral-dark">
                {statusLabels[status as keyof typeof statusLabels]}
              </h3>
              <div className="flex items-center">
                <span className="bg-primary-light text-primary rounded-full px-2 py-0.5 text-xs font-medium">
                  {items.length}
                </span>
              </div>
            </div>
            
            {/* Área de conteúdo com borda apenas na direita e embaixo */}
            <div 
              className={`flex-1 p-4 space-y-3 bg-white ${
                index < array.length - 1 ? 'border-r border-neutral-light' : ''
              }`}
            >
              {items.map((prosthetic) => (
                <Card 
                  key={prosthetic.id}
                  draggable
                  onClick={() => openDetailModal(prosthetic)}
                  onDragStart={() => handleDragStart(prosthetic)}
                  className={`cursor-grab active:cursor-grabbing hover:border-primary transition-colors duration-200 ${
                    prosthetic.labelId ? 'border-l-4' : ''
                  }`}
                  style={{ 
                    borderLeftColor: prosthetic.color || 'transparent',
                  }}
                >
                  <CardContent className="p-3">
                    {/* Rótulo se existir */}
                    {prosthetic.labelId && (
                      <div 
                        className="text-xs font-medium rounded-sm px-1 py-0.5 mb-1 inline-block"
                        style={{ 
                          backgroundColor: `${prosthetic.color}25`, // cor com 25% de opacidade
                          color: prosthetic.color
                        }}
                      >
                        {labels.find(l => l.id === prosthetic.labelId)?.name}
                      </div>
                    )}
                    <div className="font-medium mb-1">{prosthetic.patientName}</div>
                    <div className="text-sm text-neutral-medium mb-2">
                      {prosthetic.description}
                    </div>
                    <div className="flex justify-between items-center text-xs text-neutral-medium">
                      <span>{prosthetic.professional}</span>
                      <span>
                        {format(new Date(prosthetic.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Modal para criar novo serviço */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar novo serviço</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="patientName" className="required">Paciente</Label>
              <Input
                id="patientName"
                name="patientName"
                placeholder="Buscar paciente"
                value={newProsthetic.patientName}
                onChange={handleInputChange}
              />
              <p className="text-xs text-neutral-medium">Este campo é obrigatório</p>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="professional" className="required">Profissional</Label>
              <Input
                id="professional"
                name="professional"
                placeholder="Selecione o profissional"
                value={newProsthetic.professional}
                onChange={handleInputChange}
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="description" className="required">Descrição do serviço</Label>
              <Input
                id="description"
                name="description"
                placeholder="Ex: Prótese total superior"
                value={newProsthetic.description}
                onChange={handleInputChange}
              />
            </div>
          </div>
          
          <DialogFooter className="sm:justify-between">
            <Button variant="outline" onClick={closeModal}>
              Cancelar
            </Button>
            <Button onClick={handleAddProsthetic}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Modal para detalhes da prótese */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {selectedProsthetic && selectedProsthetic.patientName}
            </DialogTitle>
            <DialogDescription>
              {selectedProsthetic && selectedProsthetic.description}
            </DialogDescription>
          </DialogHeader>
          
          {selectedProsthetic && (
            <div className="space-y-6">
              {/* Informações do paciente */}
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <Avatar className="h-16 w-16">
                    <AvatarFallback className="bg-primary-light text-primary text-xl">
                      {selectedProsthetic.patientName.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    {selectedProsthetic.patientName}
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" title="Abrir perfil do paciente">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </h3>
                  <p className="text-sm text-neutral-medium">
                    {selectedProsthetic.phone}
                  </p>
                  <div className="flex gap-2 mt-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-xs h-8"
                      onClick={() => window.open(`https://wa.me/${selectedProsthetic.phone?.replace(/\D/g, '')}`, '_blank')}
                    >
                      Conversar por WhatsApp Web
                    </Button>
                  </div>
                </div>
              </div>
              
              {/* Ações principais */}
              <div className="mt-4">
                <h3 className="font-medium mb-2">Agenda</h3>
                <div className="grid grid-cols-4 gap-2">
                  <Button variant="outline" size="sm" className="flex items-center gap-1 justify-start">
                    <Paperclip className="h-4 w-4" />
                    <span>Anexar</span>
                  </Button>
                  <Button variant="outline" size="sm" className="flex items-center gap-1 justify-start">
                    <Printer className="h-4 w-4" />
                    <span>Imprimir</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex items-center gap-1 justify-start"
                    onClick={() => handleUpdateDates('sentDate')}
                  >
                    <Share2 className="h-4 w-4" />
                    <span>Data envio</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex items-center gap-1 justify-start"
                    onClick={() => handleUpdateDates('deliveryDate')}
                  >
                    <Calendar className="h-4 w-4" />
                    <span>Data entrega</span>
                  </Button>
                </div>
              </div>
              
              {/* Laboratório */}
              <div className="p-3 border rounded">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1">
                    <span className="font-medium">Laboratório</span>
                    <span className="text-sm text-neutral-medium">{selectedProsthetic.laboratory || "não informado"}</span>
                  </div>
                  
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              {/* Rótulo */}
              <div className="p-3 border rounded">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Serviço personalizado</span>
                    {selectedProsthetic.labelId ? (
                      <div 
                        className="text-xs font-medium rounded-sm px-1 py-0.5 ml-2 inline-block"
                        style={{ 
                          backgroundColor: `${selectedProsthetic.color}25`,
                          color: selectedProsthetic.color
                        }}
                      >
                        {labels.find(l => l.id === selectedProsthetic.labelId)?.name}
                      </div>
                    ) : (
                      <span className="text-sm text-neutral-medium ml-2">não informado</span>
                    )}
                  </div>
                  
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 w-6 p-0"
                    onClick={openLabelModal}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              {/* Status atual e ações */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <RotateCcw className="h-4 w-4" />
                  <span className="font-medium">Retornar serviço</span>
                  
                  <Button 
                    variant="ghost" 
                    className="ml-auto text-blue-600 hover:text-blue-800 px-2 py-1 h-auto text-sm"
                    onClick={handleReturnService}
                  >
                    RETORNAR
                  </Button>
                </div>
                
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span className="font-medium">Agendar consulta</span>
                  
                  <Button 
                    variant="ghost" 
                    className="ml-auto text-blue-600 hover:text-blue-800 px-2 py-1 h-auto text-sm"
                  >
                    AGENDAR
                  </Button>
                </div>
                
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span className="font-medium">Próximas consultas</span>
                  <span className="text-neutral-medium ml-auto">0 consultas</span>
                </div>
              </div>
              
              {/* Histórico e anotações */}
              <Tabs defaultValue="notes" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="notes" className="flex items-center gap-1">
                    <MessageSquare className="h-4 w-4" />
                    <span>Anotações</span>
                  </TabsTrigger>
                  <TabsTrigger value="history" className="flex items-center gap-1">
                    <History className="h-4 w-4" />
                    <span>Histórico</span>
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="notes" className="mt-4">
                  <div className="space-y-4">
                    {selectedProsthetic.notes && selectedProsthetic.notes.length > 0 ? (
                      <div className="space-y-2">
                        {selectedProsthetic.notes.map((note, index) => (
                          <div key={index} className="p-3 bg-neutral-lightest rounded text-sm">
                            {note}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-neutral-medium">
                        <p>Nenhuma anotação adicionada</p>
                      </div>
                    )}
                    
                    <div className="flex gap-2">
                      <Textarea 
                        placeholder="Adicionar anotações internas" 
                        className="min-h-24"
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                      />
                    </div>
                    
                    <div className="flex justify-end">
                      <span className="text-xs text-neutral-medium mr-2">
                        {newNote.length} / 255
                      </span>
                      <Button onClick={handleAddNote} disabled={!newNote.trim()}>
                        Salvar anotação
                      </Button>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="history" className="mt-4">
                  <div className="space-y-4">
                    {/* Informações básicas de datas */}
                    <div className="text-sm space-y-2 mb-4">
                      {selectedProsthetic.sentDate && (
                        <div className="flex justify-between p-2 border-b">
                          <span>Data de envio</span>
                          <span>{format(new Date(selectedProsthetic.sentDate), "dd/MM/yyyy", { locale: ptBR })}</span>
                        </div>
                      )}
                      
                      {selectedProsthetic.deliveryDate && (
                        <div className="flex justify-between p-2 border-b">
                          <span>Data de entrega</span>
                          <span>{format(new Date(selectedProsthetic.deliveryDate), "dd/MM/yyyy", { locale: ptBR })}</span>
                        </div>
                      )}
                      
                      <div className="flex justify-between p-2 border-b">
                        <span>Status atual</span>
                        <span>{statusLabels[selectedProsthetic.status]}</span>
                      </div>
                      
                      <div className="flex justify-between p-2 border-b">
                        <span>Criado em</span>
                        <span>{format(new Date(selectedProsthetic.createdAt), "dd/MM/yyyy", { locale: ptBR })}</span>
                      </div>
                    </div>
                    
                    {/* Histórico de movimentações */}
                    {selectedProsthetic.movements && selectedProsthetic.movements.length > 0 ? (
                      <div className="space-y-3">
                        {selectedProsthetic.movements.map((movement) => (
                          <div key={movement.id} className="flex items-start gap-3">
                            <div className="rounded-full bg-neutral-light w-8 h-8 flex-shrink-0 flex items-center justify-center text-neutral-dark">
                              <span className="text-xs font-medium">BO</span>
                            </div>
                            <div className="flex-1">
                              <div className="text-sm">
                                <span className="font-medium">{movement.user}</span>
                                <span className="text-neutral-medium"> movimentou:</span>
                                <span> serviço {format(new Date(movement.date), "dd 'de' MMMM 'de' yyyy HH:mm", { locale: ptBR })}</span>
                              </div>
                              <div className="text-sm mt-1 flex items-center">
                                <span className="text-neutral-medium">{movement.from}</span>
                                <ArrowRight className="h-3 w-3 mx-1 text-neutral-medium" />
                                <span className="font-medium">{movement.to}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-neutral-medium">
                        <p>Nenhuma movimentação registrada</p>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
              
              <DialogFooter className="sm:justify-between">
                <Button variant="outline" onClick={closeDetailModal}>
                  Fechar
                </Button>
                <Button variant="destructive" onClick={closeDetailModal}>
                  Excluir serviço
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Modal para seleção de rótulos */}
      <Dialog open={isLabelModalOpen} onOpenChange={setIsLabelModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Selecionar rótulo</DialogTitle>
            <DialogDescription>
              Escolha um rótulo para identificar este serviço ou crie um novo.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            {/* Rótulos existentes */}
            <div className="space-y-2">
              {labels.map((label) => (
                <div 
                  key={label.id}
                  className={`p-2 flex items-center gap-2 border rounded cursor-pointer hover:bg-neutral-lightest transition-colors ${
                    selectedProsthetic?.labelId === label.id ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => handleSelectLabel(label.id)}
                >
                  <div 
                    className="w-4 h-4 rounded-full" 
                    style={{ backgroundColor: label.color }}
                  />
                  <span>{label.name}</span>
                  
                  {selectedProsthetic?.labelId === label.id && (
                    <div className="ml-auto text-xs bg-primary-light text-primary px-1 py-0.5 rounded">
                      Selecionado
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            {/* Criar novo rótulo */}
            <div className="pt-4 border-t">
              <h4 className="text-sm font-medium mb-2">Novo rótulo</h4>
              <div className="flex gap-2 items-center">
                <div className="flex-shrink-0">
                  <div 
                    className="w-6 h-6 rounded-full cursor-pointer"
                    style={{ backgroundColor: newLabelColor }}
                    onClick={() => {
                      // Aqui seria ideal ter um seletor de cores
                      // Mas para simplificar, vamos alternar entre algumas cores
                      const colors = ['#dc2626', '#ea580c', '#16a34a', '#2563eb', '#9333ea'];
                      const currentIndex = colors.indexOf(newLabelColor);
                      const nextIndex = (currentIndex + 1) % colors.length;
                      setNewLabelColor(colors[nextIndex]);
                    }}
                  />
                </div>
                <Input
                  placeholder="Nome do rótulo"
                  value={newLabelName}
                  onChange={(e) => setNewLabelName(e.target.value)}
                  className="flex-1"
                />
                <Button 
                  size="sm"
                  disabled={!newLabelName.trim()}
                  onClick={handleAddLabel}
                >
                  Criar
                </Button>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={closeLabelModal}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Modal para editar informações do serviço */}
      <Dialog open={isEditServiceModalOpen} onOpenChange={setIsEditServiceModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar serviço</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="additionalInfo">Descrição</Label>
              <Textarea
                id="additionalInfo"
                placeholder="Informações para enviar ao laboratório"
                value={additionalInfo}
                onChange={(e) => setAdditionalInfo(e.target.value)}
                className="min-h-[100px]"
              />
              <div className="text-xs text-right text-neutral-medium">
                0 / 2000
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-2">
                <Label htmlFor="teeth">Dentes/Região</Label>
                <Input
                  id="teeth"
                  placeholder="Ex: 11, 21"
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="color">Cor</Label>
                <Input
                  id="color"
                  placeholder="Ex: A2"
                />
              </div>
            </div>
          </div>
          
          <DialogFooter className="sm:justify-between">
            <Button variant="outline" onClick={closeEditServiceModal}>
              Cancelar
            </Button>
            <Button onClick={handleSaveAdditionalInfo}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}