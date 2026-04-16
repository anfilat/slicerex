import { Phrase } from '../types'

interface DetectionConfig {
  silenceThresholdDb: number
  minSilenceDuration: number   // ms
  minPhraseDuration: number    // ms
  padding: number              // ms
}

export function detectPhrases(
  audioData: Float32Array,
  sampleRate: number,
  config: DetectionConfig
): Phrase[] {
  const windowSize = Math.floor((50 / 1000) * sampleRate)
  const hopSize = Math.floor((10 / 1000) * sampleRate)

  const thresholdLinear = Math.pow(10, config.silenceThresholdDb / 20)
  const isSilent: boolean[] = []

  for (let i = 0; i + windowSize <= audioData.length; i += hopSize) {
    let sumSq = 0
    for (let j = i; j < i + windowSize; j++) {
      sumSq += audioData[j] * audioData[j]
    }
    const rms = Math.sqrt(sumSq / windowSize)
    isSilent.push(rms < thresholdLinear)
  }

  const minSilentFrames = Math.ceil(config.minSilenceDuration / 10)
  const silenceRegions: { start: number; end: number }[] = []
  let silentStart = -1

  for (let i = 0; i < isSilent.length; i++) {
    if (isSilent[i]) {
      if (silentStart === -1) silentStart = i
    } else {
      if (silentStart !== -1 && i - silentStart >= minSilentFrames) {
        silenceRegions.push({
          start: (silentStart * hopSize) / sampleRate,
          end: (i * hopSize) / sampleRate,
        })
      }
      silentStart = -1
    }
  }
  if (silentStart !== -1 && isSilent.length - silentStart >= minSilentFrames) {
    silenceRegions.push({
      start: (silentStart * hopSize) / sampleRate,
      end: (isSilent.length * hopSize) / sampleRate,
    })
  }

  const totalDuration = audioData.length / sampleRate
  const paddingSec = config.padding / 1000
  const boundaries: { start: number; end: number }[] = []

  let prevEnd = 0
  for (const region of silenceRegions) {
    if (region.start > prevEnd) {
      boundaries.push({ start: prevEnd, end: region.start })
    }
    prevEnd = region.end
  }
  if (prevEnd < totalDuration) {
    boundaries.push({ start: prevEnd, end: totalDuration })
  }

  const minPhraseSec = config.minPhraseDuration / 1000
  let phraseId = 0

  const phrases: Phrase[] = boundaries
    .filter(b => (b.end - b.start) >= minPhraseSec)
    .map(b => {
      const paddedStart = Math.max(0, b.start - paddingSec)
      const paddedEnd = Math.min(totalDuration, b.end + paddingSec)
      const phrase: Phrase = {
        id: phraseId,
        startTime: Math.round(paddedStart * 1000) / 1000,
        endTime: Math.round(paddedEnd * 1000) / 1000,
        groupId: phraseId,
        excluded: false,
      }
      phraseId++
      return phrase
    })

  return phrases.map((p, i) => ({
    ...p,
    id: i,
    groupId: i,
  }))
}
