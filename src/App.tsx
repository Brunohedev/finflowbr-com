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
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
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
            {/* Public routes: no auth required */}
            <Route path="/planos" element={<Pricing />} />
            <Route path="/sucesso" element={<Sucesso />} />
            <Route path="/cancelado" element={<Cancelado />} />
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
