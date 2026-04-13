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
  isCheckingSubscription: boolean;
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
  const [isCheckingSubscription, setIsCheckingSubscription] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);

  const checkSubscription = useCallback(async () => {
    setIsCheckingSubscription(true);
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
      // On error, check app_metadata AND user_entitlements before assuming no access
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const meta = currentUser?.app_metadata;
      const hasMetaAccess = meta?.is_active === true || meta?.subscription_status === "active";

      if (hasMetaAccess) {
        setSubscription({
          subscribed: true,
          plan: meta?.plan ?? "invited",
          subscriptionId: null,
          subscriptionEnd: null,
        });
        return;
      }

      // Secondary fallback: check user_entitlements table directly
      if (currentUser?.id) {
        const { data: entitlements } = await supabase
          .from("user_entitlements")
          .select("access_type")
          .eq("user_id", currentUser.id)
          .eq("access_type", "unlimited")
          .limit(1);

        if (entitlements && entitlements.length > 0) {
          setSubscription({
            subscribed: true,
            plan: "unlimited",
            subscriptionId: null,
            subscriptionEnd: null,
          });
          return;
        }
      }

      setSubscription({
        subscribed: false,
        plan: null,
        subscriptionId: null,
        subscriptionEnd: null,
      });
    } finally {
      setIsCheckingSubscription(false);
    }
  }, []);

  useEffect(() => {
    const refreshUser = async (session: Session | null) => {
      if (session) {
        setSubscription(null);
        setIsCheckingSubscription(true);
        // Force fresh user fetch to get latest app_metadata (critical for magic links)
        const { data: { user: freshUser } } = await supabase.auth.getUser();
        setSession(session);
        setUser(freshUser ?? session.user ?? null);
      } else {
        setSession(null);
        setUser(null);
        setSubscription(null);
        setIsCheckingSubscription(false);
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
      void checkSubscription();
      const interval = setInterval(() => {
        void checkSubscription();
      }, 60000);
      return () => clearInterval(interval);
    } else {
      setSubscription(null);
      setIsCheckingSubscription(false);
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
        isCheckingSubscription,
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
