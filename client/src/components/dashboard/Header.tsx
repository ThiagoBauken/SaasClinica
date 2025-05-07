import { Link } from "wouter";
import { Bell, ChevronDown, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { User } from "@shared/schema";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface HeaderProps {
  user: User;
}

export default function Header({ user }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { logoutMutation } = useAuth();

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <header className="bg-white border-b border-neutral-light shadow-sm">
      <div className="container mx-auto px-4 py-2 flex items-center justify-between">
        <div className="flex items-center">
          <Link href="/" className="text-primary font-bold text-2xl">
            DentCare
          </Link>

          <div className="ml-8 hidden md:flex space-x-4">
            <Link href="/" className={`text-neutral-dark font-medium px-3 py-2 rounded-md hover:bg-neutral-lightest ${location.pathname === "/" ? "text-primary border-b-2 border-primary" : ""}`}>
              Dashboard
            </Link>
            <Link href="/schedule" className={`text-neutral-dark font-medium px-3 py-2 rounded-md hover:bg-neutral-lightest ${location.pathname === "/schedule" ? "text-primary border-b-2 border-primary" : ""}`}>
              Agenda
            </Link>
            <Link href="/patients" className={`text-neutral-dark font-medium px-3 py-2 rounded-md hover:bg-neutral-lightest ${location.pathname === "/patients" ? "text-primary border-b-2 border-primary" : ""}`}>
              Pacientes
            </Link>
            <Link href="/financial" className={`text-neutral-dark font-medium px-3 py-2 rounded-md hover:bg-neutral-lightest ${location.pathname === "/financial" ? "text-primary border-b-2 border-primary" : ""}`}>
              Financeiro
            </Link>
            <Link href="/automation" className={`text-neutral-dark font-medium px-3 py-2 rounded-md hover:bg-neutral-lightest ${location.pathname === "/automation" ? "text-primary border-b-2 border-primary" : ""}`}>
              Automações
            </Link>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {user.trialEndsAt && new Date(user.trialEndsAt) > new Date() && (
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

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center text-sm font-medium text-neutral-dark hover:text-primary focus:outline-none">
                <Avatar className="h-8 w-8 mr-2">
                  <AvatarImage src={user.profileImageUrl || ""} alt={user.fullName} />
                  <AvatarFallback>{user.fullName.substring(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="ml-2 hidden md:block">{user.fullName}</span>
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
      
      {/* Mobile menu */}
      <div className={`md:hidden ${mobileMenuOpen ? "block" : "hidden"}`}>
        <div className="px-2 pt-2 pb-3 space-y-1">
          <Link href="/" className={`block px-3 py-2 rounded-md text-base font-medium ${location.pathname === "/" ? "text-primary bg-neutral-lightest" : "text-neutral-dark"}`}>
            Dashboard
          </Link>
          <Link href="/schedule" className={`block px-3 py-2 rounded-md text-base font-medium ${location.pathname === "/schedule" ? "text-primary bg-neutral-lightest" : "text-neutral-dark"}`}>
            Agenda
          </Link>
          <Link href="/patients" className={`block px-3 py-2 rounded-md text-base font-medium ${location.pathname === "/patients" ? "text-primary bg-neutral-lightest" : "text-neutral-dark"}`}>
            Pacientes
          </Link>
          <Link href="/financial" className={`block px-3 py-2 rounded-md text-base font-medium ${location.pathname === "/financial" ? "text-primary bg-neutral-lightest" : "text-neutral-dark"}`}>
            Financeiro
          </Link>
          <Link href="/automation" className={`block px-3 py-2 rounded-md text-base font-medium ${location.pathname === "/automation" ? "text-primary bg-neutral-lightest" : "text-neutral-dark"}`}>
            Automações
          </Link>
        </div>
      </div>
    </header>
  );
}
