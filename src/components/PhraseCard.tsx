import { Phrase } from "../types";

interface Props {
  phrase: Phrase;
  index: number;
  isLast: boolean;
  onPlay: (phrase: Phrase) => void;
  onMerge: (id: number) => void;
  onUnmerge: (id: number) => void;
  onToggleExclude: (id: number) => void;
  isMergedWithNext: boolean;
}

export function PhraseCard({
  phrase,
  index,
  isLast,
  onPlay,
  onMerge,
  onUnmerge,
  onToggleExclude,
  isMergedWithNext,
}: Props) {
  const formatTime = (t: number) => {
    const min = Math.floor(t / 60);
    const sec = Math.floor(t % 60);
    const ms = Math.floor((t % 1) * 10);
    return `${min}:${String(sec).padStart(2, "0")}.${ms}`;
  };

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded ${
        phrase.excluded ? "bg-gray-800/50 opacity-50" : "bg-gray-800"
      }`}
    >
      <button
        onClick={() => onPlay(phrase)}
        className="w-8 h-8 flex items-center justify-center bg-blue-600 hover:bg-blue-700 rounded-full text-sm"
        title="Play"
      >
        ▶
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">#{index + 1}</span>
          <span className="font-mono text-xs text-gray-400">
            {formatTime(phrase.startTime)} – {formatTime(phrase.endTime)}
          </span>
          <span className="text-xs text-gray-500">
            ({(phrase.endTime - phrase.startTime).toFixed(1)}s)
          </span>
        </div>
        {phrase.transcript && (
          <p className="text-sm text-gray-300 mt-1 truncate">"{phrase.transcript}"</p>
        )}
      </div>
      {!isLast && (
        <button
          onClick={() => (isMergedWithNext ? onUnmerge(phrase.id) : onMerge(phrase.id))}
          className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded"
          title={isMergedWithNext ? "Unmerge" : "Merge with next"}
        >
          {isMergedWithNext ? "Unmerge" : "Merge ↓"}
        </button>
      )}
      <label className="flex items-center gap-1 text-xs cursor-pointer">
        <input
          type="checkbox"
          checked={phrase.excluded}
          onChange={() => onToggleExclude(phrase.id)}
        />
        Exclude
      </label>
    </div>
  );
}
