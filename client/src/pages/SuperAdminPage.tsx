import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Shield, 
  Building2, 
  Settings, 
  Users,
  Calendar,
  DollarSign,
  Package,
  Scissors,
  Activity,
  Bot,
  CheckCircle,
  XCircle,
  AlertCircle,
  Plus,
  Search
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Company {
  id: number;
  name: string;
  cnpj?: string;
  email: string;
  phone?: string;
  address?: string;
  active: boolean;
  createdAt: string;
  moduleCount: number;
}

interface ModuleStatus {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  loadStatus: 'ok' | 'error' | 'loading';
  errorMessage?: string;
}

interface User {
  id: number;
  username: string;
  full_name: string;
  email: string;
  phone?: string;
  role: string;
  speciality?: string;
  active: boolean;
  created_at: string;
  company_id: number;
  company_name?: string;
}

interface Subscription {
  id: number;
  status: string;
  billing_cycle: string;
  current_period_start: string;
  current_period_end: string;
  trial_ends_at?: string;
  company_id: number;
  company_name: string;
  company_email: string;
  plan_id: number;
  plan_name: string;
  plan_display_name: string;
  monthly_price: string;
  yearly_price: string;
}

interface Plan {
  id: number;
  name: string;
  display_name: string;
  description?: string;
  monthly_price: string;
  yearly_price?: string;
  trial_days: number;
  max_users: number;
  max_patients: number;
  max_appointments_per_month: number;
  max_automations: number;
  max_storage_gb: number;
  features?: string[];
  is_active: boolean;
  is_popular: boolean;
  sort_order: number;
}

interface Invoice {
  id: number;
  amount: string;
  status: string; // pending, paid, failed, refunded
  due_date: string;
  paid_at?: string;
  payment_method?: string;
  invoice_url?: string;
  created_at: string;
  company_id: number;
  company_name: string;
  company_email: string;
  subscription_id: number;
}

const moduleIcons = {
  agenda: Calendar,
  pacientes: Users,
  financeiro: DollarSign,
  estoque: Package,
  proteses: Scissors,
  odontograma: Activity,
  automacoes: Bot,
  clinica: Settings
};

