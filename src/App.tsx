import { useState, useRef, useEffect } from 'react'
import { AudioEngine } from './audio/audioEngine'
import { detectPhrases } from './audio/silenceDetection'
import { transcribeWithWhisper } from './audio/whisperTranscription'
import { exportPhrases } from './audio/exporter'
import { Phrase, DEFAULT_SETTINGS, DetectionSettings as DetectionSettingsType, ExportProgress } from './types'
import { AudioUploader } from './components/AudioUploader'
import { DetectionSettings } from './components/DetectionSettings'
import { PhraseList } from './components/PhraseList'
import { WaveformPanel } from './components/WaveformPanel'
import { ExportPanel } from './components/ExportPanel'
import { WhisperStatus } from './components/WhisperStatus'

export default function App() {
  const engineRef = useRef(new AudioEngine())
  const [audioLoaded, setAudioLoaded] = useState(false)

  useEffect(() => {
    return () => { engineRef.current.destroy() }
  }, [])
  const [phrases, setPhrases] = useState<Phrase[]>([])
  const [settings, setSettings] = useState<DetectionSettingsType>(DEFAULT_SETTINGS)
  const [exportProgress, setExportProgress] = useState<ExportProgress>({
    current: 0, total: 0, status: 'idle'
  })
  const [whisperProgress, setWhisperProgress] = useState<{
    status: 'idle' | 'loading' | 'transcribing' | 'done' | 'error'
    progress: number
  }>({ status: 'idle', progress: 0 })

  const handleDetect = async () => {
    const engine = engineRef.current
    if (!engine.buffer) return
    const channelData = engine.getChannelData()

    if (settings.method === 'silence') {
      const result = detectPhrases(channelData, engine.buffer.sampleRate, {
        silenceThresholdDb: settings.silenceThresholdDb,
        minSilenceDuration: settings.minSilenceDuration,
        minPhraseDuration: settings.minPhraseDuration,
        padding: settings.padding,
      })
      setPhrases(result)
    } else if (settings.method === 'whisper') {
      try {
        const result = await transcribeWithWhisper(
          channelData, engine.buffer.sampleRate, settings.whisperModel,
          (p) => setWhisperProgress({ status: p.status, progress: p.progress })
        )
        setPhrases(result.phrases)
      } catch (err) {
        setWhisperProgress({ status: 'error', progress: 0 })
        // Fall back to silence detection on error
        const result = detectPhrases(channelData, engine.buffer.sampleRate, {
          silenceThresholdDb: settings.silenceThresholdDb,
          minSilenceDuration: settings.minSilenceDuration,
          minPhraseDuration: settings.minPhraseDuration,
          padding: settings.padding,
        })
        setPhrases(result)
      }
    } else { // 'both'
      // Run silence detection first (instant)
      const silenceResult = detectPhrases(channelData, engine.buffer.sampleRate, {
        silenceThresholdDb: settings.silenceThresholdDb,
        minSilenceDuration: settings.minSilenceDuration,
        minPhraseDuration: settings.minPhraseDuration,
        padding: settings.padding,
      })
      setPhrases(silenceResult)

      // Then try Whisper in background for transcripts
      try {
        const whisperResult = await transcribeWithWhisper(
          channelData, engine.buffer.sampleRate, settings.whisperModel,
          (p) => setWhisperProgress({ status: p.status, progress: p.progress })
        )
        // Enrich silence-detected phrases with transcripts
        setPhrases(prev => prev.map((p, i) => ({
          ...p,
          transcript: whisperResult.phrases[i]?.transcript,
        })))
      } catch {
        setWhisperProgress({ status: 'error', progress: 0 })
      }
    }
  }

  const handlePlay = async (phrase: Phrase) => {
    await engineRef.current.playSegment(phrase.startTime, phrase.endTime)
  }

  const handleMerge = (id: number) => {
    const idx = phrases.findIndex(p => p.id === id)
    if (idx === -1 || idx === phrases.length - 1) return
    const targetGroupId = phrases[idx + 1].groupId
    setPhrases(phrases.map(p =>
      p.groupId === targetGroupId ? { ...p, groupId: phrases[idx].groupId } : p
    ))
  }

  const handleUnmerge = (id: number) => {
    setPhrases(phrases.map(p =>
      p.id === id + 1 ? { ...p, groupId: p.id } : p
    ))
  }

  const handleToggleExclude = (id: number) => {
    setPhrases(phrases.map(p =>
      p.id === id ? { ...p, excluded: !p.excluded } : p
    ))
  }

  const handlePhraseBoundaryChange = (id: number, startTime: number, endTime: number) => {
    setPhrases(phrases.map(p =>
      p.id === id ? { ...p, startTime, endTime } : p
    ))
  }

  const handleExport = async () => {
    const engine = engineRef.current
    if (!engine.buffer || phrases.length === 0) return

    const audioData = engine.getChannelData()
    setExportProgress({ current: 0, total: phrases.length, status: 'encoding' })

    await exportPhrases(
      audioData,
      engine.buffer.sampleRate,
      phrases,
      engine.fileName,
      (current, total) => setExportProgress({ current, total, status: 'encoding' })
    )

    setExportProgress(prev => ({ ...prev, status: 'done' }))
    setTimeout(() => setExportProgress({ current: 0, total: 0, status: 'idle' }), 2000)
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Slicerex</h1>
      <AudioUploader
        engine={engineRef.current}
        onLoaded={() => {
          setAudioLoaded(true)
          setPhrases([])
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
          <WhisperStatus
            status={whisperProgress.status}
            progress={whisperProgress.progress}
          />
          {phrases.length > 0 && (
            <WaveformPanel
              engine={engineRef.current}
              phrases={phrases}
              onPhraseBoundaryChange={handlePhraseBoundaryChange}
            />
          )}
          {phrases.length > 0 && (
            <PhraseList
              phrases={phrases}
              onPlay={handlePlay}
              onMerge={handleMerge}
              onUnmerge={handleUnmerge}
              onToggleExclude={handleToggleExclude}
            />
          )}
          {phrases.length > 0 && (
            <ExportPanel onExport={handleExport} progress={exportProgress} />
          )}
        </>
      )}
    </div>
  )
}
