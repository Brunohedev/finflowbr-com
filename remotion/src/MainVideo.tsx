import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  AbsoluteFill,
} from "remotion";

// Wallet SVG component
const Wallet: React.FC<{ scale?: number }> = ({ scale = 1 }) => (
  <svg
    width={90 * scale}
    height={72 * scale}
    viewBox="0 0 90 72"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Main body */}
    <rect x="2" y="12" width="86" height="58" rx="8" fill="#1a1a1a" />
    {/* Flap */}
    <path
      d="M10 12C10 5.37 15.37 0 22 0H78C84.63 0 90 5.37 90 12H10Z"
      fill="#2a2a2a"
    />
    {/* Clasp */}
    <rect x="60" y="32" width="28" height="18" rx="9" fill="#333" />
    <circle cx="74" cy="41" r="5" fill="#2ECC71" />
    {/* Card slot hint */}
    <rect x="10" y="22" width="40" height="4" rx="2" fill="#333" opacity="0.5" />
    <rect x="10" y="30" width="30" height="4" rx="2" fill="#333" opacity="0.3" />
    {/* Shadow */}
    <ellipse cx="45" cy="72" rx="35" ry="3" fill="black" opacity="0.08" />
  </svg>
);

// Dollar bill component
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
    <svg width="60" height="28" viewBox="0 0 60 28" fill="none">
      <rect width="60" height="28" rx="3" fill="#2ECC71" />
      <rect x="2" y="2" width="56" height="24" rx="2" fill="#27AE60" opacity="0.3" />
      <circle cx="30" cy="14" r="8" fill="#2ECC71" stroke="#1E8449" strokeWidth="1" />
      <text
        x="30"
        y="18"
        textAnchor="middle"
        fill="#1E8449"
        fontSize="12"
        fontWeight="bold"
        fontFamily="sans-serif"
      >
        $
      </text>
      {/* Corner details */}
      <rect x="4" y="4" width="8" height="6" rx="1" fill="#2ECC71" opacity="0.5" />
      <rect x="48" y="18" width="8" height="6" rx="1" fill="#2ECC71" opacity="0.5" />
    </svg>
  </div>
);

export const MainVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // === PHASE 1: Typewriter (frames 0-55) ===
  const text = "Finflow";
  const typewriterStart = 5;
  const charsPerSecond = 3;
  const framesPerChar = Math.round(fps / charsPerSecond);
  const visibleChars = Math.min(
    text.length,
    Math.floor(Math.max(0, frame - typewriterStart) / framesPerChar)
  );
  const cursorVisible = frame < 60 && Math.floor(frame / 8) % 2 === 0;
  const typewriterDone = visibleChars >= text.length;
  const typewriterDoneFrame = typewriterStart + text.length * framesPerChar;

  // Wallet position - starts on the left, moves to center at the end
  const walletStartX = 80;
  const walletCenterX = 205;
  const walletY = 160;

  // === PHASE 2: Text to bills morph (frames ~60-80) ===
  const morphStart = typewriterDoneFrame + 8;
  const morphDuration = 18;
  const morphProgress = interpolate(
    frame,
    [morphStart, morphStart + morphDuration],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Text fade out
  const textOpacity = interpolate(
    frame,
    [morphStart, morphStart + 10],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Bills fade in
  const billsAppearOpacity = interpolate(
    frame,
    [morphStart + 5, morphStart + 15],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // === PHASE 3: Bills fly into wallet (frames ~80-105) ===
  const flyStart = morphStart + morphDuration;
  const flyDuration = 25;

  // Text position (where bills originate from)
  const textCenterX = 250;
  const textCenterY = 310;

  // Wallet top position for bills target
  const walletTopX = walletStartX + 45;
  const walletTopY = walletY + 10;

  // Bill animations - staggered
  const billConfigs = [
    { delay: 0, startX: textCenterX - 30, startY: textCenterY, rotation: -5 },
    { delay: 4, startX: textCenterX, startY: textCenterY + 10, rotation: 3 },
    { delay: 8, startX: textCenterX + 30, startY: textCenterY - 5, rotation: -2 },
  ];

  const bills = billConfigs.map((cfg, i) => {
    const billFlyProgress = interpolate(
      frame,
      [flyStart + cfg.delay, flyStart + cfg.delay + flyDuration - 8],
      [0, 1],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );

    // Ease in-out curve
    const eased =
      billFlyProgress < 0.5
        ? 2 * billFlyProgress * billFlyProgress
        : 1 - Math.pow(-2 * billFlyProgress + 2, 2) / 2;

    const x = interpolate(eased, [0, 1], [cfg.startX, walletTopX - 30]);
    const y = interpolate(eased, [0, 1], [cfg.startY, walletTopY - 20 + i * 5]);

    // Arc motion - bills go up before going to wallet
    const arcY = y - Math.sin(eased * Math.PI) * 80;

    const rotation = interpolate(eased, [0, 1], [cfg.rotation, 0]);
    const scale = interpolate(eased, [0, 0.5, 1], [1, 1.1, 0.6], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

    // Disappear into wallet
    const billOpacity = interpolate(
      eased,
      [0, 0.7, 0.95, 1],
      [1, 1, 0.5, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );

    return { x, y: arcY, rotation, scale, opacity: billOpacity * billsAppearOpacity };
  });

  // === PHASE 4: Wallet slides to center (frames ~105-125) ===
  const slideStart = flyStart + flyDuration + 2;
  const walletSlide = spring({
    frame: Math.max(0, frame - slideStart),
    fps,
    config: { damping: 18, stiffness: 80 },
  });
  const walletX = interpolate(walletSlide, [0, 1], [walletStartX, walletCenterX]);

  // Wallet subtle bounce when receiving bills
  const receiveBounce =
    frame >= flyStart + flyDuration - 5 && frame < slideStart
      ? Math.sin((frame - (flyStart + flyDuration - 5)) * 0.8) * 3
      : 0;

  // Wallet scale on receive
  const walletReceiveScale =
    frame >= flyStart + flyDuration - 5 && frame < slideStart
      ? 1 + Math.sin((frame - (flyStart + flyDuration - 5)) * 0.6) * 0.05
      : 1;

  // Final wallet scale (slight pulse at center)
  const finalScale = frame >= slideStart
    ? 1 + Math.sin((frame - slideStart) * 0.15) * 0.02
    : walletReceiveScale;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "transparent",
        fontFamily: "sans-serif",
      }}
    >
      {/* Wallet */}
      <div
        style={{
          position: "absolute",
          left: walletX,
          top: walletY + receiveBounce,
          transform: `scale(${finalScale})`,
          transformOrigin: "center center",
          filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.12))",
        }}
      >
        <Wallet scale={1.1} />
      </div>

      {/* Typewriter text */}
      {textOpacity > 0 && (
        <div
          style={{
            position: "absolute",
            left: 130,
            top: 300,
            display: "flex",
            alignItems: "center",
            opacity: textOpacity,
          }}
        >
          <span style={{ fontSize: 48, fontWeight: 700, letterSpacing: -1 }}>
            {text.split("").map((char, i) => {
              if (i >= visibleChars) return null;
              const isFlow = i >= 3;
              return (
                <span
                  key={i}
                  style={{
                    color: isFlow ? "#2ECC71" : "#000000",
                    display: "inline-block",
                    transform: `translateY(${i === visibleChars - 1 && !typewriterDone ? -3 : 0}px)`,
                  }}
                >
                  {char}
                </span>
              );
            })}
          </span>
          {/* Cursor */}
          {frame < 65 && (
            <span
              style={{
                display: "inline-block",
                width: 3,
                height: 40,
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
