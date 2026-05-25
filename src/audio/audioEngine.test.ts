import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AudioEngine } from './audioEngine';

// ---------------------------------------------------------------------------
// Helpers – lightweight Web Audio API mocks
// ---------------------------------------------------------------------------

/** Create a fake AudioBuffer with the given number of channels and sample data. */
function createMockAudioBuffer(channels: Float32Array[], sampleRate = 44100): AudioBuffer {
  const length = channels[0].length;
  return {
    numberOfChannels: channels.length,
    length,
    duration: length / sampleRate,
    sampleRate,
    getChannelData: (ch: number) => channels[ch],
    // Unused but required by the AudioBuffer interface
    copyFromChannel: vi.fn(),
    copyToChannel: vi.fn(),
    getFloatFrequencyData: vi.fn(),
    getByteFrequencyData: vi.fn(),
  } as unknown as AudioBuffer;
}

/** Create a fake AudioContext that returns the given buffer from decodeAudioData. */
function createMockAudioContext(buffer: AudioBuffer) {
  return {
    decodeAudioData: vi.fn().mockResolvedValue(buffer),
    createBufferSource: vi.fn().mockReturnValue({
      buffer: null,
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      onended: null as (() => void) | null,
    }),
    destination: {},
    close: vi.fn(),
  };
}

/** Create a fake File that resolves arrayBuffer() to the given data. */
function createMockFile(name: string, data = new ArrayBuffer(0)): File {
  return {
    name,
    arrayBuffer: vi.fn().mockResolvedValue(data),
  } as unknown as File;
}

// ---------------------------------------------------------------------------
// Mock the global AudioContext constructor
// ---------------------------------------------------------------------------

type MockAudioContext = ReturnType<typeof createMockAudioContext>;

let mockCtx: MockAudioContext;
let mockBuffer: AudioBuffer;
let audioContextCallCount: number;

const OriginalAudioContext = globalThis.AudioContext;

beforeEach(() => {
  // Each test gets a fresh mock
  mockBuffer = createMockAudioBuffer([new Float32Array(100).fill(0.5)]);
  mockCtx = createMockAudioContext(mockBuffer);
  audioContextCallCount = 0;
  // Must use a real class for `new AudioContext()` to work in Vitest
  const ctx = mockCtx;
  globalThis.AudioContext = class {
    constructor() {
      audioContextCallCount++;
      Object.assign(this, ctx);
    }
  } as unknown as typeof AudioContext;
});

// Restore after all tests in this file
import { afterEach } from 'vitest';
afterEach(() => {
  globalThis.AudioContext = OriginalAudioContext;
});

// ===========================================================================
// Tests
// ===========================================================================

