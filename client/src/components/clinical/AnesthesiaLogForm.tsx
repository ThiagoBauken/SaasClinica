import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Loader2,
  Plus,
  ChevronDown,
  ChevronUp,
  Syringe,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AnesthesiaLog {
  id: number;
  appointmentId: number;
  anestheticType: string;
  anestheticName: string;
  concentration: string | null;
  vasoconstrictor: string;
  quantityMl: number;
  lotNumber: string | null;
  expirationDate: string | null;
  technique: string;
  toothRegion: string | null;
  adverseReaction: string | null;
  notes: string | null;
  createdAt: string;
}

interface AnesthesiaLogFormData {
  anestheticType: string;
  anestheticName: string;
  concentration: string;
  vasoconstrictor: string;
  quantityMl: string;
  lotNumber: string;
  expirationDate: string;
  technique: string;
  toothRegion: string;
  adverseReaction: string;
  notes: string;
}

interface AnesthesiaLogFormProps {
  appointmentId: number;
  patientId?: number;
  readOnly?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ANESTHETIC_TYPES = [
  { value: "Local", label: "Local" },
  { value: "Regional", label: "Regional" },
  { value: "Geral", label: "Geral" },
  { value: "Sedacao", label: "Sedacao" },
];

const ANESTHETIC_NAMES = [
  { value: "Lidocaina", label: "Lidocaina" },
  { value: "Mepivacaina", label: "Mepivacaina" },
  { value: "Articaina", label: "Articaina" },
  { value: "Prilocaina", label: "Prilocaina" },
  { value: "Outro", label: "Outro" },
];

const VASOCONSTRICTORS = [
  { value: "Epinefrina", label: "Epinefrina" },
  { value: "Felipressina", label: "Felipressina" },
  { value: "Sem Vasoconstritor", label: "Sem Vasoconstritor" },
];

const TECHNIQUES = [
  { value: "Infiltrativa", label: "Infiltrativa" },
  { value: "Bloqueio", label: "Bloqueio" },
  { value: "Topica", label: "Topica" },
];

const EMPTY_FORM: AnesthesiaLogFormData = {
  anestheticType: "Local",
  anestheticName: "Articaina",
  concentration: "",
  vasoconstrictor: "Epinefrina",
  quantityMl: "",
  lotNumber: "",
  expirationDate: "",
  technique: "Infiltrativa",
  toothRegion: "",
  adverseReaction: "",
  notes: "",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string): string {
  try {
    return format(new Date(dateStr), "dd/MM/yyyy HH:mm", { locale: ptBR });
  } catch {
    return dateStr;
  }
}

// ---------------------------------------------------------------------------
// Log item component
// ---------------------------------------------------------------------------

function AnesthesiaLogItem({ log }: { log: AnesthesiaLog }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <div className="border rounded-lg overflow-hidden">
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              <Syringe className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <span className="font-medium text-sm">
                  {log.anestheticName} — {log.anestheticType}
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="secondary" className="text-xs">
                    {log.technique}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {log.vasoconstrictor}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {log.quantityMl} mL
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {log.adverseReaction && (
                <Badge variant="destructive" className="text-xs flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Reacao
                </Badge>
              )}
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDate(log.createdAt)}
              </span>
              {expanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t p-3 bg-muted/30">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {log.concentration && (
                <div>
                  <span className="text-muted-foreground">Concentracao: </span>
                  <span>{log.concentration}</span>
                </div>
              )}
              {log.toothRegion && (
                <div>
                  <span className="text-muted-foreground">Regiao: </span>
                  <span>{log.toothRegion}</span>
                </div>
              )}
              {log.lotNumber && (
                <div>
                  <span className="text-muted-foreground">Lote: </span>
                  <span>{log.lotNumber}</span>
                </div>
              )}
              {log.expirationDate && (
                <div>
                  <span className="text-muted-foreground">Validade: </span>
                  <span>
                    {format(new Date(log.expirationDate), "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                </div>
              )}
            </div>
            {log.adverseReaction && (
              <div className="mt-2 p-2 rounded bg-red-50 border border-red-100">
                <p className="text-sm text-red-700">
                  <strong>Reacao Adversa:</strong> {log.adverseReaction}
                </p>
              </div>
            )}
            {log.notes && (
              <p className="mt-2 text-sm text-muted-foreground">
                <strong>Notas:</strong> {log.notes}
              </p>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AnesthesiaLogForm({
  appointmentId,
  readOnly = false,
}: AnesthesiaLogFormProps) {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<AnesthesiaLogFormData>(EMPTY_FORM);

  // -------------------------------------------------------------------------
  // Query: existing logs for this appointment
  // -------------------------------------------------------------------------

  const { data: logs = [], isLoading } = useQuery<AnesthesiaLog[]>({
    queryKey: ["/api/v1/anesthesia-logs", appointmentId],
    queryFn: async () => {
      const res = await fetch(
        `/api/v1/anesthesia-logs?appointmentId=${appointmentId}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Falha ao buscar registros de anestesia");
      return res.json();
    },
  });

  // -------------------------------------------------------------------------
  // Mutation
  // -------------------------------------------------------------------------

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("POST", "/api/v1/anesthesia-logs", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/v1/anesthesia-logs", appointmentId],
      });
      toast({
        title: "Anestesia registrada",
        description: "Registro de anestesia salvo com sucesso.",
      });
      setShowForm(false);
      setForm(EMPTY_FORM);
    },
    onError: (err: Error) =>
      toast({
        title: "Erro ao registrar",
        description: err.message,
        variant: "destructive",
      }),
  });

  // -------------------------------------------------------------------------
  // Submit
  // -------------------------------------------------------------------------

  function handleSubmit() {
    if (!form.quantityMl || parseFloat(form.quantityMl) <= 0) {
      toast({
        title: "Quantidade invalida",
        description: "Informe a quantidade em mL.",
        variant: "destructive",
      });
      return;
    }

    createMutation.mutate({
      appointmentId,
      anestheticType: form.anestheticType,
      anestheticName: form.anestheticName,
      concentration: form.concentration || null,
      vasoconstrictor: form.vasoconstrictor,
      quantityMl: parseFloat(form.quantityMl),
      lotNumber: form.lotNumber || null,
      expirationDate: form.expirationDate || null,
      technique: form.technique,
      toothRegion: form.toothRegion || null,
      adverseReaction: form.adverseReaction || null,
      notes: form.notes || null,
    });
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Syringe className="h-4 w-4 text-blue-500" />
              Registro de Anestesia
            </CardTitle>
            <CardDescription>
              {logs.length === 0
                ? "Nenhum registro para esta consulta"
                : `${logs.length} registro${logs.length > 1 ? "s" : ""}`}
            </CardDescription>
          </div>
          {!readOnly && (
            <Button
              size="sm"
              variant={showForm ? "secondary" : "outline"}
              onClick={() => setShowForm((v) => !v)}
            >
              {showForm ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-1" />
                  Cancelar
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-1" />
                  Registrar
                </>
              )}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Form */}
        {showForm && (
          <div className="border rounded-lg p-4 space-y-4 bg-muted/20">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Novo Registro
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Tipo de Anestesia *</Label>
                <Select
                  value={form.anestheticType}
                  onValueChange={(v) => setForm((f) => ({ ...f, anestheticType: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ANESTHETIC_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Anestesico *</Label>
                <Select
                  value={form.anestheticName}
                  onValueChange={(v) => setForm((f) => ({ ...f, anestheticName: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ANESTHETIC_NAMES.map((n) => (
                      <SelectItem key={n.value} value={n.value}>
                        {n.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="al-concentration">Concentracao</Label>
                <Input
                  id="al-concentration"
                  placeholder="Ex: 2%, 4%"
                  value={form.concentration}
                  onChange={(e) => setForm((f) => ({ ...f, concentration: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Vasoconstritor *</Label>
                <Select
                  value={form.vasoconstrictor}
                  onValueChange={(v) => setForm((f) => ({ ...f, vasoconstrictor: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VASOCONSTRICTORS.map((v) => (
                      <SelectItem key={v.value} value={v.value}>
                        {v.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="al-qty">Quantidade (mL) *</Label>
                <Input
                  id="al-qty"
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="Ex: 1.8"
                  value={form.quantityMl}
                  onChange={(e) => setForm((f) => ({ ...f, quantityMl: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Tecnica *</Label>
                <Select
                  value={form.technique}
                  onValueChange={(v) => setForm((f) => ({ ...f, technique: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TECHNIQUES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="al-lot">Numero do Lote</Label>
                <Input
                  id="al-lot"
                  placeholder="Ex: LT202401"
                  value={form.lotNumber}
                  onChange={(e) => setForm((f) => ({ ...f, lotNumber: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="al-expiry">Validade</Label>
                <Input
                  id="al-expiry"
                  type="date"
                  value={form.expirationDate}
                  onChange={(e) => setForm((f) => ({ ...f, expirationDate: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="al-region">Regiao / Dente</Label>
                <Input
                  id="al-region"
                  placeholder="Ex: Dente 36, Quadrante inferior esquerdo"
                  value={form.toothRegion}
                  onChange={(e) => setForm((f) => ({ ...f, toothRegion: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="al-reaction">Reacao Adversa</Label>
                <Textarea
                  id="al-reaction"
                  rows={2}
                  placeholder="Descreva qualquer reacao adversa observada..."
                  value={form.adverseReaction}
                  onChange={(e) => setForm((f) => ({ ...f, adverseReaction: e.target.value }))}
                  className={form.adverseReaction ? "border-red-300 focus-visible:ring-red-300" : ""}
                />
                {form.adverseReaction && (
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Reacao adversa sera destacada no registro
                  </p>
                )}
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="al-notes">Observacoes</Label>
                <Textarea
                  id="al-notes"
                  rows={2}
                  placeholder="Notas adicionais..."
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowForm(false);
                  setForm(EMPTY_FORM);
                }}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Salvar Registro
              </Button>
            </div>
          </div>
        )}

        {/* Logs list */}
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
            <Syringe className="h-8 w-8 opacity-30" />
            <p className="text-sm">Nenhum registro de anestesia</p>
          </div>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <AnesthesiaLogItem key={log.id} log={log} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default AnesthesiaLogForm;
