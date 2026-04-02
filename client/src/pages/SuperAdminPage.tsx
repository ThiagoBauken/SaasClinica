import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  Search,
  Loader2,
  TrendingUp,
  CreditCard,
  BarChart3,
  Edit2,
  Trash2,
  RotateCcw,
  Eye,
  UserPlus,
  FileText,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import DashboardLayout from "@/layouts/DashboardLayout";

// =============================================
// INTERFACES
// =============================================

interface Company {
  id: number;
  name: string;
  cnpj?: string;
  email: string;
  phone?: string;
  address?: string;
  active: boolean;
  created_at: string;
  module_count: number;
  user_count: number;
  patient_count: number;
  subscription_status?: string;
  plan_name?: string;
}

interface ModuleStatus {
  id: number;
  name: string;
  display_name: string;
  description: string;
  is_enabled: boolean;
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
  canceled_at?: string;
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
  status: string;
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

interface DashboardStats {
  companies: {
    total: number;
    active: number;
    inactive: number;
    new_last_30_days: number;
  };
  users: {
    total: number;
    active: number;
    admins: number;
    dentists: number;
    staff: number;
    superadmins: number;
  };
  subscriptions: {
    total: number;
    active: number;
    trial: number;
    past_due: number;
    canceled: number;
    expired: number;
  };
  revenue: {
    total_revenue: string;
    revenue_last_30_days: string;
    pending_amount: string;
    failed_payments: number;
  };
  recentCompanies: { id: number; name: string; email: string; active: boolean; created_at: string }[];
  activeCompanies7d: number;
}

const moduleIcons: Record<string, any> = {
  agenda: Calendar,
  pacientes: Users,
  financeiro: DollarSign,
  estoque: Package,
  proteses: Scissors,
  odontograma: Activity,
  automacoes: Bot,
  clinica: Settings,
};

const API_BASE = "/api/superadmin";

async function apiFetch(url: string, options?: RequestInit) {
  const res = await fetch(url, { credentials: "include", ...options });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `Erro ${res.status}` }));
    throw new Error(err.error || err.message || `Erro ${res.status}`);
  }
  return res.json();
}

// =============================================
// COMPONENT
// =============================================

