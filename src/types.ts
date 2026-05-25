export interface Phrase {
  id: number;
  startTime: number; // seconds
  endTime: number; // seconds
  excluded: boolean; // true = skip on export
}

export interface DetectionSettings {
  silenceThresholdDb: number; // default: -40
  minSilenceDuration: number; // ms, default: 1000
  minPhraseDuration: number; // ms, default: 200
  padding: number; // ms, default: 50
}

export const DEFAULT_SETTINGS: DetectionSettings = {
  silenceThresholdDb: -40,
  minSilenceDuration: 1000,
  minPhraseDuration: 200,
  padding: 50,
};

export interface ExportProgress {
  current: number;
  total: number;
  status: 'idle' | 'encoding' | 'downloading' | 'done' | 'error';
}
