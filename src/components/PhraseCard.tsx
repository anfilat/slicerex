import { useEffect, useRef } from 'react';
import { Phrase } from '../types';

interface Props {
  phrase: Phrase;
  index: number;
  isLast: boolean;
  highlighted: boolean;
  isCurrent: boolean;
  isCurrentPlaying: boolean;
  onPlay: (phrase: Phrase) => void;
  onStop: () => void;
  onMerge: (id: number) => void;
  onSplit: (id: number) => void;
  onToggleExclude: (id: number) => void;
  onSelect: (index: number) => void;
}

export function PhraseCard({
  phrase,
  index,
  isLast,
  highlighted,
  isCurrent,
  isCurrentPlaying,
  onPlay,
  onStop,
  onMerge,
  onSplit,
  onToggleExclude,
  onSelect,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!highlighted || !ref.current) return;
    ref.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [highlighted]);
  const formatTime = (t: number) => {
    const min = Math.floor(t / 60);
    const sec = Math.floor(t % 60);
    const ms = Math.floor((t % 1) * 10);
    return `${min}:${String(sec).padStart(2, '0')}.${ms}`;
  };

  return (
    <div
      ref={ref}
      onClick={() => onSelect(index)}
      className={`flex items-center gap-3 p-3 rounded border transition-colors duration-300 cursor-pointer ${isCurrent ? 'border-l-4 border-l-blue-500 bg-blue-50 border-blue-200' : highlighted ? 'bg-blue-50 border-blue-200' : phrase.excluded ? 'bg-gray-100/50 opacity-50' : 'bg-white border-gray-200'}`}
    >
      {isCurrentPlaying ? (
        <button
          onClick={onStop}
          className="w-8 h-8 flex items-center justify-center bg-red-600 hover:bg-red-700 rounded-full text-sm text-white"
          title="Stop"
        >
          ■
        </button>
      ) : (
        <button
          onClick={() => onPlay(phrase)}
          className="w-8 h-8 flex items-center justify-center bg-blue-600 hover:bg-blue-700 rounded-full text-sm text-white"
          title="Play"
        >
          ▶
        </button>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-600">#{index + 1}</span>
          <span className="font-mono text-xs text-gray-500">
            {formatTime(phrase.startTime)} – {formatTime(phrase.endTime)}
          </span>
          <span className="text-xs text-gray-600">({(phrase.endTime - phrase.startTime).toFixed(1)}s)</span>
        </div>
        {phrase.transcript && <p className="text-sm text-gray-700 mt-1 truncate">"{phrase.transcript}"</p>}
      </div>
      {!isLast && (
        <button
          onClick={() => onMerge(phrase.id)}
          className="px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded"
          title="Merge with next phrase"
        >
          Merge ↓
        </button>
      )}
      <button
        onClick={() => onSplit(phrase.id)}
        className="px-2 py-1 text-xs bg-green-100 hover:bg-green-200 text-green-700 rounded"
        title="Split into two phrases"
      >
        Split ✂
      </button>
      <label className="flex items-center gap-1 text-xs cursor-pointer">
        <input type="checkbox" checked={phrase.excluded} onChange={() => onToggleExclude(phrase.id)} />
        Exclude
      </label>
    </div>
  );
}
