import type { Language } from "@/i18n/translations";
import type { MascotPose } from "@/components/mascot/WalletMascot";

export const TOUR_SEEN_KEY = "finflow.mascotTourSeen";
export const TOUR_PATH = "/onboarding?tour=1";
export const TOUR_FINISH_PATH = "/login?mode=register";

/** The invitation opens by itself only for visitors who never saw/dismissed it. */
export const shouldAutoOpenTourInvite = (storage: Pick<Storage, "getItem"> | undefined): boolean => {
  try {
    return storage?.getItem(TOUR_SEEN_KEY) !== "1";
  } catch {
    return false;
  }
};

export const markTourInviteSeen = (storage: Pick<Storage, "setItem"> | undefined) => {
  try {
    storage?.setItem(TOUR_SEEN_KEY, "1");
  } catch {
    // Storage unavailable (private mode): the invite simply shows again next time.
  }
};

/** Pose per "Como funciona" step: wave on welcome/finish, point at the content otherwise. */
export const poseForStep = (step: number, totalSteps: number): MascotPose =>
  step === 0 || step === totalSteps - 1 ? "wave" : "point-up";

interface TourCopy {
  invite: string;
  start: string;
  later: string;
  openLabel: string;
  skip: string;
  createAccount: string;
  steps: string[];
}

export const TOUR_COPY: Record<Language, TourCopy> = {
  pt: {
    invite: "Oi! Eu sou a carteira do FinFlow. Quer que eu te mostre como fazer seu dinheiro sobrar todo mês?",
    start: "Me mostra!",
    later: "Agora não",
    openLabel: "Como funciona",
    skip: "Pular tour",
    createAccount: "Criar minha conta",
    steps: [
      "Oi! Vou te guiar pelo método do FinFlow, passo a passo.",
      "Primeiro, me diga quanto você ganha no mês. Pode somar todas as suas rendas.",
      "Agora divida sua renda em Essenciais, Desejos e Reserva. A soma é sempre 100%.",
      "Gastou menos que o limite? A diferença vira dinheiro extra guardado. Arraste e veja!",
      "Todo mês, o que você guarda vai para a sua reserva. Ela só cresce.",
      "Bateu uma meta? Uma nova, maior, aparece automaticamente.",
      "Escolha um valor e veja em quantos anos você chega lá mantendo o ritmo.",
      "Pronto! Crie sua conta e comece a ver seu dinheiro sobrando.",
    ],
  },
  en: {
    invite: "Hi! I'm the FinFlow wallet. Want me to show you how to have money left over every month?",
    start: "Show me!",
    later: "Not now",
    openLabel: "How it works",
    skip: "Skip tour",
    createAccount: "Create my account",
    steps: [
      "Hi! I'll guide you through the FinFlow method, step by step.",
      "First, tell me how much you earn per month. You can add up all your income.",
      "Now split your income into Essentials, Wants and Savings. It always adds up to 100%.",
      "Spent less than the limit? The difference becomes extra savings. Drag and see!",
      "Every month, what you save goes to your reserve. It only grows.",
      "Reached a goal? A new, bigger one appears automatically.",
      "Pick an amount and see how many years it takes to get there at your pace.",
      "All set! Create your account and start seeing money left over.",
    ],
  },
  es: {
    invite: "¡Hola! Soy la billetera de FinFlow. ¿Quieres que te muestre cómo hacer que te sobre dinero cada mes?",
    start: "¡Muéstrame!",
    later: "Ahora no",
    openLabel: "Cómo funciona",
    skip: "Saltar tour",
    createAccount: "Crear mi cuenta",
    steps: [
      "¡Hola! Te guiaré por el método FinFlow, paso a paso.",
      "Primero, dime cuánto ganas al mes. Puedes sumar todos tus ingresos.",
      "Ahora divide tus ingresos en Esenciales, Deseos y Reserva. Siempre suma 100%.",
      "¿Gastaste menos que el límite? La diferencia se vuelve ahorro extra. ¡Desliza y mira!",
      "Cada mes, lo que ahorras va a tu reserva. Solo crece.",
      "¿Alcanzaste una meta? Una nueva, mayor, aparece automáticamente.",
      "Elige un valor y mira en cuántos años lo alcanzas manteniendo el ritmo.",
      "¡Listo! Crea tu cuenta y empieza a ver tu dinero sobrando.",
    ],
  },
};
