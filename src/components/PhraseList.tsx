import { Phrase } from '../types';
import { PhraseCard } from './PhraseCard';

interface Props {
  phrases: Phrase[];
  highlightedId: number | null;
  currentPhraseId: number | null;
  onPlay: (phrase: Phrase) => void;
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
  onPlay,
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
  const canPlayNext = currentIdx !== -1 && currentIdx < phrases.length - 1;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-3">
        <h2 className="text-lg font-semibold">Phrases ({phrases.length})</h2>
        <button
          onClick={onPlayNext}
          disabled={!canPlayNext}
          className="px-3 py-1 text-sm bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:hover:bg-green-600 text-white rounded"
        >
          Play next ▶
        </button>
      </div>
      <div className="flex flex-col gap-2 max-h-96 overflow-y-auto">
        {phrases.map((phrase, i) => (
          <PhraseCard
            key={phrase.id}
            phrase={phrase}
            index={i}
            isLast={i === phrases.length - 1}
            highlighted={phrase.id === highlightedId}
            isCurrent={phrase.id === currentPhraseId}
            onPlay={onPlay}
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
