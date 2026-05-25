import { useState, useRef, useEffect } from 'react';
import { AudioEngine } from './audio/audioEngine';
import { detectPhrases } from './audio/silenceDetection';
import { exportPhrases } from './audio/exporter';
import { Phrase, DEFAULT_SETTINGS, DetectionSettings as DetectionSettingsType, ExportProgress } from './types';
import { usePersistedState } from './hooks/usePersistedState';
import { AudioUploader } from './components/AudioUploader';
import { DetectionSettings } from './components/DetectionSettings';
import { PhraseList } from './components/PhraseList';
import { WaveformPanel } from './components/WaveformPanel';
import { ExportPanel } from './components/ExportPanel';

export default function App() {
  const engineRef = useRef(new AudioEngine());
  const [audioLoaded, setAudioLoaded] = useState(false);

  useEffect(() => {
    return () => {
      engineRef.current.destroy();
    };
  }, []);
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [settings, setSettings] = usePersistedState<DetectionSettingsType>('detectionSettings', DEFAULT_SETTINGS);
  const [exportProgress, setExportProgress] = useState<ExportProgress>({
    current: 0,
    total: 0,
    status: 'idle',
  });
  const [highlightedId, setHighlightedId] = useState<number | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [scrollToPhrase, setScrollToPhrase] = useState<number | null>(null);
  const [currentPhraseId, setCurrentPhraseId] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const playSessionRef = useRef(0);
  const handleRegionClick = (phraseIndex: number) => {
    const phrase = phrases[phraseIndex];
    if (!phrase) return;
    setCurrentPhraseId(phrase.id);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    setHighlightedId(phrase.id);
    highlightTimerRef.current = setTimeout(() => setHighlightedId(null), 1500);
  };

  const handlePhraseSelect = (index: number) => {
    setScrollToPhrase(index);
  };

  const handleDetect = async () => {
    const engine = engineRef.current;
    if (!engine.buffer) return;
    const channelData = engine.getChannelData();

    const result = detectPhrases(channelData, engine.buffer.sampleRate, {
      silenceThresholdDb: settings.silenceThresholdDb,
      minSilenceDuration: settings.minSilenceDuration,
      minPhraseDuration: settings.minPhraseDuration,
      padding: settings.padding,
    });
    setPhrases(result);
    if (result.length > 0) setCurrentPhraseId(result[0].id);
  };

  const handlePlay = async (phrase: Phrase) => {
    setCurrentPhraseId(phrase.id);
    setIsPlaying(true);
    setScrollToPhrase(phrases.findIndex(p => p.id === phrase.id));
    const session = ++playSessionRef.current;
    await engineRef.current.playSegment(phrase.startTime, phrase.endTime);
    if (playSessionRef.current === session) {
      setIsPlaying(false);
    }
  };

  const handleStop = () => {
    playSessionRef.current++;
    setIsPlaying(false);
    engineRef.current.stop();
  };

  const handlePlayCurrent = () => {
    if (isPlaying) {
      handleStop();
      return;
    }
    const phrase = phrases.find(p => p.id === currentPhraseId);
    if (phrase) handlePlay(phrase);
  };

  const handlePlayNext = () => {
    if (phrases.length === 0) return;
    const idx = currentPhraseId !== null ? phrases.findIndex(p => p.id === currentPhraseId) : -1;
    if (idx === -1 || idx === phrases.length - 1) return;
    handlePlay(phrases[idx + 1]);
  };

  const handleMerge = (id: number) => {
    const idx = phrases.findIndex(p => p.id === id);
    if (idx === -1 || idx === phrases.length - 1) return;

    const current = phrases[idx];
    const next = phrases[idx + 1];

    // Create merged phrase
    const merged: Phrase = {
      id: Math.max(...phrases.map(p => p.id)) + 1,
      startTime: current.startTime,
      endTime: next.endTime,
      excluded: current.excluded && next.excluded,
    };

    // Remove both phrases and add merged one
    const newPhrases = [...phrases];
    newPhrases.splice(idx, 2, merged);
    setPhrases(newPhrases);

    if (currentPhraseId === id || currentPhraseId === next.id) {
      setCurrentPhraseId(merged.id);
    }
  };

  const handleSplit = (id: number) => {
    const idx = phrases.findIndex(p => p.id === id);
    if (idx === -1) return;

    const phrase = phrases[idx];
    const midPoint = (phrase.startTime + phrase.endTime) / 2;

    // Create two new phrases
    const maxId = Math.max(...phrases.map(p => p.id));
    const first: Phrase = {
      ...phrase,
      id: maxId + 1,
      startTime: phrase.startTime,
      endTime: midPoint,
    };
    const second: Phrase = {
      ...phrase,
      id: maxId + 2,
      startTime: midPoint,
      endTime: phrase.endTime,
    };

    // Replace original phrase with two new ones
    const newPhrases = [...phrases];
    newPhrases.splice(idx, 1, first, second);
    setPhrases(newPhrases);

    if (currentPhraseId === id) {
      setCurrentPhraseId(first.id);
    }
  };

  const handleToggleExclude = (id: number) => {
    setPhrases(phrases.map(p => (p.id === id ? { ...p, excluded: !p.excluded } : p)));
  };

  const handlePhraseBoundaryChange = (id: number, startTime: number, endTime: number) => {
    setPhrases(phrases.map(p => (p.id === id ? { ...p, startTime, endTime } : p)));
  };

  const handleExport = async () => {
    const engine = engineRef.current;
    if (!engine.buffer || phrases.length === 0) return;

    const audioData = engine.getChannelData();
    setExportProgress({ current: 0, total: phrases.length, status: 'encoding' });

    try {
      await exportPhrases(audioData, engine.buffer.sampleRate, phrases, engine.fileName, (current, total) =>
        setExportProgress({ current, total, status: 'encoding' })
      );

      setExportProgress(prev => ({ ...prev, status: 'done' }));
      setTimeout(() => setExportProgress({ current: 0, total: 0, status: 'idle' }), 2000);
    } catch {
      setExportProgress({ current: 0, total: 0, status: 'error' });
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 text-gray-900 p-6 max-w-5xl mx-auto overflow-hidden">
      <div className="mb-4 flex items-center gap-3 shrink-0">
        <AudioUploader
          engine={engineRef.current}
          onLoadStart={() => {
            setAudioLoaded(false);
            setPhrases([]);
            setCurrentPhraseId(null);
          }}
          onLoaded={() => {
            setAudioLoaded(true);
          }}
        />
        {audioLoaded && (
          <button
            onClick={handleDetect}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white disabled:opacity-50"
          >
            Detect phrases
          </button>
        )}
      </div>
      {audioLoaded && (
        <>
          <DetectionSettings settings={settings} onChange={setSettings} />
          {phrases.length > 0 && (
            <WaveformPanel
              engine={engineRef.current}
              phrases={phrases}
              scrollToPhrase={scrollToPhrase}
              currentPhraseIndex={currentPhraseId !== null ? phrases.findIndex(p => p.id === currentPhraseId) : -1}
              onPhraseBoundaryChange={handlePhraseBoundaryChange}
              onRegionClick={handleRegionClick}
            />
          )}
          {phrases.length > 0 && (
            <PhraseList
              phrases={phrases}
              highlightedId={highlightedId}
              currentPhraseId={currentPhraseId}
              scrollToPhrase={scrollToPhrase}
              isPlaying={isPlaying}
              onPlay={handlePlay}
              onStop={handleStop}
              onPlayCurrent={handlePlayCurrent}
              onPlayNext={handlePlayNext}
              onMerge={handleMerge}
              onSplit={handleSplit}
              onToggleExclude={handleToggleExclude}
              onPhraseSelect={handlePhraseSelect}
            />
          )}
          {phrases.length > 0 && <ExportPanel onExport={handleExport} progress={exportProgress} />}
        </>
      )}
    </div>
  );
}