describe('AudioEngine', () => {
  // -------------------------------------------------------------------------
  // Getters — default state
  // -------------------------------------------------------------------------
  describe('default state', () => {
    it('returns empty fileName initially', () => {
      const engine = new AudioEngine();
      expect(engine.fileName).toBe('');
    });

    it('returns null buffer initially', () => {
      const engine = new AudioEngine();
      expect(engine.buffer).toBeNull();
    });

    it('returns 0 duration initially', () => {
      const engine = new AudioEngine();
      expect(engine.duration).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // loadFile
  // -------------------------------------------------------------------------
  describe('loadFile', () => {
    it('strips file extension from name', async () => {
      const engine = new AudioEngine();
      await engine.loadFile(createMockFile('recording.mp3'));
      expect(engine.fileName).toBe('recording');
    });

    it('strips only the last extension from multi-dot names', async () => {
      const engine = new AudioEngine();
      await engine.loadFile(createMockFile('my.recording.mp3'));
      expect(engine.fileName).toBe('my.recording');
    });

    it('handles files with no extension', async () => {
      const engine = new AudioEngine();
      await engine.loadFile(createMockFile('audiofile'));
      expect(engine.fileName).toBe('audiofile');
    });

    it('sets buffer and duration after successful load', async () => {
      const engine = new AudioEngine();
      await engine.loadFile(createMockFile('test.wav'));
      expect(engine.buffer).toBe(mockBuffer);
      expect(engine.duration).toBe(mockBuffer.duration);
    });

    it('clears previous buffer when loading a new file', async () => {
      const engine = new AudioEngine();

      // First load
      await engine.loadFile(createMockFile('first.mp3'));
      const firstBuffer = engine.buffer;

      // Second load with a different buffer
      const secondBuffer = createMockAudioBuffer([new Float32Array(200).fill(0)]);
      mockCtx.decodeAudioData.mockResolvedValue(secondBuffer);

      await engine.loadFile(createMockFile('second.mp3'));
      expect(engine.buffer).not.toBe(firstBuffer);
      expect(engine.buffer).toBe(secondBuffer);
    });

    it('creates AudioContext on first load', async () => {
      const engine = new AudioEngine();
      await engine.loadFile(createMockFile('test.mp3'));
      expect(audioContextCallCount).toBe(1);
    });

    it('reuses AudioContext on subsequent loads', async () => {
      const engine = new AudioEngine();
      await engine.loadFile(createMockFile('a.mp3'));
      await engine.loadFile(createMockFile('b.mp3'));
      expect(audioContextCallCount).toBe(1);
    });

    it('propagates decode errors', async () => {
      const engine = new AudioEngine();
      mockCtx.decodeAudioData.mockRejectedValue(new Error('bad format'));

      await expect(engine.loadFile(createMockFile('bad.mp3'))).rejects.toThrow('bad format');
    });
  });

  // -------------------------------------------------------------------------
  // getChannelData — mono pass-through
  // -------------------------------------------------------------------------
  describe('getChannelData — mono', () => {
    it('returns channel data directly for mono audio', async () => {
      const channelData = new Float32Array([0.1, 0.2, 0.3]);
      mockBuffer = createMockAudioBuffer([channelData]);
      mockCtx.decodeAudioData.mockResolvedValue(mockBuffer);

      const engine = new AudioEngine();
      await engine.loadFile(createMockFile('mono.wav'));

      const result = engine.getChannelData();
      expect(result).toBe(channelData); // same reference — no copy
    });
  });

  // -------------------------------------------------------------------------
  // getChannelData — stereo downmix
  // -------------------------------------------------------------------------
  describe('getChannelData — stereo', () => {
    it('averages two channels correctly', async () => {
      const ch0 = new Float32Array([1.0, 0.5, -1.0, 0.0]);
      const ch1 = new Float32Array([0.2, -0.3, 1.0, 0.8]);
      mockBuffer = createMockAudioBuffer([ch0, ch1]);
      mockCtx.decodeAudioData.mockResolvedValue(mockBuffer);

      const engine = new AudioEngine();
      await engine.loadFile(createMockFile('stereo.wav'));

      const mono = engine.getChannelData();
      expect(mono).toHaveLength(4);
      expect(mono[0]).toBeCloseTo((1.0 + 0.2) / 2);
      expect(mono[1]).toBeCloseTo((0.5 + -0.3) / 2);
      expect(mono[2]).toBeCloseTo((-1.0 + 1.0) / 2);
      expect(mono[3]).toBeCloseTo((0.0 + 0.8) / 2);
    });

    it('returns the same cached array on second call', async () => {
      const ch0 = new Float32Array([0.5, 0.5]);
      const ch1 = new Float32Array([0.5, 0.5]);
      mockBuffer = createMockAudioBuffer([ch0, ch1]);
      mockCtx.decodeAudioData.mockResolvedValue(mockBuffer);

      const engine = new AudioEngine();
      await engine.loadFile(createMockFile('stereo.wav'));

      const first = engine.getChannelData();
      const second = engine.getChannelData();
      expect(first).toBe(second); // same reference — cached
    });

    it('invalidates cache when a new file is loaded', async () => {
      const ch0 = new Float32Array([1.0]);
      const ch1 = new Float32Array([0.0]);
      mockBuffer = createMockAudioBuffer([ch0, ch1]);
      mockCtx.decodeAudioData.mockResolvedValue(mockBuffer);

      const engine = new AudioEngine();
      await engine.loadFile(createMockFile('first.wav'));
      const firstMono = engine.getChannelData();

      // Load new file with different data
      const ch0b = new Float32Array([0.0]);
      const ch1b = new Float32Array([1.0]);
      const newBuffer = createMockAudioBuffer([ch0b, ch1b]);
      mockCtx.decodeAudioData.mockResolvedValue(newBuffer);
      await engine.loadFile(createMockFile('second.wav'));
      const secondMono = engine.getChannelData();

      expect(firstMono).not.toBe(secondMono);
      expect(secondMono[0]).toBeCloseTo(0.5); // (0+1)/2
    });

    it('handles zero-length stereo audio', async () => {
      const ch0 = new Float32Array(0);
      const ch1 = new Float32Array(0);
      mockBuffer = createMockAudioBuffer([ch0, ch1]);
      mockCtx.decodeAudioData.mockResolvedValue(mockBuffer);

      const engine = new AudioEngine();
      await engine.loadFile(createMockFile('empty.wav'));

      const mono = engine.getChannelData();
      expect(mono).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // getChannelData — throws when no audio
  // -------------------------------------------------------------------------
  describe('getChannelData — no audio', () => {
    it('throws when no file has been loaded', () => {
      const engine = new AudioEngine();
      expect(() => engine.getChannelData()).toThrow('No audio loaded');
    });

    it('throws after destroy', async () => {
      const engine = new AudioEngine();
      await engine.loadFile(createMockFile('test.mp3'));
      engine.destroy();
      expect(() => engine.getChannelData()).toThrow('No audio loaded');
    });
  });

  // -------------------------------------------------------------------------
  // playSegment / stop
  // -------------------------------------------------------------------------
  describe('playSegment', () => {
    it('resolves immediately when no audio is loaded', async () => {
      const engine = new AudioEngine();
      await expect(engine.playSegment(0, 1)).resolves.toBeUndefined();
    });

    it('creates and starts a source node', async () => {
      const engine = new AudioEngine();
      await engine.loadFile(createMockFile('test.mp3'));

      await engine.playSegment(0.5, 1.5);

      expect(mockCtx.createBufferSource).toHaveBeenCalled();
      const sourceNode = (mockCtx.createBufferSource as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(sourceNode.start).toHaveBeenCalledWith(0, 0.5, 1.0);
      expect(sourceNode.connect).toHaveBeenCalledWith(mockCtx.destination);
    });

    it('resolves when onended fires', async () => {
      const engine = new AudioEngine();
      await engine.loadFile(createMockFile('test.mp3'));

      const promise = engine.playSegment(0, 1);

      // Simulate the browser firing onended
      const sourceNode = (mockCtx.createBufferSource as ReturnType<typeof vi.fn>).mock.results[0].value;
      sourceNode.onended!();

      await expect(promise).resolves.toBeUndefined();
    });

    it('does not resolve from stale onended after stop()', async () => {
      const engine = new AudioEngine();
      await engine.loadFile(createMockFile('test.mp3'));

      let resolved = false;
      const promise = engine.playSegment(0, 1);
      promise.then(() => {
        resolved = true;
      });

      // Stop increments playbackId, making the current session stale
      engine.stop();

      // Fire the old onended — should be ignored
      const sourceNode = (mockCtx.createBufferSource as ReturnType<typeof vi.fn>).mock.results[0].value;
      sourceNode.onended!();

      // Give microtask queue a tick
      await new Promise(r => setTimeout(r, 0));
      expect(resolved).toBe(false);
    });

    it('new playSegment supersedes previous one', async () => {
      const engine = new AudioEngine();
      await engine.loadFile(createMockFile('test.mp3'));

      const first = engine.playSegment(0, 1);
      const second = engine.playSegment(1, 2);

      // Fire onended for the first source — should not resolve first promise
      const sourceNodes = (mockCtx.createBufferSource as ReturnType<typeof vi.fn>).mock.results;
      sourceNodes[0].value.onended!();

      // First promise should NOT resolve (stale playbackId)
      let firstResolved = false;
      first.then(() => {
        firstResolved = true;
      });

      // Fire onended for the second source — should resolve second promise
      sourceNodes[1].value.onended!();

      await expect(second).resolves.toBeUndefined();
      await new Promise(r => setTimeout(r, 0));
      expect(firstResolved).toBe(false);
    });
  });

  describe('stop', () => {
    it('does not throw when nothing is playing', () => {
      const engine = new AudioEngine();
      expect(() => engine.stop()).not.toThrow();
    });

    it('stops the current source node', async () => {
      const engine = new AudioEngine();
      await engine.loadFile(createMockFile('test.mp3'));

      engine.playSegment(0, 1);
      const sourceNode = (mockCtx.createBufferSource as ReturnType<typeof vi.fn>).mock.results[0].value;

      engine.stop();
      expect(sourceNode.stop).toHaveBeenCalled();
    });

    it('tolerates double stop', async () => {
      const engine = new AudioEngine();
      await engine.loadFile(createMockFile('test.mp3'));

      engine.playSegment(0, 1);
      // Mock stop to throw on second call (simulating already-stopped node)
      const sourceNode = (mockCtx.createBufferSource as ReturnType<typeof vi.fn>).mock.results[0].value;
      sourceNode.stop = vi.fn().mockImplementation(() => {
        throw new DOMException('', 'InvalidStateError');
      });

      expect(() => engine.stop()).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // destroy
  // -------------------------------------------------------------------------
  describe('destroy', () => {
    it('closes the AudioContext', async () => {
      const engine = new AudioEngine();
      await engine.loadFile(createMockFile('test.mp3'));

      engine.destroy();
      expect(mockCtx.close).toHaveBeenCalled();
    });

    it('clears buffer so getChannelData throws', async () => {
      const engine = new AudioEngine();
      await engine.loadFile(createMockFile('test.mp3'));

      engine.destroy();
      expect(engine.buffer).toBeNull();
      expect(() => engine.getChannelData()).toThrow('No audio loaded');
    });

    it('allows reuse after destroy (new AudioContext)', async () => {
      const engine = new AudioEngine();
      await engine.loadFile(createMockFile('first.mp3'));
      engine.destroy();

      // Should work again — creates a new AudioContext
      await engine.loadFile(createMockFile('second.mp3'));
      expect(engine.buffer).toBe(mockBuffer);
      expect(engine.fileName).toBe('second');
    });
  });
});
