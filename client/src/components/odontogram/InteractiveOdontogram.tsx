import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import {
  RotateCcw, History, Save, Trash2, X, CheckCircle2, Layers, XCircle
} from 'lucide-react';
import ToothSVG from './ToothSVG';
import { permanentTeeth, deciduousTeeth, odontogramProcedures } from './teethData';
import { apiRequest } from '@/lib/queryClient';

// Procedure status configs with colors
const STATUS_OPTIONS = [
  { value: 'cariado', label: 'Cárie', color: '#EF4444', group: 'clinico' },
  { value: 'restaurado', label: 'Restauração', color: '#3B82F6', group: 'clinico' },
  { value: 'ausente', label: 'Ausente', color: '#6B7280', group: 'clinico' },
  { value: 'implante', label: 'Implante', color: '#8B5CF6', group: 'clinico' },
  { value: 'tratamento-canal', label: 'Tratamento de Canal', color: '#F97316', group: 'clinico' },
  { value: 'coroa', label: 'Coroa', color: '#F59E0B', group: 'clinico' },
  { value: 'extrair', label: 'Indicado p/ Extração', color: '#DC2626', group: 'clinico' },
  { value: 'protese', label: 'Prótese', color: '#6366F1', group: 'clinico' },
  { value: 'selante', label: 'Selante', color: '#10B981', group: 'clinico' },
  { value: 'fratura', label: 'Fratura', color: '#F43F5E', group: 'clinico' },
  { value: 'desgaste', label: 'Desgaste', color: '#A855F7', group: 'clinico' },
  { value: 'saudavel', label: 'Saudável', color: '#22C55E', group: 'clinico' },
  // Estética
  { value: 'faceta', label: 'Faceta/Lente de Contato', color: '#E8D5B7', group: 'estetico' },
  { value: 'clareamento', label: 'Clareamento', color: '#F0F8FF', group: 'estetico' },
  { value: 'gengivoplastia', label: 'Gengivoplastia', color: '#FFB6C1', group: 'estetico' },
  { value: 'restauracao-estetica', label: 'Restauração Estética', color: '#DEB887', group: 'estetico' },
  { value: 'protese-estetica', label: 'Prótese Estética', color: '#FFDAB9', group: 'estetico' },
];

// Whole-tooth statuses (don't need face selection)
const WHOLE_TOOTH_STATUSES = ['ausente', 'implante', 'tratamento-canal', 'coroa', 'protese', 'extrair', 'clareamento', 'gengivoplastia', 'protese-estetica'];

function getStatusColor(status: string): string {
  return STATUS_OPTIONS.find(s => s.value === status)?.color || '#9CA3AF';
}

function getStatusLabel(status: string): string {
  return STATUS_OPTIONS.find(s => s.value === status)?.label || status;
}

const FACE_LABELS: Record<string, string> = {
  vestibular: 'Vestibular (V)',
  lingual: 'Lingual/Palatina (L)',
  mesial: 'Mesial (M)',
  distal: 'Distal (D)',
  oclusal: 'Oclusal (O)',
  incisal: 'Incisal (I)',
};

interface OdontogramEntry {
  id: number;
  toothId: string;
  faceId: string | null;
  status: string;
  color: string | null;
  notes: string | null;
  procedureId: number | null;
  createdAt: string;
  createdBy: number;
}

interface HistoryEntry extends OdontogramEntry {
  createdByName: string | null;
  procedureName: string | null;
}

interface InteractiveOdontogramProps {
  patientId: number;
  patientName?: string;
  readOnly?: boolean;
}

