import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { dictionaries, Language, LANGUAGES } from "./translations";

const STORAGE_KEY = "finflow.language";

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

const getInitialLanguage = (): Language => {
  if (typeof window === "undefined") return "pt";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY) as Language | null;
    if (stored && LANGUAGES.some((l) => l.code === stored)) return stored;
  } catch {
    // ignore
  }
  return "pt";
};

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, language);
      document.documentElement.lang = language;
    } catch {
      // ignore
    }
  }, [language]);

  const value = useMemo<LanguageContextValue>(() => {
    const dict = dictionaries[language] || {};
    return {
      language,
      setLanguage: (lang: Language) => setLanguageState(lang),
      // Fallback strategy: missing translation -> original key (never breaks UI)
      t: (key: string) => (dict[key] !== undefined && dict[key] !== "" ? dict[key] : key),
    };
  }, [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = (): LanguageContextValue => {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    // Safe fallback: identity translator so components using the hook outside the
    // provider never crash. This protects existing flows from any side effects.
    return {
      language: "pt",
      setLanguage: () => {},
      t: (key: string) => key,
    };
  }
  return ctx;
};
