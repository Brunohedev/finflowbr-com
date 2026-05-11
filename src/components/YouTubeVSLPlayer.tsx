import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface YouTubeVSLPlayerProps {
  videoId: string;
  onProgress?: (currentSec: number, durationSec: number) => void;
  onUnlock?: () => void;
  unlockAtSec?: number;
}

const YouTubeVSLPlayer = ({
  videoId,
  onProgress,
  onUnlock,
  unlockAtSec = 180,
}: YouTubeVSLPlayerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const maxWatchedRef = useRef(0);
  const unlockedRef = useRef(false);
  const intervalRef = useRef<number | null>(null);
  const [started, setStarted] = useState(false);
  const [ready, setReady] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const ensureApi = () =>
      new Promise<void>((resolve) => {
        if (window.YT && window.YT.Player) return resolve();
        const existing = document.querySelector(
          'script[src="https://www.youtube.com/iframe_api"]',
        );
        if (!existing) {
          const tag = document.createElement("script");
          tag.src = "https://www.youtube.com/iframe_api";
          document.body.appendChild(tag);
        }
        const prev = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
          prev?.();
          resolve();
        };
        // Fallback poll
        const i = window.setInterval(() => {
          if (window.YT && window.YT.Player) {
            window.clearInterval(i);
            resolve();
          }
        }, 100);
      });

    let destroyed = false;
    ensureApi().then(() => {
      if (destroyed || !containerRef.current) return;
      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId,
        playerVars: {
          controls: 0,
          disablekb: 1,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          fs: 0,
          iv_load_policy: 3,
        },
        events: {
          onReady: (e: any) => {
            setReady(true);
            setDuration(e.target.getDuration() || 0);
          },
          onStateChange: (e: any) => {
            // 1 = playing, 2 = paused, 0 = ended
            if (e.data === 1 && !intervalRef.current) {
              intervalRef.current = window.setInterval(() => {
                const p = playerRef.current;
                if (!p) return;
                const t = p.getCurrentTime?.() ?? 0;
                const d = p.getDuration?.() ?? 0;
                if (d && d !== duration) setDuration(d);
                // Anti-seek-forward: if jumped > 1.5s ahead of max, snap back
                if (t > maxWatchedRef.current + 1.5) {
                  p.seekTo(maxWatchedRef.current, true);
                  return;
                }
                // Anti-rewind: if seeked back more than 1s, snap forward
                if (t < maxWatchedRef.current - 1) {
                  p.seekTo(maxWatchedRef.current, true);
                  return;
                }
                if (t > maxWatchedRef.current) maxWatchedRef.current = t;
                setCurrent(t);
                onProgress?.(t, d);
                if (!unlockedRef.current && t >= unlockAtSec) {
                  unlockedRef.current = true;
                  onUnlock?.();
                }
              }, 250);
            }
            if (e.data !== 1 && intervalRef.current) {
              window.clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
          },
        },
      });
    });

    return () => {
      destroyed = true;
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      try {
        playerRef.current?.destroy?.();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  const handlePlay = () => {
    if (!ready) return;
    setStarted(true);
    try {
      playerRef.current?.playVideo?.();
    } catch {}
  };

  const pct = duration > 0 ? Math.min(100, (current / duration) * 100) : 0;
  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="relative w-full h-full">
      {/* YouTube iframe */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full" />

      {/* Block all pointer events on the iframe (no clicking the video) */}
      <div className="absolute inset-0 z-10" aria-hidden />

      {/* Big play button overlay (before start) */}
      {!started && (
        <button
          onClick={handlePlay}
          disabled={!ready}
          className="absolute inset-0 z-20 flex items-center justify-center bg-black/55 backdrop-blur-[2px] group transition-all"
          aria-label="Reproduzir vídeo"
        >
          <span className="relative flex items-center justify-center">
            <span className="absolute inline-flex h-24 w-24 rounded-full bg-primary opacity-60 animate-ping" />
            <span className="relative inline-flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-2xl shadow-primary/40 group-hover:scale-110 transition-transform">
              <Play className="h-9 w-9 ml-1" fill="currentColor" />
            </span>
          </span>
          <span className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/95 text-sm font-semibold tracking-wide">
            {ready ? "Toque para assistir" : "Carregando..."}
          </span>
        </button>
      )}

      {/* Progress bar (read-only) */}
      {started && (
        <div className="absolute left-0 right-0 bottom-0 z-20 px-3 pb-3 pt-6 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none">
          <div className="flex items-center justify-between text-[11px] font-medium text-white/90 mb-1.5">
            <span>{fmt(current)}</span>
            <span>{duration ? fmt(duration) : "--:--"}</span>
          </div>
          <div className="relative h-1.5 w-full rounded-full bg-white/20 overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-primary rounded-full transition-[width] duration-200"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default YouTubeVSLPlayer;
