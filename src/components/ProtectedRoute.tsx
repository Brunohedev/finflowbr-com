import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import LoginScreen from "@/components/LoginScreen";

interface ProtectedRouteProps {
  children: ReactNode;
}

/**
 * Wraps protected routes with auth + subscription checks.
 * 
 * Flow:
 * 1. Loading → spinner
 * 2. Not authenticated → LoginScreen
 * 3. Authenticated but still checking subscription → spinner
 * 4. Authenticated, no active plan → redirect to /planos
 * 5. Authenticated + active plan → render children
 */
const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const {
    isAuthenticated,
    isLoading,
    isCheckingSubscription,
    subscription,
    login,
    register,
  } = useAuth();

  // 1. Still restoring session
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // 2. Not logged in → show login (NOT /planos)
  if (!isAuthenticated) {
    return <LoginScreen onLogin={login} onRegister={register} />;
  }

  // 3. Logged in but subscription check still in progress
  if (isCheckingSubscription || subscription === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // 4. Logged in, subscription loaded, but no active plan → paywall
  const hasAccess =
    subscription.subscribed === true ||
    subscription.plan === "unlimited";

  if (!hasAccess) {
    return <Navigate to="/planos" replace />;
  }

  // 5. All good → render the protected content
  return <>{children}</>;
};

export default ProtectedRoute;
