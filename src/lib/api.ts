// src/lib/api.ts
const API_BASE = import.meta.env.PROD
  ? (import.meta.env.VITE_API_URL as string) || ""
  : ""; // dev: pakai vite proxy

// Default timeout 20 detik — cukup untuk slow upload Excel ringan, tidak
// terlalu agresif. Caller bisa override via 3rd arg (mis. import bulk).
const DEFAULT_TIMEOUT_MS = 20_000;

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T = any>(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<T> {
  // Try state token first since authStore uses persist 'auth-storage'.
  let token = null;
  if (typeof window !== "undefined") {
    token = localStorage.getItem("token");
    if (!token) {
      const authStorage = localStorage.getItem("auth-storage");
      if (authStorage) {
        try {
          const parsed = JSON.parse(authStorage);
          token = parsed?.state?.token;
        } catch(e) {}
      }
    }
  }

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    // Anti-bot interstitial Hostinger biasanya exempt XHR yg mark dirinya
    // dengan header ini. Tidak ngubah API behavior — cuma signal "ini AJAX".
    "X-Requested-With": "XMLHttpRequest",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  // AbortController — cegah request hang lama saat WiFi sekolah goyang.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${url}`, {
      ...options,
      headers,
      credentials: "include",
      signal: controller.signal,
    });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new ApiError(
        `Permintaan timeout setelah ${Math.round(timeoutMs / 1000)} detik — koneksi lambat. Coba lagi.`,
        408
      );
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  // Handle no-content responses
  if (res.status === 204) return undefined as T;

  let data: any;
  const contentType = res.headers.get("content-type");

  // Deteksi HTML response dari firewall/CDN
  if (contentType?.includes("text/html")) {
    const htmlText = await res.text();

    // Deteksi Hostinger firewall challenge
    if (htmlText.includes("Checking your browser") ||
        htmlText.includes("jschallenge") ||
        htmlText.includes("hcdn-cgi")) {
      throw new ApiError(
        "Permintaan diblokir oleh firewall. Silakan coba lagi dalam beberapa detik atau hubungi administrator.",
        403
      );
    }

    // HTML response lain yang tidak diharapkan
    throw new ApiError(
      "Server mengembalikan halaman HTML, bukan data JSON. Periksa koneksi atau hubungi administrator.",
      res.status
    );
  }

  if (contentType?.includes("application/json")) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  if (!res.ok) {
    throw new ApiError(
      data?.error || data || `Request failed (${res.status})`,
      res.status
    );
  }

  return data;
}

export const api = {
  get:    <T = any>(url: string, timeoutMs?: number) =>
    request<T>(url, { method: "GET" }, timeoutMs),
  post:   <T = any>(url: string, body?: any, timeoutMs?: number) =>
    request<T>(url, { method: "POST", body: body ? JSON.stringify(body) : undefined }, timeoutMs),
  put:    <T = any>(url: string, body?: any, timeoutMs?: number) =>
    request<T>(url, { method: "PUT", body: body ? JSON.stringify(body) : undefined }, timeoutMs),
  patch:  <T = any>(url: string, body?: any, timeoutMs?: number) =>
    request<T>(url, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }, timeoutMs),
  delete: <T = any>(url: string, timeoutMs?: number) =>
    request<T>(url, { method: "DELETE" }, timeoutMs),
};

export default api;
export { ApiError };
