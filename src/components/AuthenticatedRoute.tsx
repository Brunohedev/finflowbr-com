import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

// Account management must not depend on a paid entitlement.
const AuthenticatedRoute = ({ children }: { children: ReactNode }) => {
  const { isLoading, isAuthenticated } = useAuth();
  if (isLoading) {
    return <div role="status" aria-label="Loading" className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

export default AuthenticatedRoute;