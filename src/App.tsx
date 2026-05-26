import { useState, useRef, useEffect } from 'react';
import { AudioEngine } from './audio/audioEngine';
import { exportPhrases } from './audio/exporter';
import { Phrase, DEFAULT_SETTINGS, DetectionSettings as DetectionSettingsType, ExportProgress } from './types';
import silenceDetectionWorker from './audio/silenceDetection.worker?worker';
import { mergePhrase, splitPhrase, toggleExclude } from './audio/phraseMutations';
import { usePersistedState } from './hooks/usePersistedState';
import { DetectionSettings } from './components/DetectionSettings';
import { PhraseList } from './components/PhraseList';
import { WaveformPanel } from './components/WaveformPanel';
import { ExportPanel } from './components/ExportPanel';

export default function App() {
  const engineRef = useRef(new AudioEngine());
  const [audioLoaded, setAudioLoaded] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const loading = uploadLoading || detecting;
  const [dots, setDots] = useState(1);
  const detectionWorkerRef = useRef<Worker | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [settings, setSettings] = usePersistedState<DetectionSettingsType>('detectionSettings', DEFAULT_SETTINGS);
  const [exportProgress, setExportProgress] = useState<ExportProgress>({ status: 'idle' });
  const [highlightedId, setHighlightedId] = useState<number | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [scrollToPhrase, setScrollToPhrase] = useState<number | null>(null);
  const [currentPhraseId, setCurrentPhraseId] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const playSessionRef = useRef(0);

  useEffect(() => {
    return () => {
      terminateDetectionWorker();
      engineRef.current.destroy();
    };
  }, []);

  useEffect(() => {
    if (!loading) return;
    const id = setInterval(() => setDots(d => (d % 3) + 1), 400);
    return () => clearInterval(id);
  }, [loading]);

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadLoading(true);
    setUploadError(null);
    setAudioLoaded(false);
    setPhrases([]);
    setCurrentPhraseId(null);
    try {
      await engineRef.current.loadFile(file);
      setAudioLoaded(true);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to load audio file');
    } finally {
      setUploadLoading(false);
      e.target.value = '';
    }
  };

  const terminateDetectionWorker = () => {
    detectionWorkerRef.current?.terminate();
    detectionWorkerRef.current = null;
  };

  const handleDetect = () => {
    const engine = engineRef.current;
    if (!engine.buffer) return;
    const channelData = engine.getChannelData();

    terminateDetectionWorker();
    const worker = new silenceDetectionWorker();
    detectionWorkerRef.current = worker;

    setDetecting(true);

    worker.onmessage = (e: MessageEvent<{ phrases: Phrase[] }>) => {
      const { phrases: result } = e.data;
      setPhrases(result);
      if (result.length > 0) setCurrentPhraseId(result[0].id);
      setDetecting(false);
      terminateDetectionWorker();
    };

    worker.onerror = () => {
      setDetecting(false);
      terminateDetectionWorker();
    };

    worker.postMessage({
      audioData: channelData,
      sampleRate: engine.buffer.sampleRate,
      config: settings,
    });
  };

  const currentPhraseIndex = currentPhraseId !== null ? phrases.findIndex(p => p.id === currentPhraseId) : -1;

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
    if (currentPhraseIndex < 0 || currentPhraseIndex >= phrases.length - 1) return;
    handlePlay(phrases[currentPhraseIndex + 1]);
  };

  const handleMerge = (id: number) => {
    const result = mergePhrase(phrases, id);
    if (!result) return;
    setPhrases(result.phrases);
    if (currentPhraseId !== null && result.mergedFromIds.includes(currentPhraseId)) {
      setCurrentPhraseId(result.mergedId);
    }
  };

  const handleSplit = (id: number) => {
    const result = splitPhrase(phrases, id);
    if (!result) return;
    setPhrases(result.phrases);
    if (currentPhraseId === result.originalId) {
      setCurrentPhraseId(result.firstHalfId);
    }
  };

  const handleToggleExclude = (id: number) => {
    setPhrases(toggleExclude(phrases, id));
  };

  const handlePhraseBoundaryChange = (id: number, startTime: number, endTime: number) => {
    setPhrases(phrases.map(p => (p.id === id ? { ...p, startTime, endTime } : p)));
  };

  const handleExport = async () => {
    const engine = engineRef.current;
    if (!engine.buffer || phrases.length === 0) return;

    const audioData = engine.getChannelData();
    setExportProgress({ status: 'encoding', current: 0, total: phrases.length });

    try {
      await exportPhrases(audioData, engine.buffer.sampleRate, phrases, engine.fileName, (current, total) =>
        setExportProgress({ status: 'encoding', current, total })
      );

      setExportProgress(prev => ({ status: 'done', total: prev.status === 'encoding' ? prev.total : 0 }));
      setTimeout(() => setExportProgress({ status: 'idle' }), 2000);
    } catch {
      setExportProgress({ status: 'error' });
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 text-gray-900 p-6 max-w-5xl mx-auto overflow-hidden">
      <div className="mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white disabled:opacity-50"
          >
            {uploadLoading ? 'Loading...' : 'Upload audio file'}
          </button>
          <input ref={fileInputRef} type="file" accept="audio/*" onChange={handleFileUpload} className="hidden" />
          {audioLoaded && (
            <button
              onClick={handleDetect}
              disabled={detecting}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white disabled:opacity-50"
            >
              {detecting ? 'Detecting...' : 'Detect phrases'}
            </button>
          )}
        </div>
        <div className="mt-1 text-sm h-5">
          {uploadError && <span className="text-red-600">{uploadError}</span>}
          {!uploadError && detecting && <span className="text-gray-500">{`Detecting phrases${'.'.repeat(dots)}`}</span>}
          {!uploadError && !detecting && uploadLoading && (
            <span className="text-gray-500">{`Loading audio${'.'.repeat(dots)}`}</span>
          )}
          {!uploadError && !detecting && audioLoaded && !uploadLoading && (
            <span className="text-gray-500">
              {engineRef.current.fileName} ({Math.round(engineRef.current.duration)}s)
            </span>
          )}
        </div>
      </div>
      {audioLoaded && (
        <>
          <DetectionSettings settings={settings} onChange={setSettings} />
          {phrases.length > 0 && (
            <WaveformPanel
              engine={engineRef.current}
              phrases={phrases}
              scrollToPhrase={scrollToPhrase}
              currentPhraseIndex={currentPhraseIndex}
              onPhraseBoundaryChange={handlePhraseBoundaryChange}
              onRegionClick={handleRegionClick}
            />
          )}
          {phrases.length > 0 && (
            <PhraseList
              phrases={phrases}
              highlightedId={highlightedId}
              currentPhraseId={currentPhraseId}
              currentPhraseIndex={currentPhraseIndex}
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
              onScrolled={() => setScrollToPhrase(null)}
            />
          )}
          {phrases.length > 0 && <ExportPanel onExport={handleExport} progress={exportProgress} />}
        </>
      )}
    </div>
  );
}
