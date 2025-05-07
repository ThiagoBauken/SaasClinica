import { useState, useEffect } from "react";
import DashboardLayout from "@/layouts/DashboardLayout";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, Plus, X, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

// Tipo de dados para próteses
interface Prosthetic {
  id: number;
  patientName: string;
  patientId: number;
  createdAt: string;
  description: string;
  professional: string;
  status: "pre-lab" | "sent" | "lab" | "approved" | "completed";
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
      status: "pre-lab"
    },
    {
      id: 2,
      patientName: "João Pereira",
      patientId: 102,
      createdAt: new Date(2023, 5, 20).toISOString(),
      description: "Coroa unitária - dente 26",
      professional: "Dr. Carlos Mendes",
      status: "sent"
    },
    {
      id: 3,
      patientName: "Maria Oliveira",
      patientId: 103,
      createdAt: new Date(2023, 6, 5).toISOString(),
      description: "Prótese parcial removível inferior",
      professional: "Dr. Ana Silva",
      status: "lab"
    },
    {
      id: 4,
      patientName: "Paulo Santos",
      patientId: 104,
      createdAt: new Date(2023, 6, 10).toISOString(),
      description: "Facetas de porcelana - dentes 11 e 21",
      professional: "Dr. Juliana Costa",
      status: "approved"
    },
    {
      id: 5,
      patientName: "Carla Sousa",
      patientId: 105,
      createdAt: new Date(2023, 6, 15).toISOString(),
      description: "Implante com coroa - dente 36",
      professional: "Dr. Carlos Mendes",
      status: "completed"
    }
  ]);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProsthetic, setNewProsthetic] = useState({
    patientName: "",
    description: "",
    professional: ""
  });
  const [draggedItem, setDraggedItem] = useState<Prosthetic | null>(null);

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

  // Manipuladores para o modal
  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewProsthetic((prev) => ({ ...prev, [name]: value }));
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

      <div className="grid grid-cols-5 gap-4">
        {Object.entries(groupedProsthetics).map(([status, items]) => (
          <div 
            key={status}
            className="bg-neutral-lightest rounded-lg p-4 min-h-[500px]"
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(status as any)}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-lg text-neutral-dark">
                {statusLabels[status as keyof typeof statusLabels]}
              </h3>
              <div className="flex items-center">
                <span className="bg-primary-light text-primary rounded-full px-2 py-0.5 text-xs font-medium">
                  {items.length}
                </span>
              </div>
            </div>
            
            <div className="space-y-3">
              {items.map((prosthetic) => (
                <Card 
                  key={prosthetic.id}
                  draggable
                  onDragStart={() => handleDragStart(prosthetic)}
                  className="cursor-grab active:cursor-grabbing hover:border-primary transition-colors duration-200"
                >
                  <CardContent className="p-3">
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
    </DashboardLayout>
  );
}