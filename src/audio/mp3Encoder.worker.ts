import { encodeToMp3 } from './mp3Encoder';

self.onmessage = async (e: MessageEvent) => {
  const { audioData, sampleRate, startSample, endSample } = e.data;

  try {
    const blob = await encodeToMp3(audioData, sampleRate, startSample, endSample);
    self.postMessage({ blob });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error) });
  }
};
