import { useState, useRef } from "react";
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  Plus,
  ChevronRight,
  FlaskConical,
  CheckCircle2,
  XCircle,
  Clock,
  Paperclip,
  FileText,
  ArrowRight,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ExamStatus = "Solicitado" | "Coletado" | "Concluido" | "Cancelado";

interface ExamRequest {
  id: number;
  patientId: number;
  examType: string;
  description: string | null;
  status: ExamStatus;
  resultText: string | null;
  resultFileUrl: string | null;
  requestedAt: string;
  collectedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  notes: string | null;
}

interface ExamRequestCreate {
  examType: string;
  description: string;
  notes: string;
}

interface ExamResultForm {
  resultText: string;
  notes: string;
}

interface ExamRequestWorkflowProps {
  patientId: number;
  readOnly?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EXAM_TYPES = [
  "Hemograma Completo",
  "Coagulacao",
  "Glicemia",
  "Radiografia Periapical",
  "Radiografia Panoramica",
  "Tomografia",
  "Biopsia",
  "Microbiologico",
  "Outro",
];

// Status flow: what each status advances to
const NEXT_STATUS: Partial<Record<ExamStatus, ExamStatus>> = {
  Solicitado: "Coletado",
  Coletado: "Concluido",
};

const STATUS_CONFIG: Record<
  ExamStatus,
  { label: string; className: string; icon: React.ReactNode }
> = {
  Solicitado: {
    label: "Solicitado",
    className: "bg-blue-100 text-blue-800 border-blue-200",
    icon: <Clock className="h-3 w-3" />,
  },
  Coletado: {
    label: "Coletado",
    className: "bg-yellow-100 text-yellow-800 border-yellow-200",
    icon: <FlaskConical className="h-3 w-3" />,
  },
  Concluido: {
    label: "Concluido",
    className: "bg-green-100 text-green-800 border-green-200",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  Cancelado: {
    label: "Cancelado",
    className: "bg-gray-100 text-gray-600 border-gray-200",
    icon: <XCircle className="h-3 w-3" />,
  },
};

const EMPTY_CREATE: ExamRequestCreate = {
  examType: "Hemograma Completo",
  description: "",
  notes: "",
};

const EMPTY_RESULT: ExamResultForm = {
  resultText: "",
  notes: "",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    return format(new Date(dateStr), "dd/MM/yyyy HH:mm", { locale: ptBR });
  } catch {
    return dateStr;
  }
}

// ---------------------------------------------------------------------------
// Status Badge
// ---------------------------------------------------------------------------

function ExamStatusBadge({ status }: { status: ExamStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <Badge variant="outline" className={`flex items-center gap-1 ${cfg.className}`}>
      {cfg.icon}
      {cfg.label}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Status flow indicator
// ---------------------------------------------------------------------------

function StatusFlow({ current }: { current: ExamStatus }) {
  const steps: ExamStatus[] = ["Solicitado", "Coletado", "Concluido"];
  if (current === "Cancelado") {
    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <XCircle className="h-3 w-3 text-gray-400" />
        Cancelado
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1">
      {steps.map((step, i) => {
        const stepIndex = steps.indexOf(current);
        const isActive = i === stepIndex;
        const isDone = i < stepIndex;

        return (
          <div key={step} className="flex items-center gap-1">
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                isDone
                  ? "bg-green-100 text-green-700"
                  : isActive
                  ? "bg-blue-100 text-blue-700 ring-1 ring-blue-400"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              {step}
            </span>
            {i < steps.length - 1 && (
              <ChevronRight
                className={`h-3 w-3 ${isDone ? "text-green-400" : "text-gray-300"}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single exam card
// ---------------------------------------------------------------------------

interface ExamCardProps {
  exam: ExamRequest;
  onAdvance: (id: number, nextStatus: ExamStatus) => void;
  onCancel: (id: number) => void;
  onAddResult: (exam: ExamRequest) => void;
  isUpdating: boolean;
  readOnly: boolean;
}

function ExamCard({ exam, onAdvance, onCancel, onAddResult, isUpdating, readOnly }: ExamCardProps) {
  const next = NEXT_STATUS[exam.status];

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="font-medium">{exam.examType}</span>
          </div>
          {exam.description && (
            <p className="text-sm text-muted-foreground pl-6">{exam.description}</p>
          )}
        </div>
        <ExamStatusBadge status={exam.status} />
      </div>

      {/* Status flow */}
      <div className="pl-6">
        <StatusFlow current={exam.status} />
      </div>

      {/* Timestamps */}
      <div className="pl-6 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>Solicitado: {formatDate(exam.requestedAt)}</span>
        {exam.collectedAt && <span>Coletado: {formatDate(exam.collectedAt)}</span>}
        {exam.completedAt && <span>Concluido: {formatDate(exam.completedAt)}</span>}
        {exam.cancelledAt && <span>Cancelado: {formatDate(exam.cancelledAt)}</span>}
      </div>

      {/* Result */}
      {exam.resultText && (
        <div className="pl-6 p-3 bg-green-50 border border-green-100 rounded text-sm">
          <p className="font-medium text-green-800 mb-1 flex items-center gap-1">
            <FileText className="h-3.5 w-3.5" />
            Resultado
          </p>
          <p className="text-green-700 whitespace-pre-wrap">{exam.resultText}</p>
        </div>
      )}

      {exam.resultFileUrl && (
        <div className="pl-6">
          <a
            href={exam.resultFileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:underline flex items-center gap-1"
          >
            <Paperclip className="h-3.5 w-3.5" />
            Ver arquivo em anexo
          </a>
        </div>
      )}

      {/* Actions */}
      {!readOnly && exam.status !== "Concluido" && exam.status !== "Cancelado" && (
        <div className="pl-6 flex flex-wrap gap-2 pt-1">
          {next && (
            <Button
              size="sm"
              variant="outline"
              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              onClick={() => onAdvance(exam.id, next)}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <ArrowRight className="h-3.5 w-3.5 mr-1" />
              )}
              Avancar para {next}
            </Button>
          )}
          {exam.status === "Coletado" && (
            <Button
              size="sm"
              variant="outline"
              className="text-green-600 hover:text-green-700 hover:bg-green-50"
              onClick={() => onAddResult(exam)}
            >
              <FileText className="h-3.5 w-3.5 mr-1" />
              Adicionar Resultado
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={() => onCancel(exam.id)}
            disabled={isUpdating}
          >
            <XCircle className="h-3.5 w-3.5 mr-1" />
            Cancelar
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ExamRequestWorkflow({
  patientId,
  readOnly = false,
}: ExamRequestWorkflowProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<ExamRequestCreate>(EMPTY_CREATE);

  const [resultExam, setResultExam] = useState<ExamRequest | null>(null);
  const [resultForm, setResultForm] = useState<ExamResultForm>(EMPTY_RESULT);
  const [resultFile, setResultFile] = useState<File | null>(null);

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  const queryKey = ["/api/v1/exam-requests", patientId];

  const { data: exams = [], isLoading } = useQuery<ExamRequest[]>({
    queryKey,
    queryFn: async () => {
      const res = await fetch(
        `/api/v1/exam-requests/patient/${patientId}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Falha ao buscar exames");
      return res.json();
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  // -------------------------------------------------------------------------
  // Mutations
  // -------------------------------------------------------------------------

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("POST", "/api/v1/exam-requests", data);
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Exame solicitado", description: "Solicitacao criada com sucesso." });
      setIsCreateOpen(false);
      setCreateForm(EMPTY_CREATE);
    },
    onError: (err: Error) =>
      toast({ title: "Erro ao solicitar", description: err.message, variant: "destructive" }),
  });

  const advanceMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: ExamStatus }) => {
      const res = await apiRequest("PATCH", `/api/v1/exam-requests/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Status atualizado" });
    },
    onError: (err: Error) =>
      toast({ title: "Erro ao atualizar", description: err.message, variant: "destructive" }),
  });

  const resultMutation = useMutation({
    mutationFn: async ({
      id,
      resultText,
      notes,
      file,
    }: {
      id: number;
      resultText: string;
      notes: string;
      file: File | null;
    }) => {
      const formData = new FormData();
      formData.append("resultText", resultText);
      formData.append("notes", notes);
      formData.append("status", "Concluido");
      if (file) formData.append("file", file);

      const res = await fetch(`/api/v1/exam-requests/${id}/result`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Falha ao salvar resultado");
      }
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Resultado adicionado", description: "Exame concluido." });
      setResultExam(null);
      setResultForm(EMPTY_RESULT);
      setResultFile(null);
    },
    onError: (err: Error) =>
      toast({ title: "Erro ao salvar resultado", description: err.message, variant: "destructive" }),
  });

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  function handleCreate() {
    if (!createForm.examType) {
      toast({ title: "Tipo de exame obrigatorio", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      patientId,
      examType: createForm.examType,
      description: createForm.description || null,
      notes: createForm.notes || null,
    });
  }

  function handleAdvance(id: number, nextStatus: ExamStatus) {
    advanceMutation.mutate({ id, status: nextStatus });
  }

  function handleCancel(id: number) {
    advanceMutation.mutate({ id, status: "Cancelado" });
  }

  function handleOpenResult(exam: ExamRequest) {
    setResultExam(exam);
    setResultForm(EMPTY_RESULT);
    setResultFile(null);
  }

  function handleSubmitResult() {
    if (!resultExam) return;
    resultMutation.mutate({
      id: resultExam.id,
      resultText: resultForm.resultText,
      notes: resultForm.notes,
      file: resultFile,
    });
  }

  // -------------------------------------------------------------------------
  // Group exams by status for display order
  // -------------------------------------------------------------------------

  const active = exams.filter((e) => e.status !== "Concluido" && e.status !== "Cancelado");
  const completed = exams.filter((e) => e.status === "Concluido");
  const cancelled = exams.filter((e) => e.status === "Cancelado");

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-purple-500" />
              Solicitacoes de Exames
            </CardTitle>
            <CardDescription>
              {exams.length === 0
                ? "Nenhum exame solicitado"
                : `${exams.length} solicitacao${exams.length > 1 ? "es" : ""}`}
            </CardDescription>
          </div>
          {!readOnly && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setCreateForm(EMPTY_CREATE);
                setIsCreateOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Solicitar Exame
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : exams.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
            <FlaskConical className="h-8 w-8 opacity-30" />
            <p className="text-sm">Nenhum exame solicitado para este paciente</p>
          </div>
        ) : (
          <>
            {/* Active exams */}
            {active.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Em Andamento ({active.length})
                </h4>
                {active.map((exam) => (
                  <ExamCard
                    key={exam.id}
                    exam={exam}
                    onAdvance={handleAdvance}
                    onCancel={handleCancel}
                    onAddResult={handleOpenResult}
                    isUpdating={advanceMutation.isPending}
                    readOnly={readOnly}
                  />
                ))}
              </div>
            )}

            {/* Completed exams */}
            {completed.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Concluidos ({completed.length})
                </h4>
                {completed.map((exam) => (
                  <ExamCard
                    key={exam.id}
                    exam={exam}
                    onAdvance={handleAdvance}
                    onCancel={handleCancel}
                    onAddResult={handleOpenResult}
                    isUpdating={advanceMutation.isPending}
                    readOnly={readOnly}
                  />
                ))}
              </div>
            )}

            {/* Cancelled exams */}
            {cancelled.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Cancelados ({cancelled.length})
                </h4>
                {cancelled.map((exam) => (
                  <ExamCard
                    key={exam.id}
                    exam={exam}
                    onAdvance={handleAdvance}
                    onCancel={handleCancel}
                    onAddResult={handleOpenResult}
                    isUpdating={advanceMutation.isPending}
                    readOnly={readOnly}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>

      {/* Create exam dialog */}
      <Dialog open={isCreateOpen} onOpenChange={(open) => !open && setIsCreateOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Solicitar Exame</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Tipo de Exame *</Label>
              <Select
                value={createForm.examType}
                onValueChange={(v) => setCreateForm((f) => ({ ...f, examType: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXAM_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="er-desc">Descricao / Instrucoes</Label>
              <Textarea
                id="er-desc"
                rows={2}
                placeholder="Detalhe o exame ou instrucoes para o paciente..."
                value={createForm.description}
                onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="er-notes">Observacoes Internas</Label>
              <Textarea
                id="er-notes"
                rows={2}
                placeholder="Notas para a equipe..."
                value={createForm.notes}
                onChange={(e) => setCreateForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Solicitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add result dialog */}
      <Dialog open={resultExam !== null} onOpenChange={(open) => !open && setResultExam(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Resultado — {resultExam?.examType}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="res-text">Resultado *</Label>
              <Textarea
                id="res-text"
                rows={4}
                placeholder="Descreva o resultado do exame..."
                value={resultForm.resultText}
                onChange={(e) => setResultForm((f) => ({ ...f, resultText: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="res-file">Arquivo (PDF ou imagem)</Label>
              <input
                ref={fileInputRef}
                id="res-file"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.gif"
                className="hidden"
                onChange={(e) => setResultFile(e.target.files?.[0] ?? null)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="h-4 w-4 mr-2" />
                {resultFile ? resultFile.name : "Selecionar arquivo"}
              </Button>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="res-notes">Observacoes</Label>
              <Textarea
                id="res-notes"
                rows={2}
                placeholder="Notas adicionais..."
                value={resultForm.notes}
                onChange={(e) => setResultForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setResultExam(null)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmitResult}
              disabled={resultMutation.isPending || !resultForm.resultText.trim()}
            >
              {resultMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Salvar e Concluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default ExamRequestWorkflow;
