import { Link } from "wouter";
import DashboardLayout from "@/layouts/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Settings, 
  Building2, 
  FileText, 
  Users2, 
  Paperclip, 
  CreditCard,
  BarChart,
  Wrench,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ConfiguracoesPage() {
  // Configuração simplificada com links para páginas específicas
  const configCards = [
    { 
      title: "Dados da Clínica", 
      icon: <Building2 className="h-8 w-8 text-primary" />,
      description: "Configure informações básicas, endereço e horário de funcionamento da clínica", 
      href: "/configuracoes/clinica" 
    },
    { 
      title: "Nota Fiscal",
      icon: <FileText className="h-8 w-8 text-primary" />, 
      description: "Configure integração com sistemas de Nota Fiscal Eletrônica",
      href: "/configuracoes/fiscal" 
    },
    { 
      title: "Equipe e Permissões", 
      icon: <Users2 className="h-8 w-8 text-primary" />,
      description: "Gerencie profissionais, suas permissões e acessos ao sistema",
      href: "/configuracoes/equipe" 
    },
    { 
      title: "Comissões", 
      icon: <CreditCard className="h-8 w-8 text-primary" />,
      description: "Configure as regras de comissão para cada profissional",
      href: "/configuracoes/comissoes" 
    },
    { 
      title: "Taxas de Cartão", 
      icon: <BarChart className="h-8 w-8 text-primary" />,
      description: "Configure taxas de máquinas de cartão e regras de desconto",
      href: "/configuracoes/taxas" 
    },
    { 
      title: "Modelos de Documentos", 
      icon: <Paperclip className="h-8 w-8 text-primary" />,
      description: "Gerencie modelos de termos, laudos e documentos da clínica",
      href: "/configuracoes/modelos" 
    },
    { 
      title: "Sistema", 
      icon: <Settings className="h-8 w-8 text-primary" />,
      description: "Configure opções gerais, backup e integrações do sistema",
      href: "/configuracoes/sistema" 
    },
    { 
      title: "Manutenção", 
      icon: <Wrench className="h-8 w-8 text-primary" />,
      description: "Ferramentas de manutenção, limpeza de cache e diagnóstico",
      href: "/configuracoes/manutencao" 
    }
  ];

  return (
    <DashboardLayout title="Configurações" currentPath="/configuracoes">
      <div className="flex flex-col space-y-6 p-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {configCards.map((card, index) => (
            <Link key={index} href={card.href}>
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
                    <Link href={card.href}>Configurar</Link>
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