import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface SubscriptionInfo {
  subscribed: boolean;
  plan: string | null;
  subscriptionId: string | null;
  subscriptionEnd: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  subscription: SubscriptionInfo | null;
  checkSubscription: () => Promise<void>;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);

  const checkSubscription = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const { data, error } = await supabase.functions.invoke("check-subscription", {
        body: null,
      });
      clearTimeout(timeout);
      if (error) throw error;
      setSubscription({
        subscribed: data?.subscribed ?? false,
        plan: data?.plan ?? null,
        subscriptionId: data?.subscription_id ?? null,
        subscriptionEnd: data?.subscription_end ?? null,
      });
    } catch (err) {
      console.error("Error checking subscription:", err);
      // On error, check app_metadata before assuming no access
      // This prevents blocking invited/magic-link users when the edge function fails
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const meta = currentUser?.app_metadata;
      const hasMetaAccess = meta?.is_active === true || meta?.subscription_status === "active";
      setSubscription({
        subscribed: hasMetaAccess,
        plan: hasMetaAccess ? (meta?.plan ?? "invited") : null,
        subscriptionId: null,
        subscriptionEnd: null,
      });
    }
  }, []);

  useEffect(() => {
    const refreshUser = async (session: Session | null) => {
      if (session) {
        // Force fresh user fetch to get latest app_metadata (critical for magic links)
        const { data: { user: freshUser } } = await supabase.auth.getUser();
        setSession(session);
        setUser(freshUser ?? session.user ?? null);
      } else {
        setSession(null);
        setUser(null);
      }
      setIsLoading(false);
    };

    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((_event, session) => {
      // Fire and forget - don't await inside callback to avoid deadlocks
      refreshUser(session);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      refreshUser(session);
    });

    return () => authSub.unsubscribe();
  }, []);

  // Check subscription when user is authenticated
  useEffect(() => {
    if (session) {
      checkSubscription();
      const interval = setInterval(checkSubscription, 60000);
      return () => clearInterval(interval);
    } else {
      setSubscription(null);
    }
  }, [session, checkSubscription]);

  const login = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.error("Login error:", error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: "https://finflowbr.com/",
      },
    });
    if (error) {
      console.error("Register error:", error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isAuthenticated: !!session,
        isLoading,
        subscription,
        checkSubscription,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
