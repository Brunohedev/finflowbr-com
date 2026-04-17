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
  }, [user?.id]);

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

  // 3. Only block during the initial access resolution.
  // Background subscription refreshes must not unmount the app.
  if (subscription === null || accessLevel === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // 4. Authenticated users always reach the main app.
  // Subscription/entitlement checks continue in the background and are
  // surfaced inside the app (e.g., upgrade prompts), but we never bounce
  // a logged-in user out to /planos automatically after login.
  return <>{children}</>;
};

export default ProtectedRoute;
