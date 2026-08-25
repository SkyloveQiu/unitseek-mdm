import axios, { type AxiosResponse, type InternalAxiosRequestConfig } from "axios";

const configuredApiUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, "");

// No authentication token is persisted in browser storage.
localStorage.removeItem("unitseek_mdm_token");
localStorage.removeItem("unitseek_mdm_user");

const api = axios.create({
  baseURL: configuredApiUrl ? `${configuredApiUrl}/api/v1` : "/api/v1",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

function readCookie(name: string): string | undefined {
  const prefix = `${name}=`;
  return document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(prefix))
    ?.slice(prefix.length);
}

// Cookie sessions are HttpOnly. The readable CSRF cookie is sent only with
// mutating requests; external API clients can continue using Bearer tokens.
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const method = config.method?.toLowerCase();
    if (method && !["get", "head", "options"].includes(method) && config.headers) {
      const csrfToken = readCookie("unitseek_mdm_csrf");
      if (csrfToken) {
        config.headers["X-CSRF-Token"] = csrfToken;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle 401
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Authentication is deliberately absent while creating the first
      // administrator. Redirecting from /register made that page flash and
      // immediately disappear after its /auth/me check returned 401.
      if (!["/login", "/register"].includes(window.location.pathname)) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

// Typed helpers
export async function apiGet<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const response = await api.get<T>(url, { params });
  return response.data;
}

export async function apiPost<T>(url: string, data?: unknown): Promise<T> {
  const response = await api.post<T>(url, data);
  return response.data;
}

export async function apiPut<T>(url: string, data?: unknown): Promise<T> {
  const response = await api.put<T>(url, data);
  return response.data;
}

export async function apiDelete<T>(url: string): Promise<T> {
  const response = await api.delete<T>(url);
  return response.data;
}

export default api;
