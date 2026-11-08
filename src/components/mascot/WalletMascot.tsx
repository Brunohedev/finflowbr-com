import { motion, useReducedMotion } from "framer-motion";

export type MascotPose = "wave" | "point-up" | "idle";

interface WalletMascotProps {
  pose?: MascotPose;
  size?: number;
  className?: string;
  /** When false, the arm shrinks back into the wallet. */
  armOut?: boolean;
}

// Arm angle (degrees) for each pose. The arm is drawn pointing right, so negative
// values raise it. Wave swings between two angles.
const ARM_ANIMATION: Record<MascotPose, number | number[]> = {
  wave: [-35, 5, -35],
  "point-up": [-62, -54, -62],
  idle: [-10, -4, -10],
};

/**
 * The black FinFlow wallet (same shapes as the animated logo) with a cartoon arm.
 * Pure presentation: no state, no data.
 */
const WalletMascot = ({ pose = "idle", size = 72, className, armOut = true }: WalletMascotProps) => {
  const reduceMotion = useReducedMotion();
  const loop = reduceMotion ? undefined : { duration: pose === "wave" ? 0.9 : 1.6, repeat: Infinity, ease: "easeInOut" as const };
  const arm = ARM_ANIMATION[pose];

  return (
    <motion.svg
      width={size}
      height={(size * 84) / 132}
      viewBox="0 0 132 84"
      fill="none"
      role="img"
      aria-hidden="true"
      className={className}
      animate={reduceMotion ? undefined : { y: [0, -3, 0] }}
      transition={reduceMotion ? undefined : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
    >
      {/* Wallet body (matches the logo) */}
      <g transform="translate(10 14)">
        <rect x="2" y="10" width="76" height="52" rx="7" fill="hsl(var(--mascot-body))" />
        <path d="M9 10C9 4.48 13.48 0 19 0H69C74.52 0 79 4.48 79 10H9Z" fill="hsl(var(--mascot-flap))" />
        <circle cx="66" cy="36" r="4.5" fill="hsl(var(--primary))" />
        <rect x="9" y="19" width="35" height="3.5" rx="1.75" fill="hsl(var(--mascot-flap))" opacity="0.8" />
        <rect x="9" y="26" width="26" height="3.5" rx="1.75" fill="hsl(var(--mascot-flap))" opacity="0.6" />
      </g>

      {/* Cartoon arm, shoulder on the wallet's right edge */}
      <g transform="translate(86 50)">
        <motion.g
          style={{ originX: 0, originY: 0.5 }}
          initial={false}
          animate={{ scale: armOut ? 1 : 0, opacity: armOut ? 1 : 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.45, ease: "easeInOut" }}
        >
        <motion.g
          style={{ originX: 0, originY: 0.5 }}
          initial={{ rotate: Array.isArray(arm) ? arm[0] : arm }}
          animate={{ rotate: reduceMotion && Array.isArray(arm) ? arm[0] : arm }}
          transition={loop}
        >
          <path d="M0 0 C7 -3 13 3 21 0" stroke="hsl(var(--mascot-body))" strokeWidth="4.5" strokeLinecap="round" />
          {/* Glove */}
          <rect x="19" y="-4" width="5" height="8" rx="2" fill="hsl(var(--mascot-glove))" stroke="hsl(var(--mascot-body))" strokeWidth="1.4" />
          <circle cx="28" cy="0" r="5.5" fill="hsl(var(--mascot-glove))" stroke="hsl(var(--mascot-body))" strokeWidth="1.4" />
          <rect x="30" y="-2" width="10" height="4" rx="2" fill="hsl(var(--mascot-glove))" stroke="hsl(var(--mascot-body))" strokeWidth="1.4" />
          <ellipse cx="27" cy="-5.2" rx="2.4" ry="1.8" fill="hsl(var(--mascot-glove))" stroke="hsl(var(--mascot-body))" strokeWidth="1.2" />
        </motion.g>
        </motion.g>
      </g>
    </motion.svg>
  );
};

export default WalletMascot;
