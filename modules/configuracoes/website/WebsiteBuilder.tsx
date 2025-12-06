import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '../../../client/src/lib/queryClient';
import { Button } from '../../../client/src/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../client/src/components/ui/card';
import { Input } from '../../../client/src/components/ui/input';
import { Label } from '../../../client/src/components/ui/label';
import { Textarea } from '../../../client/src/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../client/src/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../../../client/src/components/ui/dialog';
import { Badge } from '../../../client/src/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../client/src/components/ui/tabs';
import { useToast } from '../../../client/src/hooks/use-toast';
import { 
  Globe, 
  Palette, 
  Eye, 
  Save, 
  ExternalLink, 
  Upload, 
  Phone, 
  Mail, 
  MapPin,
  Clock,
  Star,
  Camera,
  Settings,
  Monitor,
  Smartphone,
  Tablet,
  MessageCircle
} from 'lucide-react';

interface WebsiteData {
  id?: number;
  clinicName: string;
  domain?: string;
  customDomain?: string;
  template: 'modern' | 'classic' | 'minimal';
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  content: {
    hero: {
      title: string;
      subtitle: string;
      image?: string;
    };
    about: {
      title: string;
      description: string;
      image?: string;
    };
    services: Array<{
      name: string;
      description: string;
      price?: string;
    }>;
    contact: {
      phone: string;
      whatsapp: string;
      email: string;
      address: string;
      hours: string;
    };
    gallery: string[];
  };
  seo: {
    title: string;
    description: string;
    keywords: string;
  };
  social?: {
    instagram?: string;
    facebook?: string;
    linkedin?: string;
    youtube?: string;
  };
  published: boolean;
  createdAt?: string;
  updatedAt?: string;
}

const templates = [
  {
    id: 'modern',
    name: 'Moderno',
    description: 'Design contemporâneo com gradientes e animações suaves',
    features: ['Gradientes', 'Animações suaves', 'Layout responsivo', 'Botão WhatsApp flutuante'],
    editableSections: {
      content: {
        hero: { title: true, subtitle: true, image: true },
        about: { title: true, description: true, image: true },
        services: { enabled: true, showPrices: true },
        testimonials: { enabled: true }
      },
      design: {
        colors: { primary: true, secondary: true, accent: true, gradient: true },
        fonts: { heading: true, body: true },
        animations: { enabled: true }
      },
      gallery: { enabled: true, layout: 'grid' },
      contact: { phone: true, email: true, whatsapp: true, address: true, hours: true },
      social: { instagram: true, facebook: true, linkedin: true, youtube: true }
    }
  },
  {
    id: 'classic',
    name: 'Clássico',
    description: 'Design tradicional e elegante para clínicas estabelecidas',
    features: ['Design tradicional', 'Cores sóbrias', 'Tipografia elegante', 'WhatsApp integrado'],
    editableSections: {
      content: {
        hero: { title: true, subtitle: true, image: false },
        about: { title: true, description: true, image: true },
        services: { enabled: true, showPrices: false },
        testimonials: { enabled: false }
      },
      design: {
        colors: { primary: true, secondary: true, accent: false, gradient: false },
        fonts: { heading: true, body: false },
        animations: { enabled: false }
      },
      gallery: { enabled: true, layout: 'carousel' },
      contact: { phone: true, email: true, whatsapp: true, address: true, hours: true },
      social: { instagram: true, facebook: true, linkedin: false, youtube: false }
    }
  },
  {
    id: 'minimal',
    name: 'Minimalista',
    description: 'Clean e simples, focado no conteúdo essencial',
    features: ['Design limpo', 'Muito espaço em branco', 'Tipografia moderna', 'WhatsApp discreto'],
    editableSections: {
      content: {
        hero: { title: true, subtitle: false, image: false },
        about: { title: false, description: true, image: false },
        services: { enabled: true, showPrices: false },
        testimonials: { enabled: false }
      },
      design: {
        colors: { primary: true, secondary: false, accent: false, gradient: false },
        fonts: { heading: true, body: true },
        animations: { enabled: false }
      },
      gallery: { enabled: false, layout: 'none' },
      contact: { phone: true, email: true, whatsapp: true, address: false, hours: false },
      social: { instagram: true, facebook: false, linkedin: false, youtube: false }
    }
  }
];

