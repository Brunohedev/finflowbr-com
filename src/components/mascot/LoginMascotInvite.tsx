import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/LanguageContext";
import WalletMascot from "./WalletMascot";
import { markTourInviteSeen, shouldAutoOpenTourInvite, TOUR_COPY, TOUR_PATH } from "@/lib/mascotTour";

const safeStorage = () => (typeof window === "undefined" ? undefined : window.localStorage);

/** Floating wallet mascot on the public start screen that invites visitors to the guided tour. */
const LoginMascotInvite = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const copy = TOUR_COPY[language] ?? TOUR_COPY.pt;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!shouldAutoOpenTourInvite(safeStorage())) return;
    const timer = window.setTimeout(() => setOpen(true), 1200);
    return () => window.clearTimeout(timer);
  }, []);

  const dismiss = () => {
    markTourInviteSeen(safeStorage());
    setOpen(false);
  };

  const start = () => {
    markTourInviteSeen(safeStorage());
    navigate(TOUR_PATH);
  };

  return (
    <div className="public-login-mascot absolute z-20 flex flex-col items-start gap-1">
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => (open ? start() : setOpen(true))}
          aria-label={copy.openLabel}
          className="rounded-2xl p-1 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <WalletMascot pose={open ? "wave" : "idle"} size={60} />
        </button>
        <AnimatePresence>
          {!open && (
            <motion.button
              type="button"
              onClick={() => setOpen(true)}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="relative max-w-[100px] max-[359px]:hidden rounded-lg border border-primary/15 bg-primary/5 px-2 py-1 text-left text-[10px] font-medium leading-tight text-primary backdrop-blur-sm"
            >
              <svg aria-hidden="true" viewBox="0 0 5 8" className="absolute -left-[5px] top-1/2 h-2 w-[5px] -translate-y-1/2 fill-primary/5">
                <path d="M5 0 L0 4 L5 8 Z" />
              </svg>
              {copy.hint}
            </motion.button>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label={copy.openLabel}
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="relative w-[240px] rounded-2xl rounded-tl-sm border border-border bg-card p-3 text-card-foreground shadow-lg"
          >
            <p className="text-sm leading-snug">{copy.invite}</p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" className="h-8 flex-1 font-semibold" onClick={start}>{copy.start}</Button>
              <Button size="sm" variant="ghost" className="h-8 text-muted-foreground" onClick={dismiss}>{copy.later}</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LoginMascotInvite;
