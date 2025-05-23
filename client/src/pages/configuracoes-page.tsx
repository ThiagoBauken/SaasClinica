import { useState, useEffect } from "react";
import DashboardLayout from "@/layouts/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
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
  Info,
  Loader2
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
import { useClinicSettings } from "@/hooks/use-clinic-settings";
import { useFiscalSettings } from "@/hooks/use-fiscal-settings";

export default function ConfiguracoesPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("clinica");
  
  // Hooks para carregar e gerenciar as configurações
  const { 
    clinicSettings, 
    isLoading: isLoadingClinic, 
    updateClinicSettings,
    isUpdating: isUpdatingClinic
  } = useClinicSettings();
  
  const {
    fiscalSettings,
    isLoading: isLoadingFiscal,
    updateFiscalSettings,
    isUpdating: isUpdatingFiscal
  } = useFiscalSettings();
  
  // Formulário da clínica
  const [clinicForm, setClinicForm] = useState({
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
  
  // Formulário fiscal
  const [fiscalForm, setFiscalForm] = useState({
    nfseProvider: "",
    nfseToken: "",
    nfseUrl: "",
    emitReceiptFor: "all",
    receiptType: "standard",
    defaultTaxRate: "0",
    defaultServiceCode: "",
    termsAndConditions: ""
  });
  
  // Atualiza os formulários quando os dados são carregados
  useEffect(() => {
    if (clinicSettings) {
      setClinicForm({
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
  
  useEffect(() => {
    if (fiscalSettings) {
      setFiscalForm({
        nfseProvider: fiscalSettings.nfseProvider || "",
        nfseToken: fiscalSettings.nfseToken || "",
        nfseUrl: fiscalSettings.nfseUrl || "",
        emitReceiptFor: fiscalSettings.emitReceiptFor || "all",
        receiptType: fiscalSettings.receiptType || "standard",
        defaultTaxRate: fiscalSettings.defaultTaxRate?.toString() || "0",
        defaultServiceCode: fiscalSettings.defaultServiceCode || "",
        termsAndConditions: fiscalSettings.termsAndConditions || ""
      });
    }
  }, [fiscalSettings]);
  
  // Função para lidar com mudanças no formulário da clínica
  const handleClinicChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { id, value } = e.target;
    setClinicForm(prev => ({
      ...prev,
      [id]: value
    }));
  };
  
  // Função para lidar com mudanças em switches
  const handleSwitchChange = (checked: boolean, id: string) => {
    setClinicForm(prev => ({
      ...prev,
      [id]: checked
    }));
  };
  
  // Função para lidar com mudanças no select
  const handleSelectChange = (value: string, id: string) => {
    setClinicForm(prev => ({
      ...prev,
      [id]: value
    }));
  };
  
  // Função para lidar com mudanças no formulário fiscal
  const handleFiscalChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { id, value } = e.target;
    setFiscalForm(prev => ({
      ...prev,
      [id]: value
    }));
  };
  
  // Função para lidar com mudanças no select do formulário fiscal
  const handleFiscalSelectChange = (value: string, id: string) => {
    setFiscalForm(prev => ({
      ...prev,
      [id]: value
    }));
  };
  
  // Função para salvar as configurações
  const salvarConfiguracoes = () => {
    if (activeTab === "clinica") {
      updateClinicSettings(clinicForm);
    } else if (activeTab === "fiscal") {
      // Converte o defaultTaxRate para número
      const formattedForm = {
        ...fiscalForm,
        defaultTaxRate: parseFloat(fiscalForm.defaultTaxRate)
      };
      updateFiscalSettings(formattedForm);
    } else {
      toast({
        title: "Configurações salvas",
        description: "As configurações foram salvas com sucesso.",
      });
    }
  };

  return (
    <DashboardLayout title="Configurações" currentPath="/configuracoes">
      <div className="flex flex-col space-y-6 p-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
          <Button 
            onClick={salvarConfiguracoes}
            className="bg-gradient-to-r from-blue-600 to-blue-500"
            disabled={
              (activeTab === "clinica" && isUpdatingClinic) || 
              (activeTab === "fiscal" && isUpdatingFiscal)
            }
          >
            {((activeTab === "clinica" && isUpdatingClinic) || 
              (activeTab === "fiscal" && isUpdatingFiscal)) 
              ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : "Salvar Configurações"
            }
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
                {isLoadingClinic ? (
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
                          value={clinicForm.name}
                          onChange={handleClinicChange}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cnpj">CNPJ*</Label>
                        <Input 
                          id="cnpj" 
                          placeholder="00.000.000/0000-00" 
                          value={clinicForm.cnpj}
                          onChange={handleClinicChange}
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="tradingName">Nome fantasia</Label>
                        <Input 
                          id="tradingName" 
                          placeholder="Nome comercial da clínica" 
                          value={clinicForm.tradingName}
                          onChange={handleClinicChange}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="responsible">Responsável técnico</Label>
                        <Input 
                          id="responsible" 
                          placeholder="Nome do responsável técnico" 
                          value={clinicForm.responsible}
                          onChange={handleClinicChange}
                        />
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div>
                      <h3 className="text-lg font-medium mb-4">Horário de funcionamento</h3>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="openingTime">Horário de abertura*</Label>
                          <Input 
                            id="openingTime" 
                            type="time" 
                            value={clinicForm.openingTime}
                            onChange={handleClinicChange}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="closingTime">Horário de fechamento*</Label>
                          <Input 
                            id="closingTime" 
                            type="time" 
                            value={clinicForm.closingTime}
                            onChange={handleClinicChange}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="timeZone">Fuso horário*</Label>
                          <Select 
                            value={clinicForm.timeZone}
                            onValueChange={(value) => handleSelectChange(value, "timeZone")}
                          >
                            <SelectTrigger id="timeZone">
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
                          <Label htmlFor="zipCode">CEP*</Label>
                          <Input 
                            id="zipCode" 
                            placeholder="00000-000" 
                            value={clinicForm.zipCode}
                            onChange={handleClinicChange}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="address">Endereço*</Label>
                          <Input 
                            id="address" 
                            placeholder="Rua, Avenida, etc." 
                            value={clinicForm.address}
                            onChange={handleClinicChange}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div className="space-y-2">
                          <Label htmlFor="number">Número*</Label>
                          <Input 
                            id="number" 
                            placeholder="123" 
                            value={clinicForm.number}
                            onChange={handleClinicChange}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="complement">Complemento</Label>
                          <Input 
                            id="complement" 
                            placeholder="Sala, Andar, etc." 
                            value={clinicForm.complement}
                            onChange={handleClinicChange}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="neighborhood">Bairro*</Label>
                          <Input 
                            id="neighborhood" 
                            placeholder="Bairro" 
                            value={clinicForm.neighborhood}
                            onChange={handleClinicChange}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="space-y-2">
                          <Label htmlFor="city">Cidade*</Label>
                          <Input 
                            id="city" 
                            placeholder="Sua cidade" 
                            value={clinicForm.city}
                            onChange={handleClinicChange}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="state">Estado*</Label>
                          <Select 
                            value={clinicForm.state}
                            onValueChange={(value) => handleSelectChange(value, "state")}
                          >
                            <SelectTrigger id="state">
                              <SelectValue placeholder="Selecione o estado" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="SP">São Paulo</SelectItem>
                              <SelectItem value="RJ">Rio de Janeiro</SelectItem>
                              <SelectItem value="MG">Minas Gerais</SelectItem>
                              <SelectItem value="BA">Bahia</SelectItem>
                              <SelectItem value="RS">Rio Grande do Sul</SelectItem>
                              <SelectItem value="AC">Acre</SelectItem>
                              <SelectItem value="AL">Alagoas</SelectItem>
                              <SelectItem value="AP">Amapá</SelectItem>
                              <SelectItem value="AM">Amazonas</SelectItem>
                              <SelectItem value="CE">Ceará</SelectItem>
                              <SelectItem value="DF">Distrito Federal</SelectItem>
                              <SelectItem value="ES">Espírito Santo</SelectItem>
                              <SelectItem value="GO">Goiás</SelectItem>
                              <SelectItem value="MA">Maranhão</SelectItem>
                              <SelectItem value="MT">Mato Grosso</SelectItem>
                              <SelectItem value="MS">Mato Grosso do Sul</SelectItem>
                              <SelectItem value="PA">Pará</SelectItem>
                              <SelectItem value="PB">Paraíba</SelectItem>
                              <SelectItem value="PR">Paraná</SelectItem>
                              <SelectItem value="PE">Pernambuco</SelectItem>
                              <SelectItem value="PI">Piauí</SelectItem>
                              <SelectItem value="RN">Rio Grande do Norte</SelectItem>
                              <SelectItem value="RO">Rondônia</SelectItem>
                              <SelectItem value="RR">Roraima</SelectItem>
                              <SelectItem value="SC">Santa Catarina</SelectItem>
                              <SelectItem value="SE">Sergipe</SelectItem>
                              <SelectItem value="TO">Tocantins</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="space-y-2">
                          <Label htmlFor="email">E-mail*</Label>
                          <Input 
                            id="email" 
                            type="email" 
                            placeholder="contato@clinica.com.br" 
                            value={clinicForm.email}
                            onChange={handleClinicChange}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="phone">Telefone*</Label>
                          <Input 
                            id="phone" 
                            placeholder="(00) 00000-0000" 
                            value={clinicForm.phone}
                            onChange={handleClinicChange}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cellphone">Celular/WhatsApp</Label>
                        <Input 
                          id="cellphone" 
                          placeholder="(00) 00000-0000" 
                          value={clinicForm.cellphone}
                          onChange={handleClinicChange}
                        />
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div>
                      <h3 className="text-lg font-medium mb-4">Logo da clínica</h3>
                      <div className="flex items-start space-x-6">
                        <div className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-md flex items-center justify-center">
                          {clinicForm.logo ? (
                            <img 
                              src={clinicForm.logo} 
                              alt="Logo da clínica" 
                              className="max-w-full max-h-full object-contain"
                            />
                          ) : (
                            <div className="text-center">
                              <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">Arraste ou clique</span>
                            </div>
                          )}
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground">
                            Envie uma imagem no formato JPG, PNG ou SVG com no máximo 2MB.
                            A logo será utilizada nos documentos, relatórios e área do paciente.
                          </p>
                          <div className="flex space-x-2">
                            <Button variant="outline" size="sm">Selecionar arquivo</Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="text-destructive"
                              onClick={() => setClinicForm(prev => ({...prev, logo: ""}))}
                              disabled={!clinicForm.logo}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Remover
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div>
                      <h3 className="text-lg font-medium mb-4">Opções de Recibo</h3>
                      <div className="flex items-center space-x-2 mb-4">
                        <Switch 
                          id="receiptPrintEnabled"
                          checked={clinicForm.receiptPrintEnabled}
                          onCheckedChange={(checked) => handleSwitchChange(checked, "receiptPrintEnabled")}
                        />
                        <Label htmlFor="receiptPrintEnabled">Habilitar impressão automática de recibos</Label>
                      </div>
                      
                      <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="receiptHeader">Cabeçalho do recibo</Label>
                          <Input 
                            id="receiptHeader" 
                            placeholder="Texto para o cabeçalho do recibo" 
                            value={clinicForm.receiptHeader}
                            onChange={handleClinicChange}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="receiptFooter">Rodapé do recibo</Label>
                          <Input 
                            id="receiptFooter" 
                            placeholder="Texto para o rodapé do recibo" 
                            value={clinicForm.receiptFooter}
                            onChange={handleClinicChange}
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}
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
                {isLoadingFiscal ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-6">
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">Integração com sistema de Nota Fiscal</h3>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="nfseProvider" className="flex items-center">
                            Provedor de NFS-e
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="h-4 w-4 ml-1 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Selecione o provedor de emissão de Nota Fiscal de Serviços Eletrônica</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </Label>
                          <Select 
                            value={fiscalForm.nfseProvider}
                            onValueChange={(value) => handleFiscalSelectChange(value, "nfseProvider")}
                          >
                            <SelectTrigger id="nfseProvider">
                              <SelectValue placeholder="Selecione o provedor" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="nfse-municipal">NFSe Municipal</SelectItem>
                              <SelectItem value="webiss">WebISS</SelectItem>
                              <SelectItem value="prodata">Prodata</SelectItem>
                              <SelectItem value="ginfes">Ginfes</SelectItem>
                              <SelectItem value="simpliss">Simpliss</SelectItem>
                              <SelectItem value="betha">Betha</SelectItem>
                              <SelectItem value="outro">Outro</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="nfseToken">Token de API</Label>
                          <Input 
                            id="nfseToken" 
                            placeholder="Token de autenticação do serviço" 
                            value={fiscalForm.nfseToken}
                            onChange={handleFiscalChange}
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="nfseUrl">URL do serviço</Label>
                        <Input 
                          id="nfseUrl" 
                          placeholder="https://api.servico-nfse.com.br" 
                          value={fiscalForm.nfseUrl}
                          onChange={handleFiscalChange}
                        />
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">Configurações de Recibo / Nota Fiscal</h3>
                      
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="space-y-2">
                          <Label htmlFor="emitReceiptFor">Emitir recibo para</Label>
                          <Select 
                            value={fiscalForm.emitReceiptFor}
                            onValueChange={(value) => handleFiscalSelectChange(value, "emitReceiptFor")}
                          >
                            <SelectTrigger id="emitReceiptFor">
                              <SelectValue placeholder="Selecione quando emitir" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Todos os pagamentos</SelectItem>
                              <SelectItem value="cash">Apenas pagamentos em dinheiro</SelectItem>
                              <SelectItem value="card">Apenas pagamentos em cartão</SelectItem>
                              <SelectItem value="none">Não emitir automaticamente</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="receiptType">Tipo de recibo</Label>
                          <Select 
                            value={fiscalForm.receiptType}
                            onValueChange={(value) => handleFiscalSelectChange(value, "receiptType")}
                          >
                            <SelectTrigger id="receiptType">
                              <SelectValue placeholder="Selecione o tipo" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="standard">Padrão</SelectItem>
                              <SelectItem value="simplified">Simplificado</SelectItem>
                              <SelectItem value="detailed">Detalhado</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="defaultTaxRate">Alíquota padrão (%)</Label>
                          <Input 
                            id="defaultTaxRate" 
                            type="number" 
                            placeholder="0.00" 
                            value={fiscalForm.defaultTaxRate}
                            onChange={handleFiscalChange}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="defaultServiceCode">Código de serviço padrão</Label>
                          <Input 
                            id="defaultServiceCode" 
                            placeholder="Código de serviço" 
                            value={fiscalForm.defaultServiceCode}
                            onChange={handleFiscalChange}
                          />
                        </div>
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div className="space-y-2">
                      <Label htmlFor="termsAndConditions">Termos e condições padrão</Label>
                      <Textarea 
                        id="termsAndConditions" 
                        placeholder="Digite os termos e condições que aparecerão nos documentos fiscais..."
                        value={fiscalForm.termsAndConditions}
                        onChange={handleFiscalChange}
                        rows={4}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Modelos */}
          <TabsContent value="modelos">
            <Card>
              <CardHeader>
                <CardTitle>Modelos de Documentos</CardTitle>
                <CardDescription>
                  Configure os modelos de documentos, termos e laudos utilizados na clínica
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <Card className="cursor-pointer hover:border-primary transition-colors">
                    <CardHeader className="p-4">
                      <CardTitle className="text-base font-medium">Anamnese</CardTitle>
                      <CardDescription className="text-xs">Modelo padrão</CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 flex justify-between items-center">
                      <div className="text-sm text-muted-foreground">10 perguntas</div>
                      <Button variant="ghost" size="sm">
                        <FileText className="h-4 w-4 mr-1" />
                        Editar
                      </Button>
                    </CardContent>
                  </Card>
                  
                  <Card className="cursor-pointer hover:border-primary transition-colors">
                    <CardHeader className="p-4">
                      <CardTitle className="text-base font-medium">Termo de Consentimento</CardTitle>
                      <CardDescription className="text-xs">Tratamento ortodôntico</CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 flex justify-between items-center">
                      <div className="text-sm text-muted-foreground">4 páginas</div>
                      <Button variant="ghost" size="sm">
                        <FileText className="h-4 w-4 mr-1" />
                        Editar
                      </Button>
                    </CardContent>
                  </Card>
                  
                  <Card className="cursor-pointer hover:border-primary transition-colors">
                    <CardHeader className="p-4">
                      <CardTitle className="text-base font-medium">Laudo de Radiografia</CardTitle>
                      <CardDescription className="text-xs">Padrão completo</CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 flex justify-between items-center">
                      <div className="text-sm text-muted-foreground">2 páginas</div>
                      <Button variant="ghost" size="sm">
                        <FileText className="h-4 w-4 mr-1" />
                        Editar
                      </Button>
                    </CardContent>
                  </Card>
                </div>
                
                <div className="mt-4 flex justify-end">
                  <Button>
                    <FileText className="h-4 w-4 mr-2" />
                    Novo Modelo
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Sistema */}
          <TabsContent value="sistema">
            <Card>
              <CardHeader>
                <CardTitle>Configurações do Sistema</CardTitle>
                <CardDescription>
                  Configure as preferências gerais do sistema, notificações e integrações
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Notificações</h3>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <BellRing className="h-4 w-4 text-muted-foreground" />
                        <Label htmlFor="notify-appointments" className="text-sm font-medium">
                          Notificações de agendamentos
                        </Label>
                      </div>
                      <Switch id="notify-appointments" defaultChecked />
                    </div>
                    <p className="text-sm text-muted-foreground ml-6">
                      Receba notificações sobre novos agendamentos, reagendamentos e cancelamentos.
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <Label htmlFor="email-notifications" className="text-sm font-medium">
                          Notificações por e-mail
                        </Label>
                      </div>
                      <Switch id="email-notifications" defaultChecked />
                    </div>
                    <p className="text-sm text-muted-foreground ml-6">
                      Envie notificações por e-mail para pacientes sobre consultas e pagamentos.
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                        <Label htmlFor="payment-notifications" className="text-sm font-medium">
                          Notificações de pagamentos
                        </Label>
                      </div>
                      <Switch id="payment-notifications" defaultChecked />
                    </div>
                    <p className="text-sm text-muted-foreground ml-6">
                      Receba notificações sobre novos pagamentos, atrasos e vencimentos.
                    </p>
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Integrações</h3>
                  
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="whatsapp-api">API WhatsApp Business</Label>
                        <Input id="whatsapp-api" placeholder="Token de API" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="google-calendar">Google Calendar</Label>
                        <Input id="google-calendar" placeholder="ID do calendário" />
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Checkbox id="enable-google-calendar" />
                      <Label htmlFor="enable-google-calendar" className="text-sm">
                        Sincronizar eventos com Google Calendar
                      </Label>
                    </div>
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Backup e dados</h3>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="text-sm font-medium">Backup automático</h4>
                        <p className="text-sm text-muted-foreground">
                          Frequência de backup dos dados do sistema
                        </p>
                      </div>
                      <Select defaultValue="daily">
                        <SelectTrigger className="w-[160px]">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="hourly">A cada hora</SelectItem>
                          <SelectItem value="daily">Diariamente</SelectItem>
                          <SelectItem value="weekly">Semanalmente</SelectItem>
                          <SelectItem value="monthly">Mensalmente</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="flex justify-between">
                    <Button variant="outline">Fazer backup agora</Button>
                    <Button variant="outline" className="text-destructive">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Limpar dados de cache
                    </Button>
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Ajuda e suporte</h3>
                  
                  <div className="bg-muted/50 p-4 rounded-md flex items-start space-x-4">
                    <HelpCircle className="h-5 w-5 text-blue-500 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-medium">Precisa de ajuda?</h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        Nossa equipe está disponível para ajudar com quaisquer dúvidas sobre o sistema.
                      </p>
                      <Button variant="link" className="p-0 h-auto text-blue-500">
                        Acessar central de ajuda
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}