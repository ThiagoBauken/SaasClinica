import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface OdontogramChartProps {
  patientId: number;
}

interface ToothData {
  id: string;
  name: string;
  top: number;
  left: number;
  quadrant: number;
  position: number;
}

interface ToothStatus {
  toothId: string;
  faceId?: string;
  status: string;
  color?: string;
  notes?: string;
}

// Adult teeth data
const adultTeeth: ToothData[] = [
  // Upper Right (Quadrant 1)
  { id: "18", name: "Third Molar", top: 10, left: 5, quadrant: 1, position: 8 },
  { id: "17", name: "Second Molar", top: 10, left: 11, quadrant: 1, position: 7 },
  { id: "16", name: "First Molar", top: 10, left: 17, quadrant: 1, position: 6 },
  { id: "15", name: "Second Premolar", top: 10, left: 23, quadrant: 1, position: 5 },
  { id: "14", name: "First Premolar", top: 10, left: 29, quadrant: 1, position: 4 },
  { id: "13", name: "Canine", top: 10, left: 35, quadrant: 1, position: 3 },
  { id: "12", name: "Lateral Incisor", top: 10, left: 41, quadrant: 1, position: 2 },
  { id: "11", name: "Central Incisor", top: 10, left: 47, quadrant: 1, position: 1 },

  // Upper Left (Quadrant 2)
  { id: "21", name: "Central Incisor", top: 10, left: 53, quadrant: 2, position: 1 },
  { id: "22", name: "Lateral Incisor", top: 10, left: 59, quadrant: 2, position: 2 },
  { id: "23", name: "Canine", top: 10, left: 65, quadrant: 2, position: 3 },
  { id: "24", name: "First Premolar", top: 10, left: 71, quadrant: 2, position: 4 },
  { id: "25", name: "Second Premolar", top: 10, left: 77, quadrant: 2, position: 5 },
  { id: "26", name: "First Molar", top: 10, left: 83, quadrant: 2, position: 6 },
  { id: "27", name: "Second Molar", top: 10, left: 89, quadrant: 2, position: 7 },
  { id: "28", name: "Third Molar", top: 10, left: 95, quadrant: 2, position: 8 },

  // Lower Left (Quadrant 3)
  { id: "38", name: "Third Molar", top: 30, left: 95, quadrant: 3, position: 8 },
  { id: "37", name: "Second Molar", top: 30, left: 89, quadrant: 3, position: 7 },
  { id: "36", name: "First Molar", top: 30, left: 83, quadrant: 3, position: 6 },
  { id: "35", name: "Second Premolar", top: 30, left: 77, quadrant: 3, position: 5 },
  { id: "34", name: "First Premolar", top: 30, left: 71, quadrant: 3, position: 4 },
  { id: "33", name: "Canine", top: 30, left: 65, quadrant: 3, position: 3 },
  { id: "32", name: "Lateral Incisor", top: 30, left: 59, quadrant: 3, position: 2 },
  { id: "31", name: "Central Incisor", top: 30, left: 53, quadrant: 3, position: 1 },

  // Lower Right (Quadrant 4)
  { id: "41", name: "Central Incisor", top: 30, left: 47, quadrant: 4, position: 1 },
  { id: "42", name: "Lateral Incisor", top: 30, left: 41, quadrant: 4, position: 2 },
  { id: "43", name: "Canine", top: 30, left: 35, quadrant: 4, position: 3 },
  { id: "44", name: "First Premolar", top: 30, left: 29, quadrant: 4, position: 4 },
  { id: "45", name: "Second Premolar", top: 30, left: 23, quadrant: 4, position: 5 },
  { id: "46", name: "First Molar", top: 30, left: 17, quadrant: 4, position: 6 },
  { id: "47", name: "Second Molar", top: 30, left: 11, quadrant: 4, position: 7 },
  { id: "48", name: "Third Molar", top: 30, left: 5, quadrant: 4, position: 8 },
];

const TOOTH_SIZE = 30;
const TOOTH_STATUS_COLORS = {
  healthy: "#ffffff",
  caries: "#ff0000",
  filled: "#a0a0a0",
  crown: "#ffd700",
  bridge: "#d4af37",
  implant: "#c0c0c0",
  missing: "#000000",
  extraction: "#ff6b6b",
  rootcanal: "#0000ff",
};

const FACE_MAP = {
  "top": "occlusal",
  "right": "distal",
  "bottom": "buccal",
  "left": "mesial",
  "center": "lingual",
};

