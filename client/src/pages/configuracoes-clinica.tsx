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
  Share2,
  Instagram,
  Facebook,
  Linkedin,
  Youtube,
  Camera,
  Image,
  ExternalLink
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
    social: {
      instagram: '',
      facebook: '',
      linkedin: '',
      youtube: ''
    },
    gallery: [
      { id: 1, url: '', alt: 'Recepção da clínica', category: 'instalacoes' },
      { id: 2, url: '', alt: 'Consultório', category: 'instalacoes' },
      { id: 3, url: '', alt: 'Antes e depois', category: 'resultados' }
    ],
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(websiteData)
      }).then(res => res.json()),
    onSuccess: (data) => {
      setWebsiteData(prev => ({ ...prev, isPublished: true, domain: data.domain }));
      toast({ 
        title: 'Site publicado com sucesso!', 
        description: `Seu site está disponível em: ${data.domain}` 
      });
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

      // Sincroniza dados com o criador de sites
      setWebsiteData(prev => ({
        ...prev,
        content: {
          ...prev.content,
          title: clinicSettings.name || prev.content.title
        },
        contact: {
          ...prev.contact,
          phone: clinicSettings.phone || prev.contact.phone,
          email: clinicSettings.email || prev.contact.email,
          address: clinicSettings.address ? 
            `${clinicSettings.address}, ${clinicSettings.neighborhood}, ${clinicSettings.city} - ${clinicSettings.state}` 
            : prev.contact.address,
          whatsapp: clinicSettings.cellphone || prev.contact.whatsapp,
          hours: `${clinicSettings.openingTime} - ${clinicSettings.closingTime}` || prev.contact.hours
        }
      }));
    }
  }, [clinicSettings]);

  // Carrega dados do site salvos
  useEffect(() => {
    if (savedWebsite) {
      setWebsiteData(prevData => ({
        ...prevData,
        ...savedWebsite,
        // Mantém sincronização com dados da clínica se não há dados salvos específicos
        content: {
          ...prevData.content,
          ...savedWebsite.content,
          title: savedWebsite.content?.title || form.name || prevData.content.title
        },
        contact: {
          ...prevData.contact,
          ...savedWebsite.contact,
          phone: savedWebsite.contact?.phone || form.phone || prevData.contact.phone,
          email: savedWebsite.contact?.email || form.email || prevData.contact.email
        }
      }));
    }
  }, [savedWebsite, form.name, form.phone, form.email]);
  
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
                {websiteData.domain && (
                  <Button 
                    onClick={() => window.open(`https://${websiteData.domain}`, '_blank')}
                    variant="outline"
                    className="text-green-700 border-green-300 hover:bg-green-50"
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    Ver Site Publicado
                  </Button>
                )}
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
          </TabsContent>

          <TabsContent value="website" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Coluna Esquerda - Editor */}
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Globe className="h-5 w-5" />
                      Criador de Sites
                    </CardTitle>
                    <CardDescription>
                      Crie seu site profissional em minutos
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Tabs value={websiteActiveTab} onValueChange={setWebsiteActiveTab} className="space-y-4">
                      <TabsList className="grid grid-cols-4 lg:grid-cols-7 w-full">
                        <TabsTrigger value="template">Template</TabsTrigger>
                        <TabsTrigger value="content">Conteúdo</TabsTrigger>
                        <TabsTrigger value="design">Design</TabsTrigger>
                        <TabsTrigger value="contact">Contato</TabsTrigger>
                        <TabsTrigger value="social">Social</TabsTrigger>
                        <TabsTrigger value="gallery">Galeria</TabsTrigger>
                        <TabsTrigger value="seo">SEO</TabsTrigger>
                      </TabsList>

                      <TabsContent value="template" className="space-y-4">
                        <div className="space-y-4">
                          <h3 className="font-medium">Escolha seu Template</h3>
                          <div className="grid grid-cols-1 gap-4">
                            {[
                              { id: 'modern', name: 'Moderno Pro', desc: 'Landing page com animações, hero section e CTA destacados' },
                              { id: 'classic', name: 'Clássico Profissional', desc: 'Layout tradicional com seções bem definidas e credibilidade' },
                              { id: 'minimalist', name: 'Minimalista Premium', desc: 'Design clean com foco na conversão e experiência' }
                            ].map((template) => (
                              <div 
                                key={template.id}
                                className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${
                                  websiteData.template === template.id 
                                    ? 'border-primary bg-primary/5' 
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}
                                onClick={() => setWebsiteData(prev => ({ ...prev, template: template.id }))}
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`w-16 h-12 rounded flex items-center justify-center ${
                                    template.id === 'modern' ? 'bg-gradient-to-br from-blue-500 to-purple-600' :
                                    template.id === 'classic' ? 'bg-gradient-to-br from-amber-500 to-orange-600' :
                                    'bg-gradient-to-br from-gray-400 to-gray-600'
                                  }`}>
                                    <Palette className="h-6 w-6 text-white" />
                                  </div>
                                  <div className="flex-1">
                                    <h4 className="font-medium">{template.name}</h4>
                                    <p className="text-sm text-muted-foreground">{template.desc}</p>
                                    <div className="flex gap-1 mt-2">
                                      <Badge variant="secondary" className="text-xs">Landing Page</Badge>
                                      <Badge variant="secondary" className="text-xs">WhatsApp</Badge>
                                      <Badge variant="secondary" className="text-xs">SEO</Badge>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="content" className="space-y-4">
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>Título Principal</Label>
                            <Input 
                              value={websiteData.content.title}
                              onChange={(e) => setWebsiteData(prev => ({
                                ...prev,
                                content: { ...prev.content, title: e.target.value }
                              }))}
                              placeholder="Ex: Clínica Odontológica Dr. Silva"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label>Subtítulo</Label>
                            <Input 
                              value={websiteData.content.subtitle}
                              onChange={(e) => setWebsiteData(prev => ({
                                ...prev,
                                content: { ...prev.content, subtitle: e.target.value }
                              }))}
                              placeholder="Ex: Cuidando do seu sorriso com excelência"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Sobre a Clínica</Label>
                            <Textarea 
                              value={websiteData.content.about.description}
                              onChange={(e) => setWebsiteData(prev => ({
                                ...prev,
                                content: { 
                                  ...prev.content, 
                                  about: { ...prev.content.about, description: e.target.value }
                                }
                              }))}
                              placeholder="Descreva sua clínica, missão e diferenciais..."
                              rows={4}
                            />
                          </div>

                          <div className="space-y-4">
                            <Label>Serviços Oferecidos</Label>
                            {websiteData.content.services.map((service, index) => (
                              <div key={index} className="flex gap-2 items-start">
                                <div className="flex-1 space-y-2">
                                  <Input 
                                    value={service.name}
                                    onChange={(e) => {
                                      const newServices = [...websiteData.content.services];
                                      newServices[index].name = e.target.value;
                                      setWebsiteData(prev => ({
                                        ...prev,
                                        content: { ...prev.content, services: newServices }
                                      }));
                                    }}
                                    placeholder="Nome do serviço"
                                  />
                                  <Input 
                                    value={service.price}
                                    onChange={(e) => {
                                      const newServices = [...websiteData.content.services];
                                      newServices[index].price = e.target.value;
                                      setWebsiteData(prev => ({
                                        ...prev,
                                        content: { ...prev.content, services: newServices }
                                      }));
                                    }}
                                    placeholder="Preço (opcional)"
                                  />
                                </div>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => {
                                    const newServices = websiteData.content.services.filter((_, i) => i !== index);
                                    setWebsiteData(prev => ({
                                      ...prev,
                                      content: { ...prev.content, services: newServices }
                                    }));
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                            <Button 
                              variant="outline" 
                              onClick={() => {
                                const newServices = [...websiteData.content.services, { name: '', description: '', price: '' }];
                                setWebsiteData(prev => ({
                                  ...prev,
                                  content: { ...prev.content, services: newServices }
                                }));
                              }}
                              className="w-full"
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Adicionar Serviço
                            </Button>
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="design" className="space-y-4">
                        <div className="space-y-4">
                          <h3 className="font-medium">Personalização Visual</h3>
                          
                          <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <Label>Cor Primária</Label>
                              <div className="flex gap-2">
                                <Input 
                                  type="color"
                                  value={websiteData.design.primaryColor}
                                  onChange={(e) => setWebsiteData(prev => ({
                                    ...prev,
                                    design: { ...prev.design, primaryColor: e.target.value }
                                  }))}
                                  className="w-12 h-10 p-1"
                                />
                                <Input 
                                  value={websiteData.design.primaryColor}
                                  onChange={(e) => setWebsiteData(prev => ({
                                    ...prev,
                                    design: { ...prev.design, primaryColor: e.target.value }
                                  }))}
                                  placeholder="#0066cc"
                                />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label>Cor Secundária</Label>
                              <div className="flex gap-2">
                                <Input 
                                  type="color"
                                  value={websiteData.design.secondaryColor}
                                  onChange={(e) => setWebsiteData(prev => ({
                                    ...prev,
                                    design: { ...prev.design, secondaryColor: e.target.value }
                                  }))}
                                  className="w-12 h-10 p-1"
                                />
                                <Input 
                                  value={websiteData.design.secondaryColor}
                                  onChange={(e) => setWebsiteData(prev => ({
                                    ...prev,
                                    design: { ...prev.design, secondaryColor: e.target.value }
                                  }))}
                                  placeholder="#f8f9fa"
                                />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label>Cor de Destaque</Label>
                              <div className="flex gap-2">
                                <Input 
                                  type="color"
                                  value={websiteData.design.accentColor}
                                  onChange={(e) => setWebsiteData(prev => ({
                                    ...prev,
                                    design: { ...prev.design, accentColor: e.target.value }
                                  }))}
                                  className="w-12 h-10 p-1"
                                />
                                <Input 
                                  value={websiteData.design.accentColor}
                                  onChange={(e) => setWebsiteData(prev => ({
                                    ...prev,
                                    design: { ...prev.design, accentColor: e.target.value }
                                  }))}
                                  placeholder="#28a745"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="p-4 bg-gray-50 rounded-lg">
                            <h4 className="font-medium mb-2">Preview das Cores</h4>
                            <div className="flex gap-4">
                              <div 
                                className="w-16 h-16 rounded-lg flex items-center justify-center text-white font-medium"
                                style={{ backgroundColor: websiteData.design.primaryColor }}
                              >
                                Primária
                              </div>
                              <div 
                                className="w-16 h-16 rounded-lg flex items-center justify-center"
                                style={{ backgroundColor: websiteData.design.secondaryColor, color: websiteData.design.primaryColor }}
                              >
                                Secundária
                              </div>
                              <div 
                                className="w-16 h-16 rounded-lg flex items-center justify-center text-white font-medium"
                                style={{ backgroundColor: websiteData.design.accentColor }}
                              >
                                Destaque
                              </div>
                            </div>
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="contact" className="space-y-4">
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>WhatsApp (com botão flutuante)</Label>
                            <Input 
                              value={websiteData.contact.whatsapp}
                              onChange={(e) => setWebsiteData(prev => ({
                                ...prev,
                                contact: { ...prev.contact, whatsapp: e.target.value }
                              }))}
                              placeholder="Ex: 11999999999"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Telefone</Label>
                            <Input 
                              value={websiteData.contact.phone}
                              onChange={(e) => setWebsiteData(prev => ({
                                ...prev,
                                contact: { ...prev.contact, phone: e.target.value }
                              }))}
                              placeholder="Ex: (11) 3333-3333"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>E-mail</Label>
                            <Input 
                              value={websiteData.contact.email}
                              onChange={(e) => setWebsiteData(prev => ({
                                ...prev,
                                contact: { ...prev.contact, email: e.target.value }
                              }))}
                              placeholder="Ex: contato@clinica.com.br"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Endereço</Label>
                            <Textarea 
                              value={websiteData.contact.address}
                              onChange={(e) => setWebsiteData(prev => ({
                                ...prev,
                                contact: { ...prev.contact, address: e.target.value }
                              }))}
                              placeholder="Endereço completo da clínica"
                              rows={3}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Horários de Funcionamento</Label>
                            <Input 
                              value={websiteData.contact.hours}
                              onChange={(e) => setWebsiteData(prev => ({
                                ...prev,
                                contact: { ...prev.contact, hours: e.target.value }
                              }))}
                              placeholder="Ex: Segunda a Sexta: 8:00 - 18:00"
                            />
                          </div>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              </div>

              {/* Coluna Direita - Preview */}
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Eye className="h-5 w-5" />
                      Preview do Site
                    </CardTitle>
                    <CardDescription>
                      Visualize como seu site ficará
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="border rounded-lg p-4 bg-gray-50 min-h-[400px]">
                      <div className="text-center space-y-4">
                        <h1 className="text-2xl font-bold" style={{ color: websiteData.design.primaryColor }}>
                          {websiteData.content.title}
                        </h1>
                        <p className="text-gray-600">
                          {websiteData.content.subtitle}
                        </p>
                        
                        <div className="bg-white rounded-lg p-4 shadow-sm">
                          <h3 className="font-semibold mb-2">Serviços</h3>
                          <div className="space-y-2">
                            {websiteData.content.services.slice(0, 3).map((service, index) => (
                              <div key={index} className="flex justify-between text-sm">
                                <span>{service.name}</span>
                                <span className="font-medium">{service.price}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {websiteData.contact.whatsapp && (
                          <div className="flex justify-center">
                            <div 
                              className="bg-green-500 text-white px-4 py-2 rounded-full flex items-center gap-2"
                              style={{ backgroundColor: websiteData.design.accentColor }}
                            >
                              <MessageCircle className="h-4 w-4" />
                              WhatsApp
                            </div>
                          </div>
                        )}

                        <div className="text-sm text-gray-500 space-y-1">
                          <p>{websiteData.contact.phone}</p>
                          <p>{websiteData.contact.email}</p>
                          <p>{websiteData.contact.hours}</p>
                        </div>
                      </div>
                    </div>

                    {websiteData.domain && (
                      <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-green-800">
                            Site publicado em: <strong>{websiteData.domain}</strong>
                          </p>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => window.open(`https://${websiteData.domain}`, '_blank')}
                            className="text-green-800 border-green-300 hover:bg-green-100"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Ver Site
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}