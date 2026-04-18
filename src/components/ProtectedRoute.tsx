import { ReactNode, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getAccess, type AccessLevel } from "@/lib/getAccess";

interface ProtectedRouteProps {
  children: ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [accessLevel, setAccessLevel] = useState<AccessLevel | null>(null);
  const [checkingAccess, setCheckingAccess] = useState(true);

  useEffect(() => {
    let cancelled = false;

    if (!user) {
      setAccessLevel(null);
      setCheckingAccess(false);
      return;
    }

    setCheckingAccess(true);
    getAccess(user)
      .then((level) => {
        if (!cancelled) {
          setAccessLevel(level);
          setCheckingAccess(false);
        }
      })
      .catch((err) => {
        console.error("Error checking access:", err);
        if (!cancelled) {
          setAccessLevel("none");
          setCheckingAccess(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  // 1. Restoring auth session
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // 2. Not logged in → /login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // 3. Checking access level
  if (checkingAccess || accessLevel === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // 4. No active access → /planos
  if (accessLevel === "none") {
    return <Navigate to="/planos" replace />;
  }

  // 5. Active access (unlimited or pro) → app
  return <>{children}</>;
};

export default ProtectedRoute;
