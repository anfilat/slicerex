import { detectPhrases } from './silenceDetection';

self.onmessage = (e: MessageEvent) => {
  const { audioData, sampleRate, config } = e.data;
  const phrases = detectPhrases(audioData, sampleRate, config);
  self.postMessage({ phrases });
};
