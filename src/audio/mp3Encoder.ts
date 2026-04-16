import { Phrase } from "../types";

export function encodePhraseToMp3(
  audioData: Float32Array,
  sampleRate: number,
  phrase: Phrase,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./mp3Encoder.worker.ts", import.meta.url), {
      type: "module",
    });

    const startSample = Math.floor(phrase.startTime * sampleRate);
    const endSample = Math.floor(phrase.endTime * sampleRate);

    worker.onmessage = (e) => {
      resolve(e.data.blob as Blob);
      worker.terminate();
    };
    worker.onerror = (err) => {
      reject(err);
      worker.terminate();
    };

    worker.postMessage({
      audioData,
      sampleRate,
      startSample,
      endSample,
    });
  });
}
