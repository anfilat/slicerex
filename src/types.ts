export interface Phrase {
  id: number
  startTime: number    // seconds
  endTime: number      // seconds
  groupId: number      // same groupId = merged into one file
  excluded: boolean    // true = skip on export
  transcript?: string  // from Whisper, optional
}

export interface DetectionSettings {
  method: 'silence' | 'whisper' | 'both'
  silenceThresholdDb: number   // default: -40
  minSilenceDuration: number   // ms, default: 300
  minPhraseDuration: number    // ms, default: 200
  padding: number              // ms, default: 50
  whisperModel: 'tiny' | 'base' | 'small'  // default: 'base'
}

export const DEFAULT_SETTINGS: DetectionSettings = {
  method: 'silence',
  silenceThresholdDb: -40,
  minSilenceDuration: 300,
  minPhraseDuration: 200,
  padding: 50,
  whisperModel: 'base',
}

export interface ExportProgress {
  current: number
  total: number
  status: 'idle' | 'encoding' | 'downloading' | 'done'
}