/**
 * Auth API – login, OTP signup/verify/resend, and Google OAuth redirect.
 * Uses fetch directly so we can return success: false + message without throwing.
 */

import { apiUrl } from "./client";
import type { ApiResponse } from "./types";
import type {
  AuthResponse,
  LoginPayload,
  SignupPayload,
  VerifyOtpPayload,
  ResendOtpPayload,
} from "./types";

const AUTH_TOKEN_KEY = "urban_kart_access_token";

export function getStoredAccessToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setStoredAccessToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearStoredAccessToken(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

async function authFetch<T>(
  path: string,
  body: unknown
): Promise<ApiResponse<T> & { message?: string }> {
  const res = await fetch(apiUrl(path), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as ApiResponse<T> & { message?: string };
  if (res.ok && json.success && (json as { data?: { accessToken?: string } }).data?.accessToken) {
    setStoredAccessToken((json as ApiResponse<AuthResponse>).data!.accessToken);
  }
  return json;
}

export async function login(payload: LoginPayload): Promise<ApiResponse<AuthResponse> & { message?: string }> {
  return authFetch<AuthResponse>("auth/login", payload);
}

/** Step 1: signup → backend sends OTP to email. No tokens yet. */
export async function signup(payload: SignupPayload): Promise<ApiResponse<{ email: string }> & { message?: string }> {
  return authFetch<{ email: string }>("auth/signup", payload);
}

/** Step 2: verify OTP → returns tokens on success. */
export async function verifyOtp(payload: VerifyOtpPayload): Promise<ApiResponse<AuthResponse> & { message?: string }> {
  return authFetch<AuthResponse>("auth/verify-otp", payload);
}

/** Resend OTP (max 3 per hour per backend). */
export async function resendOtp(payload: ResendOtpPayload): Promise<ApiResponse<{ email: string }> & { message?: string }> {
  return authFetch<{ email: string }>("auth/resend-otp", payload);
}

/** Full URL to start Google OAuth (redirect user here). */
export function getGoogleAuthUrl(): string {
  return apiUrl("auth/google");
}
