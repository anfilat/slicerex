import { Phrase } from "../types";
import { PhraseCard } from "./PhraseCard";

interface Props {
  phrases: Phrase[];
  onPlay: (phrase: Phrase) => void;
  onMerge: (id: number) => void;
  onUnmerge: (id: number) => void;
  onToggleExclude: (id: number) => void;
}

export function PhraseList({ phrases, onPlay, onMerge, onUnmerge, onToggleExclude }: Props) {
  if (phrases.length === 0) {
    return <p className="text-gray-500">No phrases detected yet.</p>;
  }

  const isMergedWithNext = (i: number) =>
    i < phrases.length - 1 && phrases[i].groupId === phrases[i + 1].groupId;

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
            onPlay={onPlay}
            onMerge={onMerge}
            onUnmerge={onUnmerge}
            onToggleExclude={onToggleExclude}
            isMergedWithNext={isMergedWithNext(i)}
          />
        ))}
      </div>
    </div>
  );
}
