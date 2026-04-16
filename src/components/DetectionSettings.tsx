import type { DetectionSettings } from '../types';

interface Props {
  settings: DetectionSettings;
  onChange: (settings: DetectionSettings) => void;
  onDetect: () => void;
  disabled: boolean;
}

export function DetectionSettings({ settings, onChange, onDetect, disabled }: Props) {
  const update = (patch: Partial<DetectionSettings>) => onChange({ ...settings, ...patch });

  return (
    <div className="mb-6 p-4 bg-white rounded-lg border border-gray-200">
      <h2 className="text-lg font-semibold mb-3">Detection Settings</h2>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <label className="flex items-center gap-2 text-sm col-span-2 mb-2">
          Detection method:
          <select
            value={settings.method}
            onChange={e => update({ method: e.target.value as DetectionSettings['method'] })}
            className="px-2 py-1 bg-gray-100 rounded border border-gray-300 text-gray-900"
          >
            <option value="silence">Silence detection</option>
            <option value="whisper">Whisper transcription</option>
            <option value="both">Both</option>
          </select>
          {settings.method !== 'silence' && (
            <select
              value={settings.whisperModel}
              onChange={e => update({ whisperModel: e.target.value as DetectionSettings['whisperModel'] })}
              className="px-2 py-1 bg-gray-100 rounded border border-gray-300 text-gray-900"
            >
              <option value="tiny">Tiny (39MB, fast)</option>
              <option value="base">Base (74MB, balanced)</option>
              <option value="small">Small (244MB, accurate)</option>
            </select>
          )}
        </label>
        <label className="flex flex-col text-sm">
          Silence threshold (dB)
          <input
            type="number"
            value={settings.silenceThresholdDb}
            onChange={e => update({ silenceThresholdDb: Number(e.target.value) })}
            className="mt-1 px-2 py-1 bg-gray-100 rounded border border-gray-300 text-gray-900"
          />
        </label>
        <label className="flex flex-col text-sm">
          Min pause (ms)
          <input
            type="number"
            value={settings.minSilenceDuration}
            onChange={e => update({ minSilenceDuration: Number(e.target.value) })}
            className="mt-1 px-2 py-1 bg-gray-100 rounded border border-gray-300 text-gray-900"
          />
        </label>
        <label className="flex flex-col text-sm">
          Min phrase (ms)
          <input
            type="number"
            value={settings.minPhraseDuration}
            onChange={e => update({ minPhraseDuration: Number(e.target.value) })}
            className="mt-1 px-2 py-1 bg-gray-100 rounded border border-gray-300 text-gray-900"
          />
        </label>
        <label className="flex flex-col text-sm">
          Padding (ms)
          <input
            type="number"
            value={settings.padding}
            onChange={e => update({ padding: Number(e.target.value) })}
            className="mt-1 px-2 py-1 bg-gray-100 rounded border border-gray-300 text-gray-900"
          />
        </label>
      </div>
      <button
        onClick={onDetect}
        disabled={disabled}
        className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white disabled:opacity-50"
      >
        Detect phrases
      </button>
    </div>
  );
}
