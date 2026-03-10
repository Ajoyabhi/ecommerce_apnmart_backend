import { useAuth } from "@/store/use-auth";
import { Redirect } from "wouter";

export function UserGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated()) {
    return <Redirect to="/signin" />;
  }

  return <>{children}</>;
}
