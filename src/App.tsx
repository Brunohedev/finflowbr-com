import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Pricing from "./pages/Pricing";
import Sucesso from "./pages/Sucesso";
import Cancelado from "./pages/Cancelado";
import Login from "./pages/Login";
import RootRedirect from "./pages/RootRedirect";
import VSL from "./pages/VSL";
import BankConnect from "./pages/BankConnect";
import Onboarding from "./pages/Onboarding";
import Privacy from "./pages/Privacy";
import DeleteAccount from "./pages/DeleteAccount";
import PublicDeleteAccount from "./pages/PublicDeleteAccount";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import AuthenticatedRoute from "./components/AuthenticatedRoute";
import { LanguageProvider } from "./i18n/LanguageContext";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Root: redirect to /login or /app based on auth */}
            <Route path="/" element={<RootRedirect />} />
            {/* Login page: public, redirects to /app if already authenticated */}
            <Route path="/login" element={<Login />} />
            {/* Protected: requires auth + active plan */}
            <Route path="/app" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/banco" element={<ProtectedRoute><BankConnect /></ProtectedRoute>} />
            {/* Public routes: no auth required */}
            <Route path="/planos" element={<Pricing />} />
            <Route path="/sucesso" element={<Sucesso />} />
            <Route path="/cancelado" element={<Cancelado />} />
            <Route path="/vsl" element={<VSL />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/delete-account" element={<PublicDeleteAccount />} />
            <Route path="/excluir-conta" element={<AuthenticatedRoute><DeleteAccount /></AuthenticatedRoute>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
