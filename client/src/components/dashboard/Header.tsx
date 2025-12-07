import { Link, useLocation } from "wouter";
import { ChevronDown, Menu, User, Settings, LogOut, Clock, Sparkles, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { NotificationBell } from "@/components/NotificationBell";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/core/AuthProvider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// Tipo local para usuário do header (compatível com AuthProvider)
interface HeaderUser {
  id: number;
  fullName?: string;
  email?: string;
  role?: string;
  profileImageUrl?: string | null;
  trialEndsAt?: Date | string | null;
}

interface HeaderProps {
  user: HeaderUser;
  onMenuToggle?: () => void;
}

export default function Header({ user, onMenuToggle }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [, setLocation] = useLocation();

  // Try to get auth context safely for logout
  let logoutMutation = null;
  try {
    const auth = useAuth();
    logoutMutation = auth.logoutMutation;
  } catch (error) {
    // AuthContext not available, continue without logout functionality
  }

  const handleLogout = () => {
    if (logoutMutation) {
      logoutMutation.mutate();
    } else {
      // Fallback logout - redirect to login page
      window.location.href = '/login';
    }
  };

  const navigateTo = (path: string) => {
    setLocation(path);
  };

  return (
    <header className="bg-background border-b border-border shadow-sm">
      <div className="container mx-auto px-4 py-2 flex items-center justify-between">
        <div className="flex items-center">
          {/* Menu sanduíche para mobile */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden mr-2"
            onClick={onMenuToggle}
          >
            <Menu className="h-6 w-6" />
          </Button>
          
          <Link href="/dashboard" className="text-primary font-bold text-2xl">
            DentCare
          </Link>
        </div>

        <div className="flex items-center space-x-2 md:space-x-4">
          {/* Trial Badge - Melhorado */}
          {user?.trialEndsAt && (() => {
            const trialEnd = new Date(user.trialEndsAt);
            const now = new Date();
            const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            const isExpiringSoon = daysLeft <= 3 && daysLeft > 0;
            const isExpired = daysLeft <= 0;

            if (isExpired) {
              return (
                <Link href="/billing">
                  <Button variant="destructive" size="sm" className="gap-1.5 animate-pulse">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="hidden sm:inline">Trial Expirado</span>
                    <span className="sm:hidden">Expirado</span>
                  </Button>
                </Link>
              );
            }

            if (isExpiringSoon) {
              return (
                <Link href="/billing">
                  <Button variant="outline" size="sm" className="gap-1.5 border-orange-500 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950">
                    <Clock className="h-4 w-4" />
                    <span className="hidden sm:inline">{daysLeft} {daysLeft === 1 ? 'dia' : 'dias'} restantes</span>
                    <span className="sm:hidden">{daysLeft}d</span>
                  </Button>
                </Link>
              );
            }

            return (
              <Link href="/billing">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 hover:border-blue-500/40 transition-colors cursor-pointer">
                  <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span className="hidden sm:inline text-sm font-medium text-blue-700 dark:text-blue-300">
                    Trial • {daysLeft} dias
                  </span>
                  <span className="sm:hidden text-sm font-medium text-blue-700 dark:text-blue-300">
                    {daysLeft}d
                  </span>
                </div>
              </Link>
            );
          })()}

          <NotificationBell />

          {/* Temporariamente removido tema */}
          <ThemeToggle />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center text-sm font-medium text-neutral-dark hover:text-primary focus:outline-none">
                <Avatar className="h-8 w-8 mr-2">
                  <AvatarImage src={user?.profileImageUrl || ""} alt={user?.fullName || "User"} />
                  <AvatarFallback>{user?.fullName?.substring(0, 2).toUpperCase() || "U"}</AvatarFallback>
                </Avatar>
                <span className="ml-2 hidden md:block">{user?.fullName || "Usuário"}</span>
                <ChevronDown className="ml-1 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigateTo("/perfil")} className="cursor-pointer">
                <User className="mr-2 h-4 w-4" />
                Perfil
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigateTo("/configuracoes")} className="cursor-pointer">
                <Settings className="mr-2 h-4 w-4" />
                Configurações
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      {/* Em dispositivos móveis, não exibimos menu no header pois já existe no sidebar */}
    </header>
  );
}
