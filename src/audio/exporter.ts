import { Phrase } from '../types';
import { encodePhraseToMp3 } from './mp3Encoder';

export async function exportPhrases(
  audioData: Float32Array,
  sampleRate: number,
  phrases: Phrase[],
  filePrefix: string,
  onProgress: (current: number, total: number) => void
): Promise<void> {
  // Build export groups: adjacent non-excluded phrases with same groupId
  const exportGroups: Phrase[][] = [];
  let currentGroup: Phrase[] = [];

  for (const phrase of phrases) {
    if (phrase.excluded) {
      if (currentGroup.length > 0) {
        exportGroups.push(currentGroup);
        currentGroup = [];
      }
      continue;
    }
    if (currentGroup.length > 0 && currentGroup[0].groupId === phrase.groupId) {
      currentGroup.push(phrase);
    } else {
      if (currentGroup.length > 0) exportGroups.push(currentGroup);
      currentGroup = [phrase];
    }
  }
  if (currentGroup.length > 0) exportGroups.push(currentGroup);

  const total = exportGroups.length;
  onProgress(0, total);

  for (let i = 0; i < exportGroups.length; i++) {
    const group = exportGroups[i];
    const mergedPhrase: Phrase = {
      ...group[0],
      id: group[0].id,
      startTime: Math.min(...group.map(p => p.startTime)),
      endTime: Math.max(...group.map(p => p.endTime)),
    };

    const blob = await encodePhraseToMp3(audioData, sampleRate, mergedPhrase);

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
