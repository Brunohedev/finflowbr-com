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
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => (open ? start() : setOpen(true))}
          aria-label={copy.openLabel}
          className="rounded-2xl p-1 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <WalletMascot pose={open ? "wave" : "idle"} size={68} />
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
              className="relative max-w-[170px] rounded-xl border border-border bg-card px-2.5 py-1.5 text-left text-[11px] leading-snug text-card-foreground shadow-sm"
            >
              <span aria-hidden="true" className="absolute -left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rotate-45 border-b border-l border-border bg-card" />
              <span className="relative">{copy.hint}</span>
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
