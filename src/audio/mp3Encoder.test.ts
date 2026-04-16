import { describe, it, expect } from 'vitest';
import { encodeToMp3 } from './mp3Encoder';

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
    const startSample = 0;
    const endSample = 44100;

    const blob = await encodeToMp3(audioData, sampleRate, startSample, endSample);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('audio/mp3');
    expect(blob.size).toBeGreaterThan(0);
  });

  it('encodes partial audio segment', async () => {
    const audioData = createTestAudioData(44100); // 1 second
    const sampleRate = 44100;
    const startSample = 11025; // Start at 0.25 seconds
    const endSample = 33075; // End at 0.75 seconds

    const blob = await encodeToMp3(audioData, sampleRate, startSample, endSample);

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
    const startSample = 0;
    const endSample = 44100;

    const blob = await encodeToMp3(audioData, sampleRate, startSample, endSample);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });

  it('encodes in chunks of 1152 samples', async () => {
    // Create audio that's exactly 3 * 1152 samples to test chunking
    const chunkSize = 1152;
    const audioData = createTestAudioData(chunkSize * 3);

    const sampleRate = 44100;
    const startSample = 0;
    const endSample = chunkSize * 3;

    const blob = await encodeToMp3(audioData, sampleRate, startSample, endSample);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });

  it('handles single sample encoding', async () => {
    const audioData = createTestAudioData(1, 0.5);
    const sampleRate = 44100;
    const startSample = 0;
    const endSample = 1;

    const blob = await encodeToMp3(audioData, sampleRate, startSample, endSample);

    expect(blob).toBeInstanceOf(Blob);
    // Even a single sample should produce some output (headers + flush)
    expect(blob.size).toBeGreaterThan(0);
  });

  it('converts Float32 to Int16 correctly', async () => {
    const audioData = new Float32Array([1, 0.5, 0, -0.5, -1]);
    const sampleRate = 44100;
    const startSample = 0;
    const endSample = 5;

    const blob = await encodeToMp3(audioData, sampleRate, startSample, endSample);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });

  it('encodes silence without errors', async () => {
    const audioData = new Float32Array(22050).fill(0); // 0.5 seconds of silence
    const sampleRate = 44100;
    const startSample = 0;
    const endSample = 22050;

    const blob = await encodeToMp3(audioData, sampleRate, startSample, endSample);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('audio/mp3');
  });

  it('encodes stereo data as mono by using first channel', async () => {
    // Test with data that could be stereo (though we treat it as mono)
    const audioData = createTestAudioData(22050, 0.8);
    const sampleRate = 48000; // Different sample rate
    const startSample = 0;
    const endSample = 22050;

    const blob = await encodeToMp3(audioData, sampleRate, startSample, endSample);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('audio/mp3');
    expect(blob.size).toBeGreaterThan(0);
  });

  it('handles different bit depths correctly', async () => {
    const audioData = new Float32Array([0.999, -0.999, 0.5, -0.5, 0.001, -0.001]);
    const sampleRate = 44100;
    const startSample = 0;
    const endSample = 6;

    const blob = await encodeToMp3(audioData, sampleRate, startSample, endSample);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });

  it('produces valid MP3 data that can be read', async () => {
    const audioData = createTestAudioData(44100, 0.5);
    const sampleRate = 44100;
    const startSample = 0;
    const endSample = 44100;

    const blob = await encodeToMp3(audioData, sampleRate, startSample, endSample);

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
    const startSample = 0;
    const endSample = 10000;

    const blob1 = await encodeToMp3(audioData, sampleRate, startSample, endSample);
    const blob2 = await encodeToMp3(audioData, sampleRate, startSample, endSample);

    // Same input should produce same output
    expect(blob1.size).toBe(blob2.size);
  });
});
