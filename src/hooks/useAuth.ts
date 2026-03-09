import { useState, useEffect, useCallback } from "react";
import { UserAccount } from "@/types/finance";

const USERS_KEY = "finflow-users";
const SESSION_KEY = "finflow-session";

const getUsers = (): UserAccount[] => {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
  } catch {
    return [];
  }
};

const saveUsers = (users: UserAccount[]) => {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
};

export function useAuth() {
  const [user, setUser] = useState<UserAccount | null>(() => {
    try {
      const session = localStorage.getItem(SESSION_KEY);
      return session ? JSON.parse(session) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  }, [user]);

  const login = useCallback((email: string, password: string): { success: boolean; error?: string } => {
    const users = getUsers();
    const found = users.find((u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
    if (!found) return { success: false, error: "Email ou senha incorretos" };
    setUser(found);
    return { success: true };
  }, []);

  const register = useCallback((name: string, email: string, password: string): { success: boolean; error?: string } => {
    const users = getUsers();
    if (users.find((u) => u.email.toLowerCase() === email.toLowerCase())) {
      return { success: false, error: "Este email já está cadastrado" };
    }
    const newUser: UserAccount = {
      id: crypto.randomUUID(),
      email: email.toLowerCase(),
      password,
      name,
      createdAt: new Date().toISOString(),
    };
    saveUsers([...users, newUser]);
    setUser(newUser);
    return { success: true };
  }, []);

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  return { user, isAuthenticated: !!user, login, register, logout };
}
