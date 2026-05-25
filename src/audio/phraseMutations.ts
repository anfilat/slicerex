import { Phrase } from '../types';

/**
 * Merge a phrase with the next adjacent phrase.
 * Returns null if the phrase is not found or is the last one.
 */
export function mergePhrase(
  phrases: Phrase[],
  id: number
): { phrases: Phrase[]; mergedId: number; mergedFromIds: [number, number] } | null {
  const idx = phrases.findIndex(p => p.id === id);
  if (idx === -1 || idx === phrases.length - 1) return null;

  const current = phrases[idx];
  const next = phrases[idx + 1];

  const merged: Phrase = {
    id: Math.max(...phrases.map(p => p.id)) + 1,
    startTime: current.startTime,
    endTime: next.endTime,
    excluded: current.excluded && next.excluded,
  };

  const newPhrases = [...phrases];
  newPhrases.splice(idx, 2, merged);
  return { phrases: newPhrases, mergedId: merged.id, mergedFromIds: [current.id, next.id] };
}

/**
 * Split a phrase at its midpoint into two phrases.
 * Returns null if the phrase is not found.
 */
export function splitPhrase(
  phrases: Phrase[],
  id: number
): { phrases: Phrase[]; firstHalfId: number; secondHalfId: number; originalId: number } | null {
  const idx = phrases.findIndex(p => p.id === id);
  if (idx === -1) return null;

  const phrase = phrases[idx];
  const midPoint = (phrase.startTime + phrase.endTime) / 2;

  const maxId = Math.max(...phrases.map(p => p.id));
  const first: Phrase = { ...phrase, id: maxId + 1, endTime: midPoint };
  const second: Phrase = { ...phrase, id: maxId + 2, startTime: midPoint };

  const newPhrases = [...phrases];
  newPhrases.splice(idx, 1, first, second);
  return { phrases: newPhrases, firstHalfId: first.id, secondHalfId: second.id, originalId: id };
}

/**
 * Toggle the excluded flag on a phrase.
 */
export function toggleExclude(phrases: Phrase[], id: number): Phrase[] {
  return phrases.map(p => (p.id === id ? { ...p, excluded: !p.excluded } : p));
}
