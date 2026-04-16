import { useState, useRef } from 'react'
import { AudioEngine } from './audio/audioEngine'
import { detectPhrases } from './audio/silenceDetection'
import { Phrase, DEFAULT_SETTINGS, DetectionSettings as DetectionSettingsType } from './types'
import { AudioUploader } from './components/AudioUploader'
import { DetectionSettings } from './components/DetectionSettings'
import { PhraseList } from './components/PhraseList'

export default function App() {
  const engineRef = useRef(new AudioEngine())
  const [audioLoaded, setAudioLoaded] = useState(false)
  const [phrases, setPhrases] = useState<Phrase[]>([])
  const [settings, setSettings] = useState<DetectionSettingsType>(DEFAULT_SETTINGS)

  const handleDetect = () => {
    const engine = engineRef.current
    if (!engine.buffer) return
    const channelData = engine.getChannelData()
    const result = detectPhrases(channelData, engine.buffer.sampleRate, {
      silenceThresholdDb: settings.silenceThresholdDb,
      minSilenceDuration: settings.minSilenceDuration,
      minPhraseDuration: settings.minPhraseDuration,
      padding: settings.padding,
    })
    setPhrases(result)
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

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Slicerex</h1>
      <AudioUploader
        engine={engineRef.current}
        onLoaded={() => setAudioLoaded(true)}
      />
      {audioLoaded && (
        <>
          <DetectionSettings
            settings={settings}
            onChange={setSettings}
            onDetect={handleDetect}
            disabled={!audioLoaded}
          />
          {phrases.length > 0 && (
            <PhraseList
              phrases={phrases}
              onPlay={handlePlay}
              onMerge={handleMerge}
              onUnmerge={handleUnmerge}
              onToggleExclude={handleToggleExclude}
            />
          )}
        </>
      )}
    </div>
  )
}
