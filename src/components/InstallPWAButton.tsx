import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, Share, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useLanguage } from "@/i18n/LanguageContext";

interface InstallPWAButtonProps {
  variant?: "floating" | "menu";
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const isIOS = () => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
};

const isInStandaloneMode = () => {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
};

const isInIframe = () => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
};

const DISMISS_KEY = "finflow_install_dismissed_at";
const DISMISS_HOURS = 24;

const InstallPWAButton = ({ variant = "floating" }: InstallPWAButtonProps) => {
  const { t } = useLanguage();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [iosModalOpen, setIosModalOpen] = useState(false);
  const [iosEligible, setIosEligible] = useState(false);

  useEffect(() => {
    // Menu variant is always visible (user-triggered entry point)
    if (variant === "menu") {
      if (isInStandaloneMode()) return; // already installed
      setVisible(true);
      if (isIOS()) setIosEligible(true);

      const handler = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);
      };
      window.addEventListener("beforeinstallprompt", handler);
      const installed = () => {
        setVisible(false);
        setDeferredPrompt(null);
      };
      window.addEventListener("appinstalled", installed);
      return () => {
        window.removeEventListener("beforeinstallprompt", handler);
        window.removeEventListener("appinstalled", installed);
      };
    }

    if (isInIframe() || isInStandaloneMode()) return;

    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_HOURS * 3600 * 1000) return;

    if (isIOS()) {
      setIosEligible(true);
      setVisible(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const installed = () => {
      setVisible(false);
      setDeferredPrompt(null);
    };
    window.addEventListener("appinstalled", installed);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installed);
    };
  }, [variant]);

  const handleClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") setVisible(false);
      setDeferredPrompt(null);
      return;
    }
    // No native prompt available → show instructions modal (works for iOS and as fallback)
    setIosModalOpen(true);
  };


  const dismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  };

  if (!visible) {
    return (
      <Dialog open={iosModalOpen} onOpenChange={setIosModalOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-center text-xl">
              {t("Instalar o FinFlow")}
            </DialogTitle>
            <DialogDescription className="text-center">
              {t("Adicione o app à sua tela inicial em 2 passos")}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 space-y-3">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 }}
              className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-4"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                1
              </div>
              <div className="flex-1 text-sm">
                <p className="font-medium">{t("Toque em Compartilhar")}</p>
                <p className="text-muted-foreground">
                  {t("Na barra inferior do Safari")}
                </p>
              </div>
              <Share className="h-5 w-5 text-primary" />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 }}
              className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-4"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                2
              </div>
              <div className="flex-1 text-sm">
                <p className="font-medium">
                  {t("Toque em 'Adicionar à Tela de Início'")}
                </p>
                <p className="text-muted-foreground">
                  {t("Confirme para instalar")}
                </p>
              </div>
              <Plus className="h-5 w-5 text-primary" />
            </motion.div>
          </div>

          <Button onClick={() => setIosModalOpen(false)} className="mt-4 w-full rounded-full">
            {t("Entendi")}
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  if (variant === "menu") {
    return (
      <>
        <Button variant="ghost" className="justify-start rounded-xl w-full" onClick={handleClick}>
          <Download className="w-4 h-4 mr-2" /> {t("Instalar app")}
        </Button>

        <Dialog open={iosModalOpen} onOpenChange={setIosModalOpen}>
          <DialogContent className="max-w-sm rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-center text-xl">
                {t("Instalar o FinFlow")}
              </DialogTitle>
              <DialogDescription className="text-center">
                {t("Adicione o app à sua tela inicial em 2 passos")}
              </DialogDescription>
            </DialogHeader>

            <div className="mt-2 space-y-3">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 }}
                className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-4"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                  1
                </div>
                <div className="flex-1 text-sm">
                  <p className="font-medium">{t("Toque em Compartilhar")}</p>
                  <p className="text-muted-foreground">
                    {t("Na barra inferior do Safari")}
                  </p>
                </div>
                <Share className="h-5 w-5 text-primary" />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 }}
                className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-4"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                  2
                </div>
                <div className="flex-1 text-sm">
                  <p className="font-medium">
                    {t("Toque em 'Adicionar à Tela de Início'")}
                  </p>
                  <p className="text-muted-foreground">
                    {t("Confirme para instalar")}
                  </p>
                </div>
                <Plus className="h-5 w-5 text-primary" />
              </motion.div>
            </div>

            <Button onClick={() => setIosModalOpen(false)} className="mt-4 w-full rounded-full">
              {t("Entendi")}
            </Button>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ y: 80, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 80, opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className="fixed bottom-5 right-5 z-[60] sm:bottom-6 sm:right-6"
          >
            <div className="relative">
              <motion.button
                onClick={handleClick}
                whileTap={{ scale: 0.95 }}
                whileHover={{ scale: 1.03 }}
                className="flex items-center gap-2 rounded-full bg-primary px-5 py-3 pr-6 text-primary-foreground shadow-lg shadow-primary/30 ring-1 ring-primary/40 backdrop-blur"
              >
                <motion.span
                  animate={{ y: [0, -2, 0] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                  className="flex items-center justify-center"
                >
                  <Download className="h-5 w-5" />
                </motion.span>
                <span className="text-sm font-semibold">{t("Instalar app")}</span>
              </motion.button>
              <button
                onClick={dismiss}
                aria-label={t("Fechar")}
                className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-background text-foreground shadow ring-1 ring-border hover:bg-muted"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={iosModalOpen} onOpenChange={setIosModalOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-center text-xl">
              {t("Instalar o FinFlow")}
            </DialogTitle>
            <DialogDescription className="text-center">
              {t("Adicione o app à sua tela inicial em 2 passos")}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 space-y-3">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 }}
              className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-4"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                1
              </div>
              <div className="flex-1 text-sm">
                <p className="font-medium">{t("Toque em Compartilhar")}</p>
                <p className="text-muted-foreground">
                  {t("Na barra inferior do Safari")}
                </p>
              </div>
              <Share className="h-5 w-5 text-primary" />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 }}
              className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-4"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                2
              </div>
              <div className="flex-1 text-sm">
                <p className="font-medium">
                  {t("Toque em 'Adicionar à Tela de Início'")}
                </p>
                <p className="text-muted-foreground">
                  {t("Confirme para instalar")}
                </p>
              </div>
              <Plus className="h-5 w-5 text-primary" />
            </motion.div>
          </div>

          <Button onClick={() => setIosModalOpen(false)} className="mt-4 w-full rounded-full">
            {t("Entendi")}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default InstallPWAButton;
