import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import LoginScreen from "@/components/LoginScreen";

const Login = () => {
  const { isAuthenticated, isLoading, login, register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const safeNext = searchParams.get("next") === "/planos" ? "/planos" : "/app";

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate(safeNext, { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate, safeNext]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (isAuthenticated) return null;

  return <LoginScreen onLogin={login} onRegister={register} />;
};

export default Login;
