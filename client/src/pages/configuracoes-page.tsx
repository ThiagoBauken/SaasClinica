import { useState } from "react";
import DashboardLayout from "@/layouts/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Settings, 
  Building2, 
  FileText, 
  Clock, 
  Users2, 
  Paperclip, 
  BellRing, 
  Mail, 
  CreditCard,
  Calculator,
  Upload,
  Trash2,
  HelpCircle,
  Info
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function ConfiguracoesPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("clinica");

  const salvarConfiguracoes = () => {
    toast({
      title: "Configurações salvas",
      description: "As configurações foram salvas com sucesso.",
    });
  };

  return (
    <DashboardLayout title="Configurações" currentPath="/configuracoes">
      <div className="flex flex-col space-y-6 p-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
          <Button 
            onClick={salvarConfiguracoes}
            className="bg-gradient-to-r from-blue-600 to-blue-500"
          >
            Salvar Configurações
          </Button>
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="clinica" className="flex items-center justify-center">
              <Building2 className="h-4 w-4 mr-2" />
              <span>Dados da Clínica</span>
            </TabsTrigger>
            <TabsTrigger value="equipe" className="flex items-center justify-center">
              <Users2 className="h-4 w-4 mr-2" />
              <span>Equipe</span>
            </TabsTrigger>
            <TabsTrigger value="fiscal" className="flex items-center justify-center">
              <FileText className="h-4 w-4 mr-2" />
              <span>Nota Fiscal</span>
            </TabsTrigger>
            <TabsTrigger value="modelos" className="flex items-center justify-center">
              <Paperclip className="h-4 w-4 mr-2" />
              <span>Modelos</span>
            </TabsTrigger>
            <TabsTrigger value="sistema" className="flex items-center justify-center">
              <Settings className="h-4 w-4 mr-2" />
              <span>Sistema</span>
            </TabsTrigger>
          </TabsList>
          
          {/* Dados da Clínica */}
          <TabsContent value="clinica">
            <Card>
              <CardHeader>
                <CardTitle>Dados da Clínica</CardTitle>
                <CardDescription>
                  Configure as informações básicas da sua clínica ou consultório
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="clinicName">Nome da clínica*</Label>
                    <Input id="clinicName" placeholder="Ex: Odontologia Dr. Silva" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clinicCNPJ">CNPJ*</Label>
                    <Input id="clinicCNPJ" placeholder="00.000.000/0000-00" />
                  </div>
                </div>
                
                <Separator />
                
                <div>
                  <h3 className="text-lg font-medium mb-4">Horário de funcionamento</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="openingHours">Horário de abertura*</Label>
                      <Input id="openingHours" type="time" defaultValue="08:00" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="closingHours">Horário de fechamento*</Label>
                      <Input id="closingHours" type="time" defaultValue="18:00" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="timezone">Fuso horário*</Label>
                      <Select defaultValue="America/Sao_Paulo">
                        <SelectTrigger id="timezone">
                          <SelectValue placeholder="Selecione o fuso horário" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="America/Sao_Paulo">Brasília/São Paulo</SelectItem>
                          <SelectItem value="America/Manaus">Manaus</SelectItem>
                          <SelectItem value="America/Belem">Belém</SelectItem>
                          <SelectItem value="America/Bahia">Salvador</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                
                <Separator />
                
                <div>
                  <h3 className="text-lg font-medium mb-4">Endereço e contato</h3>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="space-y-2">
                      <Label htmlFor="cep">CEP*</Label>
                      <Input id="cep" placeholder="00000-000" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="address">Endereço*</Label>
                      <Input id="address" placeholder="Rua, Avenida, etc." />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="space-y-2">
                      <Label htmlFor="number">Número*</Label>
                      <Input id="number" placeholder="123" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="complement">Complemento</Label>
                      <Input id="complement" placeholder="Sala, Andar, etc." />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="neighborhood">Bairro*</Label>
                      <Input id="neighborhood" placeholder="Bairro" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="space-y-2">
                      <Label htmlFor="city">Cidade*</Label>
                      <Input id="city" placeholder="Sua cidade" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">Estado*</Label>
                      <Select defaultValue="SP">
                        <SelectTrigger id="state">
                          <SelectValue placeholder="Selecione o estado" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SP">São Paulo</SelectItem>
                          <SelectItem value="RJ">Rio de Janeiro</SelectItem>
                          <SelectItem value="MG">Minas Gerais</SelectItem>
                          <SelectItem value="BA">Bahia</SelectItem>
                          <SelectItem value="RS">Rio Grande do Sul</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">E-mail*</Label>
                      <Input id="email" type="email" placeholder="contato@clinica.com.br" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Telefone*</Label>
                      <Input id="phone" placeholder="(00) 00000-0000" />
                    </div>
                  </div>
                </div>
                
                <Separator />
                
                <div>
                  <h3 className="text-lg font-medium mb-4">Logo da clínica</h3>
                  <div className="flex items-start space-x-6">
                    <div className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-md flex items-center justify-center">
                      <div className="text-center">
                        <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Arraste ou clique</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Envie uma imagem no formato JPG, PNG ou SVG com no máximo 2MB.
                        A logo será utilizada nos documentos, relatórios e área do paciente.
                      </p>
                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm">Selecionar arquivo</Button>
                        <Button variant="outline" size="sm" className="text-destructive">
                          <Trash2 className="h-4 w-4 mr-1" />
                          Remover
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Equipe */}
          <TabsContent value="equipe">
            <Card>
              <CardHeader>
                <CardTitle>Gerenciar Profissionais</CardTitle>
                <CardDescription>
                  Gerencie os profissionais da sua clínica, definindo permissões e configurações específicas
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex justify-between mb-6">
                  <div className="flex items-center space-x-4">
                    <Select defaultValue="todos">
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Filtrar por" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        <SelectItem value="dentistas">Dentistas</SelectItem>
                        <SelectItem value="auxiliares">Auxiliares</SelectItem>
                        <SelectItem value="recepcionistas">Recepcionistas</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex items-center space-x-2">
                      <Switch id="tax-switch" />
                      <Label htmlFor="tax-switch" className="text-sm">
                        Descontar taxas de maquininha das comissões
                      </Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>As taxas das maquininhas de cartão serão descontadas proporcionalmente das comissões dos profissionais.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                  <Button>
                    <Users2 className="h-4 w-4 mr-2" />
                    Adicionar Profissional
                  </Button>
                </div>
                
                <div className="bg-white rounded-md border p-4 relative">
                  <div className="flex items-center space-x-4 mb-4">
                    <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center text-sm font-medium">
                      BD
                    </div>
                    <div>
                      <h4 className="font-medium">Dra. Bauken Dental</h4>
                      <p className="text-sm text-muted-foreground">clinicodental@email.com</p>
                    </div>
                  </div>
                  
                  <div className="mb-2">
                    <div className="flex items-center space-x-2">
                      <Users2 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Dentista administrador(a)</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 mb-3">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">72 hs / 24 permissões</span>
                  </div>
                  
                  <Button variant="outline" size="sm" className="absolute right-4 top-4">
                    Editar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Nota Fiscal */}
          <TabsContent value="fiscal">
            <Card>
              <CardHeader>
                <CardTitle>Configurações Fiscais</CardTitle>
                <CardDescription>
                  Configure os parâmetros para emissão de nota fiscal e integração com o sistema tributário
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Informações da clínica</h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="cnpj" className="flex items-center">
                          CNPJ*
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-4 w-4 ml-1 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Número do CNPJ da sua clínica ou consultório</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </Label>
                        <Input id="cnpj" placeholder="00.000.000/0000-00" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="razaoSocial">Razão social*</Label>
                        <Input id="razaoSocial" placeholder="Nome oficial registrado no CNPJ" />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="inscricaoMunicipal">Inscrição municipal*</Label>
                        <Input id="inscricaoMunicipal" placeholder="Número da inscrição" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="regimeTributario">Regime tributário*</Label>
                        <Select defaultValue="simples">
                          <SelectTrigger id="regimeTributario">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="simples">Simples Nacional</SelectItem>
                            <SelectItem value="lucro_presumido">Lucro Presumido</SelectItem>
                            <SelectItem value="lucro_real">Lucro Real</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="regimeEspecialTributacao">Regime especial de tributação*</Label>
                        <Select defaultValue="nenhum">
                          <SelectTrigger id="regimeEspecialTributacao">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="nenhum">Nenhum</SelectItem>
                            <SelectItem value="microempresa">Microempresa Municipal</SelectItem>
                            <SelectItem value="estimativa">Estimativa</SelectItem>
                            <SelectItem value="sociedade">Sociedade de Profissionais</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Certificado Digital</h3>
                    <p className="text-sm text-muted-foreground">
                      Para emissão de notas fiscais, é necessário ter um certificado digital do tipo A1. 
                      Importe seu certificado abaixo:
                    </p>
                    
                    <div className="flex items-center space-x-4">
                      <Button variant="outline">
                        <Upload className="h-4 w-4 mr-2" />
                        Selecionar Certificado
                      </Button>
                      <div className="text-sm text-muted-foreground">
                        Nenhum certificado selecionado
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="certificatePassword">Senha do certificado</Label>
                      <Input id="certificatePassword" type="password" placeholder="Digite a senha do certificado" />
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Dados de serviço</h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="cnae">CNAE*</Label>
                        <Input id="cnae" placeholder="0000-0/00" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="codigoServico">Código do serviço (LC 116)*</Label>
                        <Input id="codigoServico" placeholder="00.00" />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="codigoTributacaoMunicipio">Código de tributação do município</Label>
                        <Input id="codigoTributacaoMunicipio" placeholder="Código conforme município" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="codigoServicoMunicipal">Código de serviço municipal</Label>
                        <Input id="codigoServicoMunicipal" placeholder="Código conforme município" />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="descricaoServico">Descrição do serviço</Label>
                        <Input id="descricaoServico" placeholder="Serviços odontológicos" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="aliquotaISS">Alíquota ISS (%)*</Label>
                        <Input id="aliquotaISS" placeholder="0.00" />
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Checkbox id="issRetido" />
                      <Label htmlFor="issRetido" className="text-sm">
                        ISS retido na fonte pelo tomador
                      </Label>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
                    <div className="flex items-start">
                      <Info className="h-5 w-5 text-blue-500 mr-2 mt-0.5" />
                      <p className="text-sm text-blue-700">
                        Importante: As informações acima necessitam estar corretas para evitar erros na emissão das notas fiscais. 
                        Recomendamos que o preenchimento seja realizado com assistência de um profissional contábil qualificado.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Modelos */}
          <TabsContent value="modelos">
            <Card>
              <CardHeader>
                <CardTitle>Modelos e Templates</CardTitle>
                <CardDescription>
                  Gerencie os modelos de documentos, anamnese e contratos da sua clínica
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Tabs defaultValue="anamnese" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="anamnese">Anamnese</TabsTrigger>
                    <TabsTrigger value="contratos">Contratos</TabsTrigger>
                    <TabsTrigger value="planos">Planos de Tratamento</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="anamnese" className="pt-4">
                    <div className="flex justify-between mb-6">
                      <Input placeholder="Buscar modelo de anamnese..." className="max-w-sm" />
                      <Button>
                        <FileText className="h-4 w-4 mr-2" />
                        Novo Modelo
                      </Button>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="p-4 border rounded-md flex justify-between items-center">
                        <div>
                          <h4 className="font-medium">Anamnese Completa</h4>
                          <p className="text-sm text-muted-foreground">7 perguntas</p>
                        </div>
                        <div className="flex space-x-2">
                          <Button variant="outline" size="sm">
                            <FileText className="h-4 w-4 mr-2" />
                            Editar
                          </Button>
                          <Button variant="outline" size="sm" className="text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </Button>
                        </div>
                      </div>
                      
                      <div className="p-4 border rounded-md flex justify-between items-center">
                        <div>
                          <h4 className="font-medium">Anamnese Ortodontia</h4>
                          <p className="text-sm text-muted-foreground">12 perguntas</p>
                        </div>
                        <div className="flex space-x-2">
                          <Button variant="outline" size="sm">
                            <FileText className="h-4 w-4 mr-2" />
                            Editar
                          </Button>
                          <Button variant="outline" size="sm" className="text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </Button>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="contratos" className="pt-4">
                    <div className="flex justify-between mb-6">
                      <Input placeholder="Buscar modelo de contrato..." className="max-w-sm" />
                      <Button>
                        <FileText className="h-4 w-4 mr-2" />
                        Novo Contrato
                      </Button>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="p-4 border rounded-md flex justify-between items-center">
                        <div>
                          <h4 className="font-medium">Contrato de prestação de serviços odontológicos</h4>
                          <p className="text-sm text-muted-foreground">Atualizado em 05/01/2025</p>
                        </div>
                        <div className="flex space-x-2">
                          <Button variant="outline" size="sm">
                            <FileText className="h-4 w-4 mr-2" />
                            Editar
                          </Button>
                          <Button variant="outline" size="sm" className="text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </Button>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="planos" className="pt-4">
                    <div className="flex justify-between mb-6">
                      <Input placeholder="Buscar plano de tratamento..." className="max-w-sm" />
                      <Button>
                        <FileText className="h-4 w-4 mr-2" />
                        Novo Plano
                      </Button>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="p-4 border rounded-md flex justify-between items-center">
                        <div>
                          <h4 className="font-medium">Plano Particular</h4>
                          <p className="text-sm text-muted-foreground">Tabela de valores para pacientes particulares</p>
                        </div>
                        <div className="flex space-x-2">
                          <Button variant="outline" size="sm">
                            <FileText className="h-4 w-4 mr-2" />
                            Editar
                          </Button>
                          <Button variant="outline" size="sm" className="text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </Button>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Sistema */}
          <TabsContent value="sistema">
            <Card>
              <CardHeader>
                <CardTitle>Configurações do Sistema</CardTitle>
                <CardDescription>
                  Configure preferências gerais do sistema, backup e integrações
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Preferências gerais</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="defaultCurrency">Moeda padrão</Label>
                      <Select defaultValue="BRL">
                        <SelectTrigger id="defaultCurrency">
                          <SelectValue placeholder="Selecione a moeda" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="BRL">Real (R$)</SelectItem>
                          <SelectItem value="USD">Dólar (US$)</SelectItem>
                          <SelectItem value="EUR">Euro (€)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="dateFormat">Formato de data</Label>
                      <Select defaultValue="DD/MM/YYYY">
                        <SelectTrigger id="dateFormat">
                          <SelectValue placeholder="Selecione o formato" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="DD/MM/YYYY">DD/MM/AAAA</SelectItem>
                          <SelectItem value="MM/DD/YYYY">MM/DD/AAAA</SelectItem>
                          <SelectItem value="YYYY-MM-DD">AAAA-MM-DD</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="defaultAgendaView">Visualização padrão da agenda</Label>
                      <Select defaultValue="week">
                        <SelectTrigger id="defaultAgendaView">
                          <SelectValue placeholder="Selecione a visualização" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="day">Diária</SelectItem>
                          <SelectItem value="week">Semanal</SelectItem>
                          <SelectItem value="month">Mensal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="language">Idioma</Label>
                      <Select defaultValue="pt_BR">
                        <SelectTrigger id="language">
                          <SelectValue placeholder="Selecione o idioma" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pt_BR">Português (Brasil)</SelectItem>
                          <SelectItem value="en_US">English (United States)</SelectItem>
                          <SelectItem value="es_ES">Español</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="automaticBackup">Backup automático</Label>
                        <p className="text-sm text-muted-foreground">
                          Realize backups automáticos diários dos seus dados
                        </p>
                      </div>
                      <Switch id="automaticBackup" />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="emailNotifications">Notificações por e-mail</Label>
                        <p className="text-sm text-muted-foreground">
                          Enviar lembretes de consulta e notificações por e-mail
                        </p>
                      </div>
                      <Switch id="emailNotifications" />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="smsNotifications">Notificações por SMS</Label>
                        <p className="text-sm text-muted-foreground">
                          Enviar lembretes de consulta e notificações por SMS
                        </p>
                      </div>
                      <Switch id="smsNotifications" />
                    </div>
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Integrações</h3>
                  
                  <div className="space-y-4">
                    <div className="p-4 border rounded-md">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 bg-slate-100 rounded-md flex items-center justify-center">
                            <Mail className="h-6 w-6 text-slate-600" />
                          </div>
                          <div>
                            <h4 className="font-medium">Integração com E-mail Marketing</h4>
                            <p className="text-sm text-muted-foreground">
                              Conecte sua conta para envio automático de campanhas
                            </p>
                          </div>
                        </div>
                        <Button variant="outline">Configurar</Button>
                      </div>
                    </div>
                    
                    <div className="p-4 border rounded-md">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 bg-slate-100 rounded-md flex items-center justify-center">
                            <CreditCard className="h-6 w-6 text-slate-600" />
                          </div>
                          <div>
                            <h4 className="font-medium">Integração com Gateway de Pagamento</h4>
                            <p className="text-sm text-muted-foreground">
                              Conecte sua conta para processar pagamentos online
                            </p>
                          </div>
                        </div>
                        <Button variant="outline">Configurar</Button>
                      </div>
                    </div>
                    
                    <div className="p-4 border rounded-md">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 bg-slate-100 rounded-md flex items-center justify-center">
                            <Calculator className="h-6 w-6 text-slate-600" />
                          </div>
                          <div>
                            <h4 className="font-medium">Integração com Software Contábil</h4>
                            <p className="text-sm text-muted-foreground">
                              Exporte dados financeiros para seu sistema contábil
                            </p>
                          </div>
                        </div>
                        <Button variant="outline">Configurar</Button>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="pt-4">
                  <Button variant="outline" className="w-full">
                    <HelpCircle className="h-4 w-4 mr-2" />
                    Solicitar Suporte
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}