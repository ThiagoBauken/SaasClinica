import { useState } from "react";
import { Link } from "wouter";
import MiniCalendar from "@/components/calendar/MiniCalendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
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
  BoxSelect
} from "lucide-react";

interface SidebarProps {
  currentPath: string;
}

export default function Sidebar({ currentPath }: SidebarProps) {
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

  // Menu de navegação com links
  const navigationMenu = (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-foreground mb-4 px-4">Menu</h2>
      <nav className="space-y-1">
        <Link href="/dashboard" className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg ${currentPath === "/dashboard" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"}`}>
          <LayoutDashboard className="mr-3 h-5 w-5" />
          Dashboard
        </Link>
        <Link href="/schedule" className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg ${currentPath === "/schedule" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"}`}>
          <Calendar className="mr-3 h-5 w-5" />
          Agenda
        </Link>
        <Link href="/patients" className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg ${currentPath === "/patients" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"}`}>
          <Users className="mr-3 h-5 w-5" />
          Pacientes
        </Link>
        <Link href="/financial" className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg ${currentPath === "/financial" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"}`}>
          <DollarSign className="mr-3 h-5 w-5" />
          Financeiro
        </Link>
        <Link href="/automation" className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg ${currentPath === "/automation" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"}`}>
          <Bot className="mr-3 h-5 w-5" />
          Automações
        </Link>
        <Link href="/prosthesis" className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg ${currentPath === "/prosthesis" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"}`}>
          <Scissors className="mr-3 h-5 w-5" />
          Controle de Próteses
        </Link>
        <Link href="/inventory" className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg ${currentPath === "/inventory" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"}`}>
          <PackageOpen className="mr-3 h-5 w-5" />
          Controle de Estoque
        </Link>
        <Link href="/odontogram-demo" className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg ${currentPath === "/odontogram-demo" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"}`}>
          <Activity className="mr-3 h-5 w-5" />
          Odontograma
        </Link>
      </nav>
    </div>
  );

  // Definição de calendário vazia, removemos o conteúdo para adicionar à página de agenda
  const calendarContent = null;

  return (
    <aside className="w-64 bg-background border-r border-border h-full overflow-y-auto hidden md:block">
      <div className="py-6">
        {navigationMenu}
      </div>
    </aside>
  );
}
