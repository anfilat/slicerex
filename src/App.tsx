import { useState, useRef } from 'react'
import { AudioEngine } from './audio/audioEngine'
import { detectPhrases } from './audio/silenceDetection'
import { Phrase, DEFAULT_SETTINGS, DetectionSettings as DetectionSettingsType } from './types'
import { AudioUploader } from './components/AudioUploader'
import { DetectionSettings } from './components/DetectionSettings'

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
          <p className="text-gray-400">
            Audio loaded ({phrases.length} phrases detected)
          </p>
        </>
      )}
    </div>
  )
}
