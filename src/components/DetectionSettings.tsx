import { DetectionSettings } from '../types'

interface Props {
  settings: DetectionSettings
  onChange: (settings: DetectionSettings) => void
  onDetect: () => void
  disabled: boolean
}

export function DetectionSettings({ settings, onChange, onDetect, disabled }: Props) {
  const update = (patch: Partial<DetectionSettings>) =>
    onChange({ ...settings, ...patch })

  return (
    <div className="mb-6 p-4 bg-gray-800 rounded-lg">
      <h2 className="text-lg font-semibold mb-3">Detection Settings</h2>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <label className="flex flex-col text-sm">
          Silence threshold (dB)
          <input
            type="number"
            value={settings.silenceThresholdDb}
            onChange={e => update({ silenceThresholdDb: Number(e.target.value) })}
            className="mt-1 px-2 py-1 bg-gray-700 rounded"
          />
        </label>
        <label className="flex flex-col text-sm">
          Min pause (ms)
          <input
            type="number"
            value={settings.minSilenceDuration}
            onChange={e => update({ minSilenceDuration: Number(e.target.value) })}
            className="mt-1 px-2 py-1 bg-gray-700 rounded"
          />
        </label>
        <label className="flex flex-col text-sm">
          Min phrase (ms)
          <input
            type="number"
            value={settings.minPhraseDuration}
            onChange={e => update({ minPhraseDuration: Number(e.target.value) })}
            className="mt-1 px-2 py-1 bg-gray-700 rounded"
          />
        </label>
        <label className="flex flex-col text-sm">
          Padding (ms)
          <input
            type="number"
            value={settings.padding}
            onChange={e => update({ padding: Number(e.target.value) })}
            className="mt-1 px-2 py-1 bg-gray-700 rounded"
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
  )
}
