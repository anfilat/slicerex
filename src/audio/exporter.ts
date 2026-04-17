import { Phrase } from '../types';
import { encodePhraseToMp3 } from './mp3Encoder';

export async function exportPhrases(
  audioData: Float32Array,
  sampleRate: number,
  phrases: Phrase[],
  filePrefix: string,
  onProgress: (current: number, total: number) => void
): Promise<void> {
  // Export each non-excluded phrase individually
  const phrasesToExport = phrases.filter(p => !p.excluded);
  const total = phrasesToExport.length;
  onProgress(0, total);

  for (let i = 0; i < phrasesToExport.length; i++) {
    const phrase = phrasesToExport[i];
    const blob = await encodePhraseToMp3(audioData, sampleRate, phrase);

    const num = String(i + 1).padStart(2, '0');
    const fileName = `${filePrefix}_${num}.mp3`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);

    onProgress(i + 1, total);
    await new Promise(r => setTimeout(r, 200));
  }
}
