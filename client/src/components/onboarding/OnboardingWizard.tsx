import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Building2,
  Phone,
  MessageCircle,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Sparkles,
  QrCode,
  ExternalLink,
  Clock,
  Stethoscope,
  Users,
  Trash2,
  Plus,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getCsrfHeaders } from "@/lib/csrf";
import defaultProcedures from "@/data/default-procedures.json";

// ─── Types ─────────────────────────────────────────────────────────────────

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  completed: boolean;
}

interface OnboardingWizardProps {
  onComplete?: () => void;
}

// Working hours for one day
interface DayHours {
  active: boolean;
  start: string;
  end: string;
  breakStart: string;
  breakEnd: string;
}

type WeekHours = Record<string, DayHours>;

// A procedure card editable by the user
interface ProcedureCard {
  _key: number; // local only, no DB id yet
  name: string;
  duration: number;
  price: number;
}

// A team invite entry
interface InviteEntry {
  _key: number;
  email: string;
  role: string;
}

// ─── Defaults ──────────────────────────────────────────────────────────────

const DAY_LABELS: Record<string, string> = {
  monday: "Segunda",
  tuesday: "Terca",
  wednesday: "Quarta",
  thursday: "Quinta",
  friday: "Sexta",
  saturday: "Sabado",
  sunday: "Domingo",
};

const DAY_KEYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

function buildDefaultWeekHours(): WeekHours {
  const week: WeekHours = {};
  for (const day of DAY_KEYS) {
    if (day === "sunday") {
      week[day] = { active: false, start: "08:00", end: "18:00", breakStart: "12:00", breakEnd: "13:00" };
    } else if (day === "saturday") {
      week[day] = { active: true, start: "08:00", end: "12:00", breakStart: "", breakEnd: "" };
    } else {
      week[day] = { active: true, start: "08:00", end: "18:00", breakStart: "12:00", breakEnd: "13:00" };
    }
  }
  return week;
}

let _keyCounter = 0;
function nextKey() {
  return ++_keyCounter;
}

