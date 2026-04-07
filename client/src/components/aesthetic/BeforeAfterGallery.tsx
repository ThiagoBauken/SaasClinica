import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import {
  Camera, Plus, Trash2, Upload, Eye, ChevronLeft, ChevronRight,
  ImageIcon, Sparkles, Calendar
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const PROCEDURE_TYPES = [
  { value: 'clareamento', label: 'Clareamento Dental' },
  { value: 'faceta_porcelana', label: 'Faceta de Porcelana' },
  { value: 'faceta_resina', label: 'Faceta de Resina' },
  { value: 'lente_contato', label: 'Lente de Contato Dental' },
  { value: 'restauracao_estetica', label: 'Restauracao Estetica' },
  { value: 'gengivoplastia', label: 'Gengivoplastia' },
  { value: 'gengivectomia', label: 'Gengivectomia' },
  { value: 'bichectomia', label: 'Bichectomia' },
  { value: 'botox', label: 'Botox' },
  { value: 'preenchimento', label: 'Preenchimento Labial' },
  { value: 'harmonizacao', label: 'Harmonizacao Orofacial' },
  { value: 'design_sorriso', label: 'Design de Sorriso (DSD)' },
  { value: 'implante', label: 'Implante' },
  { value: 'ortodontia', label: 'Ortodontia' },
  { value: 'protese', label: 'Protese' },
  { value: 'outro', label: 'Outro' },
];

interface BeforeAfterPhoto {
  id: number;
  patientId: number;
  procedureType: string;
  title: string;
  description: string | null;
  beforePhotoUrl: string;
  afterPhotoUrl: string | null;
  beforeDate: string;
  afterDate: string | null;
  toothNumbers: string | null;
  notes: string | null;
  isPublic: boolean;
  patientConsent: boolean;
  createdAt: string;
}

interface BeforeAfterGalleryProps {
  patientId: number;
  patientName?: string;
}

export default function BeforeAfterGallery({ patientId, patientName }: BeforeAfterGalleryProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showCompareDialog, setShowCompareDialog] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<BeforeAfterPhoto | null>(null);
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const compareRef = useRef<HTMLDivElement>(null);

  // Form state
  const [form, setForm] = useState({
    procedureType: '',
    title: '',
    description: '',
    beforePhotoUrl: '',
    afterPhotoUrl: '',
    beforeDate: new Date().toISOString().split('T')[0],
    afterDate: '',
    toothNumbers: '',
    notes: '',
    isPublic: false,
    patientConsent: false,
  });

  const { data: photos = [], isLoading } = useQuery<BeforeAfterPhoto[]>({
    queryKey: [`/api/v1/aesthetic/patients/${patientId}/photos`],
    enabled: !!patientId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await apiRequest('POST', `/api/v1/aesthetic/patients/${patientId}/photos`, {
        ...data,
        afterPhotoUrl: data.afterPhotoUrl || undefined,
        afterDate: data.afterDate || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/v1/aesthetic/patients/${patientId}/photos`] });
      toast({ title: 'Foto registrada', description: 'Registro antes/depois criado com sucesso.' });
      setShowAddDialog(false);
      resetForm();
    },
    onError: (err: Error) => {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<typeof form> }) => {
      const res = await apiRequest('PATCH', `/api/v1/aesthetic/photos/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/v1/aesthetic/patients/${patientId}/photos`] });
      toast({ title: 'Atualizado', description: 'Foto atualizada com sucesso.' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/v1/aesthetic/photos/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/v1/aesthetic/patients/${patientId}/photos`] });
      toast({ title: 'Removido', description: 'Registro removido.' });
      setShowCompareDialog(false);
    },
  });

  const resetForm = () => {
    setForm({
      procedureType: '',
      title: '',
      description: '',
      beforePhotoUrl: '',
      afterPhotoUrl: '',
      beforeDate: new Date().toISOString().split('T')[0],
      afterDate: '',
      toothNumbers: '',
      notes: '',
      isPublic: false,
      patientConsent: false,
    });
  };

  const handleSliderMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging || !compareRef.current) return;
    const rect = compareRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    setSliderPosition((x / rect.width) * 100);
  };

  const getProcedureLabel = (value: string) =>
    PROCEDURE_TYPES.find(p => p.value === value)?.label || value;

  const pendingAfterPhotos = photos.filter(p => !p.afterPhotoUrl);
  const completedPhotos = photos.filter(p => p.afterPhotoUrl);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-amber-500" />
          <h3 className="text-lg font-medium">Antes & Depois</h3>
          {photos.length > 0 && (
            <Badge variant="secondary">{photos.length}</Badge>
          )}
        </div>
        <Button onClick={() => setShowAddDialog(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Nova Foto
        </Button>
      </div>

      {/* Pending (waiting for "after" photo) */}
      {pendingAfterPhotos.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-amber-600 mb-2 flex items-center gap-1">
            <Camera className="h-4 w-4" /> Aguardando foto "depois" ({pendingAfterPhotos.length})
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {pendingAfterPhotos.map(photo => (
              <Card key={photo.id} className="border-amber-200 bg-amber-50/50">
                <CardContent className="p-3">
                  <div className="aspect-[4/3] bg-gray-100 rounded-md overflow-hidden mb-2 relative">
                    <img
                      src={photo.beforePhotoUrl}
                      alt="Antes"
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-image.svg'; }}
                    />
                    <Badge className="absolute top-2 left-2 bg-black/70 text-white text-[10px]">ANTES</Badge>
                  </div>
                  <p className="font-medium text-sm truncate">{photo.title}</p>
                  <p className="text-xs text-muted-foreground">{getProcedureLabel(photo.procedureType)}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(photo.beforeDate), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full mt-2 border-amber-300 text-amber-700 hover:bg-amber-100"
                    onClick={() => {
                      setSelectedPhoto(photo);
                      setForm(prev => ({
                        ...prev,
                        afterPhotoUrl: '',
                        afterDate: new Date().toISOString().split('T')[0],
                      }));
                    }}
                  >
                    <Upload className="h-3 w-3 mr-1" /> Adicionar foto "depois"
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Completed comparisons */}
      {completedPhotos.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-green-600 mb-2 flex items-center gap-1">
            <ImageIcon className="h-4 w-4" /> Comparacoes completas ({completedPhotos.length})
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {completedPhotos.map(photo => (
              <Card
                key={photo.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => {
                  setSelectedPhoto(photo);
                  setSliderPosition(50);
                  setShowCompareDialog(true);
                }}
              >
                <CardContent className="p-3">
                  <div className="grid grid-cols-2 gap-1 mb-2">
                    <div className="aspect-[4/3] bg-gray-100 rounded-md overflow-hidden relative">
                      <img
                        src={photo.beforePhotoUrl}
                        alt="Antes"
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-image.svg'; }}
                      />
                      <Badge className="absolute bottom-1 left-1 bg-black/70 text-white text-[10px]">ANTES</Badge>
                    </div>
                    <div className="aspect-[4/3] bg-gray-100 rounded-md overflow-hidden relative">
                      <img
                        src={photo.afterPhotoUrl!}
                        alt="Depois"
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-image.svg'; }}
                      />
                      <Badge className="absolute bottom-1 right-1 bg-green-600/90 text-white text-[10px]">DEPOIS</Badge>
                    </div>
                  </div>
                  <p className="font-medium text-sm truncate">{photo.title}</p>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">{getProcedureLabel(photo.procedureType)}</p>
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                      <Eye className="h-3 w-3 mr-1" /> Comparar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {photos.length === 0 && !isLoading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10">
            <Camera className="h-16 w-16 text-neutral-300 mb-4" />
            <h3 className="text-lg font-medium text-neutral-600 mb-2">
              Nenhum registro antes/depois
            </h3>
            <p className="text-neutral-500 text-center max-w-md">
              Registre fotos antes e depois de procedimentos esteticos para
              acompanhar a evolucao do tratamento.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Comparison Slider Dialog */}
      <Dialog open={showCompareDialog} onOpenChange={setShowCompareDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              {selectedPhoto?.title}
            </DialogTitle>
          </DialogHeader>

          {selectedPhoto?.afterPhotoUrl && (
            <div className="space-y-3">
              {/* Slider comparison */}
              <div
                ref={compareRef}
                className="relative w-full aspect-[16/10] overflow-hidden rounded-lg cursor-col-resize select-none bg-gray-100"
                onMouseDown={() => setIsDragging(true)}
                onMouseUp={() => setIsDragging(false)}
                onMouseLeave={() => setIsDragging(false)}
                onMouseMove={handleSliderMove}
                onTouchStart={() => setIsDragging(true)}
                onTouchEnd={() => setIsDragging(false)}
                onTouchMove={handleSliderMove}
              >
                {/* After (background) */}
                <img
                  src={selectedPhoto.afterPhotoUrl}
                  alt="Depois"
                  className="absolute inset-0 w-full h-full object-cover"
                />

                {/* Before (clipped) */}
                <div
                  className="absolute inset-0 overflow-hidden"
                  style={{ width: `${sliderPosition}%` }}
                >
                  <img
                    src={selectedPhoto.beforePhotoUrl}
                    alt="Antes"
                    className="absolute inset-0 w-full h-full object-cover"
                    style={{ width: compareRef.current ? `${compareRef.current.clientWidth}px` : '100%' }}
                  />
                </div>

                {/* Slider line */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg z-10"
                  style={{ left: `${sliderPosition}%` }}
                >
                  <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center">
                    <ChevronLeft className="h-3 w-3 text-gray-600" />
                    <ChevronRight className="h-3 w-3 text-gray-600" />
                  </div>
                </div>

                {/* Labels */}
                <Badge className="absolute top-3 left-3 bg-black/70 text-white">ANTES</Badge>
                <Badge className="absolute top-3 right-3 bg-green-600/90 text-white">DEPOIS</Badge>
              </div>

              <p className="text-xs text-center text-muted-foreground">
                Arraste o controle deslizante para comparar
              </p>

              {/* Details */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Antes: {format(new Date(selectedPhoto.beforeDate), "dd/MM/yyyy", { locale: ptBR })}</span>
                </div>
                {selectedPhoto.afterDate && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>Depois: {format(new Date(selectedPhoto.afterDate), "dd/MM/yyyy", { locale: ptBR })}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline">{getProcedureLabel(selectedPhoto.procedureType)}</Badge>
                {selectedPhoto.toothNumbers && (
                  <Badge variant="secondary">Dentes: {selectedPhoto.toothNumbers}</Badge>
                )}
                {selectedPhoto.isPublic && (
                  <Badge variant="default" className="bg-green-600">Publico</Badge>
                )}
              </div>

              {selectedPhoto.description && (
                <p className="text-sm text-muted-foreground">{selectedPhoto.description}</p>
              )}
              {selectedPhoto.notes && (
                <p className="text-sm text-muted-foreground italic">{selectedPhoto.notes}</p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => selectedPhoto && deleteMutation.mutate(selectedPhoto.id)}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-4 w-4 mr-1" /> Remover
            </Button>
            <Button variant="outline" onClick={() => setShowCompareDialog(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Update Photo Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Registrar Foto Antes/Depois</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div>
              <Label>Tipo de Procedimento</Label>
              <Select value={form.procedureType} onValueChange={v => setForm(f => ({ ...f, procedureType: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {PROCEDURE_TYPES.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Titulo</Label>
              <Input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Ex: Clareamento completo - Arco superior"
              />
            </div>

            <div>
              <Label>Descricao (opcional)</Label>
              <Textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Detalhes do procedimento..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>URL Foto Antes</Label>
                <Input
                  value={form.beforePhotoUrl}
                  onChange={e => setForm(f => ({ ...f, beforePhotoUrl: e.target.value }))}
                  placeholder="URL da foto antes"
                />
              </div>
              <div>
                <Label>Data Antes</Label>
                <Input
                  type="date"
                  value={form.beforeDate}
                  onChange={e => setForm(f => ({ ...f, beforeDate: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>URL Foto Depois (opcional)</Label>
                <Input
                  value={form.afterPhotoUrl}
                  onChange={e => setForm(f => ({ ...f, afterPhotoUrl: e.target.value }))}
                  placeholder="URL da foto depois"
                />
              </div>
              <div>
                <Label>Data Depois</Label>
                <Input
                  type="date"
                  value={form.afterDate}
                  onChange={e => setForm(f => ({ ...f, afterDate: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <Label>Dentes envolvidos (opcional)</Label>
              <Input
                value={form.toothNumbers}
                onChange={e => setForm(f => ({ ...f, toothNumbers: e.target.value }))}
                placeholder="Ex: 11, 12, 21, 22"
              />
            </div>

            <div>
              <Label>Observacoes (opcional)</Label>
              <Textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Observacoes adicionais..."
                rows={2}
              />
            </div>

            <div className="flex items-center justify-between border-t pt-3">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.patientConsent}
                  onCheckedChange={v => setForm(f => ({ ...f, patientConsent: v }))}
                />
                <Label className="text-sm">Consentimento do paciente (LGPD)</Label>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.isPublic}
                  onCheckedChange={v => setForm(f => ({ ...f, isPublic: v }))}
                  disabled={!form.patientConsent}
                />
                <Label className="text-sm">Exibir na galeria publica</Label>
              </div>
              {form.isPublic && !form.patientConsent && (
                <span className="text-xs text-red-500">Requer consentimento</span>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddDialog(false); resetForm(); }}>Cancelar</Button>
            <Button
              onClick={() => createMutation.mutate(form)}
              disabled={!form.procedureType || !form.title || !form.beforePhotoUrl || !form.beforeDate || createMutation.isPending}
            >
              {createMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add After Photo inline dialog */}
      <Dialog open={!!selectedPhoto && !showCompareDialog} onOpenChange={(open) => { if (!open) setSelectedPhoto(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Foto "Depois" - {selectedPhoto?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>URL Foto Depois</Label>
              <Input
                value={form.afterPhotoUrl}
                onChange={e => setForm(f => ({ ...f, afterPhotoUrl: e.target.value }))}
                placeholder="URL da foto depois do procedimento"
              />
            </div>
            <div>
              <Label>Data</Label>
              <Input
                type="date"
                value={form.afterDate}
                onChange={e => setForm(f => ({ ...f, afterDate: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedPhoto(null)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (selectedPhoto && form.afterPhotoUrl) {
                  updateMutation.mutate({
                    id: selectedPhoto.id,
                    data: {
                      afterPhotoUrl: form.afterPhotoUrl,
                      afterDate: form.afterDate || undefined,
                    },
                  });
                  setSelectedPhoto(null);
                }
              }}
              disabled={!form.afterPhotoUrl || updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
