/**
 * Patient Self-Service Portal Page
 *
 * Public page — no auth required.
 * Accessed via tokenized link: /portal/:token
 *
 * Sections:
 *  1. Proximas Consultas
 *  2. Receitas e Atestados
 *  3. Planos de Tratamento
 *  4. Pagamentos Recentes
 */

import { useEffect, useState } from "react";
import { useParams } from "wouter";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import {
  Calendar,
  FileText,
  CreditCard,
  Activity,
  Download,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  Stethoscope,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ClinicInfo {
  name: string;
  logo: string | null;
}

interface PatientInfo {
  fullName: string;
  email: string | null;
  phone: string | null;
}

interface UpcomingAppointment {
  id: number;
  date: string;
  time: string | null;
  professional: string | null;
  speciality: string | null;
  procedure: string;
  status: string;
}

interface Prescription {
  id: number;
  type: string;
  title: string;
  issuedAt: string | null;
  signedPdfUrl: string | null;
  digitallySigned: boolean | null;
  medications: unknown;
  instructions: string | null;
  validUntil: string | null;
}

interface Payment {
  id: number;
  date: string;
  description: string;
  amount: number;
  paymentMethod: string | null;
  status: string;
}

interface TreatmentPlan {
  id: number;
  name: string;
  status: string;
  totalAmount: number;
  paidAmount: number;
  discountAmount: number;
  remainingAmount: number;
  startDate: string | null;
  completedDate: string | null;
}

interface PortalData {
  clinic: ClinicInfo;
  patient: PatientInfo;
  upcomingAppointments: UpcomingAppointment[];
  prescriptions: Prescription[];
  recentPayments: Payment[];
  treatmentPlans: TreatmentPlan[];
}

// ─── Formatters ──────────────────────────────────────────────────────────────

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ─── Badge helpers ───────────────────────────────────────────────────────────

const APPOINTMENT_STATUS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  scheduled:   { label: "Agendado",    variant: "outline" },
  confirmed:   { label: "Confirmado",  variant: "default" },
  arrived:     { label: "Chegou",      variant: "secondary" },
  in_progress: { label: "Em andamento",variant: "secondary" },
  completed:   { label: "Concluido",   variant: "default" },
  cancelled:   { label: "Cancelado",   variant: "destructive" },
  no_show:     { label: "Nao compareceu", variant: "destructive" },
};

const PRESCRIPTION_TYPE: Record<string, { label: string; className: string }> = {
  receita:     { label: "Receita",     className: "bg-blue-100 text-blue-800" },
  atestado:    { label: "Atestado",    className: "bg-green-100 text-green-800" },
  declaracao:  { label: "Declaracao",  className: "bg-purple-100 text-purple-800" },
};

const PLAN_STATUS: Record<string, { label: string; className: string }> = {
  proposed:    { label: "Proposto",     className: "bg-yellow-100 text-yellow-800" },
  approved:    { label: "Aprovado",     className: "bg-blue-100 text-blue-800" },
  in_progress: { label: "Em andamento", className: "bg-indigo-100 text-indigo-800" },
  completed:   { label: "Concluido",    className: "bg-green-100 text-green-800" },
  cancelled:   { label: "Cancelado",    className: "bg-red-100 text-red-800" },
};

