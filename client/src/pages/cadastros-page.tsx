import { useState } from "react";
import DashboardLayout from "@/layouts/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Settings, 
  Trash2, 
  PencilIcon, 
  Plus,
  Copy,
  HelpCircle,
  BoxSelect,
  Layout,
  Bed,
  Package
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function CadastrosPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("categorias");
  
  const salvarItem = () => {
    toast({
      title: "Item salvo",
      description: "O item foi salvo com sucesso.",
    });
  };

  return (
    <DashboardLayout title="Cadastros" currentPath="/cadastros">
      <div className="flex flex-col space-y-6 p-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight">Cadastros</h1>
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="categorias" className="flex items-center justify-center">
              <BoxSelect className="h-4 w-4 mr-2" />
              <span>Categorias</span>
            </TabsTrigger>
            <TabsTrigger value="caixas" className="flex items-center justify-center">
              <Package className="h-4 w-4 mr-2" />
              <span>Caixas</span>
            </TabsTrigger>
            <TabsTrigger value="cadeiras" className="flex items-center justify-center">
              <Bed className="h-4 w-4 mr-2" />
              <span>Cadeiras</span>
            </TabsTrigger>
            <TabsTrigger value="contrato" className="flex items-center justify-center">
              <Layout className="h-4 w-4 mr-2" />
              <span>Modelos de Contrato</span>
            </TabsTrigger>
          </TabsList>
          
          {/* Categorias */}
          <TabsContent value="categorias">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Categorias</CardTitle>
                    <CardDescription>
                      Gerencie as categorias de despesas e receitas do seu consultório
                    </CardDescription>
                  </div>
                  <Button onClick={salvarItem}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Categoria
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead className="w-[100px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>Contabilidade</TableCell>
                      <TableCell className="flex space-x-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <PencilIcon className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Custos Fixos (aluguel, telefone, internet, licença de software)</TableCell>
                      <TableCell className="flex space-x-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <PencilIcon className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Despesas bancárias</TableCell>
                      <TableCell className="flex space-x-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <PencilIcon className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Encargos de funcionários</TableCell>
                      <TableCell className="flex space-x-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <PencilIcon className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Infraestrutura</TableCell>
                      <TableCell className="flex space-x-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <PencilIcon className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Laboratórios</TableCell>
                      <TableCell className="flex space-x-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <PencilIcon className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Materiais odontológicos</TableCell>
                      <TableCell className="flex space-x-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <PencilIcon className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Outras</TableCell>
                      <TableCell className="flex space-x-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <PencilIcon className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
                
                <div className="flex justify-center mt-6">
                  <Button variant="outline" className="flex items-center mx-auto">
                    <HelpCircle className="h-4 w-4 mr-2" />
                    <span>Dúvidas? Saiba tudo sobre Categorias</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Caixas */}
          <TabsContent value="caixas">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Caixas</CardTitle>
                    <CardDescription>
                      Gerencie os caixas e contas do seu consultório
                    </CardDescription>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="flex space-x-2 items-center">
                      <span className="text-sm text-muted-foreground">Exibir:</span>
                      <select className="text-sm border rounded-md px-2 py-1">
                        <option>Ativos</option>
                        <option>Todos</option>
                      </select>
                    </div>
                    <Button onClick={salvarItem}>
                      <Plus className="h-4 w-4 mr-2" />
                      Novo Caixa
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead className="w-[100px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>
                        <div className="flex items-center">
                          <span className="inline-block w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
                          Clínica
                        </div>
                      </TableCell>
                      <TableCell className="flex space-x-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <PencilIcon className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>
                        <div className="flex items-center">
                          <span className="inline-block w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                          Conta do Banco
                        </div>
                      </TableCell>
                      <TableCell className="flex space-x-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <PencilIcon className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
                
                <div className="flex justify-center mt-6">
                  <Button variant="outline" className="flex items-center mx-auto">
                    <HelpCircle className="h-4 w-4 mr-2" />
                    <span>Dúvidas? Saiba tudo sobre Caixas</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Cadeiras */}
          <TabsContent value="cadeiras">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Cadeiras</CardTitle>
                    <CardDescription>
                      Gerencie as cadeiras e salas do seu consultório
                    </CardDescription>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="flex space-x-2 items-center">
                      <span className="text-sm text-muted-foreground">Exibir:</span>
                      <select className="text-sm border rounded-md px-2 py-1">
                        <option>Ativas</option>
                        <option>Todas</option>
                      </select>
                    </div>
                    <Button onClick={salvarItem}>
                      <Plus className="h-4 w-4 mr-2" />
                      Nova Cadeira
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead className="w-[100px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>Cadeira 01</TableCell>
                      <TableCell className="flex space-x-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <PencilIcon className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Cadeira 02</TableCell>
                      <TableCell className="flex space-x-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <PencilIcon className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
                
                <div className="flex justify-center mt-6">
                  <Button variant="outline" className="flex items-center mx-auto">
                    <HelpCircle className="h-4 w-4 mr-2" />
                    <span>Dúvidas? Saiba tudo sobre Cadeiras</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Modelos de Contratos */}
          <TabsContent value="contrato">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Modelos de contratos</CardTitle>
                    <CardDescription>
                      Gerencie os modelos de contratos para seus pacientes
                    </CardDescription>
                  </div>
                  <Button onClick={salvarItem}>
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Modelo
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead className="w-[150px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>Contrato de prestação de serviços odontológicos</TableCell>
                      <TableCell className="flex space-x-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <PencilIcon className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
                
                <div className="flex justify-center mt-6">
                  <Button variant="outline" className="flex items-center mx-auto">
                    <HelpCircle className="h-4 w-4 mr-2" />
                    <span>Dúvidas? Saiba tudo sobre modelos de contratos</span>
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