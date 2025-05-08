import React, { useState } from "react";
import { ToothShape } from "./ToothShape";
import ToothGrid from "./ToothGrid";
import { deciduousTeeth, permanentTeeth, odontogramProcedures } from "./teethData";
import { OdontogramProcedure, Tooth, ToothSide, ToothStatus } from "@/lib/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { HelpCircle, Info, X } from "lucide-react";

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
  
  // Estado para controlar as partes selecionadas do dente
  const [selectedSides, setSelectedSides] = useState<ToothSide[]>([]);
  
  // Função para selecionar um dente e abrir o diálogo
  const handleToothClick = (tooth: Tooth) => {
    setSelectedTooth(tooth);
    
    // Recuperar procedimentos existentes para este dente
    const toothProcedures = procedures.filter(proc => proc.toothId === tooth.id);
    setSelectedProcedures(toothProcedures.map(proc => proc.procedureId));
    
    // Recuperar lados afetados
    const sides = toothProcedures
      .filter(proc => proc.side)
      .map(proc => proc.side as ToothSide);
    setSelectedSides(sides || []);
    
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
    setSelectedSides([]);
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
  
  // Função para alternar lados do dente
  const toggleToothSide = (side: ToothSide) => {
    setSelectedSides(prev => 
      prev.includes(side) 
        ? prev.filter(s => s !== side)
        : [...prev, side]
    );
  };
  
  // Função para salvar os procedimentos para o dente selecionado
  const handleSaveProcedures = () => {
    if (!selectedTooth) return;
    
    // Remover procedimentos antigos para este dente
    const filteredProcedures = procedures.filter(proc => proc.toothId !== selectedTooth.id);
    
    // Adicionar novos procedimentos com os lados selecionados
    let newProcedures: OdontogramProcedure[] = [];
    
    if (selectedSides.length > 0) {
      // Se houver lados selecionados, criar um procedimento para cada lado
      selectedSides.forEach(side => {
        selectedProcedures.forEach(procId => {
          newProcedures.push({
            id: Math.random(), // Em produção, usar UUID ou ID do backend
            toothId: selectedTooth.id,
            procedureId: procId,
            side: side,
            status: procedureStatus,
            date: new Date().toISOString(),
            notes: notes,
            createdAt: new Date().toISOString()
          });
        });
      });
    } else if (selectedProcedures.length > 0) {
      // Se não houver lados selecionados mas houver procedimentos, criar um procedimento para o dente inteiro
      selectedProcedures.forEach(procId => {
        newProcedures.push({
          id: Math.random(),
          toothId: selectedTooth.id,
          procedureId: procId,
          status: procedureStatus,
          date: new Date().toISOString(),
          notes: notes,
          createdAt: new Date().toISOString()
        });
      });
    }
    
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
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-medium flex items-center">
          Odontograma 
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 ml-2 text-gray-400" />
              </TooltipTrigger>
              <TooltipContent className="max-w-md">
                <p>
                  Clique em um dente para adicionar procedimentos.
                  No diálogo, você pode selecionar partes específicas do dente.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </h2>
        <button className="text-gray-500 hover:text-gray-700">
          <X className="h-5 w-5" />
          <span className="sr-only">Fechar</span>
        </button>
      </div>
      
      <Tabs 
        defaultValue="permanentes" 
        value={activeTab} 
        onValueChange={(value) => setActiveTab(value as "permanentes" | "deciduos")}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="permanentes" className="px-8 py-3">Permanentes</TabsTrigger>
          <TabsTrigger value="deciduos" className="px-8 py-3">Decíduos</TabsTrigger>
        </TabsList>
        
        <TabsContent value="permanentes" className="mt-2">
          <div className="odontogram-grid">
            {/* Superior permanente (quadrantes 1 e 2) */}
            <div className="mb-4 border-b pb-6">
              <div className="flex justify-between px-1 mb-2">
                {/* Números dos dentes - Quadrante 1 */}
                <div className="flex justify-between w-[49%]">
                  {permanentTeeth.slice(0, 8).map(tooth => (
                    <span key={tooth.id} className="text-xs text-center w-[30px]">{tooth.number}</span>
                  ))}
                </div>
                
                {/* Números dos dentes - Quadrante 2 */}
                <div className="flex justify-between w-[49%]">
                  {permanentTeeth.slice(8, 16).map(tooth => (
                    <span key={tooth.id} className="text-xs text-center w-[30px]">{tooth.number}</span>
                  ))}
                </div>
              </div>
              
              <div className="flex justify-between">
                {/* Dentes superiores - Quadrante 1 */}
                <div className="flex justify-between w-[49%]">
                  {permanentTeeth.slice(0, 8).map(tooth => (
                    <ToothShape 
                      key={tooth.id}
                      number={tooth.number}
                      group={tooth.group}
                      position={tooth.position}
                      type={tooth.type}
                      status={getToothStatus(tooth.id)}
                      selected={selectedTooth?.id === tooth.id}
                      onClick={() => handleToothClick(tooth)}
                    />
                  ))}
                </div>
                
                {/* Dentes superiores - Quadrante 2 */}
                <div className="flex justify-between w-[49%]">
                  {permanentTeeth.slice(8, 16).map(tooth => (
                    <ToothShape 
                      key={tooth.id}
                      number={tooth.number}
                      group={tooth.group}
                      position={tooth.position}
                      type={tooth.type}
                      status={getToothStatus(tooth.id)}
                      selected={selectedTooth?.id === tooth.id}
                      onClick={() => handleToothClick(tooth)}
                    />
                  ))}
                </div>
              </div>
              
              <div className="flex justify-between mt-2">
                {/* Grids superiores - Quadrante 1 */}
                <div className="flex justify-between w-[49%]">
                  {permanentTeeth.slice(0, 8).map(tooth => (
                    <div key={`grid-${tooth.id}`} className="flex justify-center w-[30px]">
                      <ToothGrid 
                        selectedSides={selectedTooth?.id === tooth.id ? selectedSides : []}
                        onSideClick={() => handleToothClick(tooth)}
                        status={getToothStatus(tooth.id)}
                      />
                    </div>
                  ))}
                </div>
                
                {/* Grids superiores - Quadrante 2 */}
                <div className="flex justify-between w-[49%]">
                  {permanentTeeth.slice(8, 16).map(tooth => (
                    <div key={`grid-${tooth.id}`} className="flex justify-center w-[30px]">
                      <ToothGrid 
                        selectedSides={selectedTooth?.id === tooth.id ? selectedSides : []}
                        onSideClick={() => handleToothClick(tooth)}
                        status={getToothStatus(tooth.id)}
                      />
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="my-4 border-b border-dashed border-gray-300"></div>
              
              <div className="flex justify-between mt-2">
                {/* Grids inferiores - Quadrante 4 */}
                <div className="flex justify-between w-[49%]">
                  {permanentTeeth.slice(16, 24).map(tooth => (
                    <div key={`grid-${tooth.id}`} className="flex justify-center w-[30px]">
                      <ToothGrid 
                        selectedSides={selectedTooth?.id === tooth.id ? selectedSides : []}
                        onSideClick={() => handleToothClick(tooth)}
                        status={getToothStatus(tooth.id)}
                      />
                    </div>
                  ))}
                </div>
                
                {/* Grids inferiores - Quadrante 3 */}
                <div className="flex justify-between w-[49%]">
                  {permanentTeeth.slice(24, 32).map(tooth => (
                    <div key={`grid-${tooth.id}`} className="flex justify-center w-[30px]">
                      <ToothGrid 
                        selectedSides={selectedTooth?.id === tooth.id ? selectedSides : []}
                        onSideClick={() => handleToothClick(tooth)}
                        status={getToothStatus(tooth.id)}
                      />
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex justify-between">
                {/* Dentes inferiores - Quadrante 4 */}
                <div className="flex justify-between w-[49%]">
                  {permanentTeeth.slice(16, 24).map(tooth => (
                    <ToothShape 
                      key={tooth.id}
                      number={tooth.number}
                      group={tooth.group}
                      position={tooth.position}
                      type={tooth.type}
                      status={getToothStatus(tooth.id)}
                      selected={selectedTooth?.id === tooth.id}
                      onClick={() => handleToothClick(tooth)}
                    />
                  ))}
                </div>
                
                {/* Dentes inferiores - Quadrante 3 */}
                <div className="flex justify-between w-[49%]">
                  {permanentTeeth.slice(24, 32).map(tooth => (
                    <ToothShape 
                      key={tooth.id}
                      number={tooth.number}
                      group={tooth.group}
                      position={tooth.position}
                      type={tooth.type}
                      status={getToothStatus(tooth.id)}
                      selected={selectedTooth?.id === tooth.id}
                      onClick={() => handleToothClick(tooth)}
                    />
                  ))}
                </div>
              </div>
              
              <div className="flex justify-between mt-2">
                {/* Números dos dentes - Quadrante 4 */}
                <div className="flex justify-between w-[49%]">
                  {permanentTeeth.slice(16, 24).map(tooth => (
                    <span key={tooth.id} className="text-xs text-center w-[30px]">{tooth.number}</span>
                  ))}
                </div>
                
                {/* Números dos dentes - Quadrante 3 */}
                <div className="flex justify-between w-[49%]">
                  {permanentTeeth.slice(24, 32).map(tooth => (
                    <span key={tooth.id} className="text-xs text-center w-[30px]">{tooth.number}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="deciduos" className="mt-2">
          <div className="odontogram-grid">
            {/* Superior decíduo (quadrantes 5 e 6) */}
            <div className="mb-4 border-b pb-6">
              <div className="flex justify-between px-1 mb-2">
                {/* Números dos dentes - Quadrante 5 */}
                <div className="flex justify-between w-[49%]">
                  {deciduousTeeth.slice(0, 5).map(tooth => (
                    <span key={tooth.id} className="text-xs text-center w-[30px]">{tooth.number}</span>
                  ))}
                </div>
                
                {/* Números dos dentes - Quadrante 6 */}
                <div className="flex justify-between w-[49%]">
                  {deciduousTeeth.slice(5, 10).map(tooth => (
                    <span key={tooth.id} className="text-xs text-center w-[30px]">{tooth.number}</span>
                  ))}
                </div>
              </div>
              
              <div className="flex justify-between">
                {/* Dentes superiores - Quadrante 5 */}
                <div className="flex justify-between w-[49%]">
                  {deciduousTeeth.slice(0, 5).map(tooth => (
                    <ToothShape 
                      key={tooth.id}
                      number={tooth.number}
                      group={tooth.group}
                      position={tooth.position}
                      type={tooth.type}
                      status={getToothStatus(tooth.id)}
                      selected={selectedTooth?.id === tooth.id}
                      onClick={() => handleToothClick(tooth)}
                    />
                  ))}
                </div>
                
                {/* Dentes superiores - Quadrante 6 */}
                <div className="flex justify-between w-[49%]">
                  {deciduousTeeth.slice(5, 10).map(tooth => (
                    <ToothShape 
                      key={tooth.id}
                      number={tooth.number}
                      group={tooth.group}
                      position={tooth.position}
                      type={tooth.type}
                      status={getToothStatus(tooth.id)}
                      selected={selectedTooth?.id === tooth.id}
                      onClick={() => handleToothClick(tooth)}
                    />
                  ))}
                </div>
              </div>
              
              <div className="flex justify-between mt-2">
                {/* Grids superiores - Quadrante 5 */}
                <div className="flex justify-between w-[49%]">
                  {deciduousTeeth.slice(0, 5).map(tooth => (
                    <div key={`grid-${tooth.id}`} className="flex justify-center w-[30px]">
                      <ToothGrid 
                        selectedSides={selectedTooth?.id === tooth.id ? selectedSides : []}
                        onSideClick={() => handleToothClick(tooth)}
                        status={getToothStatus(tooth.id)}
                      />
                    </div>
                  ))}
                </div>
                
                {/* Grids superiores - Quadrante 6 */}
                <div className="flex justify-between w-[49%]">
                  {deciduousTeeth.slice(5, 10).map(tooth => (
                    <div key={`grid-${tooth.id}`} className="flex justify-center w-[30px]">
                      <ToothGrid 
                        selectedSides={selectedTooth?.id === tooth.id ? selectedSides : []}
                        onSideClick={() => handleToothClick(tooth)}
                        status={getToothStatus(tooth.id)}
                      />
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="my-4 border-b border-dashed border-gray-300"></div>
              
              <div className="flex justify-between mt-2">
                {/* Grids inferiores - Quadrante 8 */}
                <div className="flex justify-between w-[49%]">
                  {deciduousTeeth.slice(10, 15).map(tooth => (
                    <div key={`grid-${tooth.id}`} className="flex justify-center w-[30px]">
                      <ToothGrid 
                        selectedSides={selectedTooth?.id === tooth.id ? selectedSides : []}
                        onSideClick={() => handleToothClick(tooth)}
                        status={getToothStatus(tooth.id)}
                      />
                    </div>
                  ))}
                </div>
                
                {/* Grids inferiores - Quadrante 7 */}
                <div className="flex justify-between w-[49%]">
                  {deciduousTeeth.slice(15, 20).map(tooth => (
                    <div key={`grid-${tooth.id}`} className="flex justify-center w-[30px]">
                      <ToothGrid 
                        selectedSides={selectedTooth?.id === tooth.id ? selectedSides : []}
                        onSideClick={() => handleToothClick(tooth)}
                        status={getToothStatus(tooth.id)}
                      />
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex justify-between">
                {/* Dentes inferiores - Quadrante 8 */}
                <div className="flex justify-between w-[49%]">
                  {deciduousTeeth.slice(10, 15).map(tooth => (
                    <ToothShape 
                      key={tooth.id}
                      number={tooth.number}
                      group={tooth.group}
                      position={tooth.position}
                      type={tooth.type}
                      status={getToothStatus(tooth.id)}
                      selected={selectedTooth?.id === tooth.id}
                      onClick={() => handleToothClick(tooth)}
                    />
                  ))}
                </div>
                
                {/* Dentes inferiores - Quadrante 7 */}
                <div className="flex justify-between w-[49%]">
                  {deciduousTeeth.slice(15, 20).map(tooth => (
                    <ToothShape 
                      key={tooth.id}
                      number={tooth.number}
                      group={tooth.group}
                      position={tooth.position}
                      type={tooth.type}
                      status={getToothStatus(tooth.id)}
                      selected={selectedTooth?.id === tooth.id}
                      onClick={() => handleToothClick(tooth)}
                    />
                  ))}
                </div>
              </div>
              
              <div className="flex justify-between mt-2">
                {/* Números dos dentes - Quadrante 8 */}
                <div className="flex justify-between w-[49%]">
                  {deciduousTeeth.slice(10, 15).map(tooth => (
                    <span key={tooth.id} className="text-xs text-center w-[30px]">{tooth.number}</span>
                  ))}
                </div>
                
                {/* Números dos dentes - Quadrante 7 */}
                <div className="flex justify-between w-[49%]">
                  {deciduousTeeth.slice(15, 20).map(tooth => (
                    <span key={tooth.id} className="text-xs text-center w-[30px]">{tooth.number}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
      
      {/* Filtros e legenda */}
      <div className="flex flex-wrap gap-2 mt-4 justify-center border-t pt-4">
        <button className="px-3 py-1 text-sm border border-gray-300 rounded-full hover:bg-gray-50 transition-colors">
          Maxila
        </button>
        <button className="px-3 py-1 text-sm border border-gray-300 rounded-full hover:bg-gray-50 transition-colors">
          Mandíbula
        </button>
        <button className="px-3 py-1 text-sm border border-gray-300 rounded-full hover:bg-gray-50 transition-colors">
          Face
        </button>
        <button className="px-3 py-1 text-sm border border-gray-300 rounded-full hover:bg-gray-50 transition-colors">
          Arcada superior
        </button>
        <button className="px-3 py-1 text-sm border border-gray-300 rounded-full hover:bg-gray-50 transition-colors">
          Arcada inferior
        </button>
        <button className="px-3 py-1 text-sm border border-gray-300 rounded-full hover:bg-gray-50 transition-colors">
          Arcadas
        </button>
      </div>
      
      <div className="flex items-center justify-center gap-8 mt-4">
        <div className="flex items-center">
          <Checkbox id="aberto-status" />
          <label htmlFor="aberto-status" className="ml-2 text-sm">Aberto 🦷</label>
        </div>
        <div className="flex items-center">
          <Checkbox id="finalizado-status" />
          <label htmlFor="finalizado-status" className="ml-2 text-sm">Finalizado 🦷</label>
        </div>
        <Button variant="outline" className="ml-auto">Anotações !</Button>
      </div>
      
      {/* Diálogo de procedimentos de dente */}
      <Dialog open={isToothDialogOpen} onOpenChange={setIsToothDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {selectedTooth ? `Dente ${selectedTooth.number} - ${selectedTooth.type}` : "Dente"}
            </DialogTitle>
            <DialogDescription>
              Selecione as partes do dente e escolha os procedimentos
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="flex gap-6">
              <div className="w-1/3">
                <h3 className="text-sm font-medium mb-3">Partes do dente</h3>
                <div className="flex items-center justify-center">
                  <ToothGrid 
                    selectedSides={selectedSides}
                    onSideClick={toggleToothSide}
                    status={getToothStatus(selectedTooth?.id || 0)}
                  />
                </div>
              </div>
              
              <div className="w-2/3">
                <div className="flex space-x-4 mb-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="aberto" 
                      checked={procedureStatus === "aberto"} 
                      onCheckedChange={() => setProcedureStatus("aberto")}
                    />
                    <label 
                      htmlFor="aberto" 
                      className="text-sm font-medium leading-none"
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
                      className="text-sm font-medium leading-none"
                    >
                      Finalizado 🦷
                    </label>
                  </div>
                </div>
                
                <div className="mb-4">
                  <Label htmlFor="notes">Anotações</Label>
                  <Textarea
                    id="notes"
                    placeholder="Observações sobre o procedimento..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="mt-1 h-[80px]"
                  />
                </div>
                
                <div>
                  <Label className="mb-2 block">Procedimentos</Label>
                  <ScrollArea className="h-[150px] border rounded-md">
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
                            className="text-sm font-medium leading-none flex-1"
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