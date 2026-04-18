import { useState, useRef, useEffect } from 'react';
import { AudioEngine } from './audio/audioEngine';
import { detectPhrases } from './audio/silenceDetection';
import { transcribeWithWhisper } from './audio/whisperTranscription';
import { exportPhrases } from './audio/exporter';
import { Phrase, DEFAULT_SETTINGS, DetectionSettings as DetectionSettingsType, ExportProgress } from './types';
import { AudioUploader } from './components/AudioUploader';
import { DetectionSettings } from './components/DetectionSettings';
import { PhraseList } from './components/PhraseList';
import { WaveformPanel } from './components/WaveformPanel';
import { ExportPanel } from './components/ExportPanel';
import { WhisperStatus } from './components/WhisperStatus';

export default function App() {
  const engineRef = useRef(new AudioEngine());
  const [audioLoaded, setAudioLoaded] = useState(false);

  useEffect(() => {
    return () => {
      engineRef.current.destroy();
    };
  }, []);
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [settings, setSettings] = useState<DetectionSettingsType>(DEFAULT_SETTINGS);
  const [exportProgress, setExportProgress] = useState<ExportProgress>({
    current: 0,
    total: 0,
    status: 'idle',
  });
  const [highlightedId, setHighlightedId] = useState<number | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [scrollToPhrase, setScrollToPhrase] = useState<number | null>(null);
  const [currentPhraseId, setCurrentPhraseId] = useState<number | null>(null);
  const [whisperProgress, setWhisperProgress] = useState<{
    status: 'idle' | 'loading' | 'transcribing' | 'done' | 'error';
    progress: number;
  }>({ status: 'idle', progress: 0 });

  const handleRegionClick = (phraseIndex: number) => {
    const phrase = phrases[phraseIndex];
    if (!phrase) return;
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

    if (settings.method === 'silence') {
      const result = detectPhrases(channelData, engine.buffer.sampleRate, {
        silenceThresholdDb: settings.silenceThresholdDb,
        minSilenceDuration: settings.minSilenceDuration,
        minPhraseDuration: settings.minPhraseDuration,
        padding: settings.padding,
      });
      setPhrases(result);
    } else if (settings.method === 'whisper') {
      try {
        const result = await transcribeWithWhisper(channelData, engine.buffer.sampleRate, settings.whisperModel, p =>
          setWhisperProgress({ status: p.status, progress: p.progress })
        );
        setPhrases(result.phrases);
      } catch {
        setWhisperProgress({ status: 'error', progress: 0 });
        // Fall back to silence detection on error
        const result = detectPhrases(channelData, engine.buffer.sampleRate, {
          silenceThresholdDb: settings.silenceThresholdDb,
          minSilenceDuration: settings.minSilenceDuration,
          minPhraseDuration: settings.minPhraseDuration,
          padding: settings.padding,
        });
        setPhrases(result);
      }
    } else {
      // 'both'
      // Run silence detection first (instant)
      const silenceResult = detectPhrases(channelData, engine.buffer.sampleRate, {
        silenceThresholdDb: settings.silenceThresholdDb,
        minSilenceDuration: settings.minSilenceDuration,
        minPhraseDuration: settings.minPhraseDuration,
        padding: settings.padding,
      });
      setPhrases(silenceResult);

      // Then try Whisper in background for transcripts
      try {
        const whisperResult = await transcribeWithWhisper(
          channelData,
          engine.buffer.sampleRate,
          settings.whisperModel,
          p => setWhisperProgress({ status: p.status, progress: p.progress })
        );
        // Enrich silence-detected phrases with transcripts
        setPhrases(prev =>
          prev.map((p, i) => ({
            ...p,
            transcript: whisperResult.phrases[i]?.transcript,
          }))
        );
      } catch {
        setWhisperProgress({ status: 'error', progress: 0 });
      }
    }
  };

  const handlePlay = async (phrase: Phrase) => {
    setCurrentPhraseId(phrase.id);
    await engineRef.current.playSegment(phrase.startTime, phrase.endTime);
  };

  const handlePlayNext = () => {
    if (phrases.length === 0) return;
    if (currentPhraseId === null) {
      handlePlay(phrases[0]);
      return;
    }
    const idx = phrases.findIndex(p => p.id === currentPhraseId);
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

    await exportPhrases(audioData, engine.buffer.sampleRate, phrases, engine.fileName, (current, total) =>
      setExportProgress({ current, total, status: 'encoding' })
    );

    setExportProgress(prev => ({ ...prev, status: 'done' }));
    setTimeout(() => setExportProgress({ current: 0, total: 0, status: 'idle' }), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Slicerex</h1>
      <AudioUploader
        engine={engineRef.current}
        onLoaded={() => {
          setAudioLoaded(true);
          setPhrases([]);
          setCurrentPhraseId(null);
        }}
      />
      {audioLoaded && (
        <>
          <DetectionSettings
            settings={settings}
            onChange={setSettings}
            onDetect={handleDetect}
            disabled={!audioLoaded}
          />
          <WhisperStatus status={whisperProgress.status} progress={whisperProgress.progress} />
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
              onPlay={handlePlay}
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
