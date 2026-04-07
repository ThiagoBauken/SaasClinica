import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Plus, Trash2, Package, Sparkles, Clock, CalendarDays, DollarSign, Edit2
} from 'lucide-react';

const PACKAGE_CATEGORIES = [
  { value: 'smile_makeover', label: 'Smile Makeover' },
  { value: 'whitening', label: 'Clareamento' },
  { value: 'harmonization', label: 'Harmonizacao Orofacial' },
  { value: 'veneers', label: 'Facetas / Lentes' },
  { value: 'implants', label: 'Implantes' },
  { value: 'orthodontics', label: 'Ortodontia Estetica' },
  { value: 'gum', label: 'Plastica Gengival' },
  { value: 'custom', label: 'Personalizado' },
];

interface ProcedureItem {
  procedureId?: number;
  name: string;
  quantity: number;
  unitPrice: number;
}

interface AestheticPackage {
  id: number;
  name: string;
  description: string | null;
  category: string;
  procedures: ProcedureItem[];
  totalPrice: string;
  discountPercent: string;
  estimatedSessions: number | null;
  estimatedDurationDays: number | null;
  includedItems: string | null;
  active: boolean;
  createdAt: string;
}

export default function AestheticPackages() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [editingPackage, setEditingPackage] = useState<AestheticPackage | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const [form, setForm] = useState({
    name: '',
    description: '',
    category: '',
    procedures: [{ name: '', quantity: 1, unitPrice: 0 }] as ProcedureItem[],
    totalPrice: '',
    discountPercent: '0',
    estimatedSessions: '',
    estimatedDurationDays: '',
    includedItems: '',
  });

  const { data: packages = [], isLoading } = useQuery<AestheticPackage[]>({
    queryKey: ['/api/v1/aesthetic/packages', filterCategory !== 'all' ? filterCategory : undefined],
    queryFn: async () => {
      const url = filterCategory !== 'all'
        ? `/api/v1/aesthetic/packages?category=${filterCategory}`
        : '/api/v1/aesthetic/packages';
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch packages');
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await apiRequest('POST', '/api/v1/aesthetic/packages', {
        ...data,
        totalPrice: parseFloat(data.totalPrice) || 0,
        discountPercent: parseFloat(data.discountPercent) || 0,
        estimatedSessions: data.estimatedSessions ? parseInt(data.estimatedSessions) : null,
        estimatedDurationDays: data.estimatedDurationDays ? parseInt(data.estimatedDurationDays) : null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/v1/aesthetic/packages'] });
      toast({ title: 'Pacote criado', description: 'Pacote estetico criado com sucesso.' });
      setShowDialog(false);
      resetForm();
    },
    onError: (err: Error) => {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest('PATCH', `/api/v1/aesthetic/packages/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/v1/aesthetic/packages'] });
      toast({ title: 'Atualizado' });
      setShowDialog(false);
      setEditingPackage(null);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/v1/aesthetic/packages/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/v1/aesthetic/packages'] });
      toast({ title: 'Removido' });
    },
  });

  const resetForm = () => {
    setForm({
      name: '',
      description: '',
      category: '',
      procedures: [{ name: '', quantity: 1, unitPrice: 0 }],
      totalPrice: '',
      discountPercent: '0',
      estimatedSessions: '',
      estimatedDurationDays: '',
      includedItems: '',
    });
  };

  const addProcedureRow = () => {
    setForm(f => ({
      ...f,
      procedures: [...f.procedures, { name: '', quantity: 1, unitPrice: 0 }],
    }));
  };

  const removeProcedureRow = (idx: number) => {
    setForm(f => ({
      ...f,
      procedures: f.procedures.filter((_, i) => i !== idx),
    }));
  };

  const updateProcedureRow = (idx: number, field: keyof ProcedureItem, value: any) => {
    setForm(f => ({
      ...f,
      procedures: f.procedures.map((p, i) => i === idx ? { ...p, [field]: value } : p),
    }));
  };

  const calculateTotal = () => {
    const sum = form.procedures.reduce((acc, p) => acc + p.quantity * p.unitPrice, 0);
    const discount = parseFloat(form.discountPercent) || 0;
    return sum * (1 - discount / 100);
  };

  const autoCalculateTotal = () => {
    setForm(f => ({ ...f, totalPrice: calculateTotal().toFixed(2) }));
  };

  const openEdit = (pkg: AestheticPackage) => {
    setEditingPackage(pkg);
    setForm({
      name: pkg.name,
      description: pkg.description || '',
      category: pkg.category,
      procedures: pkg.procedures.length > 0 ? pkg.procedures : [{ name: '', quantity: 1, unitPrice: 0 }],
      totalPrice: pkg.totalPrice,
      discountPercent: pkg.discountPercent || '0',
      estimatedSessions: pkg.estimatedSessions?.toString() || '',
      estimatedDurationDays: pkg.estimatedDurationDays?.toString() || '',
      includedItems: pkg.includedItems || '',
    });
    setShowDialog(true);
  };

  const getCategoryLabel = (value: string) =>
    PACKAGE_CATEGORIES.find(c => c.value === value)?.label || value;

  const formatBRL = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num || 0);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-purple-500" />
          <h3 className="text-lg font-medium">Pacotes Esteticos</h3>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtrar categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorias</SelectItem>
              {PACKAGE_CATEGORIES.map(c => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => { resetForm(); setEditingPackage(null); setShowDialog(true); }} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Novo Pacote
          </Button>
        </div>
      </div>

      {packages.length === 0 && !isLoading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10">
            <Package className="h-16 w-16 text-neutral-300 mb-4" />
            <h3 className="text-lg font-medium text-neutral-600 mb-2">
              Nenhum pacote estetico
            </h3>
            <p className="text-neutral-500 text-center max-w-md">
              Crie pacotes com procedimentos agrupados, como "Smile Makeover" ou "Harmonizacao Completa", para facilitar orcamentos.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {packages.map(pkg => (
          <Card key={pkg.id} className={`relative ${!pkg.active ? 'opacity-60' : ''}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-semibold">{pkg.name}</h4>
                  <Badge variant="outline" className="text-xs mt-1">{getCategoryLabel(pkg.category)}</Badge>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(pkg)}>
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={() => deleteMutation.mutate(pkg.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {pkg.description && (
                <p className="text-sm text-muted-foreground mb-2">{pkg.description}</p>
              )}

              <div className="space-y-1 mb-3">
                {pkg.procedures.map((proc, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span>{proc.quantity}x {proc.name}</span>
                    <span className="text-muted-foreground">{formatBRL(proc.unitPrice)}</span>
                  </div>
                ))}
              </div>

              {parseFloat(pkg.discountPercent) > 0 && (
                <Badge variant="secondary" className="mb-2 text-xs bg-green-50 text-green-700">
                  {pkg.discountPercent}% desconto
                </Badge>
              )}

              <div className="flex items-center justify-between border-t pt-2">
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {pkg.estimatedSessions && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {pkg.estimatedSessions} sessoes
                    </span>
                  )}
                  {pkg.estimatedDurationDays && (
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" /> {pkg.estimatedDurationDays} dias
                    </span>
                  )}
                </div>
                <span className="font-bold text-lg flex items-center">
                  {formatBRL(pkg.totalPrice)}
                </span>
              </div>

              {pkg.includedItems && (
                <p className="text-xs text-muted-foreground mt-2 border-t pt-2">
                  Inclui: {pkg.includedItems}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => { setShowDialog(open); if (!open) { setEditingPackage(null); resetForm(); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPackage ? 'Editar Pacote' : 'Novo Pacote Estetico'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nome do Pacote</Label>
                <Input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Smile Makeover Completo"
                />
              </div>
              <div>
                <Label>Categoria</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {PACKAGE_CATEGORIES.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Descricao</Label>
              <Textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Descricao do pacote..."
                rows={2}
              />
            </div>

            {/* Procedures list */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Procedimentos</Label>
                <Button type="button" variant="outline" size="sm" onClick={addProcedureRow}>
                  <Plus className="h-3 w-3 mr-1" /> Adicionar
                </Button>
              </div>
              <div className="space-y-2">
                {form.procedures.map((proc, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      value={proc.name}
                      onChange={e => updateProcedureRow(idx, 'name', e.target.value)}
                      placeholder="Nome do procedimento"
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      value={proc.quantity}
                      onChange={e => updateProcedureRow(idx, 'quantity', parseInt(e.target.value) || 1)}
                      className="w-16"
                      min={1}
                    />
                    <Input
                      type="number"
                      value={proc.unitPrice || ''}
                      onChange={e => updateProcedureRow(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                      placeholder="R$"
                      className="w-28"
                      step="0.01"
                    />
                    {form.procedures.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => removeProcedureRow(idx)}>
                        <Trash2 className="h-3 w-3 text-red-500" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Desconto (%)</Label>
                <Input
                  type="number"
                  value={form.discountPercent}
                  onChange={e => setForm(f => ({ ...f, discountPercent: e.target.value }))}
                  min={0}
                  max={100}
                  step="0.5"
                />
              </div>
              <div>
                <Label>Preco Total (R$)</Label>
                <div className="flex gap-1">
                  <Input
                    type="number"
                    value={form.totalPrice}
                    onChange={e => setForm(f => ({ ...f, totalPrice: e.target.value }))}
                    step="0.01"
                  />
                  <Button type="button" variant="outline" size="sm" className="shrink-0 text-xs" onClick={autoCalculateTotal}>
                    Auto
                  </Button>
                </div>
              </div>
              <div>
                <Label>Sessoes estimadas</Label>
                <Input
                  type="number"
                  value={form.estimatedSessions}
                  onChange={e => setForm(f => ({ ...f, estimatedSessions: e.target.value }))}
                  min={1}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Duracao estimada (dias)</Label>
                <Input
                  type="number"
                  value={form.estimatedDurationDays}
                  onChange={e => setForm(f => ({ ...f, estimatedDurationDays: e.target.value }))}
                  min={1}
                />
              </div>
              <div>
                <Label>Itens inclusos</Label>
                <Input
                  value={form.includedItems}
                  onChange={e => setForm(f => ({ ...f, includedItems: e.target.value }))}
                  placeholder="Ex: Kit clareamento caseiro, moldagem"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDialog(false); setEditingPackage(null); resetForm(); }}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (editingPackage) {
                  updateMutation.mutate({ id: editingPackage.id, data: {
                    ...form,
                    totalPrice: parseFloat(form.totalPrice) || 0,
                    discountPercent: parseFloat(form.discountPercent) || 0,
                    estimatedSessions: form.estimatedSessions ? parseInt(form.estimatedSessions) : null,
                    estimatedDurationDays: form.estimatedDurationDays ? parseInt(form.estimatedDurationDays) : null,
                  }});
                } else {
                  createMutation.mutate(form);
                }
              }}
              disabled={!form.name || !form.category || !form.totalPrice || createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) ? 'Salvando...' : editingPackage ? 'Atualizar' : 'Criar Pacote'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