export default function InteractiveOdontogram({ patientId, patientName, readOnly = false }: InteractiveOdontogramProps) {
  const queryClient = useQueryClient();
  const [dentition, setDentition] = useState<'permanente' | 'deciduo'>('permanente');
  const [selectedTooth, setSelectedTooth] = useState<string | null>(null);
  const [selectedFace, setSelectedFace] = useState<string | null>(null);
  const [showProcedureDialog, setShowProcedureDialog] = useState(false);
  const [procedureStatus, setProcedureStatus] = useState('');
  const [procedureNotes, setProcedureNotes] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  // Bulk selection state
  const [selectedTeeth, setSelectedTeeth] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState('');
  const [showBulkDialog, setShowBulkDialog] = useState(false);

  const teeth = dentition === 'permanente' ? permanentTeeth : deciduousTeeth;

  // Fetch current odontogram state
  const { data: entries = [], isLoading } = useQuery<OdontogramEntry[]>({
    queryKey: [`/api/patients/${patientId}/odontogram`],
    enabled: !!patientId,
  });

  // Fetch tooth history when a tooth is selected and history panel is open
  const { data: toothHistory = [] } = useQuery<HistoryEntry[]>({
    queryKey: [`/api/patients/${patientId}/odontogram/tooth/${selectedTooth}/history`],
    enabled: !!patientId && !!selectedTooth && showHistory,
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: { toothId: string; faceId?: string | null; status: string; notes?: string; color?: string }) => {
      const res = await apiRequest('POST', `/api/patients/${patientId}/odontogram`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}/odontogram`] });
      if (selectedTooth) {
        queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}/odontogram/tooth/${selectedTooth}/history`] });
      }
      setShowProcedureDialog(false);
      setProcedureStatus('');
      setProcedureNotes('');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (entryId: number) => {
      const res = await apiRequest('DELETE', `/api/patients/${patientId}/odontogram/${entryId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}/odontogram`] });
      if (selectedTooth) {
        queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}/odontogram/tooth/${selectedTooth}/history`] });
      }
    },
  });

  // Bulk save mutation — applies same status to all selected teeth
  const bulkSaveMutation = useMutation({
    mutationFn: async ({ toothIds, status }: { toothIds: string[]; status: string }) => {
      const isWholeTooth = WHOLE_TOOTH_STATUSES.includes(status);
      await Promise.all(
        toothIds.map(toothId =>
          apiRequest('POST', `/api/patients/${patientId}/odontogram`, {
            toothId,
            faceId: isWholeTooth ? null : undefined,
            status,
            color: getStatusColor(status),
          }).then(r => r.json())
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}/odontogram`] });
      setSelectedTeeth([]);
      setBulkStatus('');
      setShowBulkDialog(false);
    },
  });

  // Build face colors map from entries
  const toothFaceColors = useMemo(() => {
    const map: Record<string, Record<string, string>> = {};
    for (const entry of entries) {
      if (!map[entry.toothId]) map[entry.toothId] = {};
      if (entry.faceId) {
        map[entry.toothId][entry.faceId] = entry.color || getStatusColor(entry.status);
      }
    }
    return map;
  }, [entries]);

  // Build whole-tooth status map
  const wholeToothStatuses = useMemo(() => {
    const map: Record<string, string> = {};
    for (const entry of entries) {
      if (!entry.faceId && WHOLE_TOOTH_STATUSES.includes(entry.status)) {
        map[entry.toothId] = entry.status;
      }
    }
    return map;
  }, [entries]);

  // Get entries for selected tooth
  const selectedToothEntries = useMemo(() => {
    if (!selectedTooth) return [];
    return entries.filter(e => e.toothId === selectedTooth);
  }, [entries, selectedTooth]);

  const handleFaceClick = useCallback((toothNumber: string, faceId: string) => {
    if (readOnly) return;
    setSelectedTooth(toothNumber);
    setSelectedFace(faceId);
    setShowProcedureDialog(true);
  }, [readOnly]);

  const handleToothClick = useCallback((toothNumber: string) => {
    setSelectedTooth(toothNumber);
    setShowHistory(true);
  }, []);

  // Intercept Ctrl+click at the wrapper level for bulk selection
  const handleToothWrapperClick = useCallback((toothNumber: string, e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.stopPropagation();
      e.preventDefault();
      setSelectedTeeth(prev =>
        prev.includes(toothNumber) ? prev.filter(t => t !== toothNumber) : [...prev, toothNumber]
      );
    }
  }, []);

  const handleSaveProcedure = () => {
    if (!selectedTooth || !procedureStatus) return;
    const isWholeTooth = WHOLE_TOOTH_STATUSES.includes(procedureStatus);
    saveMutation.mutate({
      toothId: selectedTooth,
      faceId: isWholeTooth ? null : selectedFace,
      status: procedureStatus,
      notes: procedureNotes || undefined,
      color: getStatusColor(procedureStatus),
    });
  };

  const selectedToothData = teeth.find(t => t.number === selectedTooth);

  // Split teeth into quadrants
  const upperTeeth = teeth.filter(t => t.position === 'superior');
  const lowerTeeth = teeth.filter(t => t.position === 'inferior');

  // Split upper into right (Q1/Q5) and left (Q2/Q6) halves
  const halfU = Math.ceil(upperTeeth.length / 2);
  const upperRight = upperTeeth.slice(0, halfU);
  const upperLeft = upperTeeth.slice(halfU);
  const halfL = Math.ceil(lowerTeeth.length / 2);
  const lowerLeft = lowerTeeth.slice(0, halfL);
  const lowerRight = lowerTeeth.slice(halfL);

  // Build per-tooth tooltip data from current entries
  const toothTooltipData = useMemo(() => {
    const map: Record<string, { statuses: string[]; notes: string[]; lastChange: string | null; historyCount: number }> = {};
    for (const entry of entries) {
      if (!map[entry.toothId]) {
        map[entry.toothId] = { statuses: [], notes: [], lastChange: null, historyCount: 0 };
      }
      map[entry.toothId].statuses.push(getStatusLabel(entry.status));
      if (entry.notes) map[entry.toothId].notes.push(entry.notes);
      if (!map[entry.toothId].lastChange || (entry.createdAt && entry.createdAt > map[entry.toothId].lastChange!)) {
        map[entry.toothId].lastChange = entry.createdAt;
      }
      map[entry.toothId].historyCount += 1;
    }
    return map;
  }, [entries]);

  const renderTooth = (tooth: typeof teeth[0]) => {
    const isBulkSelected = selectedTeeth.includes(tooth.number);
    const tooltipData = toothTooltipData[tooth.number];
    const hasData = !!tooltipData;

    const toothNode = (
      <div
        key={tooth.number}
        className={isBulkSelected ? 'ring-2 ring-primary ring-offset-1 rounded' : undefined}
        onClickCapture={(e) => handleToothWrapperClick(tooth.number, e)}
      >
        <ToothSVG
          toothNumber={tooth.number}
          group={tooth.group}
          position={tooth.position}
          faceColors={toothFaceColors[tooth.number]}
          wholeToothStatus={wholeToothStatuses[tooth.number]}
          selectedFace={selectedTooth === tooth.number ? selectedFace : null}
          onFaceClick={handleFaceClick}
          onToothClick={handleToothClick}
          size={dentition === 'deciduo' ? 40 : 44}
          isSelected={selectedTooth === tooth.number}
        />
      </div>
    );

    if (!hasData) return toothNode;

    return (
      <HoverCard key={tooth.number} openDelay={300} closeDelay={100}>
        <HoverCardTrigger asChild>
          {toothNode}
        </HoverCardTrigger>
        <HoverCardContent side="top" className="w-56 p-3 text-xs" align="center">
          <p className="font-semibold mb-1">Dente {tooth.number}</p>
          {tooltipData.statuses.length > 0 && (
            <p className="text-muted-foreground">Status: {tooltipData.statuses.join(', ')}</p>
          )}
          {tooltipData.notes.length > 0 && (
            <p className="text-muted-foreground mt-1">Obs: {tooltipData.notes[0]}</p>
          )}
          {tooltipData.lastChange && (
            <p className="text-muted-foreground mt-1">
              Última alt.: {new Date(tooltipData.lastChange).toLocaleDateString('pt-BR')}
            </p>
          )}
          <p className="text-muted-foreground mt-1">
            {tooltipData.historyCount} registro{tooltipData.historyCount !== 1 ? 's' : ''}
          </p>
        </HoverCardContent>
      </HoverCard>
    );
  };

  return (
    <TooltipProvider>
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Tabs value={dentition} onValueChange={(v) => setDentition(v as any)}>
          <TabsList>
            <TabsTrigger value="permanente">Permanentes (32)</TabsTrigger>
            <TabsTrigger value="deciduo">Decíduos (20)</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex gap-2 flex-wrap">
          {selectedTeeth.length > 0 && !readOnly && (
            <>
              <Badge variant="secondary" className="flex items-center gap-1">
                <Layers className="h-3 w-3" />
                {selectedTeeth.length} dente{selectedTeeth.length !== 1 ? 's' : ''} selecionado{selectedTeeth.length !== 1 ? 's' : ''}
              </Badge>
              <Button variant="default" size="sm" onClick={() => setShowBulkDialog(true)}>
                Aplicar Status em Lote
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSelectedTeeth([])}>
                <XCircle className="h-4 w-4 mr-1" /> Limpar Seleção
              </Button>
            </>
          )}
          {selectedTooth && selectedTeeth.length === 0 && (
            <Button variant="outline" size="sm" onClick={() => { setSelectedTooth(null); setShowHistory(false); }}>
              <X className="h-4 w-4 mr-1" /> Limpar Seleção
            </Button>
          )}
        </div>
      </div>

      {selectedTeeth.length === 0 && !readOnly && (
        <p className="text-xs text-muted-foreground">
          Dica: segure <kbd className="px-1 py-0.5 bg-muted rounded text-xs font-mono">Ctrl</kbd> e clique em vários dentes para selecioná-los em lote.
        </p>
      )}

      {/* Status legend */}
      <div className="space-y-1.5">
        <div className="flex flex-wrap gap-2">
          <span className="text-xs font-medium text-gray-500 mr-1">Clínico:</span>
          {STATUS_OPTIONS.filter(s => s.group === 'clinico').map(s => (
            <div key={s.value} className="flex items-center gap-1 text-xs">
              <div className="w-3 h-3 rounded-sm border border-gray-300" style={{ backgroundColor: s.color }}/>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="text-xs font-medium text-gray-500 mr-1">Estético:</span>
          {STATUS_OPTIONS.filter(s => s.group === 'estetico').map(s => (
            <div key={s.value} className="flex items-center gap-1 text-xs">
              <div className="w-3 h-3 rounded-sm border border-gray-300" style={{ backgroundColor: s.color }}/>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Dental arch */}
      <div className="bg-white border rounded-xl p-4 overflow-x-auto">
        {/* Upper arch */}
        <div className="flex justify-center items-end gap-0.5 mb-1">
          <div className="flex items-end gap-0.5">
            {upperRight.map(renderTooth)}
          </div>
          <div className="w-px h-20 bg-gray-300 mx-1 self-center" />
          <div className="flex items-end gap-0.5">
            {upperLeft.map(renderTooth)}
          </div>
        </div>

        {/* Midline */}
        <div className="border-t border-dashed border-gray-300 my-2" />

        {/* Lower arch */}
        <div className="flex justify-center items-start gap-0.5 mt-1">
          <div className="flex items-start gap-0.5">
            {lowerLeft.map(renderTooth)}
          </div>
          <div className="w-px h-20 bg-gray-300 mx-1 self-center" />
          <div className="flex items-start gap-0.5">
            {lowerRight.map(renderTooth)}
          </div>
        </div>
      </div>

      {/* Selected tooth info + History panel */}
      {selectedTooth && showHistory && (
        <div className="border rounded-lg p-4 bg-gray-50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg">Dente {selectedTooth}</h3>
              {selectedToothData && (
                <Badge variant="outline">
                  {selectedToothData.group === 'incisivo' ? 'Incisivo' :
                   selectedToothData.group === 'canino' ? 'Canino' :
                   selectedToothData.group === 'premolar' ? 'Pré-molar' : 'Molar'}
                  {' · '}
                  {selectedToothData.position === 'superior' ? 'Superior' : 'Inferior'}
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              {!readOnly && (
                <Button size="sm" onClick={() => { setSelectedFace(null); setShowProcedureDialog(true); }}>
                  <Save className="h-4 w-4 mr-1" /> Registrar Procedimento
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => { setShowHistory(false); setSelectedTooth(null); }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Current status */}
          {selectedToothEntries.length > 0 && (
            <div className="mb-3">
              <h4 className="text-sm font-medium mb-2 text-gray-600">Estado Atual</h4>
              <div className="flex flex-wrap gap-2">
                {selectedToothEntries.map(entry => (
                  <div key={entry.id} className="flex items-center gap-1.5 px-2 py-1 bg-white rounded border text-sm">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: entry.color || getStatusColor(entry.status) }}/>
                    <span>{getStatusLabel(entry.status)}</span>
                    {entry.faceId && <span className="text-gray-400 text-xs">({entry.faceId.charAt(0).toUpperCase()})</span>}
                    {!readOnly && (
                      <button
                        className="ml-1 text-gray-400 hover:text-red-500"
                        onClick={() => deleteMutation.mutate(entry.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* History timeline */}
          <div>
            <h4 className="text-sm font-medium mb-2 text-gray-600 flex items-center gap-1">
              <History className="h-4 w-4" /> Histórico
            </h4>
            {toothHistory.length === 0 ? (
              <p className="text-sm text-gray-400">Nenhum registro para este dente</p>
            ) : (
              <ScrollArea className="max-h-60">
                <div className="space-y-2">
                  {toothHistory.map((h) => (
                    <div key={h.id} className="flex items-start gap-3 p-2 bg-white rounded border text-sm">
                      <div className="w-3 h-3 mt-1 rounded-sm flex-shrink-0" style={{ backgroundColor: h.color || getStatusColor(h.status) }}/>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{getStatusLabel(h.status)}</span>
                          {h.faceId && <Badge variant="secondary" className="text-xs">{FACE_LABELS[h.faceId] || h.faceId}</Badge>}
                        </div>
                        {h.procedureName && <p className="text-gray-500 text-xs">Procedimento: {h.procedureName}</p>}
                        {h.notes && <p className="text-gray-500 text-xs mt-0.5">{h.notes}</p>}
                        <p className="text-gray-400 text-xs mt-0.5">
                          {h.createdAt ? new Date(h.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                          {h.createdByName ? ` · ${h.createdByName}` : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      )}

      {/* Bulk Status Dialog */}
      <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Aplicar Status em Lote — {selectedTeeth.length} dente{selectedTeeth.length !== 1 ? 's' : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Dentes selecionados: <span className="font-medium text-foreground">{selectedTeeth.sort().join(', ')}</span>
            </p>
            <div>
              <label className="text-sm font-medium mb-1 block">Condição / Procedimento</label>
              <Select value={bulkStatus} onValueChange={setBulkStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">Clínico</div>
                  {STATUS_OPTIONS.filter(s => s.group === 'clinico').map(s => (
                    <SelectItem key={s.value} value={s.value}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm border border-gray-200" style={{ backgroundColor: s.color }}/>
                        {s.label}
                      </div>
                    </SelectItem>
                  ))}
                  <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide border-t mt-1 pt-2">Estético</div>
                  {STATUS_OPTIONS.filter(s => s.group === 'estetico').map(s => (
                    <SelectItem key={s.value} value={s.value}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm border border-gray-200" style={{ backgroundColor: s.color }}/>
                        {s.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkDialog(false)}>Cancelar</Button>
            <Button
              onClick={() => bulkSaveMutation.mutate({ toothIds: selectedTeeth, status: bulkStatus })}
              disabled={!bulkStatus || bulkSaveMutation.isPending}
            >
              {bulkSaveMutation.isPending ? 'Salvando...' : `Aplicar a ${selectedTeeth.length} dente${selectedTeeth.length !== 1 ? 's' : ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Procedure Dialog */}
      <Dialog open={showProcedureDialog} onOpenChange={setShowProcedureDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Registrar Procedimento - Dente {selectedTooth}
              {selectedFace && ` (${FACE_LABELS[selectedFace] || selectedFace})`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Condição / Procedimento</label>
              <Select value={procedureStatus} onValueChange={setProcedureStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">Clínico</div>
                  {STATUS_OPTIONS.filter(s => s.group === 'clinico').map(s => (
                    <SelectItem key={s.value} value={s.value}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm border border-gray-200" style={{ backgroundColor: s.color }}/>
                        {s.label}
                      </div>
                    </SelectItem>
                  ))}
                  <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide border-t mt-1 pt-2">Estético</div>
                  {STATUS_OPTIONS.filter(s => s.group === 'estetico').map(s => (
                    <SelectItem key={s.value} value={s.value}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm border border-gray-200" style={{ backgroundColor: s.color }}/>
                        {s.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {procedureStatus && WHOLE_TOOTH_STATUSES.includes(procedureStatus) && (
                <p className="text-xs text-amber-600 mt-1">Este status será aplicado ao dente inteiro</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Observações (opcional)</label>
              <Textarea
                value={procedureNotes}
                onChange={(e) => setProcedureNotes(e.target.value)}
                placeholder="Notas sobre o procedimento..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProcedureDialog(false)}>Cancelar</Button>
            <Button
              onClick={handleSaveProcedure}
              disabled={!procedureStatus || saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  );
}
