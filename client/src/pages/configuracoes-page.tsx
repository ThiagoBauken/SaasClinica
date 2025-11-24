import { useState } from "react";
import { Link } from "wouter";
import DashboardLayout from "@/layouts/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ConfigCard } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Settings, 
  Building2, 
  FileText, 
  Users2, 
  Paperclip, 
  CreditCard,
  BarChart,
  Wrench,
  ArrowRight,
  Save,
  Plus,
  Edit,
  Trash2,
  UserPlus,
  Shield,
  Clock,
  MapPin,
  Phone,
  Mail,
  Globe,
  Stethoscope,
  User,
  Calendar
} from "lucide-react";

export default function ConfiguracoesPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("clinica");
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [showProfessionalDialog, setShowProfessionalDialog] = useState(false);
  const [showProcedureDialog, setShowProcedureDialog] = useState(false);

  const configCards: any[] = [
    {
      title: "Dados da Clínica",
      description: "Informações básicas e contato",
      icon: <Building2 className="h-5 w-5" />,
      path: "/configuracoes/clinica"
    },
    {
      title: "Integrações",
      description: "Wuzapi, Google Calendar e N8N",
      icon: <Wrench className="h-5 w-5" />,
      path: "/configuracoes/integracoes"
    }
  ];

  // Mock data for demonstration
  const [clinicData, setClinicData] = useState({
    name: "DentCare Clínica Odontológica",
    cnpj: "12.345.678/0001-90",
    address: "Rua das Flores, 123",
    neighborhood: "Centro",
    city: "São Paulo",
    state: "SP",
    zipCode: "01234-567",
    phone: "(11) 99999-9999",
    email: "contato@dentcare.com.br",
    website: "www.dentcare.com.br",
    workingHours: "08:00 - 18:00",
    workingDays: "Segunda a Sexta"
  });

  const [users, setUsers] = useState([
    { id: 1, name: "Dr. João Silva", email: "joao@dentcare.com", role: "admin", specialty: "Ortodontia", active: true },
    { id: 2, name: "Dra. Maria Santos", email: "maria@dentcare.com", role: "dentist", specialty: "Endodontia", active: true },
    { id: 3, name: "Ana Costa", email: "ana@dentcare.com", role: "staff", specialty: "Recepção", active: true }
  ]);

  const [procedures, setProcedures] = useState([
    { id: 1, name: "Consulta", price: 150.00, duration: 30, category: "Geral" },
    { id: 2, name: "Limpeza", price: 120.00, duration: 45, category: "Preventiva" },
    { id: 3, name: "Obturação", price: 200.00, duration: 60, category: "Restauradora" },
    { id: 4, name: "Canal", price: 800.00, duration: 90, category: "Endodontia" }
  ]);

  const [rooms, setRooms] = useState([
    { id: 1, name: "Consultório 1", type: "Geral", equipment: "Cadeira odontológica, Raio-X", active: true },
    { id: 2, name: "Consultório 2", type: "Cirurgia", equipment: "Cadeira cirúrgica, Sugador", active: true },
    { id: 3, name: "Sala de Raio-X", type: "Diagnóstico", equipment: "Aparelho de Raio-X digital", active: true }
  ]);

  const handleSaveClinic = () => {
    toast({
      title: "Dados salvos",
      description: "As informações da clínica foram atualizadas com sucesso.",
    });
  };

  return (
    <DashboardLayout title="Configurações" currentPath="/configuracoes">
      <div className="flex flex-col space-y-6 p-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {configCards.map((card: any, index: number) => (
            <Link key={index} href={card.path}>
              <Card className="h-full hover:shadow-md transition-shadow cursor-pointer border-muted hover:border-primary">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    {card.icon}
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <CardTitle className="text-xl mt-2">{card.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm">{card.description}</CardDescription>
                  <Button variant="link" className="p-0 h-auto mt-2 text-primary" asChild>
                    <Link href={card.path}>Configurar</Link>
                  </Button>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}