export default function SuperAdminPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [newUserForm, setNewUserForm] = useState({
    companyId: "",
    username: "",
    password: "",
    fullName: "",
    email: "",
    phone: "",
    role: "staff"
  });

  // Buscar empresas
  const { data: companies = [], isLoading: companiesLoading } = useQuery({
    queryKey: ["/api/saas/companies"],
    queryFn: async () => {
      const response = await fetch("/api/saas/companies");
      return response.json();
    }
  });

  // Buscar módulos da empresa selecionada
  const { data: companyModules = [], isLoading: modulesLoading, refetch: refetchModules } = useQuery({
    queryKey: ["/api/saas/companies", selectedCompany?.id, "modules"],
    queryFn: async () => {
      if (!selectedCompany) return [];
      const response = await fetch(`/api/saas/companies/${selectedCompany.id}/modules`);
      return response.json();
    },
    enabled: !!selectedCompany
  });

  // Buscar todos os usuários do SaaS
  const { data: allUsers = [], isLoading: usersLoading, refetch: refetchUsers } = useQuery({
    queryKey: ["/api/saas/users"],
    queryFn: async () => {
      const response = await fetch("/api/saas/users");
      return response.json();
    }
  });

  // Buscar todas as assinaturas
  const { data: subscriptions = [], isLoading: subscriptionsLoading } = useQuery({
    queryKey: ["/api/saas/subscriptions"],
    queryFn: async () => {
      const response = await fetch("/api/saas/subscriptions");
      return response.json();
    }
  });

  // Buscar todos os planos
  const { data: plans = [], isLoading: plansLoading } = useQuery({
    queryKey: ["/api/saas/plans"],
    queryFn: async () => {
      const response = await fetch("/api/saas/plans");
      return response.json();
    }
  });

  // Buscar todas as faturas
  const { data: invoices = [], isLoading: invoicesLoading } = useQuery({
    queryKey: ["/api/saas/invoices"],
    queryFn: async () => {
      const response = await fetch("/api/saas/invoices");
      return response.json();
    }
  });

  // Mutation para toggle de módulos
  const toggleModuleMutation = useMutation({
    mutationFn: async ({ companyId, moduleId, enabled }: { companyId: number; moduleId: string; enabled: boolean }) => {
      const response = await fetch(`/api/saas/companies/${companyId}/modules/${moduleId}/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled })
      });
      if (!response.ok) {
        throw new Error('Falha ao alterar módulo');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Módulo atualizado",
        description: "O módulo foi atualizado com sucesso para a empresa."
      });
      refetchModules();
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao atualizar módulo.",
        variant: "destructive"
      });
    }
  });

  // Mutation para criar nova empresa
  const createCompanyMutation = useMutation({
    mutationFn: async (companyData: Partial<Company>) => {
      const response = await apiRequest('/api/saas/companies', 'POST', companyData);
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Empresa criada",
        description: "Nova empresa criada com sucesso."
      });
      queryClient.invalidateQueries({ queryKey: ["/api/saas/companies"] });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao criar empresa.",
        variant: "destructive"
      });
    }
  });

  // Mutation para criar novo usuário
  const createUserMutation = useMutation({
    mutationFn: async (userData: Partial<User>) => {
      const response = await fetch('/api/saas/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      if (!response.ok) throw new Error('Falha ao criar usuário');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Usuário criado",
        description: "Novo usuário criado com sucesso."
      });
      refetchUsers();
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao criar usuário.",
        variant: "destructive"
      });
    }
  });

  // Mutation para atualizar usuário
  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, data }: { userId: number; data: Partial<User> }) => {
      const response = await fetch(`/api/saas/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Falha ao atualizar usuário');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Usuário atualizado",
        description: "Usuário atualizado com sucesso."
      });
      refetchUsers();
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao atualizar usuário.",
        variant: "destructive"
      });
    }
  });

  // Mutation para deletar usuário
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await fetch(`/api/saas/users/${userId}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Falha ao deletar usuário');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Usuário desativado",
        description: "Usuário desativado com sucesso."
      });
      refetchUsers();
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao desativar usuário.",
        variant: "destructive"
      });
    }
  });

  // Mutation para deletar usuário permanentemente
  const deletePermanentMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await fetch(`/api/saas/users/${userId}/permanent`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Falha ao deletar permanentemente');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Usuário deletado",
        description: "Usuário deletado permanentemente com sucesso."
      });
      refetchUsers();
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao deletar usuário permanentemente.",
        variant: "destructive"
      });
    }
  });

  // Mutation para resetar senha
  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userId, newPassword }: { userId: number; newPassword: string }) => {
      const response = await fetch(`/api/saas/users/${userId}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword })
      });
      if (!response.ok) throw new Error('Falha ao resetar senha');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Senha resetada",
        description: "Senha do usuário foi resetada com sucesso."
      });
      setShowResetPasswordModal(false);
      setNewPassword("");
      setSelectedUser(null);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao resetar senha.",
        variant: "destructive"
      });
    }
  });

  const handleModuleToggle = (moduleId: string, currentState: boolean) => {
    if (!selectedCompany) return;
    
    toggleModuleMutation.mutate({
      companyId: selectedCompany.id,
      moduleId,
      enabled: !currentState
    });
  };

  const getModuleStatusIcon = (status: string) => {
    switch (status) {
      case 'ok':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'loading':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const filteredCompanies = companies.filter((company: Company) =>
    company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    company.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredUsers = allUsers.filter((user: User) =>
    user.full_name.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
    user.username.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
    (user.company_name && user.company_name.toLowerCase().includes(userSearchTerm.toLowerCase()))
  );

  const handleCreateUser = () => {
    createUserMutation.mutate(newUserForm, {
      onSuccess: () => {
        setShowCreateUserModal(false);
        setNewUserForm({
          companyId: "",
          username: "",
          password: "",
          fullName: "",
          email: "",
          phone: "",
          role: "staff"
        });
      }
    });
  };

  if (companiesLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Carregando empresas...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Shield className="h-8 w-8 text-purple-600" />
          SuperAdmin - Gerenciamento SaaS
        </h1>
        <p className="text-muted-foreground mt-2">
          Gerencie empresas, módulos e configurações globais do sistema
        </p>
      </div>

      <Tabs defaultValue="companies" className="space-y-6">
        <TabsList>
          <TabsTrigger value="companies">Empresas</TabsTrigger>
          <TabsTrigger value="users">Usuários</TabsTrigger>
          <TabsTrigger value="subscriptions">Assinaturas</TabsTrigger>
          <TabsTrigger value="modules">Módulos por Empresa</TabsTrigger>
          <TabsTrigger value="system">Sistema Global</TabsTrigger>
        </TabsList>

        <TabsContent value="companies" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Empresas Cadastradas</CardTitle>
                  <CardDescription>
                    Gerencie as empresas do sistema SaaS
                  </CardDescription>
                </div>
                <Button
                  onClick={() => {/* TODO: Implementar modal de criação */}}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Nova Empresa
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar empresas..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="max-w-sm"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredCompanies.map((company: Company) => (
                    <Card 
                      key={company.id} 
                      className={`cursor-pointer transition-all hover:shadow-lg ${
                        selectedCompany?.id === company.id ? 'ring-2 ring-purple-500' : ''
                      }`}
                      onClick={() => setSelectedCompany(company)}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Building2 className="h-5 w-5 text-purple-600" />
                            <CardTitle className="text-lg">{company.name}</CardTitle>
                          </div>
                          {company.active ? (
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-600" />
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground">{company.email}</p>
                          {company.phone && (
                            <p className="text-sm text-muted-foreground">{company.phone}</p>
                          )}
                          <div className="flex items-center justify-between pt-2">
                            <Badge variant="secondary">
                              {company.moduleCount || 0} módulos
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(company.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {filteredCompanies.length === 0 && (
                  <div className="text-center py-8">
                    <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-lg font-medium">Nenhuma empresa encontrada</p>
                    <p className="text-muted-foreground">
                      {searchTerm ? 'Tente ajustar os filtros de busca' : 'Comece criando uma nova empresa'}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Usuários do Sistema</CardTitle>
                  <CardDescription>
                    Gerencie todos os usuários cadastrados no SaaS
                  </CardDescription>
                </div>
                <Button
                  onClick={() => setShowCreateUserModal(true)}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Novo Usuário
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar usuários por nome, email, username ou empresa..."
                    value={userSearchTerm}
                    onChange={(e) => setUserSearchTerm(e.target.value)}
                    className="max-w-md"
                  />
                </div>

                {usersLoading ? (
                  <div className="text-center py-8">Carregando usuários...</div>
                ) : (
                  <div className="border rounded-lg">
                    <table className="w-full">
                      <thead className="bg-muted/50">
                        <tr className="border-b">
                          <th className="text-left p-3 font-medium">Nome</th>
                          <th className="text-left p-3 font-medium">Email</th>
                          <th className="text-left p-3 font-medium">Username</th>
                          <th className="text-left p-3 font-medium">Empresa</th>
                          <th className="text-left p-3 font-medium">Função</th>
                          <th className="text-left p-3 font-medium">Status</th>
                          <th className="text-left p-3 font-medium">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.map((user: User) => (
                          <tr key={user.id} className="border-b hover:bg-muted/30">
                            <td className="p-3">{user.full_name}</td>
                            <td className="p-3 text-sm text-muted-foreground">{user.email}</td>
                            <td className="p-3 text-sm">{user.username}</td>
                            <td className="p-3 text-sm">{user.company_name || '-'}</td>
                            <td className="p-3">
                              <Badge variant={user.role === 'superadmin' ? 'destructive' : 'secondary'}>
                                {user.role}
                              </Badge>
                            </td>
                            <td className="p-3">
                              {user.active ? (
                                <Badge variant="default">Ativo</Badge>
                              ) : (
                                <Badge variant="secondary">Inativo</Badge>
                              )}
                            </td>
                            <td className="p-3">
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const newStatus = !user.active;
                                    updateUserMutation.mutate({
                                      userId: user.id,
                                      data: { active: newStatus }
                                    });
                                  }}
                                >
                                  {user.active ? 'Desativar' : 'Ativar'}
                                </Button>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedUser(user);
                                    setShowResetPasswordModal(true);
                                  }}
                                >
                                  Resetar Senha
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => {
                                    if (confirm(`Tem certeza que deseja DELETAR PERMANENTEMENTE o usuário ${user.full_name}? Esta ação não pode ser desfeita!`)) {
                                      deletePermanentMutation.mutate(user.id);
                                    }
                                  }}
                                >
                                  Deletar
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {filteredUsers.length === 0 && (
                      <div className="text-center py-8">
                        <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-lg font-medium">Nenhum usuário encontrado</p>
                        <p className="text-muted-foreground">
                          {userSearchTerm ? 'Tente ajustar os filtros de busca' : 'Comece criando um novo usuário'}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subscriptions" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Assinaturas e Planos</CardTitle>
              <CardDescription>
                Visualize as assinaturas ativas e os planos disponíveis
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Assinaturas Ativas</h3>
                  {subscriptionsLoading ? (
                    <div className="text-center py-4">Carregando assinaturas...</div>
                  ) : subscriptions.length === 0 ? (
                    <div className="text-center py-8">
                      <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-lg font-medium">Nenhuma assinatura encontrada</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {subscriptions.map((sub: Subscription) => (
                        <Card key={sub.id}>
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-base">{sub.company_name}</CardTitle>
                              <Badge
                                variant={
                                  sub.status === 'active' ? 'default' :
                                  sub.status === 'trial' ? 'secondary' :
                                  'destructive'
                                }
                              >
                                {sub.status}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Plano:</span>
                                <span className="font-medium">{sub.plan_display_name}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Ciclo:</span>
                                <span>{sub.billing_cycle === 'monthly' ? 'Mensal' : 'Anual'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Valor:</span>
                                <span className="font-medium">
                                  R$ {sub.billing_cycle === 'monthly' ? sub.monthly_price : sub.yearly_price}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Próxima cobrança:</span>
                                <span>{new Date(sub.current_period_end).toLocaleDateString()}</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4">Planos Disponíveis</h3>
                  {plansLoading ? (
                    <div className="text-center py-4">Carregando planos...</div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {plans.map((plan: Plan) => (
                        <Card key={plan.id} className={plan.is_popular ? 'border-purple-500 border-2' : ''}>
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <CardTitle>{plan.display_name}</CardTitle>
                              {plan.is_popular && (
                                <Badge variant="default">Popular</Badge>
                              )}
                            </div>
                            <CardDescription>{plan.description}</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-4">
                              <div>
                                <div className="text-3xl font-bold">
                                  R$ {plan.monthly_price}
                                </div>
                                <div className="text-sm text-muted-foreground">por mês</div>
                              </div>
                              <div className="space-y-2 text-sm">
                                <div className="flex items-center gap-2">
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                  <span>Até {plan.max_users} usuários</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                  <span>Até {plan.max_patients} pacientes</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                  <span>{plan.max_appointments_per_month} agendamentos/mês</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                  <span>{plan.max_storage_gb}GB armazenamento</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                  <span>{plan.trial_days} dias de teste grátis</span>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4">Faturas</h3>
                  {invoicesLoading ? (
                    <div className="text-center py-4">Carregando faturas...</div>
                  ) : invoices.length === 0 ? (
                    <div className="text-center py-8">
                      <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-lg font-medium">Nenhuma fatura encontrada</p>
                    </div>
                  ) : (
                    <div className="border rounded-lg">
                      <table className="w-full">
                        <thead className="bg-muted/50">
                          <tr className="border-b">
                            <th className="text-left p-3 font-medium">ID</th>
                            <th className="text-left p-3 font-medium">Empresa</th>
                            <th className="text-left p-3 font-medium">Valor</th>
                            <th className="text-left p-3 font-medium">Status</th>
                            <th className="text-left p-3 font-medium">Vencimento</th>
                            <th className="text-left p-3 font-medium">Pago em</th>
                            <th className="text-left p-3 font-medium">Método</th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoices.map((invoice: Invoice) => (
                            <tr key={invoice.id} className="border-b hover:bg-muted/30">
                              <td className="p-3 text-sm">#{invoice.id}</td>
                              <td className="p-3 text-sm">{invoice.company_name}</td>
                              <td className="p-3 font-medium">R$ {invoice.amount}</td>
                              <td className="p-3">
                                <Badge
                                  variant={
                                    invoice.status === 'paid' ? 'default' :
                                    invoice.status === 'pending' ? 'secondary' :
                                    invoice.status === 'failed' ? 'destructive' :
                                    'outline'
                                  }
                                >
                                  {invoice.status === 'paid' ? 'Pago' :
                                   invoice.status === 'pending' ? 'Pendente' :
                                   invoice.status === 'failed' ? 'Falhou' :
                                   invoice.status === 'refunded' ? 'Reembolsado' :
                                   invoice.status}
                                </Badge>
                              </td>
                              <td className="p-3 text-sm">
                                {new Date(invoice.due_date).toLocaleDateString()}
                              </td>
                              <td className="p-3 text-sm">
                                {invoice.paid_at ? new Date(invoice.paid_at).toLocaleDateString() : '-'}
                              </td>
                              <td className="p-3 text-sm capitalize">
                                {invoice.payment_method || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="modules" className="mt-6">
          {!selectedCompany ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-medium">Selecione uma empresa</p>
                  <p className="text-muted-foreground">
                    Escolha uma empresa na aba anterior para gerenciar seus módulos
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Módulos - {selectedCompany.name}</CardTitle>
                  <CardDescription>
                    Gerencie os módulos habilitados para esta empresa
                  </CardDescription>
                </CardHeader>
              </Card>

              {modulesLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[...Array(8)].map((_, i) => (
                    <Card key={i} className="animate-pulse">
                      <CardHeader className="pb-3">
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2 mt-2"></div>
                      </CardHeader>
                      <CardContent>
                        <div className="h-20 bg-gray-200 rounded"></div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {companyModules.map((module: any) => {
                    const IconComponent = moduleIcons[module.name as keyof typeof moduleIcons] || Settings;
                    const isEnabled = module.is_enabled || false;
                    
                    return (
                      <Card key={module.name} className="transition-all hover:shadow-lg">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <IconComponent className="h-5 w-5 text-purple-600" />
                              <CardTitle className="text-lg">{module.display_name}</CardTitle>
                            </div>
                            <div className="flex items-center space-x-2">
                              {getModuleStatusIcon('ok')}
                              <Switch
                                checked={isEnabled}
                                onCheckedChange={() => handleModuleToggle(module.name, isEnabled)}
                                disabled={toggleModuleMutation.isPending}
                              />
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground mb-3">
                            {module.description}
                          </p>
                          <div className="flex items-center justify-between">
                            <Badge 
                              variant={isEnabled ? "default" : "secondary"}
                            >
                              {isEnabled ? "Ativo" : "Inativo"}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              v{module.version || "1.0.0"}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="system" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Status do Sistema</CardTitle>
                <CardDescription>
                  Monitoramento global do sistema SaaS
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>Total de Empresas</span>
                    <Badge variant="secondary">{companies.length}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Empresas Ativas</span>
                    <Badge variant="default">
                      {companies.filter((c: Company) => c.active).length}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Módulos Disponíveis</span>
                    <Badge variant="secondary">8</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Ações Administrativas</CardTitle>
                <CardDescription>
                  Ferramentas de administração do sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Button variant="outline" className="w-full justify-start">
                    <Settings className="h-4 w-4 mr-2" />
                    Configurações Globais
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <Users className="h-4 w-4 mr-2" />
                    Gerenciar Usuários
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <Activity className="h-4 w-4 mr-2" />
                    Logs do Sistema
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal de Criar Novo Usuário */}
      <Dialog open={showCreateUserModal} onOpenChange={setShowCreateUserModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Criar Novo Usuário</DialogTitle>
            <DialogDescription>
              Adicione um novo usuário ao sistema SaaS
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="company">Empresa</Label>
              <Select
                value={newUserForm.companyId}
                onValueChange={(value) => setNewUserForm({ ...newUserForm, companyId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma empresa" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((company: Company) => (
                    <SelectItem key={company.id} value={company.id.toString()}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="fullName">Nome Completo</Label>
              <Input
                id="fullName"
                value={newUserForm.fullName}
                onChange={(e) => setNewUserForm({ ...newUserForm, fullName: e.target.value })}
                placeholder="Digite o nome completo"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={newUserForm.username}
                onChange={(e) => setNewUserForm({ ...newUserForm, username: e.target.value })}
                placeholder="Digite o username"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={newUserForm.email}
                onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                placeholder="Digite o email"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Telefone (opcional)</Label>
              <Input
                id="phone"
                value={newUserForm.phone}
                onChange={(e) => setNewUserForm({ ...newUserForm, phone: e.target.value })}
                placeholder="Digite o telefone"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={newUserForm.password}
                onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                placeholder="Digite a senha"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">Função</Label>
              <Select
                value={newUserForm.role}
                onValueChange={(value) => setNewUserForm({ ...newUserForm, role: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma função" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="dentist">Dentista</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="superadmin">Super Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateUserModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateUser} disabled={createUserMutation.isPending}>
              {createUserMutation.isPending ? 'Criando...' : 'Criar Usuário'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Resetar Senha */}
      <Dialog open={showResetPasswordModal} onOpenChange={setShowResetPasswordModal}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Resetar Senha</DialogTitle>
            <DialogDescription>
              Defina uma nova senha para {selectedUser?.full_name}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="newPassword">Nova Senha</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Digite a nova senha"
              />
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-800">
                <strong>Atenção:</strong> Esta ação irá substituir a senha atual do usuário.
                Certifique-se de informar a nova senha ao usuário.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowResetPasswordModal(false);
                setNewPassword("");
                setSelectedUser(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (selectedUser && newPassword) {
                  resetPasswordMutation.mutate({
                    userId: selectedUser.id,
                    newPassword
                  });
                }
              }}
              disabled={!newPassword || resetPasswordMutation.isPending}
            >
              {resetPasswordMutation.isPending ? 'Resetando...' : 'Resetar Senha'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}