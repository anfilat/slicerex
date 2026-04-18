import { Phrase } from '../types';
import { PhraseCard } from './PhraseCard';

interface Props {
  phrases: Phrase[];
  highlightedId: number | null;
  currentPhraseId: number | null;
  scrollToPhrase: number | null;
  isPlaying: boolean;
  onPlay: (phrase: Phrase) => void;
  onStop: () => void;
  onPlayCurrent: () => void;
  onPlayNext: () => void;
  onMerge: (id: number) => void;
  onSplit: (id: number) => void;
  onToggleExclude: (id: number) => void;
  onPhraseSelect: (index: number) => void;
}

export function PhraseList({
  phrases,
  highlightedId,
  currentPhraseId,
  scrollToPhrase,
  isPlaying,
  onPlay,
  onStop,
  onPlayCurrent,
  onPlayNext,
  onMerge,
  onSplit,
  onToggleExclude,
  onPhraseSelect,
}: Props) {
  if (phrases.length === 0) {
    return <p className="text-gray-600">No phrases detected yet.</p>;
  }

  const currentIdx = currentPhraseId !== null ? phrases.findIndex(p => p.id === currentPhraseId) : -1;
  const canPlayNext = currentIdx >= 0 && currentIdx < phrases.length - 1;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center gap-3 mb-3 shrink-0">
        <h2 className="text-lg font-semibold">Phrases ({phrases.length})</h2>
        <button
          onClick={onPlayCurrent}
          className={`px-3 py-1 text-sm text-white rounded ${isPlaying ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {isPlaying ? 'Stop ■' : 'Play ▶'}
        </button>
        <button
          onClick={onPlayNext}
          disabled={!canPlayNext}
          className="px-3 py-1 text-sm bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:hover:bg-green-600 text-white rounded"
        >
          Play next ▶
        </button>
      </div>
      <div className="flex flex-col gap-2 overflow-y-auto min-h-0">
        {phrases.map((phrase, i) => (
          <PhraseCard
            key={phrase.id}
            phrase={phrase}
            index={i}
            isLast={i === phrases.length - 1}
            highlighted={phrase.id === highlightedId}
            shouldScroll={i === scrollToPhrase}
            isCurrent={phrase.id === currentPhraseId}
            isCurrentPlaying={phrase.id === currentPhraseId && isPlaying}
            onPlay={onPlay}
            onStop={onStop}
            onMerge={onMerge}
            onSplit={onSplit}
            onToggleExclude={onToggleExclude}
            onSelect={onPhraseSelect}
          />
        ))}
      </div>
    </div>
  );
}
