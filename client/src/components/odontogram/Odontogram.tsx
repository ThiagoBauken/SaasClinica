import React, { useState } from "react";
import { ToothShape } from "./ToothShape";
import { deciduousTeeth, permanentTeeth, odontogramProcedures } from "./teethData";
import { OdontogramProcedure, Tooth, ToothStatus } from "@/lib/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";

interface OdontogramProps {
  patientId: number;
  onSave?: (procedures: OdontogramProcedure[]) => void;
  initialData?: {
    teeth: Tooth[];
    procedures: OdontogramProcedure[];
  };
}

export default function Odontogram({ patientId, onSave, initialData }: OdontogramProps) {
  const [activeTab, setActiveTab] = useState<"permanentes" | "deciduos">("permanentes");
  const [selectedTooth, setSelectedTooth] = useState<Tooth | null>(null);
  const [procedures, setProcedures] = useState<OdontogramProcedure[]>(initialData?.procedures || []);
  const [teeth, setTeeth] = useState<Tooth[]>(() => {
    if (initialData?.teeth) {
      return initialData.teeth;
    }
    return [...permanentTeeth, ...deciduousTeeth];
  });
  
  // Estado para controlar o diálogo de edição de dente
  const [isToothDialogOpen, setIsToothDialogOpen] = useState(false);
  const [selectedProcedures, setSelectedProcedures] = useState<number[]>([]);
  const [procedureStatus, setProcedureStatus] = useState<"aberto" | "finalizado">("aberto");
  const [notes, setNotes] = useState("");
  
  // Função para selecionar um dente e abrir o diálogo
  const handleToothClick = (tooth: Tooth) => {
    setSelectedTooth(tooth);
    
    // Recuperar procedimentos existentes para este dente
    const toothProcedures = procedures.filter(proc => proc.toothId === tooth.id);
    setSelectedProcedures(toothProcedures.map(proc => proc.procedureId));
    
    // Se houver procedimentos, usar o status do último
    if (toothProcedures.length > 0) {
      setProcedureStatus(toothProcedures[0].status);
      setNotes(toothProcedures[0].notes || "");
    } else {
      setProcedureStatus("aberto");
      setNotes("");
    }
    
    setIsToothDialogOpen(true);
  };
  
  // Função para fechar o diálogo
  const handleCloseDialog = () => {
    setIsToothDialogOpen(false);
    setSelectedTooth(null);
    setSelectedProcedures([]);
    setNotes("");
  };
  
  // Função para alternar procedimentos selecionados
  const toggleProcedure = (procedureId: number) => {
    setSelectedProcedures(prev => 
      prev.includes(procedureId) 
        ? prev.filter(id => id !== procedureId)
        : [...prev, procedureId]
    );
  };
  
  // Função para salvar os procedimentos para o dente selecionado
  const handleSaveProcedures = () => {
    if (!selectedTooth) return;
    
    // Remover procedimentos antigos para este dente
    const filteredProcedures = procedures.filter(proc => proc.toothId !== selectedTooth.id);
    
    // Adicionar novos procedimentos
    const newProcedures = selectedProcedures.map(procId => ({
      id: Math.random(), // Em produção, usar UUID ou ID do backend
      toothId: selectedTooth.id,
      procedureId: procId,
      status: procedureStatus,
      date: new Date().toISOString(),
      notes: notes,
      createdAt: new Date().toISOString()
    }));
    
    // Definir status do dente com base nos procedimentos
    let newStatus: ToothStatus = 'saudavel';
    if (selectedProcedures.length > 0) {
      // Determinar status baseado no ID do procedimento
      if (selectedProcedures.includes(2)) newStatus = 'cariado';
      else if (selectedProcedures.includes(5)) newStatus = 'tratamento-canal';
      else if (selectedProcedures.includes(4)) newStatus = 'implante';
      else if (selectedProcedures.includes(3)) newStatus = 'extrair';
      else if (selectedProcedures.includes(6)) newStatus = 'coroa';
      else if (selectedProcedures.includes(7)) newStatus = 'protese';
      else if (selectedProcedures.includes(1)) newStatus = 'restaurado';
    }
    
    // Atualizar o dente
    const updatedTeeth = teeth.map(tooth => 
      tooth.id === selectedTooth.id 
        ? { ...tooth, status: newStatus } 
        : tooth
    );
    
    // Atualizar estados
    setProcedures([...filteredProcedures, ...newProcedures]);
    setTeeth(updatedTeeth);
    
    // Fechar diálogo
    handleCloseDialog();
    
    // Chamar callback se fornecido
    if (onSave) {
      onSave([...filteredProcedures, ...newProcedures]);
    }
  };
  
  // Recuperar status do dente
  const getToothStatus = (toothId: number) => {
    const tooth = teeth.find(t => t.id === toothId);
    return tooth?.status || 'saudavel';
  };
  
  return (
    <div className="bg-card rounded-lg border border-border p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-medium">Odontograma</h2>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon">
                <HelpCircle className="h-5 w-5 text-muted-foreground" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="max-w-md">
              <p>
                Clique em um dente para adicionar procedimentos.
                Os dentes são representados graficamente de acordo com sua anatomia real.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      
      <Tabs 
        defaultValue="permanentes" 
        value={activeTab} 
        onValueChange={(value) => setActiveTab(value as "permanentes" | "deciduos")}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="permanentes">Permanentes</TabsTrigger>
          <TabsTrigger value="deciduos">Decíduos</TabsTrigger>
        </TabsList>
        
        <TabsContent value="permanentes" className="mt-2">
          <div className="odontogram-grid">
            {/* Superior permanente (quadrantes 1 e 2) */}
            <div className="grid grid-cols-8 gap-2 mb-4">
              {permanentTeeth.slice(0, 16).map(tooth => (
                <div key={tooth.id} className="flex flex-col items-center">
                  <span className="text-xs text-muted-foreground mb-1">{tooth.number}</span>
                  <ToothShape 
                    group={tooth.group}
                    position={tooth.position}
                    type={tooth.type}
                    status={getToothStatus(tooth.id)}
                    onClick={() => handleToothClick(tooth)}
                  />
                </div>
              ))}
            </div>
            
            {/* Divisor */}
            <div className="border-t border-border my-4" />
            
            {/* Inferior permanente (quadrantes 3 e 4) */}
            <div className="grid grid-cols-8 gap-2">
              {permanentTeeth.slice(16, 32).map(tooth => (
                <div key={tooth.id} className="flex flex-col items-center">
                  <ToothShape 
                    group={tooth.group}
                    position={tooth.position}
                    type={tooth.type}
                    status={getToothStatus(tooth.id)}
                    onClick={() => handleToothClick(tooth)}
                  />
                  <span className="text-xs text-muted-foreground mt-1">{tooth.number}</span>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="deciduos" className="mt-2">
          <div className="odontogram-grid">
            {/* Superior decíduo (quadrantes 5 e 6) */}
            <div className="grid grid-cols-10 gap-2 mb-4">
              {deciduousTeeth.slice(0, 10).map(tooth => (
                <div key={tooth.id} className="flex flex-col items-center">
                  <span className="text-xs text-muted-foreground mb-1">{tooth.number}</span>
                  <ToothShape 
                    group={tooth.group}
                    position={tooth.position}
                    type={tooth.type}
                    status={getToothStatus(tooth.id)}
                    onClick={() => handleToothClick(tooth)}
                  />
                </div>
              ))}
            </div>
            
            {/* Divisor */}
            <div className="border-t border-border my-4" />
            
            {/* Inferior decíduo (quadrantes 7 e 8) */}
            <div className="grid grid-cols-10 gap-2">
              {deciduousTeeth.slice(10, 20).map(tooth => (
                <div key={tooth.id} className="flex flex-col items-center">
                  <ToothShape 
                    group={tooth.group}
                    position={tooth.position}
                    type={tooth.type}
                    status={getToothStatus(tooth.id)}
                    onClick={() => handleToothClick(tooth)}
                  />
                  <span className="text-xs text-muted-foreground mt-1">{tooth.number}</span>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
      
      {/* Filtros e legenda */}
      <div className="flex flex-wrap gap-2 mt-4 justify-center">
        <button className="px-3 py-1 text-sm border border-border rounded-full hover:bg-secondary/10 transition-colors">
          Maxila
        </button>
        <button className="px-3 py-1 text-sm border border-border rounded-full hover:bg-secondary/10 transition-colors">
          Mandíbula
        </button>
        <button className="px-3 py-1 text-sm border border-border rounded-full hover:bg-secondary/10 transition-colors">
          Face
        </button>
        <button className="px-3 py-1 text-sm border border-border rounded-full hover:bg-secondary/10 transition-colors">
          Arcada superior
        </button>
        <button className="px-3 py-1 text-sm border border-border rounded-full hover:bg-secondary/10 transition-colors">
          Arcada inferior
        </button>
        <button className="px-3 py-1 text-sm border border-border rounded-full hover:bg-secondary/10 transition-colors">
          Arcadas
        </button>
      </div>
      
      {/* Diálogo de procedimentos de dente */}
      <Dialog open={isToothDialogOpen} onOpenChange={setIsToothDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedTooth ? `Dente ${selectedTooth.number} - ${selectedTooth.group}` : "Dente"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-4">
            <div className="space-y-4">
              <div className="flex space-x-2">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="aberto" 
                    checked={procedureStatus === "aberto"} 
                    onCheckedChange={() => setProcedureStatus("aberto")}
                  />
                  <label 
                    htmlFor="aberto" 
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Aberto 🦷
                  </label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="finalizado" 
                    checked={procedureStatus === "finalizado"} 
                    onCheckedChange={() => setProcedureStatus("finalizado")}
                  />
                  <label 
                    htmlFor="finalizado" 
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Finalizado 🦷
                  </label>
                </div>
              </div>
              
              <div>
                <Label htmlFor="notes">Anotações</Label>
                <Textarea
                  id="notes"
                  placeholder="Observações sobre o procedimento..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label>Procedimentos</Label>
                <ScrollArea className="h-60 mt-1 border rounded-md">
                  <div className="p-4 space-y-2">
                    {odontogramProcedures.map(procedure => (
                      <div key={procedure.id} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`procedure-${procedure.id}`} 
                          checked={selectedProcedures.includes(procedure.id)}
                          onCheckedChange={() => toggleProcedure(procedure.id)}
                        />
                        <label 
                          htmlFor={`procedure-${procedure.id}`} 
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex-1"
                        >
                          {procedure.name}
                        </label>
                        <div 
                          className="w-4 h-4 rounded-full" 
                          style={{ backgroundColor: procedure.color }}
                        />
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancelar
            </Button>
            <Button onClick={handleSaveProcedures}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}