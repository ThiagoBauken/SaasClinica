import { useState, useEffect, useRef } from "react";
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
  RefreshCw,
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Função para preview em tempo real
  const generatePreviewUrl = () => {
    const params = new URLSearchParams({
      template: websiteData.template,
      data: JSON.stringify(websiteData)
    });
    return `/api/website/preview?${params.toString()}`;
  };

  // Função para upload de imagens
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const uploadedImages: any[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      try {
        // Converter arquivo para base64
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
        });
        reader.readAsDataURL(file);
        const base64 = await base64Promise;

        // Enviar para o servidor
        const response = await fetch('/api/website/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageData: base64,
            filename: file.name
          })
        });

        if (response.ok) {
          const result = await response.json();
          uploadedImages.push({
            id: Date.now() + i,
            url: result.url,
            alt: file.name.split('.')[0],
            category: 'instalacoes'
          });
        }
      } catch (error) {
        console.error('Erro no upload:', error);
        toast({
          title: "Erro no upload",
          description: `Falha ao enviar ${file.name}`,
          variant: "destructive"
        });
      }
    }

    if (uploadedImages.length > 0) {
      setWebsiteData(prev => ({
        ...prev,
        gallery: [...prev.gallery, ...uploadedImages]
      }));
      
      toast({
        title: "Imagens enviadas!",
        description: `${uploadedImages.length} imagem(ns) adicionada(s) à galeria`
      });
    }

    // Limpar input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

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
      setWebsiteData(prev => ({ 
        ...prev, 
        isPublished: true, 
        domain: data.domain || `${websiteData.content.title.toLowerCase().replace(/\s+/g, '-')}.dentcare.app`
      }));
      toast({ 
        title: 'Site publicado com sucesso!', 
        description: `Seu site está disponível em: ${data.domain || websiteData.domain}` 
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
    if (savedWebsite && savedWebsite.data) {
      const data = savedWebsite.data;
      setWebsiteData({
        template: data.template || 'modern',
        content: {
          title: data.content?.hero?.title || data.clinicName || form.name || 'Minha Clínica',
          subtitle: data.content?.hero?.subtitle || 'Cuidando do seu sorriso',
          about: {
            title: data.content?.about?.title || 'Sobre Nossa Clínica',
            description: data.content?.about?.description || 'Oferecemos tratamentos de qualidade.'
          },
          services: data.content?.services || []
        },
        design: {
          primaryColor: data.colors?.primary || '#0066cc',
          secondaryColor: data.colors?.secondary || '#f8f9fa',
          accentColor: data.colors?.accent || '#28a745'
        },
        contact: {
          phone: data.content?.contact?.phone || form.phone || '',
          whatsapp: data.content?.contact?.whatsapp || form.cellphone || '',
          email: data.content?.contact?.email || form.email || '',
          address: data.content?.contact?.address || form.address || '',
          hours: data.content?.contact?.hours || 'Segunda a Sexta: 8:00 - 18:00'
        },
        social: data.social || {},
        gallery: data.content?.gallery?.map((url: string, index: number) => ({
          id: index + 1,
          url,
          alt: `Foto ${index + 1}`,
          category: 'instalacoes'
        })) || [],
        seo: data.seo || {
          title: '',
          description: '',
          keywords: ''
        },
        domain: data.domain || '',
        isPublished: data.published || false
      });
    }
  }, [savedWebsite, form.name, form.phone, form.email, form.cellphone, form.address]);
  
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
                              { id: 'minimal', name: 'Minimalista Premium', desc: 'Design clean com foco na conversão e experiência' }
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
                                    <div className="flex items-center justify-between">
                                      <div>
                                        <h4 className="font-medium">{template.name}</h4>
                                        <p className="text-sm text-muted-foreground">{template.desc}</p>
                                        <div className="flex gap-1 mt-2">
                                          <Badge variant="secondary" className="text-xs">Landing Page</Badge>
                                          <Badge variant="secondary" className="text-xs">WhatsApp</Badge>
                                          <Badge variant="secondary" className="text-xs">SEO</Badge>
                                        </div>
                                      </div>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => window.open(`/api/website/preview/${template.id}`, '_blank')}
                                        className="ml-2"
                                      >
                                        <ExternalLink className="h-4 w-4 mr-1" />
                                        Ver Demo
                                      </Button>
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

                      <TabsContent value="social" className="space-y-4">
                        <div className="space-y-4">
                          <h3 className="font-medium">Redes Sociais</h3>
                          <p className="text-sm text-muted-foreground">
                            Conecte suas redes sociais para aumentar sua presença online
                          </p>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="flex items-center gap-2">
                                <Instagram className="h-4 w-4 text-pink-600" />
                                Instagram
                              </Label>
                              <Input 
                                placeholder="https://instagram.com/sua_clinica"
                                value={websiteData.social.instagram}
                                onChange={(e) => setWebsiteData(prev => ({
                                  ...prev,
                                  social: { ...prev.social, instagram: e.target.value }
                                }))}
                              />
                            </div>

                            <div className="space-y-2">
                              <Label className="flex items-center gap-2">
                                <Facebook className="h-4 w-4 text-blue-600" />
                                Facebook
                              </Label>
                              <Input 
                                placeholder="https://facebook.com/sua_clinica"
                                value={websiteData.social.facebook}
                                onChange={(e) => setWebsiteData(prev => ({
                                  ...prev,
                                  social: { ...prev.social, facebook: e.target.value }
                                }))}
                              />
                            </div>

                            <div className="space-y-2">
                              <Label className="flex items-center gap-2">
                                <Linkedin className="h-4 w-4 text-blue-700" />
                                LinkedIn
                              </Label>
                              <Input 
                                placeholder="https://linkedin.com/company/sua-clinica"
                                value={websiteData.social.linkedin}
                                onChange={(e) => setWebsiteData(prev => ({
                                  ...prev,
                                  social: { ...prev.social, linkedin: e.target.value }
                                }))}
                              />
                            </div>

                            <div className="space-y-2">
                              <Label className="flex items-center gap-2">
                                <Youtube className="h-4 w-4 text-red-600" />
                                YouTube
                              </Label>
                              <Input 
                                placeholder="https://youtube.com/@sua_clinica"
                                value={websiteData.social.youtube}
                                onChange={(e) => setWebsiteData(prev => ({
                                  ...prev,
                                  social: { ...prev.social, youtube: e.target.value }
                                }))}
                              />
                            </div>
                          </div>

                          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <h4 className="font-medium text-blue-900 mb-2">Dicas para Redes Sociais</h4>
                            <div className="space-y-1 text-sm text-blue-800">
                              <p>• As redes sociais aparecerão como ícones no seu site</p>
                              <p>• Mantenha seus perfis atualizados com informações da clínica</p>
                              <p>• Use hashtags relevantes: #odontologia #dentista #saude</p>
                              <p>• Poste conteúdo educativo sobre saúde bucal</p>
                            </div>
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="gallery" className="space-y-4">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="font-medium">Galeria de Fotos</h3>
                              <p className="text-sm text-muted-foreground">
                                Adicione fotos da clínica, consultórios e resultados
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleImageUpload}
                                style={{ display: 'none' }}
                                ref={fileInputRef}
                                multiple
                              />
                              <Button 
                                onClick={() => fileInputRef.current?.click()}
                                size="sm"
                              >
                                <Upload className="h-4 w-4 mr-1" />
                                Upload Fotos
                              </Button>
                              <Button 
                                onClick={() => {
                                  const newPhoto = {
                                    id: Date.now(),
                                    url: '',
                                    alt: 'Nova foto',
                                    category: 'instalacoes'
                                  };
                                  setWebsiteData(prev => ({
                                    ...prev,
                                    gallery: [...prev.gallery, newPhoto]
                                  }));
                                }}
                                size="sm"
                                variant="outline"
                              >
                                <Plus className="h-4 w-4 mr-1" />
                                Adicionar por URL
                              </Button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {websiteData.gallery.map((photo, index) => (
                              <div key={photo.id} className="border rounded-lg p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                  <Badge variant="outline" className="text-xs">
                                    {photo.category === 'instalacoes' ? 'Instalações' : 
                                     photo.category === 'resultados' ? 'Resultados' : 'Equipe'}
                                  </Badge>
                                  <Button
                                    onClick={() => {
                                      setWebsiteData(prev => ({
                                        ...prev,
                                        gallery: prev.gallery.filter(p => p.id !== photo.id)
                                      }));
                                    }}
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>

                                <div className="space-y-2">
                                  <Label>URL da Imagem</Label>
                                  <div className="flex gap-2">
                                    <Input
                                      placeholder="https://exemplo.com/foto.jpg"
                                      value={photo.url}
                                      onChange={(e) => {
                                        setWebsiteData(prev => ({
                                          ...prev,
                                          gallery: prev.gallery.map(p => 
                                            p.id === photo.id ? { ...p, url: e.target.value } : p
                                          )
                                        }));
                                      }}
                                    />
                                    <Button variant="outline" size="sm">
                                      <Upload className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                  <div className="space-y-1">
                                    <Label className="text-xs">Descrição</Label>
                                    <Input
                                      placeholder="Descrição da foto"
                                      value={photo.alt}
                                      onChange={(e) => {
                                        setWebsiteData(prev => ({
                                          ...prev,
                                          gallery: prev.gallery.map(p => 
                                            p.id === photo.id ? { ...p, alt: e.target.value } : p
                                          )
                                        }));
                                      }}
                                      className="text-xs"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">Categoria</Label>
                                    <Select
                                      value={photo.category}
                                      onValueChange={(value) => {
                                        setWebsiteData(prev => ({
                                          ...prev,
                                          gallery: prev.gallery.map(p => 
                                            p.id === photo.id ? { ...p, category: value } : p
                                          )
                                        }));
                                      }}
                                    >
                                      <SelectTrigger className="text-xs">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="instalacoes">Instalações</SelectItem>
                                        <SelectItem value="resultados">Resultados</SelectItem>
                                        <SelectItem value="equipe">Equipe</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>

                                {photo.url && (
                                  <div className="mt-2">
                                    <img 
                                      src={photo.url} 
                                      alt={photo.alt}
                                      className="w-full h-24 object-cover rounded border"
                                      onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                      }}
                                    />
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>

                          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                            <h4 className="font-medium text-green-900 mb-2">Dicas para Galeria</h4>
                            <div className="space-y-1 text-sm text-green-800">
                              <p>• Use imagens de alta qualidade (mínimo 800x600px)</p>
                              <p>• Fotos de instalações mostram profissionalismo</p>
                              <p>• Resultados (antes/depois) aumentam confiança</p>
                              <p>• Imagens da equipe humanizam sua clínica</p>
                            </div>
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="seo" className="space-y-4">
                        <div className="space-y-4">
                          <h3 className="font-medium">SEO e Otimização</h3>
                          <p className="text-sm text-muted-foreground">
                            Melhore a visibilidade do seu site nos mecanismos de busca
                          </p>

                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label>Título da Página (SEO)</Label>
                              <Input 
                                value={websiteData.seo.title}
                                onChange={(e) => setWebsiteData(prev => ({
                                  ...prev,
                                  seo: { ...prev.seo, title: e.target.value }
                                }))}
                                placeholder="Ex: Clínica Odontológica em São Paulo | Dentista Especializado"
                                maxLength={60}
                              />
                              <p className="text-xs text-muted-foreground">
                                {websiteData.seo.title.length}/60 caracteres
                              </p>
                            </div>

                            <div className="space-y-2">
                              <Label>Descrição Meta</Label>
                              <Textarea 
                                value={websiteData.seo.description}
                                onChange={(e) => setWebsiteData(prev => ({
                                  ...prev,
                                  seo: { ...prev.seo, description: e.target.value }
                                }))}
                                placeholder="Descreva sua clínica e serviços para aparecer no Google"
                                maxLength={160}
                                rows={3}
                              />
                              <p className="text-xs text-muted-foreground">
                                {websiteData.seo.description.length}/160 caracteres
                              </p>
                            </div>

                            <div className="space-y-2">
                              <Label>Palavras-chave</Label>
                              <Input 
                                value={websiteData.seo.keywords}
                                onChange={(e) => setWebsiteData(prev => ({
                                  ...prev,
                                  seo: { ...prev.seo, keywords: e.target.value }
                                }))}
                                placeholder="dentista, odontologia, clínica dental, implante"
                              />
                              <p className="text-xs text-muted-foreground">
                                Separe as palavras-chave com vírgulas
                              </p>
                            </div>
                          </div>

                          <div className="mt-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                            <h4 className="font-medium text-purple-900 mb-2">Dicas de SEO</h4>
                            <div className="space-y-1 text-sm text-purple-800">
                              <p>• Use palavras-chave relevantes para odontologia</p>
                              <p>• Inclua sua localização (cidade/bairro)</p>
                              <p>• Mantenha títulos únicos e descritivos</p>
                              <p>• Atualize conteúdo regularmente</p>
                            </div>
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
                    <div className="border rounded-lg bg-white min-h-[500px] relative">
                      <iframe 
                        key={JSON.stringify(websiteData)}
                        src={generatePreviewUrl()}
                        className="w-full h-[500px] border-0 rounded-lg"
                        title="Preview do Site"
                      />
                      
                      <div className="absolute top-2 right-2 flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(generatePreviewUrl(), '_blank')}
                          className="bg-white/90 backdrop-blur-sm"
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          Abrir Preview
                        </Button>
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const iframe = document.querySelector('iframe[title="Preview do Site"]') as HTMLIFrameElement;
                            if (iframe) {
                              iframe.src = generatePreviewUrl(); // Atualizar com dados atuais
                            }
                          }}
                          className="bg-white/90 backdrop-blur-sm"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Atualizar
                        </Button>
                      </div>
                    </div>
                    
                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <strong>Template:</strong> {websiteData.template === 'modern' ? 'Moderno Pro' : 
                                                     websiteData.template === 'classic' ? 'Clássico Profissional' : 
                                                     'Minimalista Premium'}
                      </p>
                      <p className="text-sm text-blue-600 mt-1">
                        Este é o preview em tempo real do seu site com dados da clínica.
                      </p>
                      <div className="flex gap-2 mt-3">
                        <Button 
                          size="sm" 
                          onClick={() => saveWebsiteMutation.mutate(websiteData)}
                          disabled={saveWebsiteMutation.isPending}
                        >
                          <Save className="h-4 w-4 mr-1" />
                          {saveWebsiteMutation.isPending ? 'Salvando...' : 'Salvar'}
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => window.location.reload()}
                        >
                          <RefreshCw className="h-4 w-4 mr-1" />
                          Recarregar
                        </Button>
                        <Button 
                          size="sm" 
                          onClick={() => publishWebsiteMutation.mutate()}
                          disabled={publishWebsiteMutation.isPending}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          <Globe className="h-4 w-4 mr-1" />
                          {publishWebsiteMutation.isPending ? 'Publicando...' : 'Publicar Site'}
                        </Button>
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