import { useState } from "react";
import { Link } from "wouter";
import MiniCalendar from "@/components/calendar/MiniCalendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useModules } from "@/hooks/use-modules";
import { 
  Search, 
  LayoutDashboard, 
  Calendar, 
  Users, 
  DollarSign, 
  Bot, 
  Scissors, 
  Activity, 
  Package, 
  PackageOpen,
  Settings,
  BoxSelect,
  Shield,
  Building2,
  CalendarDays
} from "lucide-react";

interface SidebarProps {
  currentPath: string;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function Sidebar({ currentPath, isMobileOpen, onMobileClose }: SidebarProps) {
  // Temporariamente desabilitado o sistema modular dinâmico para evitar loops
  // const { dynamicMenuItems, isLoading } = useModules();
  const [filters, setFilters] = useState({
    status: "all",
    professional: "all",
    patient: "",
    procedure: "all",
    room: "all",
  });

  const handleFilterChange = (field: keyof typeof filters, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const clearFilters = () => {
    setFilters({
      status: "all",
      professional: "all",
      patient: "",
      procedure: "all",
      room: "all",
    });
  };

  // Mapeamento de ícones
  const iconMap = {
    Calendar,
    CalendarDays,
    Users,
    DollarSign,
    Package,
    Scissors,
    Activity,
    Bot,
    LayoutDashboard,
    Settings,
    BoxSelect,
    Shield,
    Building2
  };

  // Menu de navegação com links dinâmicos
  const navigationMenu = (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-foreground mb-4 px-4">Menu</h2>
      <nav className="space-y-1">
        {/* Dashboard sempre visível */}
        <Link href="/dashboard" className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg ${currentPath === "/dashboard" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"}`} onClick={onMobileClose}>
          <LayoutDashboard className="mr-3 h-5 w-5" />
          Dashboard
        </Link>
        
        {/* Menu estático funcional */}
        <Link href="/schedule" className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg ${currentPath === "/schedule" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"}`} onClick={onMobileClose}>
          <Calendar className="mr-3 h-5 w-5" />
          Agenda
        </Link>
        <Link href="/patients" className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg ${currentPath === "/patients" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"}`} onClick={onMobileClose}>
          <Users className="mr-3 h-5 w-5" />
          Pacientes
        </Link>
        <Link href="/financial" className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg ${currentPath === "/financial" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"}`} onClick={onMobileClose}>
          <DollarSign className="mr-3 h-5 w-5" />
          Financeiro
        </Link>
        <Link href="/automation" className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg ${currentPath === "/automation" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"}`} onClick={onMobileClose}>
          <Bot className="mr-3 h-5 w-5" />
          Automações
        </Link>
        <Link href="/prosthesis" className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg ${currentPath === "/prosthesis" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"}`} onClick={onMobileClose}>
          <Scissors className="mr-3 h-5 w-5" />
          Controle de Próteses
        </Link>
        <Link href="/inventory" className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg ${currentPath === "/inventory" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"}`} onClick={onMobileClose}>
          <Package className="mr-3 h-5 w-5" />
          Controle de Estoque
        </Link>
        <Link href="/odontogram-demo" className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg ${currentPath === "/odontogram-demo" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"}`} onClick={onMobileClose}>
          <Activity className="mr-3 h-5 w-5" />
          Odontograma
        </Link>

        {/* Menu estático de apoio */}
        <Link href="/cadastros" className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg ${currentPath === "/cadastros" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"}`} onClick={onMobileClose}>
          <BoxSelect className="mr-3 h-5 w-5" />
          Cadastros
        </Link>
        <Link href="/configuracoes" className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg ${currentPath === "/configuracoes" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"}`} onClick={onMobileClose}>
          <Settings className="mr-3 h-5 w-5" />
          Configurações
        </Link>
        
        {/* Seção de Administração */}
        <div className="mt-6 mb-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4">
            Administração
          </h3>
        </div>
        <Link href="/saas-admin" className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg ${currentPath === "/saas-admin" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"}`} onClick={onMobileClose}>
          <Shield className="mr-3 h-5 w-5" />
          Admin SaaS
        </Link>
        <Link href="/company-admin" className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg ${currentPath === "/company-admin" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"}`} onClick={onMobileClose}>
          <Settings className="mr-3 h-5 w-5" />
          Admin Clínica
        </Link>
      </nav>
    </div>
  );

  // Definição de calendário vazia, removemos o conteúdo para adicionar à página de agenda
  const calendarContent = null;

  return (
    <>
      {/* Sidebar para desktop */}
      <aside className="w-64 bg-background border-r border-border h-full overflow-y-auto hidden md:block">
        <div className="py-6">
          {navigationMenu}
        </div>
      </aside>

      {/* Menu móvel usando Sheet */}
      <Sheet open={isMobileOpen} onOpenChange={onMobileClose}>
        <SheetContent side="left" className="w-64 p-0">
          <div className="py-6">
            {navigationMenu}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
