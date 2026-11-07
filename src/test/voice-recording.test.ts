import { beforeEach, describe, expect, it, vi } from "vitest";
import { audioFile, startVoiceRecording, recordingError } from "@/lib/voiceRecording";
import { encodeWav } from "@/lib/recordWav";
import { Capacitor } from "@capacitor/core";

vi.mock("@capacitor/core", () => ({ Capacitor: { getPlatform: vi.fn(() => "web") } }));

describe("voice recording compatibility", () => {
  const stopTrack = vi.fn();
  const close = vi.fn(async () => undefined);
  let processor: { onaudioprocess: ((event: unknown) => void) | null; connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> };
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Capacitor.getPlatform).mockReturnValue("web");
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: {
      getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: stopTrack }] })),
    } });
    processor = { onaudioprocess: null, connect: vi.fn(), disconnect: vi.fn() };
    vi.stubGlobal("AudioContext", class {
      sampleRate = 44100;
      destination = {};
      resume = vi.fn(async () => undefined);
      close = close;
      createMediaStreamSource = () => ({ connect: vi.fn(), disconnect: vi.fn() });
      createScriptProcessor = () => processor;
    });
  });

  it("records native iOS without MediaRecorder and uploads a complete WAV", async () => {
    vi.mocked(Capacitor.getPlatform).mockReturnValue("ios");
    vi.stubGlobal("MediaRecorder", undefined);
    const rec = await startVoiceRecording(vi.fn());
    processor.onaudioprocess?.({
      inputBuffer: { getChannelData: () => new Float32Array(4096).fill(0.5) },
      outputBuffer: { getChannelData: () => new Float32Array(4096) },
    });
    const blob = await rec.stop();
    const file = audioFile(blob);
    expect(file.name).toBe("expense.wav");
    expect(file.type).toBe("audio/wav");
    expect(file.size).toBe(44 + 4096 * 2);
    expect(stopTrack).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("keeps supported MediaRecorder capture on Android", async () => {
    vi.mocked(Capacitor.getPlatform).mockReturnValue("android");
    const construct = vi.fn();
    vi.stubGlobal("MediaRecorder", class {
      static isTypeSupported = (type: string) => type === "audio/webm;codecs=opus";
      mimeType = "audio/webm;codecs=opus";
      onstop?: () => void;
      ondataavailable?: (event: { data: Blob }) => void;
      constructor(_stream: unknown, options: unknown) { construct(options); }
      start() {}
      stop() {
        this.ondataavailable?.({ data: new Blob(["audio"], { type: this.mimeType }) });
        this.onstop?.();
      }
    });
    const rec = await startVoiceRecording(vi.fn());
    const file = audioFile(await rec.stop());
    expect(construct).toHaveBeenCalledWith({ mimeType: "audio/webm;codecs=opus" });
    expect(file.name).toBe("expense.webm");
    expect(file.type).toBe("audio/webm;codecs=opus");
    expect(stopTrack).toHaveBeenCalledTimes(1);
  });

  it("does not mislabel MP4 recordings as WebM", () => {
    expect(audioFile(new Blob(["audio"], { type: "audio/mp4" })).name).toBe("expense.m4a");
  });

  it("rejects empty audio and preserves the 10 MiB upload limit", () => {
    expect(() => audioFile(new Blob([], { type: "audio/wav" }))).toThrow("couldn't hear");
    expect(() => audioFile(new Blob([new Uint8Array(10 * 1024 * 1024 + 1)], { type: "audio/wav" }))).toThrow("too long");
  });

  it("releases iOS audio context when permission is denied", async () => {
    vi.mocked(Capacitor.getPlatform).mockReturnValue("ios");
    const error = new DOMException("Denied", "NotAllowedError");
    vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValueOnce(error);
    await expect(startVoiceRecording(vi.fn())).rejects.toBe(error);
    expect(close).toHaveBeenCalledTimes(1);
    expect(recordingError(error)).toContain("Microphone access was denied");
  });

  it("encodes the WAV header and mono PCM samples correctly", async () => {
    const blob = encodeWav([new Float32Array([-1, 0, 1])], 44100);
    const bytes = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => reader.result instanceof ArrayBuffer ? resolve(reader.result) : reject();
      reader.readAsArrayBuffer(blob);
    });
    const view = new DataView(bytes);
    expect(String.fromCharCode(...new Uint8Array(bytes, 0, 4))).toBe("RIFF");
    expect(view.getUint32(24, true)).toBe(44100);
    expect(view.getInt16(44, true)).toBe(-32768);
    expect(view.getInt16(48, true)).toBe(32767);
  });
});