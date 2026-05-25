import { describe, it, expect } from 'vitest';
import { getExportItems } from './exporter';
import { Phrase } from '../types';

function phrase(overrides: Partial<Phrase> & { id: number }): Phrase {
  return { startTime: 0, endTime: 1, excluded: false, ...overrides };
}

describe('getExportItems', () => {
  const sampleRate = 44100;

  it('filters out excluded phrases', () => {
    const phrases = [
      phrase({ id: 0, startTime: 0, endTime: 1, excluded: true }),
      phrase({ id: 1, startTime: 1, endTime: 2, excluded: false }),
      phrase({ id: 2, startTime: 2, endTime: 3, excluded: true }),
    ];

    const items = getExportItems(phrases, sampleRate, 'test');

    expect(items).toHaveLength(1);
    expect(items[0].phrase.id).toBe(1);
  });

  it('generates zero-padded sequential filenames', () => {
    const phrases = [
      phrase({ id: 0, startTime: 0, endTime: 1 }),
      phrase({ id: 1, startTime: 1, endTime: 2 }),
      phrase({ id: 2, startTime: 2, endTime: 3 }),
    ];

    const items = getExportItems(phrases, sampleRate, 'recording');

    expect(items[0].fileName).toBe('recording_01.mp3');
    expect(items[1].fileName).toBe('recording_02.mp3');
    expect(items[2].fileName).toBe('recording_03.mp3');
  });

  it('calculates correct sample boundaries', () => {
    const phrases = [phrase({ id: 0, startTime: 1.5, endTime: 3.0 })];

    const items = getExportItems(phrases, sampleRate, 'test');

    expect(items[0].startSample).toBe(Math.floor(1.5 * sampleRate));
    expect(items[0].endSample).toBe(Math.floor(3.0 * sampleRate));
  });

  it('returns empty array when all phrases are excluded', () => {
    const phrases = [phrase({ id: 0, excluded: true }), phrase({ id: 1, excluded: true })];

    expect(getExportItems(phrases, sampleRate, 'test')).toHaveLength(0);
  });

  it('returns empty array for empty input', () => {
    expect(getExportItems([], sampleRate, 'test')).toHaveLength(0);
  });

  it('numbers files sequentially among non-excluded phrases only', () => {
    const phrases = [
      phrase({ id: 0, excluded: true }),
      phrase({ id: 1, excluded: false }),
      phrase({ id: 2, excluded: true }),
      phrase({ id: 3, excluded: false }),
    ];

    const items = getExportItems(phrases, sampleRate, 'audio');

    expect(items).toHaveLength(2);
    expect(items[0].fileName).toBe('audio_01.mp3');
    expect(items[1].fileName).toBe('audio_02.mp3');
  });

  it('uses provided file prefix', () => {
    const phrases = [phrase({ id: 0 })];

    const items = getExportItems(phrases, sampleRate, 'my_song');

    expect(items[0].fileName).toBe('my_song_01.mp3');
  });

  it('handles fractional sample boundaries with floor', () => {
    const phrases = [phrase({ id: 0, startTime: 0.001, endTime: 0.002 })];

    const items = getExportItems(phrases, 44100, 'test');

    // 0.001 * 44100 = 44.1 → floor = 44
    // 0.002 * 44100 = 88.2 → floor = 88
    expect(items[0].startSample).toBe(44);
    expect(items[0].endSample).toBe(88);
  });
});
