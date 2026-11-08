import { AnimatePresence, motion } from "framer-motion";
import { useLanguage } from "@/i18n/LanguageContext";
import WalletMascot from "./WalletMascot";
import { poseForStep, TOUR_COPY } from "@/lib/mascotTour";

interface TourMascotGuideProps {
  step: number;
  totalSteps: number;
  onSkip: () => void;
}

/** Mascot + speech bubble shown under each "Como funciona" step during the guided tour. */
const TourMascotGuide = ({ step, totalSteps, onSkip }: TourMascotGuideProps) => {
  const { language } = useLanguage();
  const copy = TOUR_COPY[language] ?? TOUR_COPY.pt;
  const text = copy.steps[Math.min(Math.max(step, 0), copy.steps.length - 1)];

  return (
    <div className="flex items-end gap-1 px-4 pt-1">
      <div className="shrink-0 -mb-1">
        <WalletMascot pose={poseForStep(step, totalSteps)} size={78} />
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={`${step}-${language}`}
          role="status"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="mb-2 flex-1 rounded-2xl rounded-bl-sm border border-border bg-card px-3 py-2 text-card-foreground shadow-sm"
        >
          <p className="text-xs leading-snug">{text}</p>
          {step < totalSteps - 1 && (
            <button type="button" onClick={onSkip} className="mt-1 text-[11px] font-medium text-muted-foreground underline-offset-2 hover:underline">
              {copy.skip}
            </button>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default TourMascotGuide;
