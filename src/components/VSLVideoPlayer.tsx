import { useRef, useState } from "react";
import { Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface VSLVideoPlayerProps {
  src: string;
  unlockAtSec: number;
  onProgress?: (currentSec: number, durationSec: number) => void;
  onUnlock?: () => void;
}

export default function VSLVideoPlayer({ src, unlockAtSec, onProgress, onUnlock }: VSLVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const maxWatchedRef = useRef(0);
  const unlockedRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(false);

  const play = async () => {
    const video = videoRef.current;
    if (!video) return;
    setError(false);
    try {
      if (video.error) video.load();
      await video.play();
    } catch {
      setError(true);
    }
  };

  const updateProgress = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.currentTime > maxWatchedRef.current + 1.5 || video.currentTime < maxWatchedRef.current - 1) {
      video.currentTime = maxWatchedRef.current;
      return;
    }
    maxWatchedRef.current = Math.max(maxWatchedRef.current, video.currentTime);
    setProgress(video.duration > 0 ? Math.min(100, video.currentTime / video.duration * 100) : 0);
    onProgress?.(video.currentTime, video.duration);
    if (!unlockedRef.current && video.currentTime >= unlockAtSec) {
      unlockedRef.current = true;
      onUnlock?.();
    }
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-card">
      <video
        ref={videoRef}
        src={src}
        playsInline
        preload="metadata"
        className="h-full w-full object-contain"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={updateProgress}
        onSeeking={() => {
          const video = videoRef.current;
          if (video && Math.abs(video.currentTime - maxWatchedRef.current) > 1.5) {
            video.currentTime = maxWatchedRef.current;
          }
        }}
        onError={() => { setError(true); setPlaying(false); }}
        onEnded={() => {
          setPlaying(false);
          maxWatchedRef.current = 0;
          if (videoRef.current) videoRef.current.currentTime = 0;
          setProgress(0);
        }}
      />
      <Button
        type="button"
        variant="ghost"
        onClick={() => playing ? videoRef.current?.pause() : void play()}
        aria-label={playing ? "Pausar vídeo" : error ? "Tentar reproduzir novamente" : "Reproduzir vídeo"}
        className={`absolute inset-0 z-10 h-full w-full rounded-none p-0 hover:bg-transparent ${playing ? "" : "bg-background/55 backdrop-blur-[2px]"}`}
      >
        {!playing && (
          <>
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl">
              {error ? <RotateCcw className="h-8 w-8" /> : <Play className="ml-1 h-9 w-9" fill="currentColor" />}
            </span>
            <span className="absolute bottom-6 inset-x-4 text-center text-sm font-semibold text-foreground">
              {error ? "Não foi possível reproduzir. Toque para tentar novamente." : "Toque para assistir"}
            </span>
          </>
        )}
      </Button>
      <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-20 h-1.5 overflow-hidden rounded-full bg-muted/50">
        <div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}