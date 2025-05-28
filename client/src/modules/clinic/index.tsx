import { lazy } from "react";
import { Calendar, Users, DollarSign, Bot, Scissors, Activity } from "lucide-react";
import { FrontendModuleInfo } from "@/core/moduleLoader";

// Lazy loading das páginas do módulo
const SchedulePage = lazy(() => import("@/pages/schedule-page"));
const PatientsPage = lazy(() => import("@/pages/patients-page"));
const FinancialPage = lazy(() => import("@/pages/financial-page"));
const AutomationPage = lazy(() => import("@/pages/automation-page"));
const ProsthesisControlPage = lazy(() => import("@/pages/prosthesis-control-page"));
const OdontogramDemo = lazy(() => import("@/pages/odontogram-demo"));

const clinicModule: FrontendModuleInfo = {
  name: "clinic",
  displayName: "Sistema Clínico",
  description: "Módulo completo para gestão de clínicas odontológicas",
  version: "1.0.0",
  isEnabled: true,
  routes: [
    {
      path: "/schedule",
      component: SchedulePage,
      requiredPermissions: ["clinic.schedule.read"],
    },
    {
      path: "/patients",
      component: PatientsPage,
      requiredPermissions: ["clinic.patients.read"],
    },
    {
      path: "/financial",
      component: FinancialPage,
      requiredPermissions: ["clinic.financial.read"],
    },
    {
      path: "/automation",
      component: AutomationPage,
      requiredPermissions: ["clinic.automation.read"],
    },
    {
      path: "/prosthesis",
      component: ProsthesisControlPage,
      requiredPermissions: ["clinic.prosthesis.read"],
    },
    {
      path: "/odontogram-demo",
      component: OdontogramDemo,
      requiredPermissions: ["clinic.odontogram.read"],
    },
  ],
  menuItems: [
    {
      path: "/schedule",
      label: "Agenda",
      icon: Calendar,
      order: 1,
      requiredPermissions: ["clinic.schedule.read"],
    },
    {
      path: "/patients",
      label: "Pacientes",
      icon: Users,
      order: 2,
      requiredPermissions: ["clinic.patients.read"],
    },
    {
      path: "/financial",
      label: "Financeiro",
      icon: DollarSign,
      order: 3,
      requiredPermissions: ["clinic.financial.read"],
    },
    {
      path: "/automation",
      label: "Automações",
      icon: Bot,
      order: 4,
      requiredPermissions: ["clinic.automation.read"],
    },
    {
      path: "/prosthesis",
      label: "Controle de Próteses",
      icon: Scissors,
      order: 5,
      requiredPermissions: ["clinic.prosthesis.read"],
    },
    {
      path: "/odontogram-demo",
      label: "Odontograma",
      icon: Activity,
      order: 6,
      requiredPermissions: ["clinic.odontogram.read"],
    },
  ],
};

export default clinicModule;