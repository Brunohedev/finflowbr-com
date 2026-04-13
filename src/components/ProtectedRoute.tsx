import { ReactNode, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getAccess } from "@/lib/getAccess";

interface ProtectedRouteProps {
  children: ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const {
    user,
    isAuthenticated,
    isLoading,
    isCheckingSubscription,
    subscription,
  } = useAuth();

  const [accessLevel, setAccessLevel] = useState<"unlimited" | "pro" | "none" | null>(null);
  const [isCheckingAccess, setIsCheckingAccess] = useState(false);

  // Run getAccess as secondary check once user is available
  useEffect(() => {
    if (!user) {
      setAccessLevel(null);
      return;
    }

    setIsCheckingAccess(true);
    getAccess(user)
      .then(setAccessLevel)
      .catch(() => setAccessLevel(null))
      .finally(() => setIsCheckingAccess(false));
  }, [user]);

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

  // 3. Still checking subscription OR access
  if (isCheckingSubscription || subscription === null || isCheckingAccess || accessLevel === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // 4. Grant access if EITHER check passes
  const hasSubscription = subscription.subscribed === true || subscription.plan === "unlimited";
  const hasDirectAccess = accessLevel === "unlimited" || accessLevel === "pro";

  if (!hasSubscription && !hasDirectAccess) {
    return <Navigate to="/planos" replace />;
  }

  // 5. Access granted
  return <>{children}</>;
};

export default ProtectedRoute;
