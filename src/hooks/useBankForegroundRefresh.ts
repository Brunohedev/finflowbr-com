import { useEffect } from "react";
import { refreshBankTransactions } from "@/lib/bankRefresh";

export function useBankForegroundRefresh(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return;
    let followUp: ReturnType<typeof setTimeout> | undefined;
    const sync = () => {
      void refreshBankTransactions(userId).catch((error) => {
        console.error("[Bank] foreground refresh failed", error);
      });
    };
    const refresh = () => {
      if (followUp) clearTimeout(followUp);
      if (document.visibilityState !== "visible") return;
      sync();
      // A purchase may become available just after the first read. One bounded
      // follow-up covers that race without a permanent polling loop.
      followUp = setTimeout(() => {
        if (document.visibilityState === "visible") sync();
      }, 30_000);
    };
    refresh();
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      if (followUp) clearTimeout(followUp);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [userId]);
}