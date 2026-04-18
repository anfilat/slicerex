import { useRef, useState } from 'react';
import { AudioEngine } from '../audio/audioEngine';

interface Props {
  engine: AudioEngine;
  onLoaded: () => void;
}

export function AudioUploader({ engine, onLoaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      await engine.loadFile(file);
      onLoaded();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white disabled:opacity-50"
      >
        {loading ? 'Loading...' : 'Upload audio file'}
      </button>
      <input ref={inputRef} type="file" accept="audio/*" onChange={handleFile} className="hidden" />
      {engine.buffer && (
        <span className="ml-3 text-gray-600">
          {engine.fileName} ({Math.round(engine.duration)}s)
        </span>
      )}
    </div>
  );
}
