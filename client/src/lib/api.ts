import { queryClient } from "./queryClient";
import { getCsrfHeaders } from "./csrf";

// API client com métodos HTTP convenientes (axios-like interface)
export const api = {
  get: async <T = any>(url: string): Promise<{ data: T }> => {
    const response = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Erro desconhecido" }));
      throw new Error(error.message || `Erro ${response.status}`);
    }
    const data = await response.json();
    return { data };
  },
  post: async <T = any>(url: string, data?: any): Promise<{ data: T }> => {
    const response = await fetch(url, {
      method: "POST",
      headers: getCsrfHeaders({ "Content-Type": "application/json" }),
      credentials: "include",
      body: data ? JSON.stringify(data) : undefined,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Erro desconhecido" }));
      throw new Error(error.message || `Erro ${response.status}`);
    }
    const responseData = await response.json();
    return { data: responseData };
  },
  put: async <T = any>(url: string, data?: any): Promise<{ data: T }> => {
    const response = await fetch(url, {
      method: "PUT",
      headers: getCsrfHeaders({ "Content-Type": "application/json" }),
      credentials: "include",
      body: data ? JSON.stringify(data) : undefined,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Erro desconhecido" }));
      throw new Error(error.message || `Erro ${response.status}`);
    }
    const responseData = await response.json();
    return { data: responseData };
  },
  patch: async <T = any>(url: string, data?: any): Promise<{ data: T }> => {
    const response = await fetch(url, {
      method: "PATCH",
      headers: getCsrfHeaders({ "Content-Type": "application/json" }),
      credentials: "include",
      body: data ? JSON.stringify(data) : undefined,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Erro desconhecido" }));
      throw new Error(error.message || `Erro ${response.status}`);
    }
    const responseData = await response.json();
    return { data: responseData };
  },
  delete: async <T = any>(url: string): Promise<{ data: T }> => {
    const response = await fetch(url, {
      method: "DELETE",
      headers: getCsrfHeaders({ "Content-Type": "application/json" }),
      credentials: "include",
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Erro desconhecido" }));
      throw new Error(error.message || `Erro ${response.status}`);
    }
    const data = await response.json();
    return { data };
  },
};

// Função genérica para fazer requisições à API
export async function apiRequest<T>(
  url: string,
  method: string = "GET",
  data?: any
): Promise<T> {
  const safeMethods = ["GET", "HEAD", "OPTIONS"];
  const headers = safeMethods.includes(method.toUpperCase())
    ? { "Content-Type": "application/json" }
    : getCsrfHeaders({ "Content-Type": "application/json" });

  const options: RequestInit = {
    method,
    headers,
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

// Configurações da Empresa (OpenAI, etc)
export const companySettingsApi = {
  getSettings: () => apiRequest<any>("/api/v1/company/settings"),
  updateSettings: (data: { openaiApiKey?: string }) =>
    apiRequest<any>("/api/v1/company/settings", "PATCH", data),
};

// Integrações (Wuzapi, Google Calendar)
export const integrationsApi = {
  getSettings: () => apiRequest<any>("/api/v1/integrations"),
  updateSettings: (data: any) => apiRequest<any>("/api/v1/integrations", "PATCH", data),
  testWhatsApp: () => apiRequest<any>("/api/v1/integrations/test-whatsapp", "POST"),
  sendTestWhatsApp: (data: { phone: string; message?: string }) =>
    apiRequest<any>("/api/v1/integrations/send-test-whatsapp", "POST", data),
  // Wuzapi 3.0 - Status e Conexão
  getWuzapiStatus: () => apiRequest<any>("/api/v1/integrations/wuzapi/status"),
  getWuzapiQrCode: () => apiRequest<any>("/api/v1/integrations/wuzapi/qrcode"),
  connectWuzapi: () => apiRequest<any>("/api/v1/integrations/wuzapi/connect", "POST"),
  disconnectWuzapi: () => apiRequest<any>("/api/v1/integrations/wuzapi/disconnect", "POST"),
  logoutWuzapi: () => apiRequest<any>("/api/v1/integrations/wuzapi/logout", "POST"),
  reconnectWuzapi: () => apiRequest<any>("/api/v1/integrations/wuzapi/reconnect", "POST"),
  reconfigureWuzapi: () => apiRequest<any>("/api/v1/integrations/wuzapi/reconfigure", "POST"),
  resetWuzapi: () => apiRequest<any>("/api/v1/integrations/wuzapi/reset", "POST"),
  // Wuzapi 3.0 - Webhook
  getWuzapiWebhookInfo: () => apiRequest<any>("/api/v1/integrations/wuzapi/webhook-info"),
  configureWuzapiWebhook: (data?: { webhookUrl?: string }) =>
    apiRequest<any>("/api/v1/integrations/wuzapi/webhook", "POST", data || {}),
};