// ─── Component ─────────────────────────────────────────────────────────────

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  // ── Basic form data (steps 1-2) ──
  const [formData, setFormData] = useState({
    clinicName: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    state: "",
  });

  // ── Working hours (step 3) ──
  const [weekHours, setWeekHours] = useState<WeekHours>(buildDefaultWeekHours);

  // ── Procedures (step 4) ──
  const [procedures, setProcedures] = useState<ProcedureCard[]>([]);
  const [proceduresLoaded, setProceduresLoaded] = useState(false);
  const [savingProcedures, setSavingProcedures] = useState(false);

  // ── Team invites (step 5) ──
  const [invites, setInvites] = useState<InviteEntry[]>([
    { _key: nextKey(), email: "", role: "dentista" },
  ]);
  const [savingInvites, setSavingInvites] = useState(false);

  // ── Data fetching ──
  const { data: company } = useQuery<{
    name?: string;
    phone?: string;
    email?: string;
    address?: string;
  }>({
    queryKey: ["/api/user/company"],
  });

  const { data: integrations } = useQuery<{ hasWuzapiConfig?: boolean }>({
    queryKey: ["/api/v1/clinic/integrations"],
  });

  // ── Auto-open logic ──
  useEffect(() => {
    const onboardingComplete = localStorage.getItem("onboarding_complete");
    const hasShownOnboarding = sessionStorage.getItem("onboarding_shown");

    if (onboardingComplete === "true" || hasShownOnboarding === "true") {
      return;
    }

    if (company) {
      const hasBasicInfo = company.name && company.phone && company.email;
      if (!hasBasicInfo) {
        setIsOpen(true);
        sessionStorage.setItem("onboarding_shown", "true");
      }
    }
  }, [company]);

  // ── Pre-fill form ──
  useEffect(() => {
    if (company) {
      setFormData({
        clinicName: company.name || "",
        phone: company.phone || "",
        email: company.email || "",
        address: company.address || "",
        city: "",
        state: "",
      });
    }
  }, [company]);

  // ── Steps definition ──
  const steps: OnboardingStep[] = [
    {
      id: "welcome",
      title: "Bem-vindo!",
      description: "Vamos configurar sua clinica em poucos passos",
      icon: <Sparkles className="h-6 w-6" />,
      completed: true,
    },
    {
      id: "clinic-info",
      title: "Dados da Clinica",
      description: "Informacoes basicas do seu negocio",
      icon: <Building2 className="h-6 w-6" />,
      completed: !!(formData.clinicName && formData.phone),
    },
    {
      id: "contact",
      title: "Contato",
      description: "Como seus pacientes podem te encontrar",
      icon: <Phone className="h-6 w-6" />,
      completed: !!(formData.email && formData.address),
    },
    {
      id: "working-hours",
      title: "Horario de Funcionamento",
      description: "Defina os dias e horarios de atendimento",
      icon: <Clock className="h-6 w-6" />,
      completed: Object.values(weekHours).some((d) => d.active),
    },
    {
      id: "procedures",
      title: "Procedimentos",
      description: "Importe os procedimentos realizados na clinica",
      icon: <Stethoscope className="h-6 w-6" />,
      completed: proceduresLoaded,
    },
    {
      id: "team",
      title: "Equipe",
      description: "Convide colaboradores para a plataforma",
      icon: <Users className="h-6 w-6" />,
      completed: false,
    },
    {
      id: "whatsapp",
      title: "WhatsApp",
      description: "Conecte para receber mensagens",
      icon: <MessageCircle className="h-6 w-6" />,
      completed: integrations?.hasWuzapiConfig || false,
    },
    {
      id: "complete",
      title: "Pronto!",
      description: "Sua clinica esta configurada",
      icon: <CheckCircle2 className="h-6 w-6" />,
      completed: false,
    },
  ];

  const progress = ((currentStep + 1) / steps.length) * 100;

  // ── Mutations ──
  const saveCompanyMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await fetch("/api/v1/clinic/settings", {
        method: "PUT",
        headers: getCsrfHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({
          name: data.clinicName,
          phone: data.phone,
          email: data.email,
          address: `${data.address}${data.city ? `, ${data.city}` : ""}${data.state ? ` - ${data.state}` : ""}`,
        }),
      });
      if (!response.ok) throw new Error("Erro ao salvar");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/company"] });
      toast({ title: "Dados salvos!", description: "As informacoes da clinica foram atualizadas." });
    },
    onError: () => {
      toast({ title: "Erro ao salvar", description: "Tente novamente mais tarde.", variant: "destructive" });
    },
  });

  // ── Helpers for working hours ──
  function updateDay(day: string, field: keyof DayHours, value: string | boolean) {
    setWeekHours((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  }

  // ── Helpers for procedures ──
  function loadDefaultProcedures() {
    const cards: ProcedureCard[] = (defaultProcedures as Array<{ name: string; duration: number; price: number }>).map(
      (p) => ({ _key: nextKey(), name: p.name, duration: p.duration, price: p.price })
    );
    setProcedures(cards);
    setProceduresLoaded(true);
  }

  function updateProcedure(key: number, field: keyof Omit<ProcedureCard, "_key">, value: string | number) {
    setProcedures((prev) =>
      prev.map((p) => (p._key === key ? { ...p, [field]: value } : p))
    );
  }

  function removeProcedure(key: number) {
    setProcedures((prev) => prev.filter((p) => p._key !== key));
  }

  async function saveProcedures() {
    if (procedures.length === 0) return;
    setSavingProcedures(true);
    try {
      const results = await Promise.allSettled(
        procedures.map((p) =>
          fetch("/api/v1/procedures", {
            method: "POST",
            headers: getCsrfHeaders({ "Content-Type": "application/json" }),
            credentials: "include",
            body: JSON.stringify({
              name: p.name,
              duration: p.duration,
              price: String(p.price),
              isActive: true,
            }),
          })
        )
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed > 0) {
        toast({
          title: "Atencao",
          description: `${procedures.length - failed} procedimentos salvos. ${failed} falharam.`,
          variant: "destructive",
        });
      } else {
        toast({ title: "Procedimentos salvos!", description: `${procedures.length} procedimentos adicionados.` });
      }
    } finally {
      setSavingProcedures(false);
    }
  }

  // ── Helpers for team invites ──
  function addInviteRow() {
    setInvites((prev) => [...prev, { _key: nextKey(), email: "", role: "dentista" }]);
  }

  function updateInvite(key: number, field: keyof Omit<InviteEntry, "_key">, value: string) {
    setInvites((prev) =>
      prev.map((inv) => (inv._key === key ? { ...inv, [field]: value } : inv))
    );
  }

  function removeInviteRow(key: number) {
    setInvites((prev) => (prev.length > 1 ? prev.filter((inv) => inv._key !== key) : prev));
  }

  async function sendInvites() {
    const valid = invites.filter((inv) => inv.email.trim() !== "");
    if (valid.length === 0) return;
    setSavingInvites(true);
    try {
      const results = await Promise.allSettled(
        valid.map((inv) =>
          fetch("/api/v1/team/invite", {
            method: "POST",
            headers: getCsrfHeaders({ "Content-Type": "application/json" }),
            credentials: "include",
            body: JSON.stringify({ email: inv.email.trim(), role: inv.role }),
          })
        )
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed > 0) {
        toast({
          title: "Atencao",
          description: `${valid.length - failed} convites enviados. ${failed} falharam.`,
          variant: "destructive",
        });
      } else {
        toast({ title: "Convites enviados!", description: `${valid.length} convite(s) enviado(s) com sucesso.` });
      }
    } finally {
      setSavingInvites(false);
    }
  }

  // ── Navigation ──
  const handleNext = async () => {
    if (currentStep === 1 || currentStep === 2) {
      await saveCompanyMutation.mutateAsync(formData);
    }

    if (currentStep === 4 && procedures.length > 0) {
      await saveProcedures();
    }

    if (currentStep === 5) {
      const hasValidInvites = invites.some((inv) => inv.email.trim() !== "");
      if (hasValidInvites) {
        await sendInvites();
      }
    }

    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem("onboarding_complete", "true");
    setIsOpen(false);
    onComplete?.();
    toast({ title: "Configuracao completa!", description: "Sua clinica esta pronta para usar." });
  };

  const handleSkip = () => {
    localStorage.setItem("onboarding_complete", "true");
    setIsOpen(false);
  };

  const goToIntegrations = () => {
    setIsOpen(false);
    setLocation("/configuracoes/integracoes");
  };

  const isNextPending =
    saveCompanyMutation.isPending || savingProcedures || savingInvites;

  // ── Step content ──
  const renderStepContent = () => {
    switch (currentStep) {
      // ── 0: Welcome ───────────────────────────────────────────────────────
      case 0:
        return (
          <div className="text-center space-y-6 py-8">
            <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="h-10 w-10 text-white" />
            </div>
            <div>
              <h3 className="text-2xl font-bold">Bem-vindo ao DentCare!</h3>
              <p className="text-muted-foreground mt-2">
                Vamos configurar sua clinica em apenas alguns passos simples.
                Isso levara menos de 5 minutos.
              </p>
            </div>
            <div className="grid grid-cols-4 gap-3 pt-4">
              {[
                { icon: <Building2 className="h-5 w-5" />, label: "Dados da Clinica" },
                { icon: <Clock className="h-5 w-5" />, label: "Horarios" },
                { icon: <Stethoscope className="h-5 w-5" />, label: "Procedimentos" },
                { icon: <Users className="h-5 w-5" />, label: "Equipe" },
              ].map((item, i) => (
                <div key={i} className="flex flex-col items-center gap-2 p-3 rounded-lg bg-muted/50">
                  <div className="p-2 rounded-full bg-primary/10 text-primary">
                    {item.icon}
                  </div>
                  <span className="text-xs text-center">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        );

      // ── 1: Clinic Info ────────────────────────────────────────────────────
      case 1:
        return (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="clinicName">Nome da Clinica *</Label>
              <Input
                id="clinicName"
                placeholder="Ex: Clinica Odontologica Sorriso"
                value={formData.clinicName}
                onChange={(e) => setFormData({ ...formData, clinicName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone/WhatsApp *</Label>
              <Input
                id="phone"
                placeholder="+55 11 99999-9999"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Este numero sera usado para receber mensagens dos pacientes
              </p>
            </div>
          </div>
        );

      // ── 2: Contact ────────────────────────────────────────────────────────
      case 2:
        return (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail *</Label>
              <Input
                id="email"
                type="email"
                placeholder="contato@clinica.com.br"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Endereco</Label>
              <Input
                id="address"
                placeholder="Rua, numero, bairro"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="city">Cidade</Label>
                <Input
                  id="city"
                  placeholder="Sao Paulo"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">Estado</Label>
                <Input
                  id="state"
                  placeholder="SP"
                  maxLength={2}
                  value={formData.state}
                  onChange={(e) =>
                    setFormData({ ...formData, state: e.target.value.toUpperCase() })
                  }
                />
              </div>
            </div>
          </div>
        );

      // ── 3: Working Hours ──────────────────────────────────────────────────
      case 3:
        return (
          <div className="py-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Marque os dias de funcionamento e defina os horarios de atendimento.
            </p>
            {/* Header row */}
            <div className="grid grid-cols-[90px_1fr_1fr_1fr_1fr] gap-1 text-xs font-medium text-muted-foreground px-1">
              <span>Dia</span>
              <span>Abertura</span>
              <span>Fechamento</span>
              <span>Inicio Pausa</span>
              <span>Fim Pausa</span>
            </div>
            {DAY_KEYS.map((day) => {
              const d = weekHours[day];
              return (
                <div
                  key={day}
                  className={cn(
                    "grid grid-cols-[90px_1fr_1fr_1fr_1fr] gap-1 items-center p-2 rounded-lg border",
                    d.active ? "bg-background" : "bg-muted/30 opacity-60"
                  )}
                >
                  {/* Checkbox + label */}
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <Checkbox
                      checked={d.active}
                      onCheckedChange={(checked) => updateDay(day, "active", !!checked)}
                    />
                    <span className="text-sm font-medium">{DAY_LABELS[day]}</span>
                  </label>
                  {/* Start */}
                  <Input
                    type="time"
                    value={d.start}
                    disabled={!d.active}
                    className="h-8 text-xs"
                    onChange={(e) => updateDay(day, "start", e.target.value)}
                  />
                  {/* End */}
                  <Input
                    type="time"
                    value={d.end}
                    disabled={!d.active}
                    className="h-8 text-xs"
                    onChange={(e) => updateDay(day, "end", e.target.value)}
                  />
                  {/* Break start */}
                  <Input
                    type="time"
                    value={d.breakStart}
                    disabled={!d.active}
                    placeholder="--:--"
                    className="h-8 text-xs"
                    onChange={(e) => updateDay(day, "breakStart", e.target.value)}
                  />
                  {/* Break end */}
                  <Input
                    type="time"
                    value={d.breakEnd}
                    disabled={!d.active}
                    placeholder="--:--"
                    className="h-8 text-xs"
                    onChange={(e) => updateDay(day, "breakEnd", e.target.value)}
                  />
                </div>
              );
            })}
          </div>
        );

      // ── 4: Procedures ─────────────────────────────────────────────────────
      case 4:
        return (
          <div className="py-4 space-y-4">
            {procedures.length === 0 ? (
              <div className="text-center space-y-4 py-6">
                <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Stethoscope className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h4 className="font-semibold">Nenhum procedimento adicionado</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Importe os 20 procedimentos odontologicos mais comuns com um clique
                    e edite conforme necessario.
                  </p>
                </div>
                <Button onClick={loadDefaultProcedures} className="gap-2">
                  <Download className="h-4 w-4" />
                  Importar procedimentos comuns
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {procedures.length} procedimento(s) — edite ou remova conforme necessario
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs gap-1"
                    onClick={loadDefaultProcedures}
                  >
                    <Download className="h-3 w-3" />
                    Reimportar
                  </Button>
                </div>
                {/* Header */}
                <div className="grid grid-cols-[1fr_70px_80px_32px] gap-2 text-xs font-medium text-muted-foreground px-2">
                  <span>Nome</span>
                  <span>Min.</span>
                  <span>R$</span>
                  <span />
                </div>
                <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
                  {procedures.map((p) => (
                    <div
                      key={p._key}
                      className="grid grid-cols-[1fr_70px_80px_32px] gap-2 items-center bg-muted/30 rounded-lg px-2 py-1"
                    >
                      <Input
                        value={p.name}
                        className="h-7 text-sm"
                        onChange={(e) => updateProcedure(p._key, "name", e.target.value)}
                      />
                      <Input
                        type="number"
                        min={1}
                        value={p.duration}
                        className="h-7 text-sm"
                        onChange={(e) => updateProcedure(p._key, "duration", Number(e.target.value))}
                      />
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={p.price}
                        className="h-7 text-sm"
                        onChange={(e) => updateProcedure(p._key, "price", Number(e.target.value))}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => removeProcedure(p._key)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      // ── 5: Team ───────────────────────────────────────────────────────────
      case 5:
        return (
          <div className="py-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Convide membros da sua equipe. Eles receberao um e-mail com o link de acesso.
              Voce pode pular esta etapa e convidar depois nas configuracoes.
            </p>
            <div className="space-y-2">
              {invites.map((inv, idx) => (
                <div key={inv._key} className="flex gap-2 items-start">
                  <div className="flex-1 space-y-1">
                    {idx === 0 && (
                      <Label className="text-xs text-muted-foreground">E-mail</Label>
                    )}
                    <Input
                      type="email"
                      placeholder="colaborador@clinica.com"
                      value={inv.email}
                      className="h-8"
                      onChange={(e) => updateInvite(inv._key, "email", e.target.value)}
                    />
                  </div>
                  <div className="w-36 space-y-1">
                    {idx === 0 && (
                      <Label className="text-xs text-muted-foreground">Funcao</Label>
                    )}
                    <Select
                      value={inv.role}
                      onValueChange={(val) => updateInvite(inv._key, "role", val)}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dentista">Dentista</SelectItem>
                        <SelectItem value="recepcionista">Recepcionista</SelectItem>
                        <SelectItem value="assistente">Assistente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className={cn("pt-1", idx === 0 && "pt-6")}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      disabled={invites.length <= 1}
                      onClick={() => removeInviteRow(inv._key)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" className="gap-2" onClick={addInviteRow}>
              <Plus className="h-4 w-4" />
              Adicionar outro
            </Button>
          </div>
        );

      // ── 6: WhatsApp ───────────────────────────────────────────────────────
      case 6:
        return (
          <div className="space-y-6 py-4">
            {integrations?.hasWuzapiConfig ? (
              <div className="text-center space-y-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-lg">WhatsApp Conectado!</h4>
                  <p className="text-muted-foreground text-sm">
                    Sua clinica ja esta recebendo mensagens via WhatsApp.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 rounded-lg border-2 border-dashed border-muted-foreground/25 text-center">
                  <QrCode className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <h4 className="font-medium">Conectar WhatsApp</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Conecte seu WhatsApp para receber e enviar mensagens automaticamente.
                  </p>
                </div>
                <Button onClick={goToIntegrations} className="w-full" variant="outline">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Ir para Configuracoes de Integracao
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  Voce pode fazer isso depois nas configuracoes
                </p>
              </div>
            )}
          </div>
        );

      // ── 7: Complete ───────────────────────────────────────────────────────
      case 7:
        return (
          <div className="text-center space-y-6 py-8">
            <div className="mx-auto w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <div>
              <h3 className="text-2xl font-bold">Tudo Pronto!</h3>
              <p className="text-muted-foreground mt-2">
                Sua clinica esta configurada. Comece a agendar pacientes,
                gerenciar prontuarios e muito mais.
              </p>
            </div>
            {/* Checklist summary */}
            <div className="text-left space-y-2 pt-2">
              {[
                { label: "Dados da clinica", done: !!(formData.clinicName && formData.phone) },
                { label: "Contato e endereco", done: !!(formData.email && formData.address) },
                { label: "Horario de funcionamento", done: Object.values(weekHours).some((d) => d.active) },
                { label: "Procedimentos cadastrados", done: proceduresLoaded && procedures.length > 0 },
                { label: "Equipe convidada", done: invites.some((inv) => inv.email.trim() !== "") },
                { label: "WhatsApp conectado", done: !!(integrations?.hasWuzapiConfig) },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2 text-sm">
                  <CheckCircle2
                    className={cn(
                      "h-4 w-4 flex-shrink-0",
                      item.done ? "text-green-500" : "text-muted-foreground/40"
                    )}
                  />
                  <span className={item.done ? "" : "text-muted-foreground"}>{item.label}</span>
                </div>
              ))}
            </div>
            <div className="space-y-3 pt-4">
              <Button onClick={handleComplete} className="w-full" size="lg">
                <Sparkles className="h-4 w-4 mr-2" />
                Comecar a Usar
              </Button>
            </div>
          </div>
        );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className={cn("sm:max-w-lg", currentStep === 3 && "sm:max-w-2xl")}>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "p-2 rounded-full",
                  currentStep === steps.length - 1
                    ? "bg-green-100 text-green-600"
                    : "bg-primary/10 text-primary"
                )}
              >
                {steps[currentStep]?.icon}
              </div>
              <div>
                <DialogTitle>{steps[currentStep]?.title}</DialogTitle>
                <DialogDescription>{steps[currentStep]?.description}</DialogDescription>
              </div>
            </div>
            <span className="text-sm text-muted-foreground">
              {currentStep + 1}/{steps.length}
            </span>
          </div>
          <Progress value={progress} className="mt-4" />
        </DialogHeader>

        {renderStepContent()}

        {/* Navigation */}
        {currentStep < steps.length - 1 && (
          <div className="flex justify-between pt-4 border-t">
            <div>
              {currentStep > 0 && (
                <Button variant="ghost" onClick={handleBack} disabled={isNextPending}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={handleSkip}
                className="text-muted-foreground"
                disabled={isNextPending}
              >
                Pular
              </Button>
              <Button onClick={handleNext} disabled={isNextPending}>
                {isNextPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                {currentStep === 0 ? "Comecar" : "Proximo"}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default OnboardingWizard;
