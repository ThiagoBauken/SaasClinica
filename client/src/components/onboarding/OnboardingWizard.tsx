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
import { useToast } from "@/hooks/use-toast";
import {
  Building2,
  Phone,
  MessageCircle,
  Workflow,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Sparkles,
  MapPin,
  Mail,
  QrCode,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    clinicName: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    state: "",
  });

  // Fetch company data
  const { data: company } = useQuery({
    queryKey: ["/api/user/company"],
  });

  // Fetch integration settings
  const { data: integrations } = useQuery({
    queryKey: ["/api/v1/clinic/integrations"],
  });

  // Check if onboarding was completed
  useEffect(() => {
    const onboardingComplete = localStorage.getItem("onboarding_complete");
    const hasShownOnboarding = sessionStorage.getItem("onboarding_shown");

    // Se já completou ou já mostrou nesta sessão, não mostra
    if (onboardingComplete === "true" || hasShownOnboarding === "true") {
      return;
    }

    // Verificar se a empresa tem informações básicas preenchidas
    if (company) {
      const hasBasicInfo = company.name && company.phone && company.email;
      if (!hasBasicInfo) {
        setIsOpen(true);
        sessionStorage.setItem("onboarding_shown", "true");
      }
    }
  }, [company]);

  // Pre-fill form with company data
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

  const steps: OnboardingStep[] = [
    {
      id: "welcome",
      title: "Bem-vindo!",
      description: "Vamos configurar sua clínica em poucos passos",
      icon: <Sparkles className="h-6 w-6" />,
      completed: true,
    },
    {
      id: "clinic-info",
      title: "Dados da Clínica",
      description: "Informações básicas do seu negócio",
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
      id: "whatsapp",
      title: "WhatsApp",
      description: "Conecte para receber mensagens",
      icon: <MessageCircle className="h-6 w-6" />,
      completed: integrations?.hasWuzapiConfig || false,
    },
    {
      id: "complete",
      title: "Pronto!",
      description: "Sua clínica está configurada",
      icon: <CheckCircle2 className="h-6 w-6" />,
      completed: false,
    },
  ];

  const progress = ((currentStep + 1) / steps.length) * 100;

  // Save company mutation
  const saveCompanyMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await fetch("/api/v1/clinic/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
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
      toast({
        title: "Dados salvos!",
        description: "As informações da clínica foram atualizadas.",
      });
    },
    onError: () => {
      toast({
        title: "Erro ao salvar",
        description: "Tente novamente mais tarde.",
        variant: "destructive",
      });
    },
  });

  const handleNext = async () => {
    // Save data when leaving clinic-info or contact step
    if (currentStep === 1 || currentStep === 2) {
      await saveCompanyMutation.mutateAsync(formData);
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
    toast({
      title: "Configuracao completa!",
      description: "Sua clinica esta pronta para usar.",
    });
  };

  const handleSkip = () => {
    localStorage.setItem("onboarding_complete", "true");
    setIsOpen(false);
  };

  const goToIntegrations = () => {
    setIsOpen(false);
    setLocation("/configuracoes/integracoes");
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Welcome
        return (
          <div className="text-center space-y-6 py-8">
            <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="h-10 w-10 text-white" />
            </div>
            <div>
              <h3 className="text-2xl font-bold">Bem-vindo ao DentCare!</h3>
              <p className="text-muted-foreground mt-2">
                Vamos configurar sua clinica em apenas 3 passos simples.
                Isso levara menos de 2 minutos.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-4 pt-4">
              {[
                { icon: <Building2 className="h-5 w-5" />, label: "Dados da Clinica" },
                { icon: <Phone className="h-5 w-5" />, label: "Contato" },
                { icon: <MessageCircle className="h-5 w-5" />, label: "WhatsApp" },
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

      case 1: // Clinic Info
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

      case 2: // Contact
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
                  onChange={(e) => setFormData({ ...formData, state: e.target.value.toUpperCase() })}
                />
              </div>
            </div>
          </div>
        );

      case 3: // WhatsApp
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

      case 4: // Complete
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-full",
                currentStep === steps.length - 1 ? "bg-green-100 text-green-600" : "bg-primary/10 text-primary"
              )}>
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
                <Button variant="ghost" onClick={handleBack}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={handleSkip} className="text-muted-foreground">
                Pular
              </Button>
              <Button onClick={handleNext} disabled={saveCompanyMutation.isPending}>
                {saveCompanyMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
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
