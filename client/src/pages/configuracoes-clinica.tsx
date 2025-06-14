import { useState, useEffect } from "react";
import DashboardLayout from "@/layouts/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useClinicSettings } from "@/hooks/use-clinic-settings";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { 
  Loader2, 
  Building, 
  Globe, 
  Palette, 
  Eye, 
  Phone, 
  MessageCircle, 
  Upload, 
  Search,
  Trash2,
  Edit3,
  Plus,
  Save,
  Share2
} from "lucide-react";

export default function ConfiguracoesClinicaPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("clinic");
  
  const { 
    clinicSettings, 
    isLoading, 
    updateClinicSettings,
    isUpdating 
  } = useClinicSettings();
  
  // Formulário da clínica
  const [form, setForm] = useState({
    name: "",
    tradingName: "",
    cnpj: "",
    responsible: "",
    email: "",
    phone: "",
    cellphone: "",
    openingTime: "08:00",
    closingTime: "18:00",
    timeZone: "America/Sao_Paulo",
    address: "",
    neighborhood: "",
    city: "",
    state: "SP",
    zipCode: "",
    complement: "",
    number: "",
    logo: "",
    receiptPrintEnabled: false,
    receiptHeader: "",
    receiptFooter: ""
  });

  // Estado para o criador de sites
  const [websiteData, setWebsiteData] = useState({
    template: 'modern',
    content: {
      title: 'Minha Clínica Odontológica',
      subtitle: 'Cuidando do seu sorriso com excelência',
      about: {
        title: 'Sobre Nossa Clínica',
        description: 'Oferecemos tratamentos odontológicos de qualidade com tecnologia avançada e atendimento humanizado.'
      },
      services: [
        { name: 'Limpeza e Profilaxia', description: 'Limpeza profissional completa', price: 'R$ 80,00' },
        { name: 'Restaurações', description: 'Tratamento de cáries e restaurações', price: 'R$ 150,00' },
        { name: 'Clareamento Dental', description: 'Clareamento profissional', price: 'R$ 300,00' }
      ]
    },
    design: {
      primaryColor: '#0066cc',
      secondaryColor: '#f8f9fa',
      accentColor: '#28a745'
    },
    contact: {
      phone: '',
      whatsapp: '',
      email: '',
      address: '',
      hours: 'Segunda a Sexta: 8:00 - 18:00'
    },
    gallery: [],
    seo: {
      title: '',
      description: '',
      keywords: ''
    },
    isPublished: false,
    domain: ''
  });

  const [websiteActiveTab, setWebsiteActiveTab] = useState('template');
  const [newService, setNewService] = useState({ name: '', description: '', price: '' });

  // Queries e mutations para o criador de sites
  const { data: savedWebsite } = useQuery({
    queryKey: ['/api/website'],
    enabled: activeTab === 'website'
  });

  const saveWebsiteMutation = useMutation({
    mutationFn: (data: any) => 
      fetch('/api/website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).then(res => res.json()),
    onSuccess: () => {
      toast({ title: 'Site salvo com sucesso!' });
      queryClient.invalidateQueries({ queryKey: ['/api/website'] });
    }
  });

  const publishWebsiteMutation = useMutation({
    mutationFn: () => 
      fetch('/api/website/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }).then(res => res.json()),
    onSuccess: () => {
      toast({ title: 'Site publicado com sucesso!', description: 'Seu site está disponível online.' });
      queryClient.invalidateQueries({ queryKey: ['/api/website'] });
    }
  });
  
  // Atualiza o formulário quando os dados são carregados
  useEffect(() => {
    if (clinicSettings) {
      setForm({
        name: clinicSettings.name || "",
        tradingName: clinicSettings.tradingName || "",
        cnpj: clinicSettings.cnpj || "",
        responsible: clinicSettings.responsible || "",
        email: clinicSettings.email || "",
        phone: clinicSettings.phone || "",
        cellphone: clinicSettings.cellphone || "",
        openingTime: clinicSettings.openingTime || "08:00",
        closingTime: clinicSettings.closingTime || "18:00",
        timeZone: clinicSettings.timeZone || "America/Sao_Paulo",
        address: clinicSettings.address || "",
        neighborhood: clinicSettings.neighborhood || "",
        city: clinicSettings.city || "",
        state: clinicSettings.state || "SP",
        zipCode: clinicSettings.zipCode || "",
        complement: clinicSettings.complement || "",
        number: clinicSettings.number || "",
        logo: clinicSettings.logo || "",
        receiptPrintEnabled: clinicSettings.receiptPrintEnabled || false,
        receiptHeader: clinicSettings.receiptHeader || "",
        receiptFooter: clinicSettings.receiptFooter || ""
      });
    }
  }, [clinicSettings]);
  
  // Função para lidar com mudanças no formulário
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setForm(prev => ({
      ...prev,
      [id]: value
    }));
  };
  
  // Função para salvar as configurações
  const salvarConfiguracoes = () => {
    updateClinicSettings(form);
  };

  return (
    <DashboardLayout title="Configurações da Clínica" currentPath="/configuracoes-clinica">
      <div className="flex flex-col space-y-6 p-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold tracking-tight">Configurações da Clínica</h1>
          <div className="flex gap-2">
            {activeTab === 'clinic' && (
              <Button 
                onClick={salvarConfiguracoes}
                className="bg-gradient-to-r from-blue-600 to-blue-500"
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : "Salvar Configurações"}
              </Button>
            )}
            {activeTab === 'website' && (
              <>
                <Button 
                  onClick={() => saveWebsiteMutation.mutate(websiteData)} 
                  variant="outline"
                  disabled={saveWebsiteMutation.isPending}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Salvar Rascunho
                </Button>
                <Button 
                  onClick={() => publishWebsiteMutation.mutate()} 
                  disabled={publishWebsiteMutation.isPending}
                >
                  <Share2 className="mr-2 h-4 w-4" />
                  Publicar Site
                </Button>
              </>
            )}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="clinic">
              <Building className="h-4 w-4 mr-2" />
              Dados da Clínica
            </TabsTrigger>
            <TabsTrigger value="website">
              <Globe className="h-4 w-4 mr-2" />
              Site da Clínica
            </TabsTrigger>
          </TabsList>

          <TabsContent value="clinic" className="space-y-4">
            <Card>
          <CardHeader>
            <CardTitle>Dados Básicos</CardTitle>
            <CardDescription>
              Configure as informações básicas da sua clínica ou consultório
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome da clínica*</Label>
                    <Input 
                      id="name" 
                      placeholder="Ex: Odontologia Dr. Silva" 
                      value={form.name}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cnpj">CNPJ*</Label>
                    <Input 
                      id="cnpj" 
                      placeholder="00.000.000/0000-00" 
                      value={form.cnpj}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail*</Label>
                    <Input 
                      id="email" 
                      type="email" 
                      placeholder="contato@clinica.com.br" 
                      value={form.email}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone*</Label>
                    <Input 
                      id="phone" 
                      placeholder="(00) 00000-0000" 
                      value={form.phone}
                      onChange={handleChange}
                    />
                  </div>
                </div>
                
                <Separator />
                
                <div>
                  <h3 className="text-lg font-medium mb-4">Endereço</h3>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="space-y-2">
                      <Label htmlFor="address">Endereço*</Label>
                      <Input 
                        id="address" 
                        placeholder="Rua, Avenida, etc." 
                        value={form.address}
                        onChange={handleChange}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="city">Cidade*</Label>
                      <Input 
                        id="city" 
                        placeholder="Sua cidade" 
                        value={form.city}
                        onChange={handleChange}
                      />
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}