import { describe, it, expect } from 'vitest';
import { mergePhrase, splitPhrase, toggleExclude } from './phraseMutations';
import { Phrase } from '../types';

function phrase(overrides: Partial<Phrase> & { id: number }): Phrase {
  return { startTime: 0, endTime: 1, excluded: false, ...overrides };
}

describe('mergePhrase', () => {
  it('merges two adjacent phrases', () => {
    const phrases = [phrase({ id: 0, startTime: 0, endTime: 1 }), phrase({ id: 1, startTime: 1, endTime: 2 })];

    const result = mergePhrase(phrases, 0);

    expect(result).not.toBeNull();
    expect(result!.phrases).toHaveLength(1);
    expect(result!.phrases[0].startTime).toBe(0);
    expect(result!.phrases[0].endTime).toBe(2);
  });

  it('returns null for last phrase in list', () => {
    const phrases = [phrase({ id: 0 }), phrase({ id: 1 })];

    expect(mergePhrase(phrases, 1)).toBeNull();
  });

  it('returns null for non-existent id', () => {
    const phrases = [phrase({ id: 0 })];

    expect(mergePhrase(phrases, 99)).toBeNull();
  });

  it('returns null for empty array', () => {
    expect(mergePhrase([], 0)).toBeNull();
  });

  it('sets excluded=true only when both phrases are excluded', () => {
    const bothExcluded = [phrase({ id: 0, excluded: true }), phrase({ id: 1, excluded: true })];
    expect(mergePhrase(bothExcluded, 0)!.phrases[0].excluded).toBe(true);

    const oneExcluded = [phrase({ id: 0, excluded: true }), phrase({ id: 1, excluded: false })];
    expect(mergePhrase(oneExcluded, 0)!.phrases[0].excluded).toBe(false);

    const noneExcluded = [phrase({ id: 0, excluded: false }), phrase({ id: 1, excluded: false })];
    expect(mergePhrase(noneExcluded, 0)!.phrases[0].excluded).toBe(false);
  });

  it('generates a new unique ID greater than all existing IDs', () => {
    const phrases = [phrase({ id: 5 }), phrase({ id: 10 }), phrase({ id: 3 })];

    const result = mergePhrase(phrases, 10);
    expect(result).not.toBeNull();
    expect(result!.mergedId).toBe(11);
  });

  it('preserves phrases before and after the merged pair', () => {
    const phrases = [
      phrase({ id: 0, startTime: 0, endTime: 1 }),
      phrase({ id: 1, startTime: 1, endTime: 2 }),
      phrase({ id: 2, startTime: 2, endTime: 3 }),
      phrase({ id: 3, startTime: 3, endTime: 4 }),
    ];

    const result = mergePhrase(phrases, 1);
    expect(result!.phrases).toHaveLength(3);
    expect(result!.phrases[0].id).toBe(0);
    expect(result!.phrases[1].startTime).toBe(1);
    expect(result!.phrases[1].endTime).toBe(3);
    expect(result!.phrases[2].id).toBe(3);
  });

  it('returns mergedFromIds with both original IDs', () => {
    const phrases = [phrase({ id: 7 }), phrase({ id: 12 })];

    const result = mergePhrase(phrases, 7);
    expect(result!.mergedFromIds).toEqual([7, 12]);
  });

  it('does not mutate the original array', () => {
    const phrases = [phrase({ id: 0 }), phrase({ id: 1 })];
    const original = [...phrases];

    mergePhrase(phrases, 0);
    expect(phrases).toEqual(original);
  });
});

