import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useAuth } from "@/core/AuthProvider";
import {
  LayoutDashboard,
  Calendar,
  Users,
  DollarSign,
  Bot,
  Scissors,
  Package,
  Settings,
  BoxSelect,
  Shield,
  CreditCard,
  Plug,
  MessageCircle,
  Target,
  BarChart3,
  Video,
  MessageSquare,
  FlaskConical,
  HelpCircle,
  Sparkles
} from "lucide-react";

interface SidebarProps {
  currentPath: string;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function Sidebar({ currentPath, isMobileOpen, onMobileClose }: SidebarProps) {
  const { user } = useAuth();
  const userRole = user?.role || 'staff';

  // Contagem de chats que precisam atenção (badge no menu)
  const { data: chatCounts } = useQuery<{ unreadCount: number; waitingHuman: number; active: number }>({
    queryKey: ['chat-unread-count'],
    queryFn: async () => {
      const res = await fetch('/api/v1/chat/unread-count', { credentials: 'include' });
      if (!res.ok) return { unreadCount: 0, waitingHuman: 0, active: 0 };
      return res.json();
    },
    refetchInterval: 15000,
    staleTime: 10000,
  });

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

        {/* Agenda */}
        <Link href="/agenda" data-tour="sidebar-agenda" className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg ${currentPath === "/agenda" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"}`} onClick={onMobileClose}>
          <Calendar className="mr-3 h-5 w-5" />
          Agenda
        </Link>

        {/* Atendimento WhatsApp */}
        <Link href="/atendimento" data-tour="sidebar-atendimento" className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg ${currentPath === "/atendimento" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"}`} onClick={onMobileClose}>
          <MessageCircle className="mr-3 h-5 w-5" />
          Atendimento
          {(chatCounts?.unreadCount ?? 0) > 0 && (
            <span className="ml-auto flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[11px] font-bold rounded-full bg-red-500 text-white">
              {chatCounts!.unreadCount > 99 ? '99+' : chatCounts!.unreadCount}
            </span>
          )}
        </Link>

        {/* Pacientes */}
        <Link href="/patients" data-tour="sidebar-patients" className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg ${currentPath === "/patients" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"}`} onClick={onMobileClose}>
          <Users className="mr-3 h-5 w-5" />
          Pacientes
        </Link>

        {/* Financeiro */}
        <Link href="/financial" data-tour="sidebar-financial" className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg ${currentPath === "/financial" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"}`} onClick={onMobileClose}>
          <DollarSign className="mr-3 h-5 w-5" />
          Financeiro
        </Link>

        {/* CRM */}
        <Link href="/crm" className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg ${currentPath === "/crm" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"}`} onClick={onMobileClose}>
          <Target className="mr-3 h-5 w-5" />
          CRM
        </Link>

        {/* Automações */}
        <Link href="/automation" className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg ${currentPath === "/automation" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"}`} onClick={onMobileClose}>
          <Bot className="mr-3 h-5 w-5" />
          Automações
        </Link>

        {/* Pacotes Estéticos */}
        <Link href="/pacotes-esteticos" className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg ${currentPath === "/pacotes-esteticos" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"}`} onClick={onMobileClose}>
          <Sparkles className="mr-3 h-5 w-5" />
          Estetica
        </Link>

        {/* Próteses */}
        <Link href="/prosthesis" className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg ${currentPath === "/prosthesis" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"}`} onClick={onMobileClose}>
          <Scissors className="mr-3 h-5 w-5" />
          Próteses
        </Link>

        {/* Estoque */}
        <Link href="/inventory" className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg ${currentPath === "/inventory" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"}`} onClick={onMobileClose}>
          <Package className="mr-3 h-5 w-5" />
          Estoque
        </Link>

        {/* Assistente IA */}
        <Link href="/configuracoes/ia" className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg ${currentPath === "/configuracoes/ia" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"}`} onClick={onMobileClose}>
          <Bot className="mr-3 h-5 w-5" />
          Assistente IA
        </Link>

        {/* Teleconsulta */}
        <Link href="/teleconsulta" className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg ${currentPath === "/teleconsulta" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"}`} onClick={onMobileClose}>
          <Video className="mr-3 h-5 w-5" />
          Teleconsulta
        </Link>

        {/* Chat Interno */}
        <Link href="/chat-interno" className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg ${currentPath === "/chat-interno" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"}`} onClick={onMobileClose}>
          <MessageSquare className="mr-3 h-5 w-5" />
          Chat Interno
        </Link>

        {/* Pagamentos */}
        <Link href="/pagamentos-paciente" className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg ${currentPath === "/pagamentos-paciente" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"}`} onClick={onMobileClose}>
          <CreditCard className="mr-3 h-5 w-5" />
          Pagamentos
        </Link>

        {/* Laboratório */}
        <Link href="/laboratorio" className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg ${currentPath === "/laboratorio" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"}`} onClick={onMobileClose}>
          <FlaskConical className="mr-3 h-5 w-5" />
          Laboratório
        </Link>

        {/* Relatórios */}
        <Link href="/relatorios" className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg ${currentPath === "/relatorios" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"}`} onClick={onMobileClose}>
          <BarChart3 className="mr-3 h-5 w-5" />
          Relatórios
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
        <Link href="/ajuda" className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg ${currentPath === "/ajuda" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"}`} onClick={onMobileClose}>
          <HelpCircle className="mr-3 h-5 w-5" />
          Ajuda
        </Link>

        {/* Seção de Administração - Apenas para admin e superadmin */}
        {(userRole === 'admin' || userRole === 'superadmin') && (
          <>
            <div className="mt-6 mb-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4">
                Administração
              </h3>
            </div>

            {/* SuperAdmin - Apenas para superadmin */}
            {userRole === 'superadmin' && (
              <>
                <Link href="/superadmin" className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg ${currentPath === "/superadmin" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"}`} onClick={onMobileClose}>
                  <Shield className="mr-3 h-5 w-5" />
                  SuperAdmin
                </Link>
                <Link href="/saas-admin" className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg ${currentPath === "/saas-admin" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"}`} onClick={onMobileClose}>
                  <Shield className="mr-3 h-5 w-5" />
                  Admin SaaS
                </Link>
              </>
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
