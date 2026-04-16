interface Props {
  status: 'idle' | 'loading' | 'transcribing' | 'done' | 'error';
  progress: number; // 0-100
  errorMessage?: string;
}

export function WhisperStatus({ status, progress, errorMessage }: Props) {
  if (status === 'idle') return null;

  const label = {
    loading: 'Loading Whisper model...',
    transcribing: 'Transcribing audio...',
    done: 'Transcription complete',
    error: errorMessage ?? 'Error',
  }[status];

  return (
    <div className="mb-4 p-3 bg-gray-800 rounded-lg">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <p className="text-sm mb-1">{label}</p>
          {(status === 'loading' || status === 'transcribing') && (
            <div className="h-2 bg-gray-700 rounded overflow-hidden">
              <div className="h-full bg-amber-500 transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>
        <span className="text-sm text-gray-400">{progress}%</span>
      </div>
    </div>
  );
}
