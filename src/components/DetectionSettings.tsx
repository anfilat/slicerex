import { useState } from 'react';
import type { DetectionSettings } from '../types';

interface Props {
  settings: DetectionSettings;
  onChange: (settings: DetectionSettings) => void;
}

export function DetectionSettings({ settings, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const update = (patch: Partial<DetectionSettings>) => onChange({ ...settings, ...patch });

  return (
    <div className="mb-6">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
      >
        <span className={`transition-transform ${open ? 'rotate-90' : ''}`}>&#9654;</span>
        Detection settings
      </button>
      {open && (
        <div className="mt-3 p-4 bg-white rounded-lg border border-gray-200">
          <div className="grid grid-cols-2 gap-3">
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
        </div>
      )}
    </div>
  );
}
