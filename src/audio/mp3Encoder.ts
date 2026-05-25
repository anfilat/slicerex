import { Mp3Encoder } from '@breezystack/lamejs';

/** Convert Float32 samples to Int16 using asymmetric scaling (standard PCM convention). */
export function float32ToInt16(data: Float32Array): Int16Array {
  const int16 = new Int16Array(data.length);
  for (let i = 0; i < data.length; i++) {
    const s = Math.max(-1, Math.min(1, data[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16;
}

export async function encodeToMp3(audioData: Float32Array, sampleRate: number): Promise<Blob> {
  const encoder = new Mp3Encoder(1, sampleRate, 128);

  const int16 = float32ToInt16(audioData);

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
