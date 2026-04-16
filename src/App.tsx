import { useState, useRef } from 'react'
import { AudioEngine } from './audio/audioEngine'
import { Phrase, DEFAULT_SETTINGS, DetectionSettings } from './types'
import { AudioUploader } from './components/AudioUploader'

export default function App() {
  const engineRef = useRef(new AudioEngine())
  const [audioLoaded, setAudioLoaded] = useState(false)
  const [phrases, setPhrases] = useState<Phrase[]>([])
  const [settings, setSettings] = useState<DetectionSettings>(DEFAULT_SETTINGS)

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Slicerex</h1>
      <AudioUploader
        engine={engineRef.current}
        onLoaded={() => setAudioLoaded(true)}
      />
      {audioLoaded && (
        <p className="text-gray-400">
          Audio loaded ({phrases.length} phrases detected)
        </p>
      )}
    </div>
  )
}
