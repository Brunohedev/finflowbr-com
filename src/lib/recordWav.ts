// Complete PCM/WAV clips avoid fragmented MP4 recording issues in iOS WebKit.
export function encodeWav(chunks: readonly Float32Array[], sampleRate: number): Blob {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const bytes = new ArrayBuffer(44 + length * 2);
  const view = new DataView(bytes);
  const tag = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  tag(0, "RIFF");
  view.setUint32(4, 36 + length * 2, true);
  tag(8, "WAVE");
  tag(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  tag(36, "data");
  view.setUint32(40, length * 2, true);
  let offset = 44;
  for (const chunk of chunks) {
    for (const value of chunk) {
      const sample = Math.max(-1, Math.min(1, value));
      view.setInt16(offset, sample * (sample < 0 ? 32768 : 32767), true);
      offset += 2;
    }
  }
  return new Blob([bytes], { type: "audio/wav" });
}

export async function recordWav(): Promise<{ stop: () => Promise<Blob> }> {
  // Start the audio context during the tap gesture, before awaiting permission.
  const context = new AudioContext();
  const resumed = context.resume();
  let stream: MediaStream | undefined;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    await resumed;
    const source = context.createMediaStreamSource(stream);
    // Supported by WKWebView, including versions without MediaRecorder.
    const node = context.createScriptProcessor(4096, 1, 1);
    const chunks: Float32Array[] = [];
    let size = 44;
    node.onaudioprocess = (event) => {
      const samples = event.inputBuffer.getChannelData(0);
      if (size + samples.length * 2 <= 10 * 1024 * 1024) {
        chunks.push(new Float32Array(samples));
        size += samples.length * 2;
      }
      event.outputBuffer.getChannelData(0).fill(0);
    };
    source.connect(node);
    node.connect(context.destination);
    const activeStream = stream;
    let stopped = false;
    return {
      async stop() {
        if (stopped) throw new Error("Recording already stopped.");
        stopped = true;
        activeStream.getTracks().forEach((track) => track.stop());
        node.disconnect();
        source.disconnect();
        node.onaudioprocess = null;
        const blob = encodeWav(chunks, context.sampleRate);
        await context.close();
        if (blob.size < 2048) throw new Error("We couldn't hear anything. Please record again.");
        return blob;
      },
    };
  } catch (error) {
    stream?.getTracks().forEach((track) => track.stop());
    await context.close();
    // Observe a rejected resume promise even if the permission request failed first.
    await resumed.catch(() => undefined);
    throw error;
  }
}