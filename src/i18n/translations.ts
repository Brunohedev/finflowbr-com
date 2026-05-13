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
// Components opt-in by calling t("Original text"). Untranslated strings fall back
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
  "Seu dinheiro finalmente sobrando": "Your money, finally left over",

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
  "Confirmar": "Confirm",
  "Continuar": "Continue",
  "Suporte": "Support",

  // Dashboard
  "Dinheiro Restante Este Mês": "Money Left This Month",
  "Renda:": "Income:",
  "Gastos:": "Expenses:",
  "despesa pendente": "pending expense",
  "despesas pendentes": "pending expenses",
  "Alocação do Orçamento": "Budget Allocation",
  "Últimas Despesas": "Latest Expenses",
  "Nova Despesa": "New Expense",
  "Nova despesa": "New expense",
  "da renda": "of income",
  "Usado:": "Used:",
  "Limite:": "Limit:",
  "Restam": "Remaining",
  "Excedido em": "Exceeded by",
  "Excedido": "Exceeded",
  "Atenção": "Warning",
  "No limite": "On track",

  // Categories
  "Essenciais": "Essentials",
  "Desejos": "Wants",
  "Reserva / Investimentos": "Savings / Investments",
  "Adicionar à Reserva": "Add to Savings",
  "Adicionar aos Investimentos": "Add to Investments",
  "Definir meta": "Set goal",
  "Definir meta...": "Set goal...",
  "Nota (opcional)": "Note (optional)",
  "Investimento": "Investment",

  // Settings
  "Fontes de Renda": "Income Sources",
  "(base para todos os meses)": "(base for all months)",
  "Total mensal base:": "Base monthly total:",
  "Renda somente para": "Income only for",
  "Alterar aqui afeta": "Changing here affects",
  "apenas": "only",
  "este mês. Os demais meses usam o valor base.": "this month. Other months use the base value.",
  "Restaurar valor base": "Restore base value",
  "Valor diferente da base": "Different from base value",
  "Só afeta": "Only affects",
  "Total:": "Total:",
  "Resetar Mês": "Reset Month",

  // Income manager
  "Adicionar renda": "Add income",
  "Adicionar Renda": "Add Income",
  "Nome (ex: Salário)": "Name (e.g. Salary)",
  "Diário": "Daily",
  "Semanal": "Weekly",
  "Quinzenal": "Biweekly",
  "Mensal": "Monthly",
  "Valor único": "One-time",
  "(único)": "(one-time)",

  // Setup wizard
  "Adicione suas fontes de renda para começar.": "Add your income sources to get started.",
  "Renda mensal total": "Total monthly income",
  "Defina suas proporções": "Set your proportions",
  "(deve ser 100%)": "(must be 100%)",
  "Começar a controlar": "Start tracking",

  // Expense dialog
  "Valor Total": "Total Amount",
  "Categoria": "Category",
  "Subcategoria": "Subcategory",
  "Selecione": "Select",
  "Parcelado?": "Installments?",
  "Número de parcelas": "Number of installments",
  "Status": "Status",
  "Pendente": "Pending",
  "Pago": "Paid",
  "Data": "Date",
  "Observação...": "Note...",
  "Adicionar Despesa": "Add Expense",
  "Ex: Supermercado": "E.g. Groceries",

  // Months
  "Janeiro": "January", "Fevereiro": "February", "Março": "March", "Abril": "April",
  "Maio": "May", "Junho": "June", "Julho": "July", "Agosto": "August",
  "Setembro": "September", "Outubro": "October", "Novembro": "November", "Dezembro": "December",

  // Demo simulation
  "Demonstração FinFlow": "FinFlow Demo",
  "Ver demonstração": "Watch demo",
  "Defina seu salário e a divisão do orçamento, depois veja a simulação.": "Set your salary and budget split, then watch the simulation.",
  "Renda mensal": "Monthly Income",
  "Reserva (sobra)": "Reserve (left over)",
  "Ajuste as barras acima para mudar quanto sobra.": "Adjust the sliders above to change how much is left.",
  "Rodar simulação": "Run simulation",
  "Reserva": "Reserve",
  "Enviando para a Reserva": "Sending to Reserve",
  "É isso. Claro, simples, e seu dinheiro finalmente trabalhando para você.": "That's it. Clear, simple, and your money is finally working for you.",
  "Ajustar": "Adjust",
  "Começar agora": "Get started",
  "Aluguel": "Rent",
  "Mercado": "Groceries",
  "Transporte": "Transport",
  "Restaurantes": "Restaurants",
  "Compras": "Shopping",
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
  "Seu dinheiro finalmente sobrando": "Tu dinero, por fin sobrando",

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
  "Confirmar": "Confirmar",
  "Continuar": "Continuar",
  "Suporte": "Soporte",

  // Dashboard
  "Dinheiro Restante Este Mês": "Dinero restante este mes",
  "Renda:": "Ingreso:",
  "Gastos:": "Gastos:",
  "despesa pendente": "gasto pendiente",
  "despesas pendentes": "gastos pendientes",
  "Alocação do Orçamento": "Asignación del presupuesto",
  "Últimas Despesas": "Últimos gastos",
  "Nova Despesa": "Nuevo gasto",
  "Nova despesa": "Nuevo gasto",
  "da renda": "del ingreso",
  "Usado:": "Usado:",
  "Limite:": "Límite:",
  "Restam": "Restan",
  "Excedido em": "Excedido en",
  "Excedido": "Excedido",
  "Atenção": "Atención",
  "No limite": "En el límite",

  // Categories
  "Essenciais": "Esenciales",
  "Desejos": "Deseos",
  "Reserva / Investimentos": "Reserva / Inversiones",
  "Adicionar à Reserva": "Añadir a la reserva",
  "Adicionar aos Investimentos": "Añadir a inversiones",
  "Definir meta": "Definir meta",
  "Definir meta...": "Definir meta...",
  "Nota (opcional)": "Nota (opcional)",
  "Investimento": "Inversión",

  // Settings
  "Fontes de Renda": "Fuentes de ingreso",
  "(base para todos os meses)": "(base para todos los meses)",
  "Total mensal base:": "Total mensual base:",
  "Renda somente para": "Ingreso solo para",
  "Alterar aqui afeta": "Cambiar aquí afecta",
  "apenas": "solo",
  "este mês. Os demais meses usam o valor base.": "este mes. Los demás meses usan el valor base.",
  "Restaurar valor base": "Restaurar valor base",
  "Valor diferente da base": "Valor diferente de la base",
  "Só afeta": "Solo afecta",
  "Total:": "Total:",
  "Resetar Mês": "Reiniciar mes",

  // Income manager
  "Adicionar renda": "Añadir ingreso",
  "Adicionar Renda": "Añadir ingreso",
  "Nome (ex: Salário)": "Nombre (ej: Salario)",
  "Diário": "Diario",
  "Semanal": "Semanal",
  "Quinzenal": "Quincenal",
  "Mensal": "Mensual",
  "Valor único": "Valor único",
  "(único)": "(único)",

  // Setup wizard
  "Adicione suas fontes de renda para começar.": "Añade tus fuentes de ingreso para comenzar.",
  "Renda mensal total": "Ingreso mensual total",
  "Defina suas proporções": "Define tus proporciones",
  "(deve ser 100%)": "(debe ser 100%)",
  "Começar a controlar": "Comenzar a controlar",

  // Expense dialog
  "Valor Total": "Importe total",
  "Categoria": "Categoría",
  "Subcategoria": "Subcategoría",
  "Selecione": "Selecciona",
  "Parcelado?": "¿En cuotas?",
  "Número de parcelas": "Número de cuotas",
  "Status": "Estado",
  "Pendente": "Pendiente",
  "Pago": "Pagado",
  "Data": "Fecha",
  "Observação...": "Observación...",
  "Adicionar Despesa": "Añadir gasto",
  "Ex: Supermercado": "Ej: Supermercado",

  // Months
  "Janeiro": "Enero", "Fevereiro": "Febrero", "Março": "Marzo", "Abril": "Abril",
  "Maio": "Mayo", "Junho": "Junio", "Julho": "Julio", "Agosto": "Agosto",
  "Setembro": "Septiembre", "Outubro": "Octubre", "Novembro": "Noviembre", "Dezembro": "Diciembre",

  // Demo simulation
  "Demonstração FinFlow": "Demostración FinFlow",
  "Defina seu salário e a divisão do orçamento, depois veja a simulação.": "Define tu salario y la división del presupuesto, luego mira la simulación.",
  "Renda mensal": "Ingreso mensual",
  "Reserva (sobra)": "Reserva (lo que sobra)",
  "Ajuste as barras acima para mudar quanto sobra.": "Ajusta las barras de arriba para cambiar cuánto sobra.",
  "Rodar simulação": "Ejecutar simulación",
  "Reserva": "Reserva",
  "Enviando para a Reserva": "Enviando a la reserva",
  "É isso. Claro, simples, e seu dinheiro finalmente trabalhando para você.": "Eso es todo. Claro, simple, y tu dinero por fin trabajando para ti.",
  "Ajustar": "Ajustar",
  "Começar agora": "Empezar ahora",
  "Aluguel": "Alquiler",
  "Mercado": "Supermercado",
  "Transporte": "Transporte",
  "Restaurantes": "Restaurantes",
  "Compras": "Compras",
};

export const dictionaries: Record<Language, Dict> = { pt, en, es };
