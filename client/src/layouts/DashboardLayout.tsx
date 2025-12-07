import { ReactNode, useState, useMemo } from "react";
import Header from "@/components/dashboard/Header";
import Sidebar from "@/components/dashboard/Sidebar";
import { useAuth } from "@/core/AuthProvider";
import { ChevronRight, Home } from "lucide-react";
import { Link } from "wouter";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { TrialGuard } from "@/components/TrialGuard";

// Mapeamento de paths para nomes amigáveis
const pathLabels: Record<string, string> = {
  "": "Início",
  "dashboard": "Dashboard",
  "agenda": "Agenda",
  "pacientes": "Pacientes",
  "financeiro": "Financeiro",
  "prontuario": "Prontuário",
  "estoque": "Estoque",
  "configuracoes": "Configurações",
  "settings": "Configurações",
  "integracoes": "Integrações",
  "automacao": "Automação",
  "laboratorio": "Laboratório",
  "proteses": "Próteses",
  "analytics": "Analytics",
  "crm": "CRM",
  "chat": "Chat",
  "billing": "Faturamento",
};

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
  currentPath: string;
}

export default function DashboardLayout({ children, title, currentPath }: DashboardLayoutProps) {
  const { user } = useAuth();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleMenuToggle = () => {
    setIsMobileMenuOpen(prev => !prev);
  };

  const handleMobileMenuClose = () => {
    setIsMobileMenuOpen(false);
  };

  // Gerar breadcrumbs a partir do currentPath
  const breadcrumbs = useMemo(() => {
    const pathSegments = currentPath.split("/").filter(Boolean);
    const crumbs: { label: string; path: string; isLast: boolean }[] = [];

    let accumulatedPath = "";
    pathSegments.forEach((segment, index) => {
      accumulatedPath += `/${segment}`;
      const label = pathLabels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);
      crumbs.push({
        label,
        path: accumulatedPath,
        isLast: index === pathSegments.length - 1,
      });
    });

    return crumbs;
  }, [currentPath]);

  return (
    <TrialGuard>
      <div className="min-h-screen flex flex-col">
        {/* Onboarding Wizard - Aparece para novos usuarios */}
        <OnboardingWizard />

        <Header user={user!} onMenuToggle={handleMenuToggle} />

        <div className="flex-1 flex overflow-hidden">
          <Sidebar
            currentPath={currentPath}
            isMobileOpen={isMobileMenuOpen}
            onMobileClose={handleMobileMenuClose}
          />

          <main className="flex-1 overflow-y-auto bg-background">
            <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-6">
              {/* Breadcrumbs */}
              {breadcrumbs.length > 0 && (
                <nav className="flex items-center text-sm text-muted-foreground mb-2" aria-label="Breadcrumb">
                  <Link href="/dashboard" className="hover:text-foreground transition-colors">
                    <Home className="h-4 w-4" />
                  </Link>
                  {breadcrumbs.map((crumb, index) => (
                    <span key={crumb.path} className="flex items-center">
                      <ChevronRight className="h-4 w-4 mx-1" />
                      {crumb.isLast ? (
                        <span className="text-foreground font-medium">{crumb.label}</span>
                      ) : (
                        <Link href={crumb.path} className="hover:text-foreground transition-colors">
                          {crumb.label}
                        </Link>
                      )}
                    </span>
                  ))}
                </nav>
              )}

              <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-4 sm:mb-6">{title}</h1>
              {children}
            </div>
          </main>
        </div>
      </div>
    </TrialGuard>
  );
}