const PAYMENT_METHOD: Record<string, string> = {
  cash:          "Dinheiro",
  credit_card:   "Cartao credito",
  debit_card:    "Cartao debito",
  pix:           "PIX",
  bank_transfer: "Transferencia",
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  title,
}: {
  icon: React.ElementType;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon className="h-5 w-5 text-blue-600 shrink-0" />
      <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <p className="text-sm text-gray-400 py-6 text-center">{message}</p>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function PatientPortalPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PortalData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setError("Link invalido.");
      setLoading(false);
      return;
    }

    fetch(`/api/public/portal/${token}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) {
          setError(json.error || "Nao foi possivel carregar os dados.");
        } else {
          setData(json as PortalData);
        }
      })
      .catch(() => setError("Erro de conexao. Tente novamente."))
      .finally(() => setLoading(false));
  }, [token]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <p className="text-sm">Carregando seu portal...</p>
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <Card className="max-w-md w-full shadow-sm">
          <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4 text-center">
            <AlertCircle className="h-12 w-12 text-red-400" />
            <div>
              <h1 className="text-xl font-semibold text-gray-800 mb-1">Link indisponivel</h1>
              <p className="text-sm text-gray-500">{error || "Nao foi possivel carregar os dados."}</p>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Se precisar de ajuda, entre em contato diretamente com a clinica.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { clinic, patient, upcomingAppointments, prescriptions, recentPayments, treatmentPlans } = data;
  const firstName = patient.fullName?.split(" ")[0] || "Paciente";

  // ── Portal ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-5 flex items-center gap-3">
          {clinic.logo ? (
            <img
              src={clinic.logo}
              alt={clinic.name}
              className="h-10 w-10 rounded-full object-cover border border-gray-200"
            />
          ) : (
            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
              <Stethoscope className="h-5 w-5 text-blue-600" />
            </div>
          )}
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium leading-none mb-0.5">
              Portal do Paciente
            </p>
            <p className="text-base font-semibold text-gray-800 leading-tight">{clinic.name}</p>
          </div>
        </div>
      </div>

      {/* Greeting */}
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-2">
        <h1 className="text-2xl font-bold text-gray-900">
          Ola, {firstName}!
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Aqui voce pode consultar seus dados, receitas e agendamentos.
        </p>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 pb-12 space-y-5 mt-4">

        {/* ── Section 1: Proximas Consultas ─────────────────────────────────── */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2 pt-5 px-5">
            <SectionHeader icon={Calendar} title="Proximas Consultas" />
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {upcomingAppointments.length === 0 ? (
              <EmptyState message="Nenhuma consulta agendada nos proximos 30 dias." />
            ) : (
              <div className="space-y-3">
                {upcomingAppointments.map((appt) => {
                  const statusInfo = APPOINTMENT_STATUS[appt.status] ?? {
                    label: appt.status,
                    variant: "outline" as const,
                  };
                  return (
                    <div
                      key={appt.id}
                      className="flex items-start justify-between gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex flex-col items-center bg-blue-50 rounded-md px-2.5 py-1.5 min-w-[52px] text-center">
                          <span className="text-xs font-medium text-blue-600 leading-none">
                            {new Date(appt.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "")}
                          </span>
                          <span className="text-xs text-blue-400 mt-0.5 leading-none">
                            {appt.time ?? "—"}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-800 leading-tight">
                            {appt.procedure}
                          </p>
                          {appt.professional && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              {appt.professional}
                              {appt.speciality ? ` · ${appt.speciality}` : ""}
                            </p>
                          )}
                        </div>
                      </div>
                      <Badge variant={statusInfo.variant} className="text-xs shrink-0 mt-0.5">
                        {statusInfo.label}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Section 2: Receitas e Atestados ──────────────────────────────── */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2 pt-5 px-5">
            <SectionHeader icon={FileText} title="Receitas e Atestados" />
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {prescriptions.length === 0 ? (
              <EmptyState message="Nenhuma receita ou atestado disponivel." />
            ) : (
              <div className="space-y-3">
                {prescriptions.map((rx) => {
                  const typeInfo = PRESCRIPTION_TYPE[rx.type] ?? {
                    label: rx.type,
                    className: "bg-gray-100 text-gray-700",
                  };
                  return (
                    <div
                      key={rx.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${typeInfo.className}`}
                          >
                            {typeInfo.label}
                          </span>
                          {rx.digitallySigned && (
                            <span className="inline-flex items-center gap-0.5 text-xs text-green-600">
                              <CheckCircle className="h-3 w-3" />
                              Assinado
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-gray-800 mt-1 truncate">
                          {rx.title}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {rx.issuedAt ? formatDate(rx.issuedAt) : "—"}
                          {rx.validUntil ? ` · Valido ate ${formatDate(rx.validUntil)}` : ""}
                        </p>
                      </div>
                      {rx.signedPdfUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="shrink-0 text-xs gap-1.5"
                          asChild
                        >
                          <a href={rx.signedPdfUrl} target="_blank" rel="noopener noreferrer">
                            <Download className="h-3.5 w-3.5" />
                            Baixar PDF
                          </a>
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Section 3: Planos de Tratamento ──────────────────────────────── */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2 pt-5 px-5">
            <SectionHeader icon={Activity} title="Planos de Tratamento" />
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {treatmentPlans.length === 0 ? (
              <EmptyState message="Nenhum plano de tratamento encontrado." />
            ) : (
              <div className="space-y-4">
                {treatmentPlans.map((plan) => {
                  const planStatusInfo = PLAN_STATUS[plan.status] ?? {
                    label: plan.status,
                    className: "bg-gray-100 text-gray-700",
                  };
                  const progress =
                    plan.totalAmount > 0
                      ? Math.min(100, Math.round((plan.paidAmount / plan.totalAmount) * 100))
                      : 0;

                  return (
                    <div
                      key={plan.id}
                      className="p-3 rounded-lg bg-gray-50 border border-gray-100 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-gray-800 leading-tight flex-1">
                          {plan.name}
                        </p>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ${planStatusInfo.className}`}
                        >
                          {planStatusInfo.label}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>
                            Pago: {formatCurrency(plan.paidAmount)}
                          </span>
                          <span>
                            Total: {formatCurrency(plan.totalAmount)}
                          </span>
                        </div>
                        <Progress value={progress} className="h-2" />
                        <p className="text-xs text-gray-400">
                          {progress}% concluido
                          {plan.remainingAmount > 0
                            ? ` · Restam ${formatCurrency(plan.remainingAmount)}`
                            : " · Quitado"}
                        </p>
                      </div>

                      {plan.startDate && (
                        <p className="text-xs text-gray-400 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Inicio: {formatDate(plan.startDate)}
                          {plan.completedDate
                            ? ` · Concluido: ${formatDate(plan.completedDate)}`
                            : ""}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Section 4: Pagamentos Recentes ────────────────────────────────── */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2 pt-5 px-5">
            <SectionHeader icon={CreditCard} title="Pagamentos Recentes" />
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {recentPayments.length === 0 ? (
              <EmptyState message="Nenhum pagamento nos ultimos 6 meses." />
            ) : (
              <div className="overflow-x-auto -mx-1">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs pl-1">Data</TableHead>
                      <TableHead className="text-xs">Descricao</TableHead>
                      <TableHead className="text-xs">Forma</TableHead>
                      <TableHead className="text-xs text-right pr-1">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentPayments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="text-xs text-gray-600 pl-1 whitespace-nowrap">
                          {formatDate(payment.date)}
                        </TableCell>
                        <TableCell className="text-xs text-gray-700 max-w-[140px] truncate">
                          {payment.description}
                        </TableCell>
                        <TableCell className="text-xs text-gray-500 whitespace-nowrap">
                          {payment.paymentMethod
                            ? PAYMENT_METHOD[payment.paymentMethod] ?? payment.paymentMethod
                            : "—"}
                        </TableCell>
                        <TableCell className="text-xs font-medium text-gray-800 text-right pr-1 whitespace-nowrap">
                          {formatCurrency(payment.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <Separator />
        <p className="text-center text-xs text-gray-400 pb-4">
          Este portal e exclusivo para voce. Nao compartilhe este link.
          <br />
          Em caso de duvidas, entre em contato com a clinica.
        </p>
      </div>
    </div>
  );
}
