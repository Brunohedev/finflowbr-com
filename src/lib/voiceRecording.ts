import { Capacitor } from "@capacitor/core";
import { recordWav } from "@/lib/recordWav";

export interface VoiceRecording {
  stop: () => Promise<Blob>;
}

export function audioFile(blob: Blob): File {
  if (!blob.size) throw new Error("We couldn't hear anything. Please record again.");
  if (blob.size > 10 * 1024 * 1024) throw new Error("Recording is too long. Please record a shorter expense.");
  const type = blob.type.split(";")[0];
  const extensions: Record<string, string> = {
    "audio/webm": "webm", "audio/mp4": "m4a", "audio/wav": "wav",
  };
  const ext = extensions[type];
  if (!ext) throw new Error("This audio format isn't supported. Please record again.");
  return new File([blob], `expense.${ext}`, { type: blob.type });
}

export function recordingError(error: unknown): string {
  const name = error instanceof Error || error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Microphone access was denied. Allow microphone access for FinFlow in your settings to record.";
  }
  if (name === "NotFoundError") return "No microphone is available on this device.";
  if (name === "NotReadableError") return "Your microphone is busy. Close other recording apps and try again.";
  return error instanceof Error ? error.message : "Could not record audio. Please try again.";
}

export async function startVoiceRecording(onError: (error: unknown) => void): Promise<VoiceRecording> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Voice recording isn't supported on this device.");
  }
  // Only iOS native capture changes; Android and the web retain MediaRecorder.
  if (Capacitor.getPlatform() === "ios" || typeof MediaRecorder === "undefined") return recordWav();

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  try {
    const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]
      .find((type) => MediaRecorder.isTypeSupported(type));
    if (!mimeType) throw new Error("Voice recording isn't supported on this device.");
    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    let resolveStop: ((blob: Blob) => void) | undefined;
    let rejectStop: ((error: unknown) => void) | undefined;
    let failed = false;
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      resolveStop?.(new Blob(chunks, { type: recorder.mimeType || mimeType }));
    };
    recorder.onerror = () => {
      failed = true;
      stream.getTracks().forEach((track) => track.stop());
      const error = new Error("Recording was interrupted. Please try again.");
      rejectStop?.(error);
      onError(error);
    };
    recorder.start();
    let stopped = false;
    return {
      stop: () => new Promise<Blob>((resolve, reject) => {
        if (stopped || failed) { reject(new Error("Recording already stopped.")); return; }
        stopped = true;
        resolveStop = resolve;
        rejectStop = reject;
        recorder.stop();
      }),
    };
  } catch (error) {
    stream.getTracks().forEach((track) => track.stop());
    throw error;
  }
}