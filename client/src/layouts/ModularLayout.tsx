import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/core/AuthProvider';
import { useActiveModules } from '@/core/ModuleLoader';
import { Button } from '@/components/ui/button';
import { 
  Calendar, 
  Users, 
  DollarSign, 
  Package, 
  Settings, 
  Activity, 
  Bot, 
  Scissors,
  Menu,
  LogOut,
  Building2,
  Shield
} from 'lucide-react';

const moduleIcons = {
  agenda: Calendar,
  pacientes: Users,
  financeiro: DollarSign,
  estoque: Package,
  proteses: Scissors,
  odontograma: Activity,
  automacoes: Bot,
  clinica: Settings
};

interface MenuItem {
  id: string;
  label: string;
  path: string;
  icon: any;
  permissions?: string[];
}

export default function ModularLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { modules, isLoading } = useActiveModules();

  // Gerar menu dinâmico baseado nos módulos ativos
  const menuItems: MenuItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      path: '/dashboard',
      icon: Activity
    },
    // Gerar itens de menu baseado nos módulos carregados
    ...modules.map(module => ({
      id: module.definition.id,
      label: module.definition.displayName,
      path: `/${module.definition.id}`,
      icon: moduleIcons[module.definition.id as keyof typeof moduleIcons] || Settings,
      permissions: module.definition.permissions
    }))
  ];

  // Adicionar itens administrativos baseado no role
  if (user?.role === 'superadmin') {
    menuItems.push({
      id: 'superadmin',
      label: 'SuperAdmin',
      path: '/superadmin',
      icon: Shield
    });
  }

  if (user?.role === 'admin') {
    menuItems.push({
      id: 'admin',
      label: 'Admin Empresa',
      path: '/admin',
      icon: Building2
    });
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className={`bg-white shadow-lg transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-16'}`}>
        <div className="p-4">
          <div className="flex items-center justify-between">
            <h1 className={`font-bold text-xl text-blue-600 ${!sidebarOpen && 'hidden'}`}>
              Sistema Odonto
            </h1>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <nav className="mt-6">
          {isLoading ? (
            <div className="px-4 py-2 text-sm text-gray-500">
              Carregando módulos...
            </div>
          ) : (
            menuItems.map((item) => {
              const IconComponent = item.icon;
              const isActive = location === item.path;
              
              return (
                <Link key={item.id} href={item.path}>
                  <div className={`
                    flex items-center px-4 py-3 mx-2 rounded-lg cursor-pointer transition-colors
                    ${isActive 
                      ? 'bg-blue-100 text-blue-600 border-r-2 border-blue-600' 
                      : 'text-gray-600 hover:bg-gray-100'
                    }
                  `}>
                    <IconComponent className="h-5 w-5" />
                    {sidebarOpen && (
                      <span className="ml-3 font-medium">{item.label}</span>
                    )}
                  </div>
                </Link>
              );
            })
          )}
        </nav>

        {/* User info and logout */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t">
          {sidebarOpen && user && (
            <div className="mb-3">
              <p className="text-sm font-medium text-gray-900">{user.fullName}</p>
              <p className="text-xs text-gray-500">{user.role}</p>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="w-full justify-start"
          >
            <LogOut className="h-4 w-4" />
            {sidebarOpen && <span className="ml-2">Sair</span>}
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}