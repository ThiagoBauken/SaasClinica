import { queryClient } from "./queryClient";

// Função genérica para fazer requisições à API
export async function apiRequest<T>(
  url: string,
  method: string = "GET",
  data?: any
): Promise<T> {
  const options: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      message: "Ocorreu um erro desconhecido",
    }));
    throw new Error(error.message || `Erro ${response.status}`);
  }

  return response.json();
}

// Funções específicas para cada entidade

// Configurações da Clínica
export const clinicSettingsApi = {
  getSettings: () => apiRequest<any>("/api/clinic-settings"),
  updateSettings: (data: any) => apiRequest<any>("/api/clinic-settings", "POST", data),
};

// Usuários e Permissões
export const usersApi = {
  getUsers: () => apiRequest<any[]>("/api/users"),
  getUser: (id: number) => apiRequest<any>(`/api/users/${id}`),
  createUser: (data: any) => apiRequest<any>("/api/users", "POST", data),
  updateUser: (id: number, data: any) => apiRequest<any>(`/api/users/${id}`, "PATCH", data),
  getUserPermissions: (id: number) => apiRequest<any[]>(`/api/users/${id}/permissions`),
  updateUserPermissions: (id: number, permissions: number[]) => 
    apiRequest<any>(`/api/users/${id}/permissions`, "POST", { permissions }),
  getAvailablePermissions: () => apiRequest<any[]>("/api/permissions"),
};

// Configurações fiscais
export const fiscalSettingsApi = {
  getSettings: () => apiRequest<any>("/api/fiscal-settings"),
  updateSettings: (data: any) => apiRequest<any>("/api/fiscal-settings", "POST", data),
};

// Comissões
export const commissionsApi = {
  getSettings: (userId?: number) => 
    apiRequest<any>(userId ? `/api/commissions/settings/${userId}` : "/api/commissions/settings"),
  updateSettings: (data: any, userId?: number) => 
    apiRequest<any>(userId ? `/api/commissions/settings/${userId}` : "/api/commissions/settings", "POST", data),
  getProcedureCommissions: (userId: number) => 
    apiRequest<any[]>(`/api/commissions/procedures/${userId}`),
  updateProcedureCommission: (userId: number, procedureId: number, data: any) => 
    apiRequest<any>(`/api/commissions/procedures/${userId}/${procedureId}`, "POST", data),
  getRecords: (userId?: number) => 
    apiRequest<any[]>(userId ? `/api/commissions/records/${userId}` : "/api/commissions/records"),
  payCommission: (recordId: number) => 
    apiRequest<any>(`/api/commissions/records/${recordId}/pay`, "POST"),
};

// Taxas de maquininha
export const machineTaxesApi = {
  getTaxes: () => apiRequest<any[]>("/api/machine-taxes"),
  getTax: (id: number) => apiRequest<any>(`/api/machine-taxes/${id}`),
  createTax: (data: any) => apiRequest<any>("/api/machine-taxes", "POST", data),
  updateTax: (id: number, data: any) => apiRequest<any>(`/api/machine-taxes/${id}`, "PATCH", data),
  deleteTax: (id: number) => apiRequest<void>(`/api/machine-taxes/${id}`, "DELETE"),
};

// Configurações da Empresa (OpenAI, N8N, etc)
export const companySettingsApi = {
  getSettings: () => apiRequest<any>("/api/v1/company/settings"),
  updateSettings: (data: { openaiApiKey?: string; n8nWebhookUrl?: string }) =>
    apiRequest<any>("/api/v1/company/settings", "PATCH", data),
};

// Integrações (Wuzapi, Google Calendar, N8N)
export const integrationsApi = {
  getSettings: () => apiRequest<any>("/api/v1/integrations"),
  updateSettings: (data: any) => apiRequest<any>("/api/v1/integrations", "PATCH", data),
  testWhatsApp: () => apiRequest<any>("/api/v1/integrations/test-whatsapp", "POST"),
  testN8N: () => apiRequest<any>("/api/v1/integrations/test-n8n", "POST"),
  sendTestWhatsApp: (data: { phone: string; message?: string }) =>
    apiRequest<any>("/api/v1/integrations/send-test-whatsapp", "POST", data),
};