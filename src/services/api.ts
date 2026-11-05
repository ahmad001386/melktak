import { ApiResponse } from "../types/index.js";

const TOKEN_KEY = "amlak_token";
const USER_KEY = "amlak_user";
const TENANT_KEY = "amlak_tenant";

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredSession(token: string, user: any, tenant: any) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  localStorage.setItem(TENANT_KEY, JSON.stringify(tenant));
}

export function clearStoredSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(TENANT_KEY);
}

export function getStoredUser(): any | null {
  try {
    const data = localStorage.getItem(USER_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export function getStoredTenant(): any | null {
  try {
    const data = localStorage.getItem(TENANT_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

async function request<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const url = endpoint.startsWith("http") ? endpoint : `/api/v1${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      credentials: "include"
    });

    const data: ApiResponse<T> = await res.json().catch(() => ({
      success: false,
      error: { code: "INVALID_JSON", message: "پاسخ سرور نامعتبر است." }
    }));

    if (!res.ok) {
      if (res.status === 401 && !endpoint.includes("/auth/login")) {
        clearStoredSession();
        window.dispatchEvent(new CustomEvent("amlak:unauthorized"));
      }
      return {
        success: false,
        error: data.error || {
          code: `HTTP_${res.status}`,
          message: data.message || `خطای سرور (${res.status})`
        }
      };
    }

    return data;
  } catch (err: any) {
    return {
      success: false,
      error: {
        code: "NETWORK_ERROR",
        message: err.message || "خطا در برقراری ارتباط با سرور."
      }
    };
  }
}

export const api = {
  // Auth
  login: (data: { agency_code: string; username: string; password: string }) =>
    request<{ token: string; user: any; tenant: any }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(data)
    }),

  logout: () =>
    request("/auth/logout", {
      method: "POST"
    }),

  getMe: () =>
    request<{ user: any; tenant: any }>("/auth/me"),

  updateProfile: (data: { display_name?: string; phone?: string }) =>
    request("/auth/profile", {
      method: "PATCH",
      body: JSON.stringify(data)
    }),

  changePassword: (data: { current_password: string; new_password: string; confirm_password: string }) =>
    request("/auth/change-password", {
      method: "POST",
      body: JSON.stringify(data)
    }),

  // Properties
  getProperties: (params?: Record<string, string | number | boolean | undefined>) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== "") {
          query.set(key, String(val));
        }
      });
    }
    const qStr = query.toString();
    return request<any[]>(`/properties${qStr ? `?${qStr}` : ""}`);
  },

  getPropertyById: (id: string) =>
    request<any>(`/properties/${id}`),

  createProperty: (data: any) =>
    request<any>("/properties", {
      method: "POST",
      body: JSON.stringify(data)
    }),

  updateProperty: (id: string, data: any) =>
    request<any>(`/properties/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data)
    }),

  deleteProperty: (id: string) =>
    request(`/properties/${id}`, {
      method: "DELETE"
    }),

  assignProperty: (id: string, assigned_to_user_id: string) =>
    request(`/properties/${id}/assign`, {
      method: "POST",
      body: JSON.stringify({ assigned_to_user_id })
    }),

  getPropertyMatches: (id: string) =>
    request<any[]>(`/properties/${id}/matches`),

  uploadPropertyMedia: (id: string, file: File, isCover: boolean = false) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("is_cover", String(isCover));
    return request<any>(`/properties/${id}/media`, {
      method: "POST",
      body: formData
    });
  },

  deletePropertyMedia: (propertyId: string, mediaId: string) =>
    request(`/properties/${propertyId}/media/${mediaId}`, {
      method: "DELETE"
    }),

  linkPropertyOwner: (propertyId: string, data: any) =>
    request(`/properties/${propertyId}/owners`, {
      method: "POST",
      body: JSON.stringify(data)
    }),

  unlinkPropertyOwner: (propertyId: string, ownerId: string) =>
    request(`/properties/${propertyId}/owners/${ownerId}`, {
      method: "DELETE"
    }),

  // Customers
  getCustomers: (params?: Record<string, string | number | boolean | undefined>) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== "") {
          query.set(key, String(val));
        }
      });
    }
    const qStr = query.toString();
    return request<any[]>(`/customers${qStr ? `?${qStr}` : ""}`);
  },

  getCustomerById: (id: string) =>
    request<any>(`/customers/${id}`),

  createCustomer: (data: any) =>
    request<any>("/customers", {
      method: "POST",
      body: JSON.stringify(data)
    }),

  updateCustomer: (id: string, data: any) =>
    request<any>(`/customers/${id}`, {
      method: "PUT",
      body: JSON.stringify(data)
    }),

  deleteCustomer: (id: string) =>
    request(`/customers/${id}`, {
      method: "DELETE"
    }),

  assignCustomer: (id: string, assigned_to_user_id: string) =>
    request(`/customers/${id}/assign`, {
      method: "POST",
      body: JSON.stringify({ assigned_to_user_id })
    }),

  getCustomerMatches: (id: string) =>
    request<any[]>(`/customers/${id}/matches`),

  addCustomerRequirement: (customerId: string, data: any) =>
    request<any>(`/customers/${customerId}/requirements`, {
      method: "POST",
      body: JSON.stringify(data)
    }),

  updateCustomerRequirement: (customerId: string, reqId: string, data: any) =>
    request<any>(`/customers/${customerId}/requirements/${reqId}`, {
      method: "PUT",
      body: JSON.stringify(data)
    }),

  getCustomerInteractions: (customerId: string) =>
    request<any[]>(`/customers/${customerId}/interactions`),

  addCustomerInteraction: (customerId: string, data: any) =>
    request<any>(`/customers/${customerId}/interactions`, {
      method: "POST",
      body: JSON.stringify(data)
    }),

  reactToProperty: (customerId: string, propertyId: string, reaction: string, notes?: string) =>
    request(`/customers/${customerId}/reactions`, {
      method: "POST",
      body: JSON.stringify({ property_id: propertyId, reaction, reaction_notes: notes })
    }),

  // Tasks
  getTasks: (params?: Record<string, string | number | boolean | undefined>) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== "") {
          query.set(key, String(val));
        }
      });
    }
    const qStr = query.toString();
    return request<any[]>(`/tasks${qStr ? `?${qStr}` : ""}`);
  },

  getTodayTasks: () =>
    request<any[]>("/tasks/today"),

  createTask: (data: any) =>
    request<any>("/tasks", {
      method: "POST",
      body: JSON.stringify(data)
    }),

  updateTask: (id: string, data: any) =>
    request<any>(`/tasks/${id}`, {
      method: "PUT",
      body: JSON.stringify(data)
    }),

  updateTaskStatus: (id: string, status: string, visit_result?: string) =>
    request<any>(`/tasks/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, visit_result })
    }),

  deleteTask: (id: string) =>
    request(`/tasks/${id}`, {
      method: "DELETE"
    }),

  // Search
  search: (q: string) =>
    request<{ properties: any[]; customers: any[] }>(`/search?q=${encodeURIComponent(q)}`),

  // Owners
  getOwners: (q?: string) =>
    request<any[]>(`/owners${q ? `?q=${encodeURIComponent(q)}` : ""}`),

  createOwner: (data: any) =>
    request<any>("/owners", {
      method: "POST",
      body: JSON.stringify(data)
    }),

  // Transactions
  getTransactions: (params?: Record<string, string | number | boolean | undefined>) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== "") {
          query.set(key, String(val));
        }
      });
    }
    const qStr = query.toString();
    return request<any[]>(`/transactions${qStr ? `?${qStr}` : ""}`);
  },

  createTransaction: (data: any) =>
    request<any>("/transactions", {
      method: "POST",
      body: JSON.stringify(data)
    }),

  updateTransaction: (id: string, data: any) =>
    request<any>(`/transactions/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data)
    }),

  deleteTransaction: (id: string) =>
    request(`/transactions/${id}`, { method: "DELETE" }),

  getPerformanceReport: (from?: string, to?: string, branch_id?: string) => {
    const query = new URLSearchParams();
    if (from) query.set("from", from);
    if (to) query.set("to", to);
    if (branch_id) query.set("branch_id", branch_id);
    const qStr = query.toString();
    return request<any>(`/transactions/report/performance${qStr ? `?${qStr}` : ""}`);
  },

  // Agency
  getAgents: () =>
    request<any[]>("/agency/agents"),

  createAgent: (data: any) =>
    request<any>("/agency/agents", {
      method: "POST",
      body: JSON.stringify(data)
    }),

  updateAgent: (id: string, data: any) =>
    request<any>(`/agency/agents/${id}`, {
      method: "PUT",
      body: JSON.stringify(data)
    }),

  updateAgentStatus: (id: string, is_active: boolean) =>
    request(`/agency/agents/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ is_active })
    }),

  resetAgentPassword: (id: string, password: string) =>
    request(`/agency/agents/${id}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ password })
    }),

  transferAgentAssets: (id: string, data: any) =>
    request(`/agency/agents/${id}/transfer-assets`, {
      method: "POST",
      body: JSON.stringify(data)
    }),

  getBranches: () =>
    request<any[]>("/agency/branches"),

  createBranch: (data: any) =>
    request<any>("/agency/branches", {
      method: "POST",
      body: JSON.stringify(data)
    }),

  updateBranch: (id: string, data: any) =>
    request<any>(`/agency/branches/${id}`, {
      method: "PUT",
      body: JSON.stringify(data)
    }),

  getSettings: () =>
    request<any>("/agency/settings"),

  updateSettings: (data: any) =>
    request<any>("/agency/settings", {
      method: "PUT",
      body: JSON.stringify(data)
    }),

  getSubscription: () =>
    request<any>("/agency/subscription"),

  // Documents
  getAllDocuments: (includeArchived: boolean = false) =>
    request<any[]>(`/documents/all?include_archived=${includeArchived}`),

  uploadDocument: (data: { file: File; document_type: string; display_name?: string; property_id?: string; customer_id?: string }) => {
    const formData = new FormData();
    formData.append("file", data.file);
    formData.append("document_type", data.document_type);
    if (data.display_name) formData.append("display_name", data.display_name);
    if (data.property_id) formData.append("property_id", data.property_id);
    if (data.customer_id) formData.append("customer_id", data.customer_id);
    return request<any>("/documents/upload", {
      method: "POST",
      body: formData
    });
  },

  deleteDocument: (id: string) =>
    request(`/documents/${id}`, {
      method: "DELETE"
    })
};
