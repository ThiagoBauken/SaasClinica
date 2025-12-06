import { useState } from "react";
import { Link } from "wouter";
import MiniCalendar from "@/components/calendar/MiniCalendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useModules } from "@/hooks/use-modules";
import { useAuth } from "@/core/AuthProvider";
import { useMenuPermissions } from "@/hooks/use-menu-permissions";
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
  CalendarDays,
  CreditCard,
  Plug,
  MessageCircle,
  Target,
  BarChart3,
  FileText,
  AlertTriangle
} from "lucide-react";

interface SidebarProps {
  currentPath: string;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function Sidebar({ currentPath, isMobileOpen, onMobileClose }: SidebarProps) {
  const { dynamicMenuItems, isLoading } = useModules();
  const { user } = useAuth();
  const userRole = user?.role || 'staff';
  const { permissions, isLoading: permissionsLoading } = useMenuPermissions();

  // Menu estático como fallback
  const fallbackMenuItems = [
    { label: 'Agenda', path: '/schedule', icon: 'Calendar' },
    { label: 'Agenda Modular', path: '/schedule-modular', icon: 'CalendarDays' },
    { label: 'Pacientes', path: '/patients', icon: 'Users' },
    { label: 'Financeiro', path: '/financial', icon: 'DollarSign' },
    { label: 'Automações', path: '/automation', icon: 'Bot' },
    { label: 'Próteses', path: '/prosthesis', icon: 'Scissors' },
    { label: 'Estoque', path: '/inventory', icon: 'Package' },
    { label: 'Odontograma', path: '/odontogram-demo', icon: 'Activity' },
  ];

  // Priorizar permissões do banco, depois menu dinâmico, depois fallback
  const menuItems = permissions.length > 0
    ? permissions
      .filter(p => p.canView) // Apenas itens que o usuário pode visualizar
      .sort((a, b) => a.order - b.order)
    : (dynamicMenuItems && dynamicMenuItems.length > 0)
      ? dynamicMenuItems
      : fallbackMenuItems;
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
    Building2,
    MessageCircle,
    Target,
    BarChart3,
    FileText,
    AlertTriangle
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

        {/* Atendimento WhatsApp */}
        <Link href="/atendimento" className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg ${currentPath === "/atendimento" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"}`} onClick={onMobileClose}>
          <MessageCircle className="mr-3 h-5 w-5" />
          Atendimento
        </Link>

        {/* Menu dinâmico com fallback automático */}
        {(!isLoading && !permissionsLoading) && menuItems.map((item, index) => {
          const IconComponent = iconMap[item.icon as keyof typeof iconMap] || Settings;
          return (
            <Link
              key={`menu-${item.path}-${index}`}
              href={item.path}
              className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg ${currentPath === item.path ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"}`}
              onClick={onMobileClose}
            >
              <IconComponent className="mr-3 h-5 w-5" />
              {item.label}
            </Link>
          );
        })}

        {/* CRM - Funil de Vendas */}
        <Link href="/crm" className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg ${currentPath === "/crm" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"}`} onClick={onMobileClose}>
          <Target className="mr-3 h-5 w-5" />
          CRM
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
        <Link href="/billing" className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg ${currentPath === "/billing" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"}`} onClick={onMobileClose}>
          <CreditCard className="mr-3 h-5 w-5" />
          Assinatura
        </Link>

        {/* Seção de Administração - Apenas para admin e superadmin */}
        {(userRole === 'admin' || userRole === 'superadmin') && (
          <>
            <div className="mt-6 mb-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4">
                Administração
              </h3>
            </div>

            {/* Admin SaaS - Apenas para superadmin */}
            {userRole === 'superadmin' && (
              <Link href="/saas-admin" className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg ${currentPath === "/saas-admin" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"}`} onClick={onMobileClose}>
                <Shield className="mr-3 h-5 w-5" />
                Admin SaaS
              </Link>
            )}

            {/* Admin Clínica - Para admin e superadmin */}
            <Link href="/company-admin" className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg ${currentPath === "/company-admin" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"}`} onClick={onMobileClose}>
              <Settings className="mr-3 h-5 w-5" />
              Admin Clínica
            </Link>

            {/* Permissões - Para admin e superadmin */}
            <Link href="/permissions" className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg ${currentPath === "/permissions" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"}`} onClick={onMobileClose}>
              <Shield className="mr-3 h-5 w-5" />
              Permissões
            </Link>

            {/* Integrações - Para admin e superadmin */}
            <Link href="/integracoes" className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg ${currentPath === "/integracoes" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"}`} onClick={onMobileClose}>
              <Plug className="mr-3 h-5 w-5" />
              Integrações
            </Link>

            {/* Analytics - Para admin e superadmin */}
            <Link href="/analytics" className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg ${currentPath === "/analytics" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"}`} onClick={onMobileClose}>
              <BarChart3 className="mr-3 h-5 w-5" />
              Analytics
            </Link>
          </>
        )}
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
