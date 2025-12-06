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
  Calendar,
  Bell,
  Database,
  Palette,
  MessageSquare,
  DollarSign,
  ClipboardList,
  Lock,
  Printer
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
      icon: <Building2 className="h-5 w-5 text-blue-500" />,
      path: "/configuracoes/clinica",
      category: "geral"
    },
    {
      title: "Horários de Funcionamento",
      description: "Dias e horários de atendimento",
      icon: <Clock className="h-5 w-5 text-green-500" />,
      path: "/configuracoes/horarios",
      category: "geral"
    },
    {
      title: "Integrações",
      description: "WhatsApp, Google Calendar e N8N",
      icon: <Wrench className="h-5 w-5 text-orange-500" />,
      path: "/configuracoes/integracoes",
      category: "sistema"
    },
    {
      title: "Usuários e Permissões",
      description: "Gerenciar equipe e acessos",
      icon: <Users2 className="h-5 w-5 text-purple-500" />,
      path: "/configuracoes/usuarios",
      category: "sistema"
    },
    {
      title: "Procedimentos",
      description: "Catálogo de serviços e preços",
      icon: <ClipboardList className="h-5 w-5 text-cyan-500" />,
      path: "/configuracoes/procedimentos",
      category: "clinico"
    },
    {
      title: "Salas e Consultórios",
      description: "Recursos físicos da clínica",
      icon: <MapPin className="h-5 w-5 text-teal-500" />,
      path: "/configuracoes/salas",
      category: "clinico"
    },
    {
      title: "Notificações",
      description: "Alertas e lembretes automáticos",
      icon: <Bell className="h-5 w-5 text-yellow-500" />,
      path: "/configuracoes/notificacoes",
      category: "comunicacao"
    },
    {
      title: "Mensagens Automáticas",
      description: "Templates de WhatsApp e SMS",
      icon: <MessageSquare className="h-5 w-5 text-green-600" />,
      path: "/configuracoes/chat",
      category: "comunicacao"
    },
    {
      title: "Financeiro",
      description: "Formas de pagamento e taxas",
      icon: <DollarSign className="h-5 w-5 text-emerald-500" />,
      path: "/configuracoes/financeiro",
      category: "financeiro"
    },
    {
      title: "Impressão",
      description: "Modelos de documentos e recibos",
      icon: <Printer className="h-5 w-5 text-gray-500" />,
      path: "/configuracoes/impressao",
      category: "documentos"
    },
    {
      title: "Aparência",
      description: "Tema e personalização visual",
      icon: <Palette className="h-5 w-5 text-pink-500" />,
      path: "/configuracoes/aparencia",
      category: "sistema"
    },
    {
      title: "Backup e Dados",
      description: "Exportação e restauração",
      icon: <Database className="h-5 w-5 text-indigo-500" />,
      path: "/configuracoes/backup",
      category: "sistema"
    }
  ];

  // Agrupar cards por categoria
  const cardsByCategory = {
    geral: configCards.filter(c => c.category === "geral"),
    clinico: configCards.filter(c => c.category === "clinico"),
    comunicacao: configCards.filter(c => c.category === "comunicacao"),
    financeiro: configCards.filter(c => c.category === "financeiro"),
    sistema: configCards.filter(c => c.category === "sistema"),
    documentos: configCards.filter(c => c.category === "documentos"),
  };

  const categoryLabels: Record<string, string> = {
    geral: "Geral",
    clinico: "Clínico",
    comunicacao: "Comunicação",
    financeiro: "Financeiro",
    sistema: "Sistema",
    documentos: "Documentos",
  };

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
      <div className="flex flex-col space-y-8">
        {/* Seção Geral */}
        {cardsByCategory.geral.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Settings className="h-5 w-5 text-muted-foreground" />
              {categoryLabels.geral}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {cardsByCategory.geral.map((card: any, index: number) => (
                <Link key={index} href={card.path}>
                  <Card className="h-full hover:shadow-md transition-all cursor-pointer border-muted hover:border-primary group">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="p-2 rounded-lg bg-muted/50 group-hover:bg-primary/10 transition-colors">
                          {card.icon}
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <CardTitle className="text-lg mt-3">{card.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-sm">{card.description}</CardDescription>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Seção Clínico */}
        {cardsByCategory.clinico.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-muted-foreground" />
              {categoryLabels.clinico}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {cardsByCategory.clinico.map((card: any, index: number) => (
                <Link key={index} href={card.path}>
                  <Card className="h-full hover:shadow-md transition-all cursor-pointer border-muted hover:border-primary group">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="p-2 rounded-lg bg-muted/50 group-hover:bg-primary/10 transition-colors">
                          {card.icon}
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <CardTitle className="text-lg mt-3">{card.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-sm">{card.description}</CardDescription>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Seção Comunicação */}
        {cardsByCategory.comunicacao.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-muted-foreground" />
              {categoryLabels.comunicacao}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {cardsByCategory.comunicacao.map((card: any, index: number) => (
                <Link key={index} href={card.path}>
                  <Card className="h-full hover:shadow-md transition-all cursor-pointer border-muted hover:border-primary group">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="p-2 rounded-lg bg-muted/50 group-hover:bg-primary/10 transition-colors">
                          {card.icon}
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <CardTitle className="text-lg mt-3">{card.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-sm">{card.description}</CardDescription>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Seção Financeiro */}
        {cardsByCategory.financeiro.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
              {categoryLabels.financeiro}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {cardsByCategory.financeiro.map((card: any, index: number) => (
                <Link key={index} href={card.path}>
                  <Card className="h-full hover:shadow-md transition-all cursor-pointer border-muted hover:border-primary group">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="p-2 rounded-lg bg-muted/50 group-hover:bg-primary/10 transition-colors">
                          {card.icon}
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <CardTitle className="text-lg mt-3">{card.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-sm">{card.description}</CardDescription>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Seção Documentos */}
        {cardsByCategory.documentos.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              {categoryLabels.documentos}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {cardsByCategory.documentos.map((card: any, index: number) => (
                <Link key={index} href={card.path}>
                  <Card className="h-full hover:shadow-md transition-all cursor-pointer border-muted hover:border-primary group">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="p-2 rounded-lg bg-muted/50 group-hover:bg-primary/10 transition-colors">
                          {card.icon}
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <CardTitle className="text-lg mt-3">{card.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-sm">{card.description}</CardDescription>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Seção Sistema */}
        {cardsByCategory.sistema.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Wrench className="h-5 w-5 text-muted-foreground" />
              {categoryLabels.sistema}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {cardsByCategory.sistema.map((card: any, index: number) => (
                <Link key={index} href={card.path}>
                  <Card className="h-full hover:shadow-md transition-all cursor-pointer border-muted hover:border-primary group">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="p-2 rounded-lg bg-muted/50 group-hover:bg-primary/10 transition-colors">
                          {card.icon}
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <CardTitle className="text-lg mt-3">{card.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-sm">{card.description}</CardDescription>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </DashboardLayout>
  );
}