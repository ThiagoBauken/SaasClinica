import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle, XCircle, Clock, FileText, AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface QuoteItem {
  procedureName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface PublicQuote {
  clinicName: string;
  clinicPhone?: string;
  patientName: string;
  professionalName?: string;
  items: QuoteItem[];
  subtotal: number;
  discountPercent: string;
  discountAmount: number;
  totalAmount: number;
  installments: number;
  installmentValue?: number;
  interestRate: string;
  totalWithInterest?: number;
  status: string;
  validUntil?: string;
  notes?: string;
  createdAt: string;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  pending: { label: "Aguardando analise", color: "bg-blue-100 text-blue-800", icon: Clock },
  sent: { label: "Enviado", color: "bg-blue-100 text-blue-800", icon: FileText },
  viewed: { label: "Visualizado", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  approved: { label: "Aprovado", color: "bg-green-100 text-green-800", icon: CheckCircle },
  rejected: { label: "Recusado", color: "bg-red-100 text-red-800", icon: XCircle },
  expired: { label: "Expirado", color: "bg-gray-100 text-gray-600", icon: AlertTriangle },
};

export default function PublicQuotePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [quote, setQuote] = useState<PublicQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [actionDone, setActionDone] = useState<"approved" | "rejected" | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/v1/quotes/public/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Orcamento nao encontrado");
        }
        return res.json();
      })
      .then((data) => setQuote(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  const handleApprove = async () => {
    setApproving(true);
    try {
      const res = await fetch(`/api/v1/quotes/public/${token}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientName: quote?.patientName }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erro ao aprovar");
      }
      setActionDone("approved");
      if (quote) setQuote({ ...quote, status: "approved" });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    setRejecting(true);
    try {
      const res = await fetch(`/api/v1/quotes/public/${token}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason || "Nao informado" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erro ao recusar");
      }
      setActionDone("rejected");
      setShowRejectDialog(false);
      if (quote) setQuote({ ...quote, status: "rejected" });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setRejecting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-2" />
            <CardTitle>Orcamento nao encontrado</CardTitle>
            <CardDescription>{error || "O link pode ter expirado ou ser invalido."}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const statusInfo = STATUS_MAP[quote.status] || STATUS_MAP.pending;
  const StatusIcon = statusInfo.icon;
  const canAct = ["pending", "sent", "viewed"].includes(quote.status) && !actionDone;
  const isExpired = quote.validUntil && new Date(quote.validUntil) < new Date();

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold">{quote.clinicName}</h1>
          {quote.clinicPhone && <p className="text-muted-foreground">{quote.clinicPhone}</p>}
        </div>

        {/* Status */}
        {actionDone && (
          <Card className={actionDone === "approved" ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50"}>
            <CardContent className="flex items-center gap-3 py-4">
              {actionDone === "approved" ? (
                <CheckCircle className="h-6 w-6 text-green-600" />
              ) : (
                <XCircle className="h-6 w-6 text-red-600" />
              )}
              <div>
                <p className="font-semibold">
                  {actionDone === "approved" ? "Orcamento aprovado com sucesso!" : "Orcamento recusado."}
                </p>
                <p className="text-sm text-muted-foreground">
                  {actionDone === "approved"
                    ? "A clinica sera notificada e entrara em contato para agendar."
                    : "A clinica foi notificada da sua decisao."}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quote Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Orcamento</CardTitle>
                <CardDescription>
                  Para: {quote.patientName}
                  {quote.professionalName && ` | Dr(a). ${quote.professionalName}`}
                </CardDescription>
              </div>
              <Badge className={statusInfo.color}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {statusInfo.label}
              </Badge>
            </div>
            {quote.validUntil && (
              <p className={`text-xs ${isExpired ? "text-destructive" : "text-muted-foreground"}`}>
                {isExpired ? "Expirado em" : "Valido ate"}: {formatDate(quote.validUntil)}
              </p>
            )}
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Items table */}
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">Procedimento</th>
                    <th className="text-center p-3 font-medium w-16">Qtd</th>
                    <th className="text-right p-3 font-medium w-28">Valor Unit.</th>
                    <th className="text-right p-3 font-medium w-28">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {quote.items.map((item, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-3">{item.procedureName}</td>
                      <td className="p-3 text-center">{item.quantity}</td>
                      <td className="p-3 text-right">{formatCurrency(item.unitPrice)}</td>
                      <td className="p-3 text-right font-medium">{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Separator />

            {/* Totals */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(quote.subtotal)}</span>
              </div>
              {quote.discountAmount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Desconto ({quote.discountPercent}%)</span>
                  <span>- {formatCurrency(quote.discountAmount)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>{formatCurrency(quote.totalAmount)}</span>
              </div>

              {quote.installments > 1 && (
                <div className="bg-muted/50 rounded-lg p-3 mt-3 space-y-1">
                  <div className="flex justify-between font-medium">
                    <span>{quote.installments}x de</span>
                    <span>{formatCurrency(quote.installmentValue || Math.ceil(quote.totalAmount / quote.installments))}</span>
                  </div>
                  {parseFloat(quote.interestRate) > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Juros: {quote.interestRate}% a.m. | Total com juros: {formatCurrency(quote.totalWithInterest || quote.totalAmount)}
                    </p>
                  )}
                </div>
              )}
            </div>

            {quote.notes && (
              <>
                <Separator />
                <div>
                  <p className="text-sm font-medium mb-1">Observacoes</p>
                  <p className="text-sm text-muted-foreground">{quote.notes}</p>
                </div>
              </>
            )}
          </CardContent>

          {canAct && !isExpired && (
            <CardFooter className="flex flex-col sm:flex-row gap-3">
              <Button
                className="w-full sm:w-auto flex-1"
                size="lg"
                onClick={handleApprove}
                disabled={approving}
              >
                {approving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                Aprovar Orcamento
              </Button>
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                size="lg"
                onClick={() => setShowRejectDialog(true)}
                disabled={rejecting}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Recusar
              </Button>
            </CardFooter>
          )}
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Emitido em {formatDate(quote.createdAt)} | {quote.clinicName}
        </p>
      </div>

      {/* Reject reason dialog */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Recusar orcamento</AlertDialogTitle>
            <AlertDialogDescription>
              Informe o motivo da recusa (opcional). Isso ajuda a clinica a oferecer uma alternativa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Ex: Preco acima do esperado, vou pesquisar outras opcoes..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={rejecting}
            >
              {rejecting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Confirmar Recusa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