export default function OdontogramChart({ patientId }: OdontogramChartProps) {
  const { toast } = useToast();
  const [selectedTooth, setSelectedTooth] = useState<ToothData | null>(null);
  const [selectedFace, setSelectedFace] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    status: "healthy",
    notes: "",
  });
  const [activeTab, setActiveTab] = useState<string>("adult");

  // Fetch tooth status data for the patient
  const { data: toothStatusData, isLoading } = useQuery<ToothStatus[]>({
    queryKey: ["/api/patients", patientId, "odontogram"],
    queryFn: async () => {
      const res = await fetch(`/api/patients/${patientId}/odontogram`, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Failed to fetch odontogram");
      }
      return res.json();
    },
  });

  // Save tooth status mutation
  const saveToothStatusMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest(
        "POST",
        `/api/patients/${patientId}/odontogram`,
        data
      );
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ["/api/patients", patientId, "odontogram"] 
      });
      toast({
        title: "Status atualizado",
        description: "O status do dente foi atualizado com sucesso!",
      });
      setIsModalOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar status",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Get tooth status for rendering
  const getToothStatus = (toothId: string, faceId?: string): ToothStatus | undefined => {
    if (!toothStatusData) return undefined;
    
    if (faceId) {
      return toothStatusData.find(
        (status) => status.toothId === toothId && status.faceId === faceId
      );
    } else {
      return toothStatusData.find(
        (status) => status.toothId === toothId && !status.faceId
      );
    }
  };

  // Get color for tooth or face based on status
  const getColor = (status?: ToothStatus): string => {
    if (!status) return TOOTH_STATUS_COLORS.healthy;
    return TOOTH_STATUS_COLORS[status.status as keyof typeof TOOTH_STATUS_COLORS] || "#ffffff";
  };

  // Handle tooth or face click
  const handleClick = (tooth: ToothData, face?: string) => {
    setSelectedTooth(tooth);
    setSelectedFace(face || null);
    
    // Pre-populate form with existing data if available
    const existingStatus = getToothStatus(
      tooth.id,
      face ? FACE_MAP[face as keyof typeof FACE_MAP] : undefined
    );
    
    setFormData({
      status: existingStatus?.status || "healthy",
      notes: existingStatus?.notes || "",
    });
    
    setIsModalOpen(true);
  };

  // Handle form input changes
  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Handle form submission
  const handleSaveStatus = () => {
    if (!selectedTooth) return;
    
    saveToothStatusMutation.mutate({
      toothId: selectedTooth.id,
      faceId: selectedFace ? FACE_MAP[selectedFace as keyof typeof FACE_MAP] : undefined,
      status: formData.status,
      notes: formData.notes,
    });
  };

  // Render a single tooth with its faces
  const renderTooth = (tooth: ToothData) => {
    const toothStatus = getToothStatus(tooth.id);
    const toothColor = getColor(toothStatus);
    
    // For missing teeth, render differently
    if (toothStatus?.status === "missing") {
      return (
        <g
          key={tooth.id}
          transform={`translate(${tooth.left * 6}, ${tooth.top * 6})`}
          onClick={() => handleClick(tooth)}
          style={{ cursor: 'pointer' }}
        >
          <rect 
            x="0" 
            y="0" 
            width={TOOTH_SIZE} 
            height={TOOTH_SIZE} 
            fill="#f0f0f0" 
            stroke="#ccc" 
            strokeWidth="1" 
          />
          <line 
            x1="0" 
            y1="0" 
            x2={TOOTH_SIZE} 
            y2={TOOTH_SIZE} 
            stroke="#666" 
            strokeWidth="2" 
          />
          <line 
            x1="0" 
            y1={TOOTH_SIZE} 
            x2={TOOTH_SIZE} 
            y2="0" 
            stroke="#666" 
            strokeWidth="2" 
          />
          <text 
            x={TOOTH_SIZE/2} 
            y={TOOTH_SIZE+10} 
            textAnchor="middle" 
            fill="#333" 
            fontSize="8"
          >
            {tooth.id}
          </text>
        </g>
      );
    }
    
    // For normal teeth, render with faces
    return (
      <g
        key={tooth.id}
        transform={`translate(${tooth.left * 6}, ${tooth.top * 6})`}
      >
        {/* Tooth outline */}
        <rect 
          x="0" 
          y="0" 
          width={TOOTH_SIZE} 
          height={TOOTH_SIZE} 
          fill="#f0f0f0" 
          stroke="#ccc" 
          strokeWidth="1" 
        />
        
        {/* Top face (occlusal) */}
        <rect 
          x="10" 
          y="0" 
          width="10" 
          height="10" 
          fill={getColor(getToothStatus(tooth.id, "occlusal"))}
          stroke="#ccc" 
          strokeWidth="1"
          onClick={() => handleClick(tooth, "top")}
          style={{ cursor: 'pointer' }}
        />
        
        {/* Right face (distal) */}
        <rect 
          x="20" 
          y="10" 
          width="10" 
          height="10" 
          fill={getColor(getToothStatus(tooth.id, "distal"))}
          stroke="#ccc" 
          strokeWidth="1"
          onClick={() => handleClick(tooth, "right")}
          style={{ cursor: 'pointer' }}
        />
        
        {/* Bottom face (buccal) */}
        <rect 
          x="10" 
          y="20" 
          width="10" 
          height="10" 
          fill={getColor(getToothStatus(tooth.id, "buccal"))}
          stroke="#ccc" 
          strokeWidth="1"
          onClick={() => handleClick(tooth, "bottom")}
          style={{ cursor: 'pointer' }}
        />
        
        {/* Left face (mesial) */}
        <rect 
          x="0" 
          y="10" 
          width="10" 
          height="10" 
          fill={getColor(getToothStatus(tooth.id, "mesial"))}
          stroke="#ccc" 
          strokeWidth="1"
          onClick={() => handleClick(tooth, "left")}
          style={{ cursor: 'pointer' }}
        />
        
        {/* Center (lingual/palatal) */}
        <rect 
          x="10" 
          y="10" 
          width="10" 
          height="10" 
          fill={getColor(getToothStatus(tooth.id, "lingual"))}
          stroke="#ccc" 
          strokeWidth="1"
          onClick={() => handleClick(tooth, "center")}
          style={{ cursor: 'pointer' }}
        />
        
        {/* Whole tooth status (overrides faces if present) */}
        {toothStatus?.status && !toothStatus.faceId && (
          <rect 
            x="0" 
            y="0" 
            width={TOOTH_SIZE} 
            height={TOOTH_SIZE} 
            fill={toothColor}
            fillOpacity="0.5"
            stroke="#666" 
            strokeWidth="1"
            onClick={() => handleClick(tooth)}
            style={{ cursor: 'pointer' }}
          />
        )}
        
        {/* Tooth number label */}
        <text 
          x={TOOTH_SIZE/2} 
          y={TOOTH_SIZE+10} 
          textAnchor="middle" 
          fill="#333" 
          fontSize="8"
        >
          {tooth.id}
        </text>
      </g>
    );
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium mb-2">Odontograma</h3>
      
      <Tabs defaultValue="adult" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-2 w-60">
          <TabsTrigger value="adult">Adulto</TabsTrigger>
          <TabsTrigger value="child">Infantil</TabsTrigger>
        </TabsList>
        
        <TabsContent value="adult">
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <svg 
                width="600" 
                height="300" 
                viewBox="0 0 600 300" 
                className="mx-auto"
              >
                {/* Upper and Lower Jaw Lines */}
                <line x1="30" y1="120" x2="570" y2="120" stroke="#ccc" strokeWidth="2" />
                <line x1="30" y1="220" x2="570" y2="220" stroke="#ccc" strokeWidth="2" />
                
                {/* Render all teeth */}
                {adultTeeth.map((tooth) => renderTooth(tooth))}
              </svg>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="child">
          <div className="flex justify-center items-center h-64 bg-muted/50 rounded-md">
            <p className="text-muted-foreground">Visualização infantil em desenvolvimento</p>
          </div>
        </TabsContent>
      </Tabs>
      
      <div className="mt-6">
        <h4 className="font-medium mb-2">Legenda</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center">
            <div className="w-4 h-4 bg-background border border-border mr-2"></div>
            <span className="text-sm">Saudável</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-red-500 mr-2"></div>
            <span className="text-sm">Cárie</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-gray-400 mr-2"></div>
            <span className="text-sm">Restaurado</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-yellow-500 mr-2"></div>
            <span className="text-sm">Coroa</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-amber-700 mr-2"></div>
            <span className="text-sm">Ponte</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-gray-300 mr-2"></div>
            <span className="text-sm">Implante</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-black mr-2"></div>
            <span className="text-sm">Ausente</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-blue-500 mr-2"></div>
            <span className="text-sm">Tratamento de Canal</span>
          </div>
        </div>
      </div>
      
      {/* Tooth Status Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedTooth ? `Dente ${selectedTooth.id}${selectedFace ? ` - Face ${selectedFace}` : ''}` : 'Atualizar Status'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => handleInputChange("status", value)}
              >
                <SelectTrigger id="status">
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="healthy">Saudável</SelectItem>
                  <SelectItem value="caries">Cárie</SelectItem>
                  <SelectItem value="filled">Restaurado</SelectItem>
                  <SelectItem value="crown">Coroa</SelectItem>
                  <SelectItem value="bridge">Ponte</SelectItem>
                  <SelectItem value="implant">Implante</SelectItem>
                  <SelectItem value="missing">Ausente</SelectItem>
                  <SelectItem value="extraction">Extração Indicada</SelectItem>
                  <SelectItem value="rootcanal">Tratamento de Canal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleInputChange("notes", e.target.value)}
                placeholder="Adicione observações sobre o status do dente"
                rows={4}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveStatus} disabled={saveToothStatusMutation.isPending}>
              {saveToothStatusMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
