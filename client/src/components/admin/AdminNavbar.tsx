import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { 
  Building2, 
  Users, 
  Settings, 
  Home, 
  Calendar,
  FileText,
  BarChart3,
  LogOut,
  ChevronDown
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface AdminNavbarProps {
  type: 'saas' | 'company';
  currentUser?: { name: string; role: string };
}

export default function AdminNavbar({ type, currentUser }: AdminNavbarProps) {
  const [location] = useLocation();

  const saasMenuItems = [
    { href: "/admin/saas", icon: Building2, label: "Empresas", description: "Gerenciar empresas" },
    { href: "/admin/saas/modules", icon: Settings, label: "Módulos", description: "Módulos globais" },
    { href: "/admin/saas/analytics", icon: BarChart3, label: "Analytics", description: "Relatórios SaaS" },
  ];

  const companyMenuItems = [
    { href: "/admin/company", icon: Users, label: "Usuários", description: "Gerenciar usuários" },
    { href: "/admin/company/permissions", icon: Settings, label: "Permissões", description: "Controle de acesso" },
    { href: "/admin/company/modules", icon: FileText, label: "Módulos", description: "Módulos da empresa" },
  ];

  const menuItems = type === 'saas' ? saasMenuItems : companyMenuItems;
  const title = type === 'saas' ? 'Admin SaaS' : 'Admin Empresa';

  return (
    <nav className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center space-x-8">
          {/* Logo/Title */}
          <Link href={type === 'saas' ? '/admin/saas' : '/admin/company'}>
            <div className="flex items-center space-x-2 cursor-pointer hover:opacity-80">
              {type === 'saas' ? (
                <Building2 className="h-8 w-8 text-blue-600" />
              ) : (
                <Users className="h-8 w-8 text-green-600" />
              )}
              <span className="text-xl font-bold text-gray-900">{title}</span>
            </div>
          </Link>

          {/* Navigation Menu */}
          <div className="hidden md:flex items-center space-x-1">
            {menuItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={location === item.href ? "default" : "ghost"}
                  className="flex items-center space-x-2"
                  size="sm"
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Button>
              </Link>
            ))}
          </div>
        </div>

        {/* User Menu */}
        <div className="flex items-center space-x-4">
          <Link href="/">
            <Button variant="ghost" size="sm" className="flex items-center space-x-2">
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </Button>
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center space-x-2">
                <div className="text-right hidden sm:block">
                  <div className="text-sm font-medium">
                    {currentUser?.name || 'Admin'}
                  </div>
                  <div className="text-xs text-gray-500 capitalize">
                    {currentUser?.role || (type === 'saas' ? 'SaaS Admin' : 'Company Admin')}
                  </div>
                </div>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                <span>Configurações</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-600">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sair</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Mobile Menu */}
        <div className="md:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <Settings className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {menuItems.map((item) => (
                <Link key={item.href} href={item.href}>
                  <DropdownMenuItem>
                    <item.icon className="mr-2 h-4 w-4" />
                    <div>
                      <div className="font-medium">{item.label}</div>
                      <div className="text-xs text-gray-500">{item.description}</div>
                    </div>
                  </DropdownMenuItem>
                </Link>
              ))}
              <DropdownMenuSeparator />
              <Link href="/">
                <DropdownMenuItem>
                  <Home className="mr-2 h-4 w-4" />
                  <span>Dashboard Principal</span>
                </DropdownMenuItem>
              </Link>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  );
}