import { Phrase } from '../types';
import { Mp3Encoder } from '@breezystack/lamejs';

export async function encodeToMp3(
  audioData: Float32Array,
  sampleRate: number,
  startSample: number,
  endSample: number
): Promise<Blob> {
  const encoder = new Mp3Encoder(1, sampleRate, 128);

  const segment = audioData.slice(startSample, endSample);

  // Convert Float32 to Int16
  const int16 = new Int16Array(segment.length);
  for (let i = 0; i < segment.length; i++) {
    const s = Math.max(-1, Math.min(1, segment[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }

  // Encode in chunks of 1152 samples
  const mp3Chunks: Uint8Array[] = [];
  for (let i = 0; i < int16.length; i += 1152) {
    const chunk = int16.subarray(i, Math.min(i + 1152, int16.length));
    const mp3buf = encoder.encodeBuffer(chunk);
    if (mp3buf.length > 0) mp3Chunks.push(mp3buf);
  }
  const mp3buf = encoder.flush();
  if (mp3buf.length > 0) mp3Chunks.push(mp3buf);

  return new Blob(mp3Chunks as BlobPart[], { type: 'audio/mp3' });
}

export function encodePhraseToMp3(audioData: Float32Array, sampleRate: number, phrase: Phrase): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./mp3Encoder.worker.ts', import.meta.url), {
      type: 'module',
    });

    const startSample = Math.floor(phrase.startTime * sampleRate);
    const endSample = Math.floor(phrase.endTime * sampleRate);

    worker.onmessage = e => {
      resolve(e.data.blob as Blob);
      worker.terminate();
    };
    worker.onerror = err => {
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
