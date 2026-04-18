import { Phrase } from '../types';
import { PhraseCard } from './PhraseCard';

interface Props {
  phrases: Phrase[];
  highlightedId: number | null;
  onPlay: (phrase: Phrase) => void;
  onMerge: (id: number) => void;
  onSplit: (id: number) => void;
  onToggleExclude: (id: number) => void;
  onPhraseSelect: (index: number) => void;
}

export function PhraseList({
  phrases,
  highlightedId,
  onPlay,
  onMerge,
  onSplit,
  onToggleExclude,
  onPhraseSelect,
}: Props) {
  if (phrases.length === 0) {
    return <p className="text-gray-600">No phrases detected yet.</p>;
  }

  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold mb-3">Phrases ({phrases.length})</h2>
      <div className="flex flex-col gap-2 max-h-96 overflow-y-auto">
        {phrases.map((phrase, i) => (
          <PhraseCard
            key={phrase.id}
            phrase={phrase}
            index={i}
            isLast={i === phrases.length - 1}
            highlighted={phrase.id === highlightedId}
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
