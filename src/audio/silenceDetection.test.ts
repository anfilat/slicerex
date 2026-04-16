import { describe, it, expect } from 'vitest'
import { detectPhrases } from './silenceDetection'

// Helper: create a Float32Array representing audio with silence gaps
function createTestAudio(
  sampleRate: number,
  segments: { durationMs: number; amplitude: number }[]
): Float32Array {
  const totalSamples = segments.reduce(
    (sum, s) => sum + Math.floor((s.durationMs / 1000) * sampleRate), 0
  )
  const data = new Float32Array(totalSamples)
  let offset = 0
  for (const seg of segments) {
    const samples = Math.floor((seg.durationMs / 1000) * sampleRate)
    for (let i = 0; i < samples; i++) {
      data[offset + i] = seg.amplitude * Math.sin((2 * Math.PI * 440 * i) / sampleRate)
    }
    offset += samples
  }
  return data
}

describe('detectPhrases', () => {
  const sampleRate = 44100

  it('detects a single phrase with silence on both sides', () => {
    const audio = createTestAudio(sampleRate, [
      { durationMs: 500, amplitude: 0 },
      { durationMs: 1000, amplitude: 0.5 },
      { durationMs: 500, amplitude: 0 },
    ])
    const phrases = detectPhrases(audio, sampleRate, {
      silenceThresholdDb: -40, minSilenceDuration: 300, minPhraseDuration: 200, padding: 0,
    })
    expect(phrases).toHaveLength(1)
    expect(phrases[0].startTime).toBeCloseTo(0.5, 1)
    expect(phrases[0].endTime).toBeCloseTo(1.5, 1)
  })

  it('detects two phrases separated by silence', () => {
    const audio = createTestAudio(sampleRate, [
      { durationMs: 500, amplitude: 0.5 },
      { durationMs: 400, amplitude: 0 },
      { durationMs: 500, amplitude: 0.5 },
      { durationMs: 400, amplitude: 0 },
    ])
    const phrases = detectPhrases(audio, sampleRate, {
      silenceThresholdDb: -40, minSilenceDuration: 300, minPhraseDuration: 200, padding: 0,
    })
    expect(phrases).toHaveLength(2)
  })

  it('ignores short silences within speech', () => {
    const audio = createTestAudio(sampleRate, [
      { durationMs: 300, amplitude: 0.5 },
      { durationMs: 100, amplitude: 0 },
      { durationMs: 300, amplitude: 0.5 },
      { durationMs: 500, amplitude: 0 },
      { durationMs: 300, amplitude: 0.5 },
    ])
    const phrases = detectPhrases(audio, sampleRate, {
      silenceThresholdDb: -40, minSilenceDuration: 300, minPhraseDuration: 200, padding: 0,
    })
    expect(phrases).toHaveLength(2)
  })

  it('assigns unique sequential IDs and groupIds', () => {
    const audio = createTestAudio(sampleRate, [
      { durationMs: 300, amplitude: 0.5 },
      { durationMs: 400, amplitude: 0 },
      { durationMs: 300, amplitude: 0.5 },
    ])
    const phrases = detectPhrases(audio, sampleRate, {
      silenceThresholdDb: -40, minSilenceDuration: 300, minPhraseDuration: 200, padding: 0,
    })
    expect(phrases.map(p => p.id)).toEqual([0, 1])
    expect(phrases.map(p => p.groupId)).toEqual([0, 1])
    expect(phrases.every(p => p.excluded === false)).toBe(true)
  })

  it('applies padding to phrase boundaries', () => {
    const audio = createTestAudio(sampleRate, [
      { durationMs: 500, amplitude: 0 },
      { durationMs: 500, amplitude: 0.5 },
      { durationMs: 500, amplitude: 0 },
    ])
    const phrases = detectPhrases(audio, sampleRate, {
      silenceThresholdDb: -40, minSilenceDuration: 300, minPhraseDuration: 200, padding: 50,
    })
    expect(phrases).toHaveLength(1)
    expect(phrases[0].startTime).toBeCloseTo(0.45, 1)
    expect(phrases[0].endTime).toBeCloseTo(1.05, 1)
  })

  it('clamps padding to audio boundaries', () => {
    const audio = createTestAudio(sampleRate, [
      { durationMs: 500, amplitude: 0.5 },
      { durationMs: 500, amplitude: 0 },
    ])
    const phrases = detectPhrases(audio, sampleRate, {
      silenceThresholdDb: -40, minSilenceDuration: 300, minPhraseDuration: 200, padding: 50,
    })
    expect(phrases[0].startTime).toBe(0)
  })

  it('filters out phrases shorter than minPhraseDuration', () => {
    const audio = createTestAudio(sampleRate, [
      { durationMs: 100, amplitude: 0.5 },
      { durationMs: 400, amplitude: 0 },
      { durationMs: 500, amplitude: 0.5 },
      { durationMs: 400, amplitude: 0 },
    ])
    const phrases = detectPhrases(audio, sampleRate, {
      silenceThresholdDb: -40, minSilenceDuration: 300, minPhraseDuration: 200, padding: 0,
    })
    expect(phrases).toHaveLength(1)
  })

  it('returns empty array for silent audio', () => {
    const audio = createTestAudio(sampleRate, [
      { durationMs: 3000, amplitude: 0 },
    ])
    const phrases = detectPhrases(audio, sampleRate, {
      silenceThresholdDb: -40, minSilenceDuration: 300, minPhraseDuration: 200, padding: 0,
    })
    expect(phrases).toHaveLength(0)
  })
})
