import { useAuth } from "@/store/use-auth";
import { Redirect } from "wouter";

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAdmin } = useAuth();

  if (!isAuthenticated() || !isAdmin()) {
    return <Redirect to="/admin/login" />;
  }

  return <>{children}</>;
}