describe('splitPhrase', () => {
  it('splits a phrase at its midpoint', () => {
    const phrases = [phrase({ id: 0, startTime: 2, endTime: 4 })];

    const result = splitPhrase(phrases, 0);

    expect(result).not.toBeNull();
    expect(result!.phrases).toHaveLength(2);
    expect(result!.phrases[0].startTime).toBe(2);
    expect(result!.phrases[0].endTime).toBeCloseTo(3, 10);
    expect(result!.phrases[1].startTime).toBeCloseTo(3, 10);
    expect(result!.phrases[1].endTime).toBe(4);
  });

  it('returns null for non-existent id', () => {
    const phrases = [phrase({ id: 0 })];

    expect(splitPhrase(phrases, 99)).toBeNull();
  });

  it('returns null for empty array', () => {
    expect(splitPhrase([], 0)).toBeNull();
  });

  it('generates sequential IDs greater than all existing IDs', () => {
    const phrases = [phrase({ id: 0 }), phrase({ id: 5, startTime: 1, endTime: 3 }), phrase({ id: 10 })];

    const result = splitPhrase(phrases, 5);
    expect(result!.firstHalfId).toBe(11);
    expect(result!.secondHalfId).toBe(12);
  });

  it('inherits excluded from the original phrase', () => {
    const excluded = [phrase({ id: 0, excluded: true, startTime: 0, endTime: 2 })];
    const result = splitPhrase(excluded, 0);
    expect(result!.phrases[0].excluded).toBe(true);
    expect(result!.phrases[1].excluded).toBe(true);

    const notExcluded = [phrase({ id: 0, excluded: false, startTime: 0, endTime: 2 })];
    const result2 = splitPhrase(notExcluded, 0);
    expect(result2!.phrases[0].excluded).toBe(false);
    expect(result2!.phrases[1].excluded).toBe(false);
  });

  it('preserves other phrases in the array', () => {
    const phrases = [
      phrase({ id: 0, startTime: 0, endTime: 1 }),
      phrase({ id: 1, startTime: 1, endTime: 3 }),
      phrase({ id: 2, startTime: 3, endTime: 5 }),
    ];

    const result = splitPhrase(phrases, 1);
    expect(result!.phrases).toHaveLength(4);
    expect(result!.phrases[0].id).toBe(0);
    expect(result!.phrases[3].id).toBe(2);
  });

  it('returns originalId of the split phrase', () => {
    const phrases = [phrase({ id: 7, startTime: 0, endTime: 2 })];

    const result = splitPhrase(phrases, 7);
    expect(result!.originalId).toBe(7);
  });

  it('first half is contiguous with second half at midpoint', () => {
    const phrases = [phrase({ id: 0, startTime: 1.5, endTime: 3.5 })];

    const result = splitPhrase(phrases, 0);
    expect(result!.phrases[0].endTime).toBeCloseTo(result!.phrases[1].startTime, 10);
  });

  it('does not mutate the original array', () => {
    const phrases = [phrase({ id: 0, startTime: 0, endTime: 2 })];
    const original = [...phrases];

    splitPhrase(phrases, 0);
    expect(phrases).toEqual(original);
  });
});

describe('toggleExclude', () => {
  it('toggles excluded from false to true', () => {
    const phrases = [phrase({ id: 0, excluded: false }), phrase({ id: 1, excluded: false })];

    const result = toggleExclude(phrases, 0);
    expect(result[0].excluded).toBe(true);
    expect(result[1].excluded).toBe(false);
  });

  it('toggles excluded from true to false', () => {
    const phrases = [phrase({ id: 0, excluded: true })];

    const result = toggleExclude(phrases, 0);
    expect(result[0].excluded).toBe(false);
  });

  it('returns same array structure for non-existent id', () => {
    const phrases = [phrase({ id: 0, excluded: false }), phrase({ id: 1, excluded: true })];

    const result = toggleExclude(phrases, 99);
    expect(result).toEqual(phrases);
  });

  it('does not mutate the original array', () => {
    const phrases = [phrase({ id: 0, excluded: false })];
    const original = [...phrases];

    toggleExclude(phrases, 0);
    expect(phrases).toEqual(original);
  });

  it('preserves all other phrase fields', () => {
    const phrases = [phrase({ id: 0, startTime: 1.2, endTime: 3.4, excluded: false })];

    const result = toggleExclude(phrases, 0);
    expect(result[0].id).toBe(0);
    expect(result[0].startTime).toBe(1.2);
    expect(result[0].endTime).toBe(3.4);
    expect(result[0].excluded).toBe(true);
  });
});
