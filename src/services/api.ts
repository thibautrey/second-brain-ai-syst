/**
 * API Service - Base HTTP client for backend communication
 */

const API_BASE_URL = `${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api`;

function getAuthToken(): string | null {
  return localStorage.getItem("authToken");
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || `HTTP error! status: ${response.status}`);
  }
  return response.json();
}

export async function apiGet<T>(
  endpoint: string,
  params?: Record<string, unknown>,
): Promise<T> {
  const url = new URL(`${API_BASE_URL}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
      "Content-Type": "application/json",
    },
  });

  return handleResponse<T>(response);
}

export async function apiPost<T>(endpoint: string, data?: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
      "Content-Type": "application/json",
    },
    body: data ? JSON.stringify(data) : undefined,
  });

  return handleResponse<T>(response);
}

export async function apiPatch<T>(
  endpoint: string,
  data?: unknown,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
      "Content-Type": "application/json",
    },
    body: data ? JSON.stringify(data) : undefined,
  });

  return handleResponse<T>(response);
}

export async function apiPut<T>(
  endpoint: string,
  data?: unknown,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
      "Content-Type": "application/json",
    },
    body: data ? JSON.stringify(data) : undefined,
  });

  return handleResponse<T>(response);
}

export async function apiDelete<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
      "Content-Type": "application/json",
    },
  });

  return handleResponse<T>(response);
}
// ==================== Tips API ====================

export interface Tip {
  id: string;
  userId: string;
  title: string;
  description: string;
  category: string;
  targetFeature?: string;
  isDismissed: boolean;
  dismissedAt?: string;
  viewCount: number;
  lastViewedAt?: string;
  priority: number;
  icon?: string;
  createdAt: string;
  updatedAt: string;
}

export async function fetchActiveTips(options?: {
  limit?: number;
  offset?: number;
  targetFeature?: string;
}): Promise<{ tips: Tip[]; total: number; limit: number; offset: number }> {
  return apiGet<{ tips: Tip[]; total: number; limit: number; offset: number }>(
    "/tips",
    options,
  );
}

export async function viewTip(tipId: string): Promise<{ success: boolean; tip: Tip }> {
  return apiPatch<{ success: boolean; tip: Tip }>(`/tips/${tipId}/view`);
}

export async function dismissTip(tipId: string): Promise<{ success: boolean; tip: Tip }> {
  return apiPatch<{ success: boolean; tip: Tip }>(`/tips/${tipId}/dismiss`);
}

export async function createTip(data: {
  title: string;
  description: string;
  category?: string;
  targetFeature?: string;
  priority?: number;
  icon?: string;
  metadata?: Record<string, any>;
}): Promise<{ success: boolean; tip: Tip }> {
  return apiPost<{ success: boolean; tip: Tip }>("/tips", data);
}