import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/store/use-auth";
import { setStoredAccessToken } from "@/api/auth";
import { fetchApi } from "@/api/client";
import type { UserProfile } from "@/api/types";
import { Loader2 } from "lucide-react";

/**
 * Handles redirect from Google OAuth: backend sends accessToken & refreshToken in query.
 * We set tokens, fetch profile, then redirect home.
 */
export default function AuthCallback() {
  const [, setLocation] = useLocation();
  const { setAuth } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const accessToken = params.get("accessToken");
    const refreshToken = params.get("refreshToken");

    if (!accessToken) {
      const err = params.get("error") || "Missing tokens";
      setError(decodeURIComponent(err));
      return;
    }

    let cancelled = false;

    (async () => {
      setStoredAccessToken(accessToken);
      const placeholderUser = {
        id: "",
        email: "",
        firstName: "",
        lastName: "",
        role: "CUSTOMER",
      };
      setAuth(placeholderUser, accessToken, refreshToken || accessToken);

      try {
        const res = await fetchApi<UserProfile>("user/profile", { method: "GET" });
        if (cancelled) return;
        const profile = (res as { data?: UserProfile }).data;
        if (profile) {
          setAuth(
            {
              id: profile.id,
              email: profile.email,
              firstName: profile.firstName ?? "",
              lastName: profile.lastName ?? "",
              role: profile.role ?? "CUSTOMER",
            },
            accessToken,
            refreshToken || accessToken
          );
        }
        setLocation("/");
      } catch {
        if (cancelled) return;
        setLocation("/");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [setAuth, setLocation]);

  if (error) {
    return (
      <div className="min-h-[40vh] flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-destructive font-medium">{error}</p>
        <a href="/signin" className="text-primary hover:underline">
          Back to Sign in
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-[40vh] flex flex-col items-center justify-center gap-4 px-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-muted-foreground">Signing you in...</p>
    </div>
  );
}
