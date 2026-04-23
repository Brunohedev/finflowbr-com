// Lightweight, isolated i18n layer.
// Adds translations on top of the existing UI without modifying any existing copy.
// If a key is missing, the original text is kept (fallback handled by the hook).

export type Language = "pt" | "en" | "es";

export const LANGUAGES: { code: Language; label: string; flag: string; country: string }[] = [
  { code: "pt", label: "Português", flag: "🇧🇷", country: "Brasil" },
  { code: "en", label: "English", flag: "🇺🇸", country: "United States" },
  { code: "es", label: "Español", flag: "🇪🇸", country: "España" },
];

// Translation dictionaries. Keys map to the ORIGINAL Portuguese text used in the app.
// Components can opt-in by calling t("Original text"). Untranslated strings fall back
// to the original key, so nothing breaks if a translation is missing.
type Dict = Record<string, string>;

const pt: Dict = {};

const en: Dict = {
  // Auth / Login
  "Entrar na minha conta": "Sign in to my account",
  "Crie sua conta": "Create your account",
  "Nome": "Name",
  "Seu nome": "Your name",
  "Email": "Email",
  "Senha": "Password",
  "Entrar": "Sign in",
  "Criar Conta": "Create Account",
  "Aguarde...": "Please wait...",
  "Não tem conta? Criar conta": "Don't have an account? Sign up",
  "Já tenho uma conta": "I already have an account",
  "Preencha todos os campos": "Please fill in all fields",
  "Senha deve ter pelo menos 6 caracteres": "Password must be at least 6 characters",
  "Erro ao entrar": "Sign in error",
  "Erro ao criar conta": "Sign up error",
  "Feito para ": "Made for ",
  // Common
  "Configurações": "Settings",
  "Sair": "Sign out",
  "Salvar": "Save",
  "Cancelar": "Cancel",
  "Adicionar": "Add",
  "Excluir": "Delete",
  "Editar": "Edit",
  "Voltar": "Back",
  "Idioma": "Language",
  "Selecionar idioma": "Select language",
};

const es: Dict = {
  // Auth / Login
  "Entrar na minha conta": "Entrar en mi cuenta",
  "Crie sua conta": "Crea tu cuenta",
  "Nome": "Nombre",
  "Seu nome": "Tu nombre",
  "Email": "Correo",
  "Senha": "Contraseña",
  "Entrar": "Entrar",
  "Criar Conta": "Crear cuenta",
  "Aguarde...": "Espera...",
  "Não tem conta? Criar conta": "¿No tienes cuenta? Crear cuenta",
  "Já tenho uma conta": "Ya tengo una cuenta",
  "Preencha todos os campos": "Completa todos los campos",
  "Senha deve ter pelo menos 6 caracteres": "La contraseña debe tener al menos 6 caracteres",
  "Erro ao entrar": "Error al entrar",
  "Erro ao criar conta": "Error al crear la cuenta",
  "Feito para ": "Hecho para ",
  // Common
  "Configurações": "Configuración",
  "Sair": "Salir",
  "Salvar": "Guardar",
  "Cancelar": "Cancelar",
  "Adicionar": "Añadir",
  "Excluir": "Eliminar",
  "Editar": "Editar",
  "Voltar": "Volver",
  "Idioma": "Idioma",
  "Selecionar idioma": "Seleccionar idioma",
};

export const dictionaries: Record<Language, Dict> = { pt, en, es };
