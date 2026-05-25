import { Phrase } from '../types';

export interface ExportItem {
  phrase: Phrase;
  startSample: number;
  endSample: number;
  fileName: string;
}

/** Compute export plan: filter excluded phrases, calculate sample boundaries, generate filenames. */
export function getExportItems(phrases: Phrase[], sampleRate: number, filePrefix: string): ExportItem[] {
  return phrases
    .filter(p => !p.excluded)
    .map((phrase, i) => ({
      phrase,
      startSample: Math.floor(phrase.startTime * sampleRate),
      endSample: Math.floor(phrase.endTime * sampleRate),
      fileName: `${filePrefix}_${String(i + 1).padStart(2, '0')}.mp3`,
    }));
}

export async function exportPhrases(
  audioData: Float32Array,
  sampleRate: number,
  phrases: Phrase[],
  filePrefix: string,
  onProgress: (current: number, total: number) => void
): Promise<void> {
  const items = getExportItems(phrases, sampleRate, filePrefix);
  const total = items.length;
  onProgress(0, total);

  for (let i = 0; i < items.length; i++) {
    const { startSample, endSample, fileName } = items[i];
    const blob = await encodeSegmentToMp3(audioData, sampleRate, startSample, endSample);

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();

    onProgress(i + 1, total);
    await new Promise(r => setTimeout(r, 200));
    URL.revokeObjectURL(url);
  }
}

function encodeSegmentToMp3(
  audioData: Float32Array,
  sampleRate: number,
  startSample: number,
  endSample: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./mp3Encoder.worker.ts', import.meta.url), {
      type: 'module',
    });

    const segment = audioData.slice(startSample, endSample);

    worker.onmessage = e => {
      if (e.data.error) {
        reject(new Error(e.data.error));
      } else {
        resolve(e.data.blob as Blob);
      }
      worker.terminate();
    };
    worker.onerror = err => {
      reject(err);
      worker.terminate();
    };

    worker.postMessage({ audioData: segment, sampleRate }, [segment.buffer]);
  });
}
