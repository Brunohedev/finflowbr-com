import { useEffect } from "react";
import { refreshBankTransactions } from "@/lib/bankRefresh";

export function useBankForegroundRefresh(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      void refreshBankTransactions(userId).catch((error) => {
        console.error("[Bank] foreground refresh failed", error);
      });
    };
    refresh();
    // Visibility covers returning from payment/another app. In-flight requests are deduplicated.
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, [userId]);
}