export default function SuperAdminPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("dashboard");

  // Modal states
  const [showCreateCompanyModal, setShowCreateCompanyModal] = useState(false);
  const [showEditCompanyModal, setShowEditCompanyModal] = useState(false);
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [showCreateSubscriptionModal, setShowCreateSubscriptionModal] = useState(false);
  const [showEditSubscriptionModal, setShowEditSubscriptionModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
  const [newPassword, setNewPassword] = useState("");

  // Form states
  const [companyForm, setCompanyForm] = useState({ name: "", email: "", phone: "", cnpj: "", address: "" });
  const [newUserForm, setNewUserForm] = useState({ companyId: "", username: "", password: "", fullName: "", email: "", phone: "", role: "staff" });
  const [subscriptionForm, setSubscriptionForm] = useState({ companyId: "", planId: "", billingCycle: "monthly", status: "trial" });
  const [editSubForm, setEditSubForm] = useState({ planId: "", status: "", billingCycle: "" });

  // =============================================
  // QUERIES
  // =============================================

  const { data: dashboard, isLoading: dashboardLoading } = useQuery<DashboardStats>({
    queryKey: ["superadmin-dashboard"],
    queryFn: () => apiFetch(`${API_BASE}/dashboard`),
  });

  const { data: companies = [], isLoading: companiesLoading } = useQuery<Company[]>({
    queryKey: ["superadmin-companies"],
    queryFn: () => apiFetch(`${API_BASE}/companies`),
  });

  const { data: companyModules = [], isLoading: modulesLoading, refetch: refetchModules } = useQuery<ModuleStatus[]>({
    queryKey: ["superadmin-modules", selectedCompany?.id],
    queryFn: () => apiFetch(`${API_BASE}/companies/${selectedCompany!.id}/modules`),
    enabled: !!selectedCompany,
  });

  const { data: allUsers = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["superadmin-users"],
    queryFn: () => apiFetch(`${API_BASE}/users`),
  });

  const { data: subscriptions = [], isLoading: subscriptionsLoading } = useQuery<Subscription[]>({
    queryKey: ["superadmin-subscriptions"],
    queryFn: () => apiFetch(`${API_BASE}/subscriptions`),
  });

  const { data: plans = [], isLoading: plansLoading } = useQuery<Plan[]>({
    queryKey: ["superadmin-plans"],
    queryFn: () => apiFetch(`${API_BASE}/plans`),
  });

  const { data: invoices = [], isLoading: invoicesLoading } = useQuery<Invoice[]>({
    queryKey: ["superadmin-invoices"],
    queryFn: () => apiFetch(`${API_BASE}/invoices`),
  });

  // =============================================
  // MUTATIONS
  // =============================================

  const createCompanyMutation = useMutation({
    mutationFn: (data: any) => apiFetch(`${API_BASE}/companies`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    }),
    onSuccess: () => {
      toast({ title: "Empresa criada com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["superadmin-companies"] });
      queryClient.invalidateQueries({ queryKey: ["superadmin-dashboard"] });
      setShowCreateCompanyModal(false);
      setCompanyForm({ name: "", email: "", phone: "", cnpj: "", address: "" });
    },
    onError: (err: Error) => toast({ title: "Erro ao criar empresa", description: err.message, variant: "destructive" }),
  });

  const updateCompanyMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiFetch(`${API_BASE}/companies/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    }),
    onSuccess: () => {
      toast({ title: "Empresa atualizada" });
      queryClient.invalidateQueries({ queryKey: ["superadmin-companies"] });
      setShowEditCompanyModal(false);
    },
    onError: (err: Error) => toast({ title: "Erro ao atualizar empresa", description: err.message, variant: "destructive" }),
  });

  const deleteCompanyMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`${API_BASE}/companies/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Empresa desativada" });
      queryClient.invalidateQueries({ queryKey: ["superadmin-companies"] });
      queryClient.invalidateQueries({ queryKey: ["superadmin-dashboard"] });
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const toggleModuleMutation = useMutation({
    mutationFn: ({ companyId, moduleId, enabled }: { companyId: number; moduleId: string; enabled: boolean }) =>
      apiFetch(`${API_BASE}/companies/${companyId}/modules/${moduleId}/toggle`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled }),
      }),
    onSuccess: () => {
      toast({ title: "Módulo atualizado" });
      refetchModules();
    },
    onError: (err: Error) => toast({ title: "Erro ao atualizar módulo", description: err.message, variant: "destructive" }),
  });

  const createUserMutation = useMutation({
    mutationFn: (data: any) => apiFetch(`${API_BASE}/users`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    }),
    onSuccess: () => {
      toast({ title: "Usuário criado" });
      queryClient.invalidateQueries({ queryKey: ["superadmin-users"] });
      queryClient.invalidateQueries({ queryKey: ["superadmin-dashboard"] });
      setShowCreateUserModal(false);
      setNewUserForm({ companyId: "", username: "", password: "", fullName: "", email: "", phone: "", role: "staff" });
    },
    onError: (err: Error) => toast({ title: "Erro ao criar usuário", description: err.message, variant: "destructive" }),
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ userId, data }: { userId: number; data: any }) => apiFetch(`${API_BASE}/users/${userId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    }),
    onSuccess: () => {
      toast({ title: "Usuário atualizado" });
      queryClient.invalidateQueries({ queryKey: ["superadmin-users"] });
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const deletePermanentMutation = useMutation({
    mutationFn: (userId: number) => apiFetch(`${API_BASE}/users/${userId}/permanent`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Usuário deletado permanentemente" });
      queryClient.invalidateQueries({ queryKey: ["superadmin-users"] });
      queryClient.invalidateQueries({ queryKey: ["superadmin-dashboard"] });
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ userId, newPassword }: { userId: number; newPassword: string }) =>
      apiFetch(`${API_BASE}/users/${userId}/reset-password`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ newPassword }),
      }),
    onSuccess: () => {
      toast({ title: "Senha resetada com sucesso" });
      setShowResetPasswordModal(false);
      setNewPassword("");
      setSelectedUser(null);
    },
    onError: (err: Error) => toast({ title: "Erro ao resetar senha", description: err.message, variant: "destructive" }),
  });

  const createSubscriptionMutation = useMutation({
    mutationFn: (data: any) => apiFetch(`${API_BASE}/subscriptions`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    }),
    onSuccess: () => {
      toast({ title: "Assinatura criada" });
      queryClient.invalidateQueries({ queryKey: ["superadmin-subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["superadmin-dashboard"] });
      setShowCreateSubscriptionModal(false);
      setSubscriptionForm({ companyId: "", planId: "", billingCycle: "monthly", status: "trial" });
    },
    onError: (err: Error) => toast({ title: "Erro ao criar assinatura", description: err.message, variant: "destructive" }),
  });

  const updateSubscriptionMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiFetch(`${API_BASE}/subscriptions/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    }),
    onSuccess: () => {
      toast({ title: "Assinatura atualizada" });
      queryClient.invalidateQueries({ queryKey: ["superadmin-subscriptions"] });
      setShowEditSubscriptionModal(false);
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  // =============================================
  // HELPERS
  // =============================================

  const filteredCompanies = companies.filter((c) =>
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredUsers = allUsers.filter((u) =>
    u.full_name?.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
    u.username?.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
    u.company_name?.toLowerCase().includes(userSearchTerm.toLowerCase())
  );

  const statusBadge = (status: string) => {
    const map: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      active: { variant: "default", label: "Ativo" },
      trial: { variant: "secondary", label: "Trial" },
      past_due: { variant: "destructive", label: "Atrasado" },
      canceled: { variant: "outline", label: "Cancelado" },
      expired: { variant: "destructive", label: "Expirado" },
      paid: { variant: "default", label: "Pago" },
      pending: { variant: "secondary", label: "Pendente" },
      failed: { variant: "destructive", label: "Falhou" },
      refunded: { variant: "outline", label: "Reembolsado" },
    };
    const cfg = map[status] || { variant: "secondary" as const, label: status };
    return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
  };

  const formatCurrency = (val: string | number) => {
    const num = typeof val === "string" ? parseFloat(val) : val;
    return `R$ ${num.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  };

  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString("pt-BR") : "-";

  // =============================================
  // LOADING
  // =============================================

  if (companiesLoading && dashboardLoading) {
    return (
      <DashboardLayout title="SuperAdmin" currentPath="/superadmin">
        <div className="p-6">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-purple-600 mr-3" />
            <div className="text-lg">Carregando painel SuperAdmin...</div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // =============================================
  // RENDER
  // =============================================

  return (
    <DashboardLayout title="SuperAdmin" currentPath="/superadmin">
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8 text-purple-600" />
            SuperAdmin - Gerenciamento SaaS
          </h1>
          <p className="text-muted-foreground mt-2">
            Gerencie empresas, usuários, assinaturas e configurações globais do sistema
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-6 w-full max-w-3xl">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="companies">Empresas</TabsTrigger>
            <TabsTrigger value="users">Usuários</TabsTrigger>
            <TabsTrigger value="subscriptions">Assinaturas</TabsTrigger>
            <TabsTrigger value="modules">Módulos</TabsTrigger>
            <TabsTrigger value="invoices">Faturas</TabsTrigger>
          </TabsList>

          {/* =============================================
              TAB: DASHBOARD
          ============================================= */}
          <TabsContent value="dashboard" className="mt-6">
            {dashboardLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin mr-2" /> Carregando dashboard...
              </div>
            ) : dashboard ? (
              <div className="space-y-6">
                {/* KPIs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Empresas Ativas</p>
                          <p className="text-3xl font-bold">{dashboard.companies.active}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            +{dashboard.companies.new_last_30_days} nos últimos 30 dias
                          </p>
                        </div>
                        <Building2 className="h-10 w-10 text-purple-600 opacity-80" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Usuários Totais</p>
                          <p className="text-3xl font-bold">{dashboard.users.total}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {dashboard.users.active} ativos
                          </p>
                        </div>
                        <Users className="h-10 w-10 text-blue-600 opacity-80" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Receita Total</p>
                          <p className="text-3xl font-bold">{formatCurrency(dashboard.revenue.total_revenue)}</p>
                          <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                            <ArrowUpRight className="h-3 w-3" />
                            {formatCurrency(dashboard.revenue.revenue_last_30_days)} este mês
                          </p>
                        </div>
                        <DollarSign className="h-10 w-10 text-green-600 opacity-80" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Assinaturas Ativas</p>
                          <p className="text-3xl font-bold">{dashboard.subscriptions.active}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {dashboard.subscriptions.trial} em trial
                          </p>
                        </div>
                        <CreditCard className="h-10 w-10 text-orange-600 opacity-80" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Details row */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Subscription Breakdown */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Assinaturas por Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {[
                          { label: "Ativas", value: dashboard.subscriptions.active, color: "bg-green-500" },
                          { label: "Trial", value: dashboard.subscriptions.trial, color: "bg-blue-500" },
                          { label: "Atrasadas", value: dashboard.subscriptions.past_due, color: "bg-red-500" },
                          { label: "Canceladas", value: dashboard.subscriptions.canceled, color: "bg-gray-400" },
                          { label: "Expiradas", value: dashboard.subscriptions.expired, color: "bg-orange-500" },
                        ].map((item) => (
                          <div key={item.label} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded-full ${item.color}`} />
                              <span className="text-sm">{item.label}</span>
                            </div>
                            <span className="font-semibold">{item.value}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Users Breakdown */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Usuários por Tipo</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {[
                          { label: "Dentistas", value: dashboard.users.dentists, color: "bg-blue-500" },
                          { label: "Admins", value: dashboard.users.admins, color: "bg-purple-500" },
                          { label: "Staff", value: dashboard.users.staff, color: "bg-green-500" },
                          { label: "SuperAdmins", value: dashboard.users.superadmins, color: "bg-red-500" },
                        ].map((item) => (
                          <div key={item.label} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded-full ${item.color}`} />
                              <span className="text-sm">{item.label}</span>
                            </div>
                            <span className="font-semibold">{item.value}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Recent Companies */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Empresas Recentes</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {dashboard.recentCompanies.map((c) => (
                          <div key={c.id} className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium">{c.name}</p>
                              <p className="text-xs text-muted-foreground">{c.email}</p>
                            </div>
                            <span className="text-xs text-muted-foreground">{formatDate(c.created_at)}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Alerts */}
                {(dashboard.revenue.failed_payments > 0 || dashboard.subscriptions.past_due > 0) && (
                  <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <AlertCircle className="h-5 w-5 text-red-600" />
                        <div>
                          <p className="font-medium text-red-800 dark:text-red-300">Atenção</p>
                          <p className="text-sm text-red-600 dark:text-red-400">
                            {dashboard.revenue.failed_payments > 0 && `${dashboard.revenue.failed_payments} pagamento(s) falharam. `}
                            {dashboard.subscriptions.past_due > 0 && `${dashboard.subscriptions.past_due} assinatura(s) com pagamento atrasado. `}
                            {parseFloat(dashboard.revenue.pending_amount) > 0 && `${formatCurrency(dashboard.revenue.pending_amount)} pendente.`}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : null}
          </TabsContent>

          {/* =============================================
              TAB: EMPRESAS
          ============================================= */}
          <TabsContent value="companies" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Empresas Cadastradas</CardTitle>
                    <CardDescription>Gerencie as empresas do sistema SaaS</CardDescription>
                  </div>
                  <Button onClick={() => { setCompanyForm({ name: "", email: "", phone: "", cnpj: "", address: "" }); setShowCreateCompanyModal(true); }}>
                    <Plus className="h-4 w-4 mr-2" /> Nova Empresa
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Buscar empresas..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="max-w-sm" />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredCompanies.map((company) => (
                      <Card
                        key={company.id}
                        className={`cursor-pointer transition-all hover:shadow-lg ${selectedCompany?.id === company.id ? "ring-2 ring-purple-500" : ""}`}
                        onClick={() => setSelectedCompany(company)}
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <Building2 className="h-5 w-5 text-purple-600" />
                              <CardTitle className="text-lg">{company.name}</CardTitle>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button variant="ghost" size="sm" onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCompany(company);
                                setCompanyForm({
                                  name: company.name || "",
                                  email: company.email || "",
                                  phone: company.phone || "",
                                  cnpj: company.cnpj || "",
                                  address: company.address || "",
                                });
                                setShowEditCompanyModal(true);
                              }}>
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              {company.active ? (
                                <CheckCircle className="h-5 w-5 text-green-600" />
                              ) : (
                                <XCircle className="h-5 w-5 text-red-600" />
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            <p className="text-sm text-muted-foreground">{company.email}</p>
                            {company.phone && <p className="text-sm text-muted-foreground">{company.phone}</p>}
                            <div className="flex flex-wrap gap-2 pt-2">
                              <Badge variant="secondary">{company.module_count || 0} módulos</Badge>
                              <Badge variant="outline">{company.user_count || 0} usuários</Badge>
                              <Badge variant="outline">{company.patient_count || 0} pacientes</Badge>
                            </div>
                            <div className="flex items-center justify-between pt-1">
                              {company.plan_name && (
                                <Badge variant="default">{company.plan_name}</Badge>
                              )}
                              {company.subscription_status && statusBadge(company.subscription_status)}
                              <span className="text-xs text-muted-foreground">{formatDate(company.created_at)}</span>
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
                      <p className="text-muted-foreground">{searchTerm ? "Tente ajustar os filtros" : "Comece criando uma nova empresa"}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* =============================================
              TAB: USUÁRIOS
          ============================================= */}
          <TabsContent value="users" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Usuários do Sistema</CardTitle>
                    <CardDescription>Gerencie todos os usuários cadastrados</CardDescription>
                  </div>
                  <Button onClick={() => setShowCreateUserModal(true)}>
                    <UserPlus className="h-4 w-4 mr-2" /> Novo Usuário
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome, email, username ou empresa..."
                      value={userSearchTerm}
                      onChange={(e) => setUserSearchTerm(e.target.value)}
                      className="max-w-md"
                    />
                  </div>

                  {usersLoading ? (
                    <div className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
                  ) : (
                    <div className="border rounded-lg overflow-x-auto">
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
                          {filteredUsers.map((user) => (
                            <tr key={user.id} className="border-b hover:bg-muted/30">
                              <td className="p-3">{user.full_name}</td>
                              <td className="p-3 text-sm text-muted-foreground">{user.email}</td>
                              <td className="p-3 text-sm">{user.username}</td>
                              <td className="p-3 text-sm">{user.company_name || "-"}</td>
                              <td className="p-3">
                                <Badge variant={user.role === "superadmin" ? "destructive" : user.role === "admin" ? "default" : "secondary"}>
                                  {user.role}
                                </Badge>
                              </td>
                              <td className="p-3">
                                <Badge variant={user.active ? "default" : "secondary"}>
                                  {user.active ? "Ativo" : "Inativo"}
                                </Badge>
                              </td>
                              <td className="p-3">
                                <div className="flex gap-1">
                                  <Button variant="outline" size="sm" onClick={() => {
                                    updateUserMutation.mutate({ userId: user.id, data: { active: !user.active } });
                                  }}>
                                    {user.active ? "Desativar" : "Ativar"}
                                  </Button>
                                  <Button variant="secondary" size="sm" onClick={() => {
                                    setSelectedUser(user);
                                    setShowResetPasswordModal(true);
                                  }}>
                                    <RotateCcw className="h-3 w-3 mr-1" /> Senha
                                  </Button>
                                  {user.role !== "superadmin" && (
                                    <Button variant="destructive" size="sm" onClick={() => {
                                      if (confirm(`Deletar permanentemente ${user.full_name}? Não pode ser desfeito!`)) {
                                        deletePermanentMutation.mutate(user.id);
                                      }
                                    }}>
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  )}
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
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* =============================================
              TAB: ASSINATURAS
          ============================================= */}
          <TabsContent value="subscriptions" className="mt-6">
            <div className="space-y-6">
              {/* Subscriptions */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Assinaturas</CardTitle>
                      <CardDescription>Gerencie as assinaturas das empresas</CardDescription>
                    </div>
                    <Button onClick={() => setShowCreateSubscriptionModal(true)}>
                      <Plus className="h-4 w-4 mr-2" /> Nova Assinatura
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {subscriptionsLoading ? (
                    <div className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
                  ) : subscriptions.length === 0 ? (
                    <div className="text-center py-8">
                      <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-lg font-medium">Nenhuma assinatura encontrada</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {subscriptions.map((sub) => (
                        <Card key={sub.id} className="hover:shadow-md transition-shadow">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-base">{sub.company_name}</CardTitle>
                              <div className="flex items-center gap-2">
                                {statusBadge(sub.status)}
                                <Button variant="ghost" size="sm" onClick={() => {
                                  setSelectedSubscription(sub);
                                  setEditSubForm({
                                    planId: sub.plan_id.toString(),
                                    status: sub.status,
                                    billingCycle: sub.billing_cycle,
                                  });
                                  setShowEditSubscriptionModal(true);
                                }}>
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                              </div>
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
                                <span>{sub.billing_cycle === "monthly" ? "Mensal" : "Anual"}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Valor:</span>
                                <span className="font-medium">
                                  {formatCurrency(sub.billing_cycle === "monthly" ? sub.monthly_price : (sub.yearly_price || sub.monthly_price))}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Próxima cobrança:</span>
                                <span>{formatDate(sub.current_period_end)}</span>
                              </div>
                              {sub.trial_ends_at && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Trial até:</span>
                                  <span>{formatDate(sub.trial_ends_at)}</span>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Plans */}
              <Card>
                <CardHeader>
                  <CardTitle>Planos Disponíveis</CardTitle>
                  <CardDescription>Configuração dos planos do SaaS</CardDescription>
                </CardHeader>
                <CardContent>
                  {plansLoading ? (
                    <div className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {plans.map((plan) => (
                        <Card key={plan.id} className={plan.is_popular ? "border-purple-500 border-2" : ""}>
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <CardTitle>{plan.display_name}</CardTitle>
                              {plan.is_popular && <Badge variant="default">Popular</Badge>}
                            </div>
                            <CardDescription>{plan.description}</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-4">
                              <div>
                                <div className="text-3xl font-bold">{formatCurrency(plan.monthly_price)}</div>
                                <div className="text-sm text-muted-foreground">por mês</div>
                                {plan.yearly_price && (
                                  <div className="text-sm text-green-600">
                                    ou {formatCurrency(plan.yearly_price)}/ano
                                  </div>
                                )}
                              </div>
                              <div className="space-y-2 text-sm">
                                <div className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-600" /><span>Até {plan.max_users} usuários</span></div>
                                <div className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-600" /><span>Até {plan.max_patients} pacientes</span></div>
                                <div className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-600" /><span>{plan.max_appointments_per_month} agendamentos/mês</span></div>
                                <div className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-600" /><span>{plan.max_storage_gb}GB armazenamento</span></div>
                                <div className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-600" /><span>{plan.trial_days} dias de teste</span></div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* =============================================
              TAB: MÓDULOS
          ============================================= */}
          <TabsContent value="modules" className="mt-6">
            {!selectedCompany ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-8">
                    <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-lg font-medium">Selecione uma empresa</p>
                    <p className="text-muted-foreground">
                      Escolha uma empresa na aba "Empresas" para gerenciar seus módulos
                    </p>
                    <Button variant="outline" className="mt-4" onClick={() => setActiveTab("companies")}>
                      Ir para Empresas
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Módulos - {selectedCompany.name}</CardTitle>
                        <CardDescription>Gerencie os módulos habilitados para esta empresa</CardDescription>
                      </div>
                      <Button variant="outline" onClick={() => setActiveTab("companies")}>
                        Trocar Empresa
                      </Button>
                    </div>
                  </CardHeader>
                </Card>

                {modulesLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[...Array(6)].map((_, i) => (
                      <Card key={i} className="animate-pulse">
                        <CardHeader className="pb-3"><div className="h-4 bg-muted rounded w-3/4" /><div className="h-3 bg-muted rounded w-1/2 mt-2" /></CardHeader>
                        <CardContent><div className="h-20 bg-muted rounded" /></CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {companyModules.map((module) => {
                      const IconComponent = moduleIcons[module.name] || Settings;
                      const isEnabled = module.is_enabled || false;
                      return (
                        <Card key={module.name} className="transition-all hover:shadow-lg">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <IconComponent className="h-5 w-5 text-purple-600" />
                                <CardTitle className="text-lg">{module.display_name}</CardTitle>
                              </div>
                              <Switch
                                checked={isEnabled}
                                onCheckedChange={() => toggleModuleMutation.mutate({
                                  companyId: selectedCompany.id,
                                  moduleId: module.name,
                                  enabled: !isEnabled,
                                })}
                                disabled={toggleModuleMutation.isPending}
                              />
                            </div>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-muted-foreground mb-3">{module.description}</p>
                            <Badge variant={isEnabled ? "default" : "secondary"}>
                              {isEnabled ? "Ativo" : "Inativo"}
                            </Badge>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* =============================================
              TAB: FATURAS
          ============================================= */}
          <TabsContent value="invoices" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Faturas</CardTitle>
                <CardDescription>Histórico de todas as faturas do sistema</CardDescription>
              </CardHeader>
              <CardContent>
                {invoicesLoading ? (
                  <div className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
                ) : invoices.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-lg font-medium">Nenhuma fatura encontrada</p>
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-x-auto">
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
                        {invoices.map((invoice) => (
                          <tr key={invoice.id} className="border-b hover:bg-muted/30">
                            <td className="p-3 text-sm">#{invoice.id}</td>
                            <td className="p-3 text-sm">{invoice.company_name}</td>
                            <td className="p-3 font-medium">{formatCurrency(invoice.amount)}</td>
                            <td className="p-3">{statusBadge(invoice.status)}</td>
                            <td className="p-3 text-sm">{formatDate(invoice.due_date)}</td>
                            <td className="p-3 text-sm">{invoice.paid_at ? formatDate(invoice.paid_at) : "-"}</td>
                            <td className="p-3 text-sm capitalize">{invoice.payment_method || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* =============================================
            MODALS
        ============================================= */}

        {/* Create Company Modal */}
        <Dialog open={showCreateCompanyModal} onOpenChange={setShowCreateCompanyModal}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Nova Empresa</DialogTitle>
              <DialogDescription>Cadastre uma nova empresa no sistema</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Nome da Empresa *</Label>
                <Input value={companyForm.name} onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })} placeholder="Nome da clínica" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>E-mail</Label>
                  <Input type="email" value={companyForm.email} onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })} placeholder="contato@empresa.com" />
                </div>
                <div className="grid gap-2">
                  <Label>Telefone</Label>
                  <Input value={companyForm.phone} onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })} placeholder="(11) 99999-9999" />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>CNPJ</Label>
                <Input value={companyForm.cnpj} onChange={(e) => setCompanyForm({ ...companyForm, cnpj: e.target.value.replace(/\D/g, "").slice(0, 14) })} placeholder="00000000000000" />
              </div>
              <div className="grid gap-2">
                <Label>Endereço</Label>
                <Input value={companyForm.address} onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })} placeholder="Rua, número, cidade - UF" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateCompanyModal(false)}>Cancelar</Button>
              <Button onClick={() => createCompanyMutation.mutate(companyForm)} disabled={!companyForm.name || createCompanyMutation.isPending}>
                {createCompanyMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Criando...</> : "Criar Empresa"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Company Modal */}
        <Dialog open={showEditCompanyModal} onOpenChange={setShowEditCompanyModal}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Editar Empresa</DialogTitle>
              <DialogDescription>Altere os dados da empresa {selectedCompany?.name}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Nome *</Label>
                <Input value={companyForm.name} onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>E-mail</Label>
                  <Input type="email" value={companyForm.email} onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Telefone</Label>
                  <Input value={companyForm.phone} onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>CNPJ</Label>
                <Input value={companyForm.cnpj} onChange={(e) => setCompanyForm({ ...companyForm, cnpj: e.target.value.replace(/\D/g, "").slice(0, 14) })} />
              </div>
              <div className="grid gap-2">
                <Label>Endereço</Label>
                <Input value={companyForm.address} onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="destructive" onClick={() => {
                if (selectedCompany && confirm(`Desativar empresa ${selectedCompany.name}?`)) {
                  deleteCompanyMutation.mutate(selectedCompany.id);
                  setShowEditCompanyModal(false);
                }
              }}>
                Desativar
              </Button>
              <Button variant="outline" onClick={() => setShowEditCompanyModal(false)}>Cancelar</Button>
              <Button onClick={() => {
                if (selectedCompany) {
                  updateCompanyMutation.mutate({ id: selectedCompany.id, data: companyForm });
                }
              }} disabled={!companyForm.name || updateCompanyMutation.isPending}>
                {updateCompanyMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create User Modal */}
        <Dialog open={showCreateUserModal} onOpenChange={setShowCreateUserModal}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Criar Novo Usuário</DialogTitle>
              <DialogDescription>Adicione um novo usuário ao sistema</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Empresa *</Label>
                <Select value={newUserForm.companyId} onValueChange={(v) => setNewUserForm({ ...newUserForm, companyId: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione uma empresa" /></SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Nome Completo *</Label>
                  <Input value={newUserForm.fullName} onChange={(e) => setNewUserForm({ ...newUserForm, fullName: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Username *</Label>
                  <Input value={newUserForm.username} onChange={(e) => setNewUserForm({ ...newUserForm, username: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Email *</Label>
                  <Input type="email" value={newUserForm.email} onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Telefone</Label>
                  <Input value={newUserForm.phone} onChange={(e) => setNewUserForm({ ...newUserForm, phone: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Senha *</Label>
                  <Input type="password" value={newUserForm.password} onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Função</Label>
                  <Select value={newUserForm.role} onValueChange={(v) => setNewUserForm({ ...newUserForm, role: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="staff">Staff</SelectItem>
                      <SelectItem value="dentist">Dentista</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="superadmin">Super Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateUserModal(false)}>Cancelar</Button>
              <Button onClick={() => createUserMutation.mutate(newUserForm)} disabled={createUserMutation.isPending || !newUserForm.companyId || !newUserForm.username || !newUserForm.password || !newUserForm.fullName || !newUserForm.email}>
                {createUserMutation.isPending ? "Criando..." : "Criar Usuário"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reset Password Modal */}
        <Dialog open={showResetPasswordModal} onOpenChange={setShowResetPasswordModal}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>Resetar Senha</DialogTitle>
              <DialogDescription>Nova senha para {selectedUser?.full_name}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Nova Senha</Label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min. 6 caracteres" />
              </div>
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                <p className="text-sm text-yellow-800 dark:text-yellow-300">
                  <strong>Atenção:</strong> Certifique-se de informar a nova senha ao usuário.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowResetPasswordModal(false); setNewPassword(""); setSelectedUser(null); }}>Cancelar</Button>
              <Button onClick={() => { if (selectedUser && newPassword) resetPasswordMutation.mutate({ userId: selectedUser.id, newPassword }); }} disabled={!newPassword || newPassword.length < 6 || resetPasswordMutation.isPending}>
                {resetPasswordMutation.isPending ? "Resetando..." : "Resetar Senha"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Subscription Modal */}
        <Dialog open={showCreateSubscriptionModal} onOpenChange={setShowCreateSubscriptionModal}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Nova Assinatura</DialogTitle>
              <DialogDescription>Criar assinatura para uma empresa</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Empresa *</Label>
                <Select value={subscriptionForm.companyId} onValueChange={(v) => setSubscriptionForm({ ...subscriptionForm, companyId: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {companies.filter(c => !subscriptions.find(s => s.company_id === c.id)).map((c) => (
                      <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Plano *</Label>
                <Select value={subscriptionForm.planId} onValueChange={(v) => setSubscriptionForm({ ...subscriptionForm, planId: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {plans.filter(p => p.is_active).map((p) => (
                      <SelectItem key={p.id} value={p.id.toString()}>{p.display_name} - {formatCurrency(p.monthly_price)}/mês</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Ciclo</Label>
                  <Select value={subscriptionForm.billingCycle} onValueChange={(v) => setSubscriptionForm({ ...subscriptionForm, billingCycle: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Mensal</SelectItem>
                      <SelectItem value="yearly">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select value={subscriptionForm.status} onValueChange={(v) => setSubscriptionForm({ ...subscriptionForm, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trial">Trial</SelectItem>
                      <SelectItem value="active">Ativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateSubscriptionModal(false)}>Cancelar</Button>
              <Button onClick={() => createSubscriptionMutation.mutate(subscriptionForm)} disabled={!subscriptionForm.companyId || !subscriptionForm.planId || createSubscriptionMutation.isPending}>
                {createSubscriptionMutation.isPending ? "Criando..." : "Criar Assinatura"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Subscription Modal */}
        <Dialog open={showEditSubscriptionModal} onOpenChange={setShowEditSubscriptionModal}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Editar Assinatura</DialogTitle>
              <DialogDescription>{selectedSubscription?.company_name}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Plano</Label>
                <Select value={editSubForm.planId} onValueChange={(v) => setEditSubForm({ ...editSubForm, planId: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {plans.map((p) => (
                      <SelectItem key={p.id} value={p.id.toString()}>{p.display_name} - {formatCurrency(p.monthly_price)}/mês</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select value={editSubForm.status} onValueChange={(v) => setEditSubForm({ ...editSubForm, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trial">Trial</SelectItem>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="past_due">Atrasado</SelectItem>
                      <SelectItem value="canceled">Cancelado</SelectItem>
                      <SelectItem value="expired">Expirado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Ciclo</Label>
                  <Select value={editSubForm.billingCycle} onValueChange={(v) => setEditSubForm({ ...editSubForm, billingCycle: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Mensal</SelectItem>
                      <SelectItem value="yearly">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditSubscriptionModal(false)}>Cancelar</Button>
              <Button onClick={() => {
                if (selectedSubscription) {
                  updateSubscriptionMutation.mutate({
                    id: selectedSubscription.id,
                    data: { planId: parseInt(editSubForm.planId), status: editSubForm.status, billingCycle: editSubForm.billingCycle },
                  });
                }
              }} disabled={updateSubscriptionMutation.isPending}>
                {updateSubscriptionMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
