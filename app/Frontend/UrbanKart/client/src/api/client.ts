import type { ApiResponse } from "./types";
import { useAuth } from "@/store/use-auth";

const getBaseUrl = (): string => {
  const url = import.meta.env.VITE_API_URL || "http://localhost:5001";
  if (url) return url.replace(/\/$/, "");
  return "";
};

const API_BASE = "/api/v1";
const AUTH_TOKEN_KEY = "urban_kart_access_token";

export function getApiBaseUrl(): string {
  return getBaseUrl();
}

export function apiUrl(path: string): string {
  const base = getBaseUrl();
  const p = path.startsWith("/") ? path : `/${path}`;
  const prefix = base ? `${base}${API_BASE}` : API_BASE;
  return `${prefix}${p}`;
}

function getAuthHeader(): Record<string, string> {
  try {
    const token = typeof localStorage !== "undefined" ? localStorage.getItem(AUTH_TOKEN_KEY) : null;
    if (token) return { Authorization: `Bearer ${token}` };
  } catch {
    // ignore
  }
  return {};
}

export async function fetchApi<T>(
  path: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  const url = path.startsWith("http") ? path : apiUrl(path);

  const token = useAuth.getState().accessToken;
  const authHeaders: Record<string, string> = {};
  if (token) {
    authHeaders["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
      ...options?.headers,
    },
  });

  if (res.status === 401) {
    useAuth.getState().logout();
  }

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.message || `Request failed: ${res.status}`);
  }
  return json as ApiResponse<T>;
}

/** Response from POST /api/v1/admin/upload-media */
export interface UploadMediaResponse {
  success: boolean;
  files?: { path: string }[];
  message?: string;
}

/**
 * Upload one or more files to admin media (B2). Uses multipart/form-data.
 * Requires admin auth. Returns stored paths (e.g. products/uuid.webp).
 */
export async function uploadAdminMedia(files: File[]): Promise<{ path: string }[]> {
  const url = apiUrl("admin/upload-media");
  const token = useAuth.getState().accessToken;
  const authHeaders: Record<string, string> = {};
  if (token) authHeaders["Authorization"] = `Bearer ${token}`;

  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));

  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: authHeaders,
    body: formData,
  });

  const json = (await res.json().catch(() => ({}))) as UploadMediaResponse;
  if (!res.ok) throw new Error(json?.message || `Upload failed: ${res.status}`);
  if (!json.success || !json.files) throw new Error(json?.message || "Upload failed");
  return json.files;
}
