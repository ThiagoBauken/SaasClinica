import { Link } from "wouter";
import { Bell, ChevronDown, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { User } from "@shared/schema";
import { useState } from "react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
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
// import { ThemeToggle } from "@/components/theme/theme-toggle";

interface HeaderProps {
  user: User;
  onMenuToggle?: () => void;
}

export default function Header({ user, onMenuToggle }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
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
      // Fallback logout - redirect to auth page
      window.location.href = '/auth';
    }
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
          {user?.trialEndsAt && new Date(user.trialEndsAt) > new Date() && (
            <div className="hidden md:flex items-center mr-2">
              <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full mr-2">
                Teste Gratuito
              </span>
              <span className="text-sm text-gray-500">
                Expira em{" "}
                {Math.ceil((new Date(user.trialEndsAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))}{" "}
                dias
              </span>
            </div>
          )}
          
          <Button variant="ghost" size="icon" className="text-neutral-dark hover:bg-neutral-lightest rounded-full">
            <Bell className="h-6 w-6" />
          </Button>
          
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
              <DropdownMenuItem>Perfil</DropdownMenuItem>
              <DropdownMenuItem>Configurações</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>Sair</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      {/* Em dispositivos móveis, não exibimos menu no header pois já existe no sidebar */}
    </header>
  );
}
