import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { getCsrfHeaders } from '@/lib/csrf';
import { Minus, Plus, Search, ShoppingCart, Trash2, UserPlus, X } from 'lucide-react';

// PDV interno do caixa: vende produtos do estoque (inventory_items.is_sellable=true)
// ao paciente. Backend: POST /api/v1/cash-register/sale.

interface SellableItem {
  id: number;
  name: string;
  sku: string | null;
  barcode: string | null;
  salePrice: number | null;
  currentStock: number;
  unitOfMeasure: string | null;
}

interface CartLine {
  itemId: number;
  name: string;
  quantity: number;
  unitPriceCents: number;
  availableStock: number;
}

interface PatientHit {
  id: number;
  fullName: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const PAYMENT_METHODS = [
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'pix', label: 'PIX' },
  { value: 'cartao_credito', label: 'Cartão de crédito' },
  { value: 'cartao_debito', label: 'Cartão de débito' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'cheque', label: 'Cheque' },
];

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function PDVDialog({ open, onClose, onSuccess }: Props) {
  const { toast } = useToast();

  const [itemSearch, setItemSearch] = useState('');
  const [items, setItems] = useState<SellableItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  const [cart, setCart] = useState<Map<number, CartLine>>(new Map());
  const [paymentMethod, setPaymentMethod] = useState<string>('dinheiro');

  const [showPatient, setShowPatient] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [patientHits, setPatientHits] = useState<PatientHit[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientHit | null>(null);

  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Reset state when dialog closes — evita "última venda" ressuscitar ao reabrir.
  useEffect(() => {
    if (!open) {
      setItemSearch('');
      setItems([]);
      setCart(new Map());
      setPaymentMethod('dinheiro');
      setShowPatient(false);
      setPatientSearch('');
      setPatientHits([]);
      setSelectedPatient(null);
      setNotes('');
    }
  }, [open]);

  // Busca de itens vendáveis (debounced)
  useEffect(() => {
    if (!open) return;
    const ac = new AbortController();
    setLoadingItems(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/v1/cash-register/sellable-items?q=${encodeURIComponent(itemSearch.trim())}`,
          { credentials: 'include', signal: ac.signal }
        );
        if (res.ok) {
          const data = await res.json();
          setItems(data.items ?? []);
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          // mantém lista anterior em erro de rede transitório
        }
      } finally {
        setLoadingItems(false);
      }
    }, 200);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [itemSearch, open]);

  // Busca de paciente (debounced) — usa o endpoint paginado de pacientes.
  useEffect(() => {
    if (!showPatient || patientSearch.trim().length < 2) {
      setPatientHits([]);
      return;
    }
    const ac = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/v1/patients?search=${encodeURIComponent(patientSearch.trim())}&page=1&limit=8`,
          { credentials: 'include', signal: ac.signal }
        );
        if (res.ok) {
          const data = await res.json();
          // O endpoint pagina retorna { data: [...] } ou um array; suportamos ambos.
          const list: any[] = Array.isArray(data) ? data : data.data ?? [];
          setPatientHits(
            list.slice(0, 8).map((p) => ({ id: p.id, fullName: p.full_name ?? p.fullName ?? 'Paciente' }))
          );
        }
      } catch {
        /* abort/erro: mantém estado */
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [showPatient, patientSearch]);

  // Operações do carrinho
  function addToCart(item: SellableItem) {
    if (item.salePrice == null) {
      toast({
        title: 'Preço de venda não cadastrado',
        description: `Defina o preço de venda de "${item.name}" no cadastro do estoque.`,
        variant: 'destructive',
      });
      return;
    }
    if (item.currentStock <= 0) {
      toast({
        title: 'Sem estoque',
        description: `"${item.name}" está com estoque zero.`,
        variant: 'destructive',
      });
      return;
    }
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(item.id);
      const newQty = (existing?.quantity ?? 0) + 1;
      if (newQty > item.currentStock) {
        toast({
          title: 'Estoque insuficiente',
          description: `Apenas ${item.currentStock} unidade(s) disponível(is) de "${item.name}".`,
          variant: 'destructive',
        });
        return prev;
      }
      next.set(item.id, {
        itemId: item.id,
        name: item.name,
        quantity: newQty,
        unitPriceCents: existing?.unitPriceCents ?? item.salePrice ?? 0,
        availableStock: item.currentStock,
      });
      return next;
    });
  }

  function updateQty(itemId: number, delta: number) {
    setCart((prev) => {
      const next = new Map(prev);
      const line = next.get(itemId);
      if (!line) return prev;
      const newQty = line.quantity + delta;
      if (newQty <= 0) {
        next.delete(itemId);
      } else if (newQty > line.availableStock) {
        toast({
          title: 'Estoque insuficiente',
          description: `Disponível apenas ${line.availableStock} unidade(s).`,
          variant: 'destructive',
        });
      } else {
        next.set(itemId, { ...line, quantity: newQty });
      }
      return next;
    });
  }

  function updatePrice(itemId: number, newPriceBRL: number) {
    setCart((prev) => {
      const next = new Map(prev);
      const line = next.get(itemId);
      if (!line) return prev;
      const cents = Math.max(0, Math.round(newPriceBRL * 100));
      next.set(itemId, { ...line, unitPriceCents: cents });
      return next;
    });
  }

  function removeFromCart(itemId: number) {
    setCart((prev) => {
      const next = new Map(prev);
      next.delete(itemId);
      return next;
    });
  }

  const cartLines = useMemo(() => Array.from(cart.values()), [cart]);
  const totalCents = useMemo(
    () => cartLines.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0),
    [cartLines]
  );
  const totalItems = useMemo(() => cartLines.reduce((s, l) => s + l.quantity, 0), [cartLines]);

  async function handleSubmit() {
    if (cart.size === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/cash-register/sale', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...getCsrfHeaders(),
        },
        body: JSON.stringify({
          patientId: selectedPatient?.id ?? null,
          items: cartLines.map((l) => ({
            itemId: l.itemId,
            quantity: l.quantity,
            unitPriceCents: l.unitPriceCents,
          })),
          paymentMethod,
          notes: notes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Erro ao registrar venda (HTTP ${res.status})`);
      }
      const data = await res.json();
      toast({
        title: 'Venda registrada',
        description: `${totalItems} item(ns) — ${formatBRL(data.sale?.totalCents ?? totalCents)}`,
      });
      onSuccess();
      onClose();
    } catch (err) {
      toast({
        title: 'Falha ao registrar venda',
        description: err instanceof Error ? err.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !submitting && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Vender Produto (PDV)
          </DialogTitle>
          <DialogDescription>
            Itens marcados como vendáveis no estoque. A venda dá baixa no estoque e entra como
            depósito no caixa aberto.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* ── LEFT: Catálogo ─────────────────────────────────────────────── */}
          <div className="space-y-2">
            <Label htmlFor="pdv-search">Buscar produto</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="pdv-search"
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                placeholder="Nome, SKU ou marca..."
                className="pl-8"
                autoFocus
              />
            </div>
            <ScrollArea className="h-72 rounded-md border">
              {loadingItems && items.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">Carregando...</p>
              ) : items.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">
                  Nenhum item vendável encontrado. Marque itens como "Disponível para venda" no
                  cadastro do estoque.
                </p>
              ) : (
                <ul className="divide-y">
                  {items.map((item) => {
                    const noPrice = item.salePrice == null;
                    const noStock = item.currentStock <= 0;
                    const disabled = noPrice || noStock;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => addToCart(item)}
                          className="w-full p-3 text-left hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed flex items-start justify-between gap-3"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm truncate">{item.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.sku ?? '—'} · {item.unitOfMeasure ?? 'un'} · estoque{' '}
                              {item.currentStock}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-semibold">
                              {noPrice ? '—' : formatBRL(item.salePrice!)}
                            </p>
                            {noStock && (
                              <Badge variant="destructive" className="text-[10px] mt-1">
                                Sem estoque
                              </Badge>
                            )}
                            {noPrice && !noStock && (
                              <Badge variant="secondary" className="text-[10px] mt-1">
                                Sem preço
                              </Badge>
                            )}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </ScrollArea>
          </div>

          {/* ── RIGHT: Carrinho ────────────────────────────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Carrinho ({totalItems})</Label>
              {cart.size > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setCart(new Map())}
                  className="h-7 text-xs"
                >
                  Limpar
                </Button>
              )}
            </div>
            <ScrollArea className="h-72 rounded-md border">
              {cart.size === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">
                  Clique em um item à esquerda para adicionar.
                </p>
              ) : (
                <ul className="divide-y">
                  {cartLines.map((line) => (
                    <li key={line.itemId} className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-tight flex-1">{line.name}</p>
                        <button
                          type="button"
                          onClick={() => removeFromCart(line.itemId)}
                          className="text-muted-foreground hover:text-destructive p-0.5"
                          aria-label="Remover item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center border rounded">
                          <button
                            type="button"
                            onClick={() => updateQty(line.itemId, -1)}
                            className="px-2 py-1 hover:bg-muted"
                            aria-label="Diminuir"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="px-2 text-sm w-8 text-center">{line.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateQty(line.itemId, 1)}
                            className="px-2 py-1 hover:bg-muted"
                            aria-label="Aumentar"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={(line.unitPriceCents / 100).toFixed(2)}
                          onChange={(e) => updatePrice(line.itemId, parseFloat(e.target.value) || 0)}
                          className="h-8 text-sm"
                          aria-label="Preço unitário"
                        />
                        <p className="text-sm font-semibold w-24 text-right shrink-0">
                          {formatBRL(line.unitPriceCents * line.quantity)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>

            <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="text-lg font-bold">{formatBRL(totalCents)}</span>
            </div>
          </div>
        </div>

        <Separator />

        {/* ── Footer: pagamento + paciente + notas ─────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="pdv-payment">Forma de pagamento</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger id="pdv-payment">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Paciente (opcional)</Label>
            {selectedPatient ? (
              <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span className="truncate">{selectedPatient.fullName}</span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPatient(null);
                    setPatientSearch('');
                  }}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Remover paciente"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : showPatient ? (
              <div className="space-y-1">
                <Input
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  placeholder="Buscar por nome..."
                  autoFocus
                />
                {patientHits.length > 0 && (
                  <div className="rounded-md border max-h-40 overflow-y-auto">
                    {patientHits.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedPatient(p);
                          setShowPatient(false);
                        }}
                        className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted"
                      >
                        {p.fullName}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowPatient(true)}
                className="gap-2 w-full"
              >
                <UserPlus className="h-4 w-4" />
                Vincular paciente
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="pdv-notes">Observação (opcional)</Label>
          <Textarea
            id="pdv-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value.slice(0, 500))}
            rows={2}
            placeholder="Ex: cortesia da clínica, desconto promocional..."
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={cart.size === 0 || totalCents === 0 || submitting}
            className="gap-2"
          >
            <ShoppingCart className="h-4 w-4" />
            {submitting ? 'Registrando...' : `Registrar venda — ${formatBRL(totalCents)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
