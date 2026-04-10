import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  AbsoluteFill,
} from "remotion";

const Wallet: React.FC<{ scale?: number }> = ({ scale = 1 }) => (
  <svg
    width={80 * scale}
    height={64 * scale}
    viewBox="0 0 80 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect x="2" y="10" width="76" height="52" rx="7" fill="#1a1a1a" />
    <path d="M9 10C9 4.48 13.48 0 19 0H69C74.52 0 79 4.48 79 10H9Z" fill="#2a2a2a" />
    <rect x="54" y="28" width="24" height="16" rx="8" fill="#333" />
    <circle cx="66" cy="36" r="4.5" fill="#2ECC71" />
    <rect x="9" y="19" width="35" height="3.5" rx="1.75" fill="#333" opacity="0.5" />
    <rect x="9" y="26" width="26" height="3.5" rx="1.75" fill="#333" opacity="0.3" />
  </svg>
);

const DollarBill: React.FC<{
  x: number;
  y: number;
  rotation: number;
  opacity: number;
  scale: number;
}> = ({ x, y, rotation, opacity, scale }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      transform: `rotate(${rotation}deg) scale(${scale})`,
      opacity,
      transformOrigin: "center center",
    }}
  >
    <svg width="56" height="26" viewBox="0 0 56 26" fill="none">
      <rect width="56" height="26" rx="3" fill="#2ECC71" />
      <rect x="2" y="2" width="52" height="22" rx="2" fill="#27AE60" opacity="0.3" />
      <circle cx="28" cy="13" r="7" fill="#2ECC71" stroke="#1E8449" strokeWidth="1" />
      <text x="28" y="17" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="bold" fontFamily="sans-serif">$</text>
    </svg>
  </div>
);

export const MainVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const text = "FinFlow";
  const typewriterStart = 5;
  const framesPerChar = 7;
  const visibleChars = Math.min(
    text.length,
    Math.floor(Math.max(0, frame - typewriterStart) / framesPerChar)
  );
  const cursorVisible = frame < 62 && Math.floor(frame / 8) % 2 === 0;
  const typewriterDone = visibleChars >= text.length;
  const typewriterDoneFrame = typewriterStart + text.length * framesPerChar;

  // Layout: wallet + text on same horizontal line, centered
  const walletW = 80;
  const textW = 220;
  const gap = 12;
  const totalW = walletW + gap + textW;
  const groupLeft = (width - totalW) / 2;
  const centerY = height / 2 - 32;

  // Wallet X: starts at group left, slides to center after bills
  const slideStart = typewriterDoneFrame + 55;
  const walletSlide = spring({
    frame: Math.max(0, frame - slideStart),
    fps,
    config: { damping: 18, stiffness: 80 },
  });
  const walletFinalX = (width - walletW) / 2;
  const walletX = interpolate(walletSlide, [0, 1], [groupLeft, walletFinalX]);

  // Morph: text fades, bills appear
  const morphStart = typewriterDoneFrame + 8;
  const textOpacity = interpolate(frame, [morphStart, morphStart + 10], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const billsAppear = interpolate(frame, [morphStart + 5, morphStart + 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Bills fly to wallet
  const flyStart = morphStart + 18;
  const flyDuration = 22;
  const textCenterX = groupLeft + walletW + gap + textW / 2;
  const textCenterY = centerY + 10;
  const walletTopX = groupLeft + walletW / 2 - 28;
  const walletTopY = centerY - 5;

  const billConfigs = [
    { delay: 0, startX: textCenterX - 28, startY: textCenterY, rot: -5 },
    { delay: 4, startX: textCenterX, startY: textCenterY + 8, rot: 3 },
    { delay: 8, startX: textCenterX + 28, startY: textCenterY - 4, rot: -2 },
  ];

  const bills = billConfigs.map((cfg, i) => {
    const p = interpolate(frame, [flyStart + cfg.delay, flyStart + cfg.delay + flyDuration - 6], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    const x = interpolate(eased, [0, 1], [cfg.startX, walletTopX]);
    const y = interpolate(eased, [0, 1], [cfg.startY, walletTopY + i * 4]);
    const arcY = y - Math.sin(eased * Math.PI) * 60;
    const rotation = interpolate(eased, [0, 1], [cfg.rot, 0]);
    const scale = interpolate(eased, [0, 0.5, 1], [1, 1.1, 0.5], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const opacity = interpolate(eased, [0, 0.7, 0.95, 1], [1, 1, 0.5, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    return { x, y: arcY, rotation, scale, opacity: opacity * billsAppear };
  });

  // Wallet bounce when receiving
  const receiveBounce =
    frame >= flyStart + flyDuration - 5 && frame < slideStart
      ? Math.sin((frame - (flyStart + flyDuration - 5)) * 0.8) * 2
      : 0;

  const finalPulse = frame >= slideStart ? 1 + Math.sin((frame - slideStart) * 0.15) * 0.015 : 1;

  return (
    <AbsoluteFill style={{ backgroundColor: "transparent", fontFamily: "sans-serif" }}>
      {/* Wallet */}
      <div
        style={{
          position: "absolute",
          left: walletX,
          top: centerY + receiveBounce,
          transform: `scale(${finalPulse})`,
          transformOrigin: "center center",
          filter: "drop-shadow(0 6px 18px rgba(0,0,0,0.10))",
        }}
      >
        <Wallet scale={1} />
      </div>

      {/* Typewriter text - same line as wallet */}
      {textOpacity > 0 && (
        <div
          style={{
            position: "absolute",
            left: groupLeft + walletW + gap,
            top: centerY + 10,
            display: "flex",
            alignItems: "center",
            opacity: textOpacity,
          }}
        >
          <span style={{ fontSize: 42, fontWeight: 700, letterSpacing: -1 }}>
            {text.split("").map((char, i) => {
              if (i >= visibleChars) return null;
              const isFlow = i >= 3;
              return (
                <span
                  key={i}
                  style={{
                    color: isFlow ? "#2ECC71" : "#000000",
                    display: "inline-block",
                    transform: `translateY(${i === visibleChars - 1 && !typewriterDone ? -2 : 0}px)`,
                  }}
                >
                  {char}
                </span>
              );
            })}
          </span>
          {frame < 65 && (
            <span
              style={{
                display: "inline-block",
                width: 2.5,
                height: 36,
                backgroundColor: "#2ECC71",
                marginLeft: 2,
                opacity: cursorVisible ? 1 : 0,
                borderRadius: 1,
              }}
            />
          )}
        </div>
      )}

      {/* Dollar bills */}
      {frame >= morphStart + 5 &&
        bills.map((bill, i) => (
          <DollarBill
            key={i}
            x={bill.x}
            y={bill.y}
            rotation={bill.rotation}
            opacity={bill.opacity}
            scale={bill.scale}
          />
        ))}
    </AbsoluteFill>
  );
};
