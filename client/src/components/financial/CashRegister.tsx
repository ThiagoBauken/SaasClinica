import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getCsrfHeaders } from '@/lib/csrf';
import { useToast } from '@/hooks/use-toast';
import {
  Banknote,
  CreditCard,
  ArrowDownCircle,
  ArrowUpCircle,
  BarChart3,
  LockKeyhole,
  Unlock,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Clock,
  ShoppingCart,
} from 'lucide-react';
import PDVDialog from './PDVDialog';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface BoxRecord {
  id: number;
  name: string;
  openingBalance: string;
  currentBalance: string;
  status: 'open' | 'closed';
  responsibleId: number | null;
  lastOpenedAt: string | null;
  lastClosedAt: string | null;
}

interface BoxTransaction {
  id: number;
  type: 'deposit' | 'withdrawal' | 'adjustment';
  amount: string;
  description: string | null;
  paymentMethod: string | null;
  createdAt: string;
}

interface PaymentMethodTotals {
  deposits: number;
  withdrawals: number;
}

interface CurrentRegisterResponse {
  box: BoxRecord;
  transactions: BoxTransaction[];
  summary: {
    openingBalance: number;
    totalDeposits: number;
    totalWithdrawals: number;
    expectedBalance: number;
    byPaymentMethod: Record<string, PaymentMethodTotals>;
  };
}

interface SummaryResponse {
  production: {
    totalBrl: number;
    procedureCount: number;
  };
  receipts: {
    totalBrl: number;
    byPaymentMethod: Record<string, { totalBrl: number; count: number }>;
  };
  pending: { count: number };
  difference: { brl: number };
}

interface HistoryItem {
  id: number;
  name: string;
  openingBalance: string;
  currentBalance: string;
  lastOpenedAt: string | null;
  lastClosedAt: string | null;
  responsibleName: string | null;
  totals: { deposits: number; withdrawals: number; txCount: number };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

const METHOD_LABELS: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  cartao_credito: 'Cartão Crédito',
  cartao_debito: 'Cartão Débito',
  boleto: 'Boleto',
  cheque: 'Cheque',
  outros: 'Outros',
};

const TX_TYPE_LABELS: Record<string, string> = {
  deposit: 'Suprimento',
  withdrawal: 'Sangria',
  adjustment: 'Ajuste',
};

const TX_TYPE_COLORS: Record<string, string> = {
  deposit: 'bg-emerald-100 text-emerald-700',
  withdrawal: 'bg-red-100 text-red-700',
  adjustment: 'bg-amber-100 text-amber-700',
};