export default function WebsiteBuilder() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('template');
  const [previewMode, setPreviewMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [websiteData, setWebsiteData] = useState<WebsiteData>({
    clinicName: '',
    template: 'modern',
    colors: {
      primary: '#3B82F6',
      secondary: '#1E40AF',
      accent: '#60A5FA'
    },
    content: {
      hero: {
        title: 'Sua Clínica Odontológica',
        subtitle: 'Cuidando do seu sorriso com excelência e dedicação'
      },
      about: {
        title: 'Sobre Nossa Clínica',
        description: 'Há mais de 10 anos oferecendo os melhores tratamentos odontológicos com tecnologia de ponta e profissionais qualificados.'
      },
      services: [
        { name: 'Limpeza Dental', description: 'Profilaxia completa e orientações de higiene' },
        { name: 'Clareamento', description: 'Clareamento dental seguro e eficaz' },
        { name: 'Ortodontia', description: 'Aparelhos ortodônticos tradicionais e estéticos' }
      ],
      contact: {
        phone: '',
        whatsapp: '',
        email: '',
        address: '',
        hours: 'Segunda a Sexta: 8h às 18h'
      },
      gallery: []
    },
    seo: {
      title: '',
      description: '',
      keywords: 'dentista, clínica odontológica, tratamento dental'
    },
    published: false
  });

  // Buscar dados do site existente
  const { data: existingWebsite, isLoading } = useQuery({
    queryKey: ['/api/website'],
    queryFn: async () => {
      const response = await fetch('/api/website');
      if (response.ok) {
        return response.json();
      }
      return null;
    }
  });

  // Função para obter seções editáveis do template atual
  const getCurrentTemplateConfig = () => {
    return templates.find(t => t.id === websiteData.template)?.editableSections || templates[0].editableSections;
  };

  // Carregar dados existentes quando disponíveis
  useEffect(() => {
    if (existingWebsite) {
      setWebsiteData(existingWebsite);
    }
  }, [existingWebsite]);

  // Atualizar configurações quando template mudar
  useEffect(() => {
    const templateConfig = getCurrentTemplateConfig();
    // Aqui podemos ajustar dados baseados no template se necessário
  }, [websiteData.template]);

  // Mutation para salvar o site
  const saveWebsiteMutation = useMutation({
    mutationFn: async (data: WebsiteData) => {
      const response = await fetch('/api/website', {
        method: data.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Falha ao salvar site');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/website'] });
      toast({
        title: "Site salvo",
        description: "Suas alterações foram salvas com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao salvar o site.",
        variant: "destructive",
      });
    }
  });

  // Mutation para publicar o site
  const publishWebsiteMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/website/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(websiteData)
      });
      if (!response.ok) throw new Error('Falha ao publicar site');
      return response.json();
    },
    onSuccess: (data) => {
      setWebsiteData(prev => ({ ...prev, published: true, domain: data.domain }));
      toast({
        title: "Site publicado",
        description: `Seu site está disponível em: ${data.domain}`,
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao publicar o site.",
        variant: "destructive",
      });
    }
  });

  const handleSave = () => {
    saveWebsiteMutation.mutate(websiteData);
  };

  const handlePublish = () => {
    publishWebsiteMutation.mutate();
  };

  const updateWebsiteData = (path: string, value: any) => {
    setWebsiteData(prev => {
      const newData = { ...prev } as Record<string, any>;
      const keys = path.split('.');
      let current: Record<string, any> = newData;

      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) current[keys[i]] = {};
        current = current[keys[i]] as Record<string, any>;
      }

      current[keys[keys.length - 1]] = value;
      return newData as typeof prev;
    });
  };

  const addService = () => {
    setWebsiteData(prev => ({
      ...prev,
      content: {
        ...prev.content,
        services: [...prev.content.services, { name: '', description: '', price: '' }]
      }
    }));
  };

  const removeService = (index: number) => {
    setWebsiteData(prev => ({
      ...prev,
      content: {
        ...prev.content,
        services: prev.content.services.filter((_, i) => i !== index)
      }
    }));
  };

  // Gerar URL do domínio
  const generateDomain = (clinicName: string) => {
    if (!clinicName) return '';
    const slug = clinicName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .trim();
    return `${slug}.dentcare.com.br`;
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Carregando...</div>;
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Criador de Sites</h1>
          <p className="text-muted-foreground">
            Crie e personalize o site da sua clínica com WhatsApp integrado
          </p>
        </div>
        
        <div className="flex gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Eye className="h-4 w-4" />
                Visualizar
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-6xl h-[80vh]">
              <DialogHeader>
                <DialogTitle>Pré-visualização do Site</DialogTitle>
                <DialogDescription>
                  Veja como seu site ficará para os visitantes
                </DialogDescription>
              </DialogHeader>
              
              <div className="flex gap-2 mb-4">
                <Button
                  variant={previewMode === 'desktop' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPreviewMode('desktop')}
                >
                  <Monitor className="h-4 w-4 mr-1" />
                  Desktop
                </Button>
                <Button
                  variant={previewMode === 'tablet' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPreviewMode('tablet')}
                >
                  <Tablet className="h-4 w-4 mr-1" />
                  Tablet
                </Button>
                <Button
                  variant={previewMode === 'mobile' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPreviewMode('mobile')}
                >
                  <Smartphone className="h-4 w-4 mr-1" />
                  Mobile
                </Button>
              </div>
              
              <div className={`
                border rounded-lg overflow-hidden bg-white relative
                ${previewMode === 'desktop' ? 'w-full h-full' : ''}
                ${previewMode === 'tablet' ? 'w-[768px] h-[1024px] mx-auto' : ''}
                ${previewMode === 'mobile' ? 'w-[375px] h-[667px] mx-auto' : ''}
              `}>
                <div className="p-8 text-center">
                  <h2 className="text-2xl font-bold mb-4" style={{ color: websiteData.colors.primary }}>
                    {websiteData.content.hero.title}
                  </h2>
                  <p className="text-gray-600 mb-8">{websiteData.content.hero.subtitle}</p>
                  
                  {/* Serviços preview */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    {websiteData.content.services.slice(0, 3).map((service, index) => (
                      <div key={index} className="border rounded-lg p-4">
                        <h3 className="font-semibold mb-2">{service.name}</h3>
                        <p className="text-sm text-gray-600">{service.description}</p>
                        {service.price && (
                          <p className="text-lg font-bold mt-2" style={{ color: websiteData.colors.primary }}>
                            {service.price}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  {/* Botão WhatsApp flutuante */}
                  {websiteData.content.contact.whatsapp && (
                    <div className="fixed bottom-4 right-4">
                      <Button 
                        className="rounded-full w-14 h-14 bg-green-500 hover:bg-green-600"
                        style={{ backgroundColor: '#25D366' }}
                      >
                        <MessageCircle className="h-6 w-6" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
          
          <Button onClick={handleSave} disabled={saveWebsiteMutation.isPending} className="gap-2">
            <Save className="h-4 w-4" />
            Salvar
          </Button>
          
          <Button 
            onClick={handlePublish} 
            disabled={publishWebsiteMutation.isPending || !websiteData.clinicName}
            className="gap-2"
          >
            <Globe className="h-4 w-4" />
            Publicar
          </Button>
        </div>
      </div>

      {websiteData.published && websiteData.domain && (
        <Card className="mb-6 border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-green-800">Site Publicado</p>
                <p className="text-sm text-green-600">
                  Seu site está disponível em: <strong>{websiteData.domain}</strong>
                </p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <a href={`https://${websiteData.domain}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Visitar
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {websiteData.clinicName && !websiteData.published && (
        <Card className="mb-6 border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-blue-800">Domínio Reservado</p>
                <p className="text-sm text-blue-600">
                  Quando publicar, seu site ficará em: <strong>{generateDomain(websiteData.clinicName)}</strong>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="template">Template</TabsTrigger>
          <TabsTrigger value="content">Conteúdo</TabsTrigger>
          <TabsTrigger value="design">Design</TabsTrigger>
          <TabsTrigger value="contact">Contato</TabsTrigger>
          <TabsTrigger value="social">Social</TabsTrigger>
          {getCurrentTemplateConfig().gallery.enabled && (
            <TabsTrigger value="gallery">Galeria</TabsTrigger>
          )}
          <TabsTrigger value="seo">SEO</TabsTrigger>
        </TabsList>

        <TabsContent value="template" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Escolha um Template</CardTitle>
              <CardDescription>
                Selecione o design que melhor representa sua clínica. Todos incluem WhatsApp integrado.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className={`
                      border-2 rounded-lg p-4 cursor-pointer transition-all
                      ${websiteData.template === template.id 
                        ? 'border-primary bg-primary/5' 
                        : 'border-gray-200 hover:border-gray-300'
                      }
                    `}
                    onClick={() => updateWebsiteData('template', template.id)}
                  >
                    <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 rounded mb-4 flex items-center justify-center">
                      <div className="text-center">
                        <div className="w-16 h-16 mx-auto mb-2 bg-white rounded-lg shadow flex items-center justify-center">
                          {template.id === 'modern' && <Palette className="h-8 w-8 text-blue-500" />}
                          {template.id === 'classic' && <Star className="h-8 w-8 text-amber-500" />}
                          {template.id === 'minimal' && <Settings className="h-8 w-8 text-gray-500" />}
                        </div>
                        <p className="text-xs text-gray-500">{template.name}</p>
                      </div>
                    </div>
                    <h3 className="font-semibold mb-2">{template.name}</h3>
                    <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                    <div className="flex flex-wrap gap-1">
                      {template.features.map((feature, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {feature}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="content" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informações Básicas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="clinicName">Nome da Clínica</Label>
                <Input
                  id="clinicName"
                  value={websiteData.clinicName}
                  onChange={(e) => updateWebsiteData('clinicName', e.target.value)}
                  placeholder="Ex: Clínica Odontológica Sorriso"
                />
                {websiteData.clinicName && (
                  <p className="text-xs text-gray-500 mt-1">
                    Domínio: {generateDomain(websiteData.clinicName)}
                  </p>
                )}
              </div>
              
              {getCurrentTemplateConfig().content.hero.title && (
                <div>
                  <Label htmlFor="heroTitle">Título Principal</Label>
                  <Input
                    id="heroTitle"
                    value={websiteData.content.hero.title}
                    onChange={(e) => updateWebsiteData('content.hero.title', e.target.value)}
                  />
                </div>
              )}
              
              {getCurrentTemplateConfig().content.hero.subtitle && (
                <div>
                  <Label htmlFor="heroSubtitle">Subtítulo</Label>
                  <Textarea
                    id="heroSubtitle"
                    value={websiteData.content.hero.subtitle}
                    onChange={(e) => updateWebsiteData('content.hero.subtitle', e.target.value)}
                    rows={2}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sobre a Clínica</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {getCurrentTemplateConfig().content.about.title && (
                <div>
                  <Label htmlFor="aboutTitle">Título da Seção</Label>
                  <Input
                    id="aboutTitle"
                    value={websiteData.content.about.title}
                    onChange={(e) => updateWebsiteData('content.about.title', e.target.value)}
                  />
                </div>
              )}
              
              {getCurrentTemplateConfig().content.about.description && (
                <div>
                  <Label htmlFor="aboutDescription">Descrição</Label>
                  <Textarea
                    id="aboutDescription"
                    value={websiteData.content.about.description}
                    onChange={(e) => updateWebsiteData('content.about.description', e.target.value)}
                    rows={4}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {getCurrentTemplateConfig().content.services.enabled && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Serviços
                  <Button onClick={addService} size="sm">
                    Adicionar Serviço
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {websiteData.content.services.map((service, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="font-medium">Serviço {index + 1}</h4>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeService(index)}
                      >
                        Remover
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <Label>Nome do Serviço</Label>
                        <Input
                          value={service.name}
                          onChange={(e) => {
                            const newServices = [...websiteData.content.services];
                            newServices[index].name = e.target.value;
                            updateWebsiteData('content.services', newServices);
                          }}
                          placeholder="Ex: Limpeza Dental"
                        />
                      </div>
                      
                      {getCurrentTemplateConfig().content.services.showPrices && (
                        <div>
                          <Label>Preço (opcional)</Label>
                          <Input
                            value={service.price || ''}
                            onChange={(e) => {
                              const newServices = [...websiteData.content.services];
                              newServices[index].price = e.target.value;
                              updateWebsiteData('content.services', newServices);
                            }}
                            placeholder="Ex: R$ 150,00"
                          />
                        </div>
                      )}
                    </div>
                  
                  <div className="mt-3">
                    <Label>Descrição</Label>
                    <Textarea
                      value={service.description}
                      onChange={(e) => {
                        const newServices = [...websiteData.content.services];
                        newServices[index].description = e.target.value;
                        updateWebsiteData('content.services', newServices);
                      }}
                      placeholder="Descreva o serviço..."
                      rows={2}
                    />
                  </div>
                </div>
              ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="design" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Cores do Site
              </CardTitle>
              <CardDescription>
                Personalize as cores para combinar com a identidade da sua clínica
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {getCurrentTemplateConfig().design.colors.primary && (
                  <div>
                    <Label htmlFor="primaryColor">Cor Primária</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        id="primaryColor"
                        type="color"
                        value={websiteData.colors.primary}
                        onChange={(e) => updateWebsiteData('colors.primary', e.target.value)}
                        className="w-16 h-10"
                      />
                      <Input
                        value={websiteData.colors.primary}
                        onChange={(e) => updateWebsiteData('colors.primary', e.target.value)}
                        placeholder="#3B82F6"
                      />
                    </div>
                  </div>
                )}
                
                {getCurrentTemplateConfig().design.colors.secondary && (
                  <div>
                    <Label htmlFor="secondaryColor">Cor Secundária</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        id="secondaryColor"
                        type="color"
                        value={websiteData.colors.secondary}
                        onChange={(e) => updateWebsiteData('colors.secondary', e.target.value)}
                        className="w-16 h-10"
                      />
                      <Input
                        value={websiteData.colors.secondary}
                        onChange={(e) => updateWebsiteData('colors.secondary', e.target.value)}
                        placeholder="#1E40AF"
                      />
                    </div>
                  </div>
                )}
                
                {getCurrentTemplateConfig().design.colors.accent && (
                  <div>
                    <Label htmlFor="accentColor">Cor de Destaque</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        id="accentColor"
                        type="color"
                        value={websiteData.colors.accent}
                        onChange={(e) => updateWebsiteData('colors.accent', e.target.value)}
                        className="w-16 h-10"
                      />
                      <Input
                        value={websiteData.colors.accent}
                        onChange={(e) => updateWebsiteData('colors.accent', e.target.value)}
                        placeholder="#60A5FA"
                      />
                    </div>
                  </div>
                )}
              </div>
              
              <div className="p-4 border rounded-lg">
                <p className="text-sm text-gray-600 mb-2">Pré-visualização das cores:</p>
                <div className="flex gap-4">
                  <div 
                    className="w-16 h-16 rounded-lg border"
                    style={{ backgroundColor: websiteData.colors.primary }}
                    title="Cor Primária"
                  />
                  <div 
                    className="w-16 h-16 rounded-lg border"
                    style={{ backgroundColor: websiteData.colors.secondary }}
                    title="Cor Secundária"
                  />
                  <div 
                    className="w-16 h-16 rounded-lg border"
                    style={{ backgroundColor: websiteData.colors.accent }}
                    title="Cor de Destaque"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contact" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Informações de Contato
              </CardTitle>
              <CardDescription>
                Configure os dados de contato que aparecerão no site
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {getCurrentTemplateConfig().contact.phone && (
                  <div>
                    <Label htmlFor="phone">Telefone</Label>
                    <Input
                      id="phone"
                      value={websiteData.content.contact.phone}
                      onChange={(e) => updateWebsiteData('content.contact.phone', e.target.value)}
                      placeholder="(11) 99999-9999"
                    />
                  </div>
                )}
                
                {getCurrentTemplateConfig().contact.whatsapp && (
                  <div>
                    <Label htmlFor="whatsapp" className="flex items-center gap-2">
                      <MessageCircle className="h-4 w-4 text-green-500" />
                      WhatsApp
                    </Label>
                    <Input
                      id="whatsapp"
                      value={websiteData.content.contact.whatsapp}
                      onChange={(e) => updateWebsiteData('content.contact.whatsapp', e.target.value)}
                      placeholder="(11) 99999-9999"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Será usado para o botão de WhatsApp flutuante no site
                    </p>
                  </div>
                )}
              </div>
              
              {getCurrentTemplateConfig().contact.email && (
                <div>
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={websiteData.content.contact.email}
                    onChange={(e) => updateWebsiteData('content.contact.email', e.target.value)}
                    placeholder="contato@clinica.com"
                  />
                </div>
              )}
              
              {getCurrentTemplateConfig().contact.address && (
                <div>
                  <Label htmlFor="address">Endereço</Label>
                  <Textarea
                    id="address"
                    value={websiteData.content.contact.address}
                    onChange={(e) => updateWebsiteData('content.contact.address', e.target.value)}
                    placeholder="Rua Example, 123 - Bairro - Cidade/UF"
                    rows={2}
                  />
                </div>
              )}
              
              {getCurrentTemplateConfig().contact.hours && (
                <div>
                  <Label htmlFor="hours">Horário de Funcionamento</Label>
                  <Input
                    id="hours"
                    value={websiteData.content.contact.hours}
                    onChange={(e) => updateWebsiteData('content.contact.hours', e.target.value)}
                    placeholder="Segunda a Sexta: 8h às 18h"
                  />
                </div>
              )}

              {websiteData.content.contact.whatsapp && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageCircle className="h-5 w-5 text-green-600" />
                    <p className="font-medium text-green-800">WhatsApp Configurado</p>
                  </div>
                  <p className="text-sm text-green-700">
                    Visitantes poderão entrar em contato diretamente pelo WhatsApp através do botão flutuante no site.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="social" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Redes Sociais</CardTitle>
              <CardDescription>
                Configure as redes sociais da clínica que aparecerão no site
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {getCurrentTemplateConfig().social.instagram && (
                <div>
                  <Label htmlFor="instagram">Instagram</Label>
                  <Input
                    id="instagram"
                    value={websiteData.social?.instagram || ''}
                    onChange={(e) => updateWebsiteData('social.instagram', e.target.value)}
                    placeholder="https://instagram.com/sua_clinica"
                  />
                </div>
              )}
              
              {getCurrentTemplateConfig().social.facebook && (
                <div>
                  <Label htmlFor="facebook">Facebook</Label>
                  <Input
                    id="facebook"
                    value={websiteData.social?.facebook || ''}
                    onChange={(e) => updateWebsiteData('social.facebook', e.target.value)}
                    placeholder="https://facebook.com/sua_clinica"
                  />
                </div>
              )}
              
              {getCurrentTemplateConfig().social.linkedin && (
                <div>
                  <Label htmlFor="linkedin">LinkedIn</Label>
                  <Input
                    id="linkedin"
                    value={websiteData.social?.linkedin || ''}
                    onChange={(e) => updateWebsiteData('social.linkedin', e.target.value)}
                    placeholder="https://linkedin.com/company/sua_clinica"
                  />
                </div>
              )}
              
              {getCurrentTemplateConfig().social.youtube && (
                <div>
                  <Label htmlFor="youtube">YouTube</Label>
                  <Input
                    id="youtube"
                    value={websiteData.social?.youtube || ''}
                    onChange={(e) => updateWebsiteData('social.youtube', e.target.value)}
                    placeholder="https://youtube.com/@sua_clinica"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gallery" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Galeria de Fotos
              </CardTitle>
              <CardDescription>
                Adicione fotos da clínica, equipe e tratamentos realizados
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600 mb-2">Arraste fotos aqui ou clique para selecionar</p>
                <p className="text-sm text-gray-500">PNG, JPG até 5MB cada</p>
                <Button variant="outline" className="mt-4">
                  Selecionar Fotos
                </Button>
              </div>
              
              {websiteData.content.gallery.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                  {websiteData.content.gallery.map((image, index) => (
                    <div key={index} className="relative aspect-square border rounded-lg overflow-hidden">
                      <img src={image} alt={`Galeria ${index + 1}`} className="w-full h-full object-cover" />
                      <Button
                        variant="destructive"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() => {
                          const newGallery = websiteData.content.gallery.filter((_, i) => i !== index);
                          updateWebsiteData('content.gallery', newGallery);
                        }}
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="seo" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Configurações de SEO
              </CardTitle>
              <CardDescription>
                Otimize seu site para mecanismos de busca como Google
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="seoTitle">Título SEO</Label>
                <Input
                  id="seoTitle"
                  value={websiteData.seo.title}
                  onChange={(e) => updateWebsiteData('seo.title', e.target.value)}
                  placeholder="Clínica Odontológica - Melhor Dentista da Região"
                  maxLength={60}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {websiteData.seo.title.length}/60 caracteres
                </p>
              </div>
              
              <div>
                <Label htmlFor="seoDescription">Descrição SEO</Label>
                <Textarea
                  id="seoDescription"
                  value={websiteData.seo.description}
                  onChange={(e) => updateWebsiteData('seo.description', e.target.value)}
                  placeholder="Clínica odontológica com mais de 10 anos de experiência..."
                  rows={3}
                  maxLength={160}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {websiteData.seo.description.length}/160 caracteres
                </p>
              </div>
              
              <div>
                <Label htmlFor="seoKeywords">Palavras-chave</Label>
                <Input
                  id="seoKeywords"
                  value={websiteData.seo.keywords}
                  onChange={(e) => updateWebsiteData('seo.keywords', e.target.value)}
                  placeholder="dentista, clínica odontológica, tratamento dental, ortodontia"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Separe as palavras-chave com vírgulas
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}