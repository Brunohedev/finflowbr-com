import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
  children: ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { isAuthenticated, isLoading } = useAuth();

  // 1. Still restoring session
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // 2. Not logged in
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // 3. After auth succeeds, always enter the app immediately.
  // Subscription/entitlement checks must stay in the background and never
  // block or redirect the first post-login entry.
  return <>{children}</>;
};

export default ProtectedRoute;
