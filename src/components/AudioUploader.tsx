import { useRef, useState } from 'react';
import { AudioEngine } from '../audio/audioEngine';

interface Props {
  engine: AudioEngine;
  onLoadStart: () => void;
  onLoaded: () => void;
}

export function AudioUploader({ engine, onLoadStart, onLoaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError(null);
    onLoadStart();
    try {
      await engine.loadFile(file);
      onLoaded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audio file');
    } finally {
      setLoading(false);
      e.target.value = '';
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
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {engine.buffer && (
        <span className="ml-3 text-gray-600">
          {engine.fileName} ({Math.round(engine.duration)}s)
        </span>
      )}
    </div>
  );
}
