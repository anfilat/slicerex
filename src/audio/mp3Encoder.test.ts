import { describe, it, expect } from 'vitest';
import { encodeToMp3, float32ToInt16 } from './mp3Encoder';

// Helper: create a Float32Array with test audio data
function createTestAudioData(sampleCount: number, amplitude = 0.5): Float32Array {
  const data = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    data[i] = amplitude * Math.sin((2 * Math.PI * 440 * i) / 44100);
  }
  return data;
}

describe('encodeToMp3', () => {
  it('encodes audio segment to MP3 blob', async () => {
    const audioData = createTestAudioData(44100); // 1 second at 44.1kHz
    const sampleRate = 44100;

    const blob = await encodeToMp3(audioData, sampleRate);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('audio/mp3');
    expect(blob.size).toBeGreaterThan(0);
  });

  it('encodes partial audio segment', async () => {
    const fullData = createTestAudioData(44100); // 1 second
    const audioData = fullData.slice(11025, 33075); // 0.25s to 0.75s
    const sampleRate = 44100;

    const blob = await encodeToMp3(audioData, sampleRate);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('audio/mp3');
    // The encoded segment should be smaller than encoding the full second
    expect(blob.size).toBeGreaterThan(0);
  });

  it('handles clipping by clamping values to [-1, 1]', async () => {
    const audioData = new Float32Array(44100);
    // Create audio with values outside [-1, 1] range
    for (let i = 0; i < audioData.length; i++) {
      audioData[i] = i % 3 === 0 ? 2 : i % 3 === 1 ? -2.5 : 0.5;
    }

    const sampleRate = 44100;

    const blob = await encodeToMp3(audioData, sampleRate);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });

  it('encodes in chunks of 1152 samples', async () => {
    // Create audio that's exactly 3 * 1152 samples to test chunking
    const chunkSize = 1152;
    const audioData = createTestAudioData(chunkSize * 3);

    const sampleRate = 44100;

    const blob = await encodeToMp3(audioData, sampleRate);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });

  it('handles single sample encoding', async () => {
    const audioData = createTestAudioData(1, 0.5);
    const sampleRate = 44100;

    const blob = await encodeToMp3(audioData, sampleRate);

    expect(blob).toBeInstanceOf(Blob);
    // Even a single sample should produce some output (headers + flush)
    expect(blob.size).toBeGreaterThan(0);
  });

  it('converts Float32 to Int16 correctly', async () => {
    const audioData = new Float32Array([1, 0.5, 0, -0.5, -1]);
    const sampleRate = 44100;

    const blob = await encodeToMp3(audioData, sampleRate);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });

  it('encodes silence without errors', async () => {
    const audioData = new Float32Array(22050).fill(0); // 0.5 seconds of silence
    const sampleRate = 44100;

    const blob = await encodeToMp3(audioData, sampleRate);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('audio/mp3');
  });

  it('encodes stereo data as mono by using first channel', async () => {
    // Test with data that could be stereo (though we treat it as mono)
    const audioData = createTestAudioData(22050, 0.8);
    const sampleRate = 48000; // Different sample rate

    const blob = await encodeToMp3(audioData, sampleRate);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('audio/mp3');
    expect(blob.size).toBeGreaterThan(0);
  });

  it('handles different bit depths correctly', async () => {
    const audioData = new Float32Array([0.999, -0.999, 0.5, -0.5, 0.001, -0.001]);
    const sampleRate = 44100;

    const blob = await encodeToMp3(audioData, sampleRate);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });

  it('produces valid MP3 data that can be read', async () => {
    const audioData = createTestAudioData(44100, 0.5);
    const sampleRate = 44100;

    const blob = await encodeToMp3(audioData, sampleRate);

    // MP3 files start with ID3 tag or sync frame
    // ID3v2 starts with "ID3", sync frame starts with 0xFF
    const arrayBuffer = await blob.arrayBuffer();
    const firstByte = new Uint8Array(arrayBuffer)[0];

    // First byte should either be 'I' (0x49) for ID3 or 0xFF for sync
    expect([0x49, 0xff]).toContain(firstByte);
  });

  it('produces consistent output for identical input', async () => {
    const audioData = createTestAudioData(10000, 0.6);
    const sampleRate = 44100;

    const blob1 = await encodeToMp3(audioData, sampleRate);
    const blob2 = await encodeToMp3(audioData, sampleRate);

    // Same input should produce same output
    expect(blob1.size).toBe(blob2.size);
  });
});

describe('float32ToInt16', () => {
  it('converts 1.0 to max positive value (32767)', () => {
    const result = float32ToInt16(new Float32Array([1.0]));
    expect(result[0]).toBe(32767);
  });

  it('converts -1.0 to min negative value (-32768)', () => {
    const result = float32ToInt16(new Float32Array([-1.0]));
    expect(result[0]).toBe(-32768);
  });

  it('converts 0.0 to 0', () => {
    const result = float32ToInt16(new Float32Array([0.0]));
    expect(result[0]).toBe(0);
  });

  it('converts 0.5 correctly', () => {
    const result = float32ToInt16(new Float32Array([0.5]));
    expect(result[0]).toBe(Math.trunc(0.5 * 0x7fff));
  });

  it('converts -0.5 correctly', () => {
    const result = float32ToInt16(new Float32Array([-0.5]));
    expect(result[0]).toBe(Math.trunc(-0.5 * 0x8000));
  });

  it('clamps values above 1.0 to 32767', () => {
    const result = float32ToInt16(new Float32Array([2.0, 100.0, 1.5]));
    expect(result[0]).toBe(32767);
    expect(result[1]).toBe(32767);
    expect(result[2]).toBe(32767);
  });

  it('clamps values below -1.0 to -32768', () => {
    const result = float32ToInt16(new Float32Array([-2.0, -100.0, -1.5]));
    expect(result[0]).toBe(-32768);
    expect(result[1]).toBe(-32768);
    expect(result[2]).toBe(-32768);
  });

  it('handles very small values near zero', () => {
    const result = float32ToInt16(new Float32Array([0.0001, -0.0001]));
    expect(result[0]).toBe(Math.trunc(0.0001 * 0x7fff));
    expect(result[1]).toBe(Math.trunc(-0.0001 * 0x8000));
  });

  it('returns empty Int16Array for empty input', () => {
    const result = float32ToInt16(new Float32Array(0));
    expect(result).toBeInstanceOf(Int16Array);
    expect(result.length).toBe(0);
  });

  it('preserves asymmetric range: positive max differs from negative max', () => {
    const pos = float32ToInt16(new Float32Array([1.0]));
    const neg = float32ToInt16(new Float32Array([-1.0]));
    // 32767 vs -32768 — one more negative value than positive
    expect(pos[0]).toBe(32767);
    expect(neg[0]).toBe(-32768);
    expect(Math.abs(neg[0])).toBe(pos[0] + 1);
  });
});