async function apiPost<T = unknown>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: getCsrfHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error ?? 'Erro na requisição');
  }
  return data as T;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function StatCard({
  title,
  value,
  icon: Icon,
  colorClass = 'text-foreground',
  subtitle,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  colorClass?: string;
  subtitle?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{title}</p>
            <p className={`text-xl font-bold ${colorClass}`}>{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${colorClass}`} />
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Open Register Dialog
// ─────────────────────────────────────────────────────────────────────────────

function OpenRegisterDialog({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [openingBalance, setOpeningBalance] = useState('');
  const [responsibleName, setResponsibleName] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      apiPost('/api/v1/cash-register/open', {
        openingBalance: parseFloat(openingBalance.replace(',', '.')) || 0,
        responsibleName,
      }),
    onSuccess: () => {
      toast({ title: 'Caixa aberto com sucesso' });
      onSuccess();
      onClose();
      setOpeningBalance('');
      setResponsibleName('');
    },
    onError: (err: Error) => {
      toast({ title: 'Erro ao abrir caixa', description: err.message, variant: 'destructive' });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Abrir Caixa</DialogTitle>
          <DialogDescription>
            Informe o saldo inicial em dinheiro presente no caixa.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="opening-balance">Saldo Inicial (R$)</Label>
            <Input
              id="opening-balance"
              type="number"
              min="0"
              step="0.01"
              placeholder="0,00"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="responsible-name">Responsável</Label>
            <Input
              id="responsible-name"
              placeholder="Nome do responsável"
              value={responsibleName}
              onChange={(e) => setResponsibleName(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !responsibleName}
          >
            {mutation.isPending ? 'Abrindo...' : 'Abrir Caixa'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Transaction Dialog (Sangria / Suprimento / Ajuste)
// ─────────────────────────────────────────────────────────────────────────────

function TransactionDialog({
  open,
  defaultType,
  onClose,
  onSuccess,
}: {
  open: boolean;
  defaultType: 'deposit' | 'withdrawal' | 'adjustment';
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [type, setType] = useState<'deposit' | 'withdrawal' | 'adjustment'>(defaultType);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('dinheiro');

  const mutation = useMutation({
    mutationFn: () =>
      apiPost('/api/v1/cash-register/transaction', {
        type,
        amount: parseFloat(amount.replace(',', '.')) || 0,
        description,
        paymentMethod,
      }),
    onSuccess: () => {
      toast({ title: 'Movimentação registrada' });
      onSuccess();
      onClose();
      setAmount('');
      setDescription('');
    },
    onError: (err: Error) => {
      toast({ title: 'Erro ao registrar movimentação', description: err.message, variant: 'destructive' });
    },
  });

  const typeLabel = TX_TYPE_LABELS[type] ?? 'Movimentação';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova {typeLabel}</DialogTitle>
          <DialogDescription>
            Registre uma movimentação manual no caixa.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="deposit">Suprimento (entrada)</SelectItem>
                <SelectItem value="withdrawal">Sangria (retirada)</SelectItem>
                <SelectItem value="adjustment">Ajuste</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tx-amount">Valor (R$)</Label>
            <Input
              id="tx-amount"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Forma de Pagamento</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(METHOD_LABELS).map(([val, label]) => (
                  <SelectItem key={val} value={val}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tx-description">Descrição</Label>
            <Input
              id="tx-description"
              placeholder="Motivo da movimentação"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !amount || !description}
          >
            {mutation.isPending ? 'Registrando...' : `Registrar ${typeLabel}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Close Register Dialog
// ─────────────────────────────────────────────────────────────────────────────

function CloseRegisterDialog({
  open,
  expectedBalance,
  onClose,
  onSuccess,
}: {
  open: boolean;
  expectedBalance: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [countedCash, setCountedCash] = useState('');
  const [responsibleName, setResponsibleName] = useState('');
  const [notes, setNotes] = useState('');

  const counted = parseFloat(countedCash.replace(',', '.')) || 0;
  const difference = counted - expectedBalance;

  const mutation = useMutation({
    mutationFn: () =>
      apiPost('/api/v1/cash-register/close', {
        countedCash: counted,
        responsibleName,
        notes,
      }),
    onSuccess: () => {
      toast({ title: 'Caixa fechado com sucesso' });
      onSuccess();
      onClose();
      setCountedCash('');
      setResponsibleName('');
      setNotes('');
    },
    onError: (err: Error) => {
      toast({ title: 'Erro ao fechar caixa', description: err.message, variant: 'destructive' });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Fechar Caixa</DialogTitle>
          <DialogDescription>
            Informe o valor fisicamente contado no caixa para registrar o fechamento.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="rounded-lg border bg-muted/40 p-3 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Saldo esperado pelo sistema:</span>
              <span className="font-semibold">{formatBRL(expectedBalance)}</span>
            </div>
            {countedCash && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor contado:</span>
                  <span className="font-semibold">{formatBRL(counted)}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-medium">
                  <span>Diferença:</span>
                  <span
                    className={
                      difference > 0
                        ? 'text-emerald-600'
                        : difference < 0
                        ? 'text-red-600'
                        : 'text-muted-foreground'
                    }
                  >
                    {difference >= 0 ? '+' : ''}
                    {formatBRL(difference)}
                  </span>
                </div>
              </>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="counted-cash">Valor Contado no Caixa (R$)</Label>
            <Input
              id="counted-cash"
              type="number"
              min="0"
              step="0.01"
              placeholder="0,00"
              value={countedCash}
              onChange={(e) => setCountedCash(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="close-responsible">Responsável pelo Fechamento</Label>
            <Input
              id="close-responsible"
              placeholder="Nome do responsável"
              value={responsibleName}
              onChange={(e) => setResponsibleName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="close-notes">Observações</Label>
            <Textarea
              id="close-notes"
              placeholder="Observações sobre o fechamento (opcional)"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !countedCash || !responsibleName}
          >
            {mutation.isPending ? 'Fechando...' : 'Confirmar Fechamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// History Tab
// ─────────────────────────────────────────────────────────────────────────────

function HistoryTab() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<{
    data: HistoryItem[];
    pagination: { page: number; totalPages: number; total: number };
  }>({
    queryKey: ['/api/v1/cash-register/history', page],
    queryFn: async () => {
      const res = await fetch(`/api/v1/cash-register/history?page=${page}&limit=15`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Erro ao carregar histórico');
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground gap-2">
        <RefreshCw className="h-4 w-4 animate-spin" />
        Carregando histórico...
      </div>
    );
  }

  if (!data || data.data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
        <Clock className="h-8 w-8 opacity-40" />
        <p className="text-sm">Nenhum fechamento registrado ainda</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data de Fechamento</TableHead>
            <TableHead>Responsável</TableHead>
            <TableHead className="text-right">Saldo Inicial</TableHead>
            <TableHead className="text-right">Entradas</TableHead>
            <TableHead className="text-right">Saídas</TableHead>
            <TableHead className="text-right">Saldo Final</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.data.map((item) => {
            const opening = parseFloat(item.openingBalance);
            const closing = parseFloat(item.currentBalance);
            return (
              <TableRow key={item.id}>
                <TableCell className="text-sm">{formatDateTime(item.lastClosedAt)}</TableCell>
                <TableCell className="text-sm">{item.responsibleName ?? '—'}</TableCell>
                <TableCell className="text-right text-sm">{formatBRL(opening)}</TableCell>
                <TableCell className="text-right text-sm text-emerald-600">
                  +{formatBRL(item.totals.deposits)}
                </TableCell>
                <TableCell className="text-right text-sm text-red-600">
                  -{formatBRL(item.totals.withdrawals)}
                </TableCell>
                <TableCell className="text-right text-sm font-semibold">
                  {formatBRL(closing)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground pt-1">
          <span>
            {data.pagination.total} fechamentos no total
          </span>
          <div className="flex gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= data.pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function CashRegister() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'register' | 'history'>('register');
  const [openOpenDialog, setOpenOpenDialog] = useState(false);
  const [openCloseDialog, setOpenCloseDialog] = useState(false);
  const [openTxDialog, setOpenTxDialog] = useState(false);
  const [txDialogType, setTxDialogType] = useState<'deposit' | 'withdrawal' | 'adjustment'>('withdrawal');
  const [openPDVDialog, setOpenPDVDialog] = useState(false);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/v1/cash-register/current'] });
    queryClient.invalidateQueries({ queryKey: ['/api/v1/cash-register/summary'] });
    queryClient.invalidateQueries({ queryKey: ['/api/v1/cash-register/history'] });
  };

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: current, isLoading: loadingCurrent } = useQuery<CurrentRegisterResponse | null>({
    queryKey: ['/api/v1/cash-register/current'],
    queryFn: async () => {
      const res = await fetch('/api/v1/cash-register/current', { credentials: 'include' });
      if (!res.ok) throw new Error('Erro ao carregar caixa');
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const { data: summary } = useQuery<SummaryResponse>({
    queryKey: ['/api/v1/cash-register/summary'],
    queryFn: async () => {
      const res = await fetch('/api/v1/cash-register/summary', { credentials: 'include' });
      if (!res.ok) throw new Error('Erro ao carregar resumo');
      return res.json();
    },
    enabled: !!current,
    refetchInterval: 60_000,
  });

  // ── Loading state ──────────────────────────────────────────────────────────

  if (loadingCurrent) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground gap-2">
        <RefreshCw className="h-5 w-5 animate-spin" />
        Carregando caixa...
      </div>
    );
  }

  // ── No open register ───────────────────────────────────────────────────────

  const isClosed = !current;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Caixa</h2>
          <p className="text-sm text-muted-foreground">
            {isClosed ? 'Caixa fechado' : `Aberto em ${formatDateTime(current.box.lastOpenedAt)}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={isClosed ? 'secondary' : 'default'} className="gap-1">
            {isClosed ? (
              <LockKeyhole className="h-3 w-3" />
            ) : (
              <Unlock className="h-3 w-3" />
            )}
            {isClosed ? 'Fechado' : 'Aberto'}
          </Badge>

          {/* Tab buttons */}
          <div className="flex rounded-md border overflow-hidden text-sm">
            <button
              className={`px-3 py-1.5 ${activeTab === 'register' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}
              onClick={() => setActiveTab('register')}
            >
              Caixa Atual
            </button>
            <button
              className={`px-3 py-1.5 border-l ${activeTab === 'history' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}
              onClick={() => setActiveTab('history')}
            >
              Histórico
            </button>
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={invalidate}
            title="Atualizar"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ── History Tab ────────────────────────────────────────────────────── */}
      {activeTab === 'history' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Histórico de Fechamentos</CardTitle>
            <CardDescription>Registros dos caixas fechados anteriores</CardDescription>
          </CardHeader>
          <CardContent>
            <HistoryTab />
          </CardContent>
        </Card>
      )}

      {/* ── Register Tab ───────────────────────────────────────────────────── */}
      {activeTab === 'register' && (
        <>
          {/* Closed state — open button */}
          {isClosed && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
                <LockKeyhole className="h-12 w-12 text-muted-foreground opacity-40" />
                <div className="text-center">
                  <p className="font-medium">Caixa fechado</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Abra o caixa para começar a registrar movimentações do dia.
                  </p>
                </div>
                <Button onClick={() => setOpenOpenDialog(true)} className="gap-2">
                  <Unlock className="h-4 w-4" />
                  Abrir Caixa
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Open state */}
          {!isClosed && current && (
            <>
              {/* Stats row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard
                  title="Saldo Inicial"
                  value={formatBRL(current.summary.openingBalance)}
                  icon={Banknote}
                  colorClass="text-muted-foreground"
                />
                <StatCard
                  title="Entradas"
                  value={formatBRL(current.summary.totalDeposits)}
                  icon={ArrowDownCircle}
                  colorClass="text-emerald-600"
                />
                <StatCard
                  title="Saídas"
                  value={formatBRL(current.summary.totalWithdrawals)}
                  icon={ArrowUpCircle}
                  colorClass="text-red-500"
                />
                <StatCard
                  title="Saldo Esperado"
                  value={formatBRL(current.summary.expectedBalance)}
                  icon={CreditCard}
                  colorClass="text-blue-600"
                />
              </div>

              {/* Production vs Receipts */}
              {summary && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      Produção vs Recebimentos de Hoje
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-4 space-y-1">
                        <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-400">
                          <TrendingUp className="h-4 w-4" />
                          <span className="text-xs font-medium uppercase tracking-wide">Produção</span>
                        </div>
                        <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                          {formatBRL(summary.production.totalBrl)}
                        </p>
                        <p className="text-xs text-blue-600/70 dark:text-blue-400/70">
                          {summary.production.procedureCount} procedimento(s)
                        </p>
                      </div>

                      <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-4 space-y-1">
                        <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                          <Banknote className="h-4 w-4" />
                          <span className="text-xs font-medium uppercase tracking-wide">Recebimentos</span>
                        </div>
                        <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                          {formatBRL(summary.receipts.totalBrl)}
                        </p>
                        {summary.pending.count > 0 && (
                          <p className="text-xs text-amber-600 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {summary.pending.count} consulta(s) sem pagamento
                          </p>
                        )}
                      </div>

                      <div className="rounded-lg bg-muted/60 p-4 space-y-1">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <TrendingDown className="h-4 w-4" />
                          <span className="text-xs font-medium uppercase tracking-wide">Diferença</span>
                        </div>
                        <p
                          className={`text-2xl font-bold ${
                            summary.difference.brl > 0
                              ? 'text-amber-600'
                              : summary.difference.brl < 0
                              ? 'text-red-600'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {summary.difference.brl >= 0 ? '+' : ''}
                          {formatBRL(summary.difference.brl)}
                        </p>
                        <p className="text-xs text-muted-foreground">produção − recebido</p>
                      </div>
                    </div>

                    {/* Receipts by payment method */}
                    {Object.keys(summary.receipts.byPaymentMethod).length > 0 && (
                      <>
                        <Separator className="my-4" />
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                          Recebimentos por Forma de Pagamento
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {Object.entries(summary.receipts.byPaymentMethod).map(([method, totals]) => (
                            <div
                              key={method}
                              className="flex items-center justify-between rounded border px-3 py-2 text-sm"
                            >
                              <span className="text-muted-foreground">
                                {METHOD_LABELS[method] ?? method}
                              </span>
                              <span className="font-semibold">{formatBRL(totals.totalBrl)}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Payment method totals for box transactions */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Movimentações por Forma de Pagamento (Caixa)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {Object.entries(current.summary.byPaymentMethod)
                      .filter(([, v]) => v.deposits > 0 || v.withdrawals > 0)
                      .map(([method, totals]) => (
                        <div key={method} className="rounded-lg border p-3 space-y-1.5">
                          <p className="text-xs font-medium text-muted-foreground">
                            {METHOD_LABELS[method] ?? method}
                          </p>
                          {totals.deposits > 0 && (
                            <p className="text-sm text-emerald-600">
                              +{formatBRL(totals.deposits)}
                            </p>
                          )}
                          {totals.withdrawals > 0 && (
                            <p className="text-sm text-red-500">
                              -{formatBRL(totals.withdrawals)}
                            </p>
                          )}
                        </div>
                      ))}
                    {Object.values(current.summary.byPaymentMethod).every(
                      (v) => v.deposits === 0 && v.withdrawals === 0
                    ) && (
                      <p className="col-span-full text-sm text-muted-foreground py-2">
                        Nenhuma movimentação registrada ainda hoje.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Transactions list */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Movimentações de Hoje</CardTitle>
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        size="sm"
                        className="gap-1.5"
                        onClick={() => setOpenPDVDialog(true)}
                      >
                        <ShoppingCart className="h-3.5 w-3.5" />
                        Vender produto
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                        onClick={() => {
                          setTxDialogType('withdrawal');
                          setOpenTxDialog(true);
                        }}
                      >
                        <ArrowUpCircle className="h-3.5 w-3.5" />
                        Sangria
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                        onClick={() => {
                          setTxDialogType('deposit');
                          setOpenTxDialog(true);
                        }}
                      >
                        <ArrowDownCircle className="h-3.5 w-3.5" />
                        Suprimento
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {current.transactions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
                      <Banknote className="h-8 w-8 opacity-30" />
                      <p className="text-sm">Nenhuma movimentação hoje</p>
                    </div>
                  ) : (
                    <ScrollArea className="h-72">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Horário</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Descrição</TableHead>
                            <TableHead>Forma</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {current.transactions.map((tx) => {
                            const amount = parseFloat(tx.amount);
                            const isDeposit = tx.type === 'deposit';
                            return (
                              <TableRow key={tx.id}>
                                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                  {new Date(tx.createdAt).toLocaleTimeString('pt-BR', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </TableCell>
                                <TableCell>
                                  <span
                                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                      TX_TYPE_COLORS[tx.type] ?? 'bg-muted text-muted-foreground'
                                    }`}
                                  >
                                    {TX_TYPE_LABELS[tx.type] ?? tx.type}
                                  </span>
                                </TableCell>
                                <TableCell className="text-sm max-w-[200px] truncate">
                                  {tx.description ?? '—'}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {METHOD_LABELS[tx.paymentMethod ?? ''] ?? tx.paymentMethod ?? '—'}
                                </TableCell>
                                <TableCell
                                  className={`text-right font-semibold text-sm ${
                                    isDeposit ? 'text-emerald-600' : 'text-red-500'
                                  }`}
                                >
                                  {isDeposit ? '+' : '-'}
                                  {formatBRL(amount)}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>

              {/* Close register button */}
              <div className="flex justify-end pt-2">
                <Button
                  variant="destructive"
                  size="lg"
                  className="gap-2"
                  onClick={() => setOpenCloseDialog(true)}
                >
                  <LockKeyhole className="h-4 w-4" />
                  Fechar Caixa
                </Button>
              </div>
            </>
          )}
        </>
      )}

      {/* ── Dialogs ────────────────────────────────────────────────────────── */}

      <OpenRegisterDialog
        open={openOpenDialog}
        onClose={() => setOpenOpenDialog(false)}
        onSuccess={invalidate}
      />

      <TransactionDialog
        open={openTxDialog}
        defaultType={txDialogType}
        onClose={() => setOpenTxDialog(false)}
        onSuccess={invalidate}
      />

      <PDVDialog
        open={openPDVDialog}
        onClose={() => setOpenPDVDialog(false)}
        onSuccess={invalidate}
      />

      {!isClosed && current && (
        <CloseRegisterDialog
          open={openCloseDialog}
          expectedBalance={current.summary.expectedBalance}
          onClose={() => setOpenCloseDialog(false)}
          onSuccess={invalidate}
        />
      )}
    </div>
  );
}
