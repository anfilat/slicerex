import { Phrase } from '../types'

export interface WhisperProgress {
  status: 'loading' | 'transcribing' | 'done'
  progress: number  // 0-100
}

/**
 * Transcribe audio using OpenAI's Whisper model running locally in the browser via WASM.
 *
 * @param audioData - Audio samples as Float32Array
 * @param sampleRate - Sample rate in Hz (typically 16000 for Whisper)
 * @param model - Whisper model size to use ('tiny' | 'base' | 'small')
 * @param onProgress - Callback for progress updates
 * @returns Promise resolving to phrases with transcriptions and timestamps
 *
 * @throws Error if Whisper transcription is not yet available
 *
 * NOTE: This is currently a STUB implementation.
 *
 * Research findings (April 2026):
 *
 * Available packages:
 * 1. @remotion/whisper-web
 *    - Active development (last updated April 2026)
 *    - Wraps whisper.cpp for browser use via WASM
 *    - Part of Remotion ecosystem
 *    - May have dependencies on Remotion internals
 *    - Unknown: word-level timestamp support, Web Worker compatibility
 *
 * 2. @xenova/transformers (Transformers.js)
 *    - Very active development
 *    - Supports Whisper models (tiny, base, small, medium, large)
 *    - Runs in browser via ONNX Runtime Web
 *    - Has Web Worker support examples
 *    - Unknown: Word-level timestamp extraction (Whisper supports them natively, but need to verify JS API exposes them)
 *
 * Limitations found:
 * - Both packages require more investigation for word-level timestamps
 * - Model sizes: tiny (~39MB), base (~74MB), small (~244MB)
 * - First load downloads model from Hugging Face (can be cached in browser)
 * - Processing happens in browser, so long audio may need chunking
 *
 * To implement:
 * 1. Choose between @xenova/transformers (recommended) or @remotion/whisper-web
 * 2. Test word-level timestamp extraction
 * 3. Add Web Worker support for non-blocking processing
 * 4. Handle audio chunking for files longer than 30 seconds
 * 5. Implement proper error handling for model loading failures
 */
export async function transcribeWithWhisper(
  audioData: Float32Array,
  sampleRate: number,
  model: 'tiny' | 'base' | 'small',
  onProgress: (p: WhisperProgress) => void
): Promise<{ phrases: Phrase[] }> {
  // Report loading progress
  onProgress({ status: 'loading', progress: 0 })

  // STUB: Throw error indicating Whisper is not yet implemented
  // Use parameters to avoid unused variable warnings
  void audioData
  void sampleRate
  void model

  throw new Error(
    'Whisper transcription is not yet available. ' +
    'This is a placeholder implementation. ' +
    'To enable Whisper transcription, integrate one of the following packages:\n' +
    '  - @xenova/transformers (recommended)\n' +
    '  - @remotion/whisper-web\n\n' +
    'See implementation notes in src/audio/whisperTranscription.ts for research findings.'
  )

  /* Implementation example for @xenova/transformers (when ready):

  // Step 1: Import and setup
  import { pipeline, env } from '@xenova/transformers'

  // Disable local model checks (we'll download from Hugging Face)
  env.allowLocalModels = false
  env.useBrowserCache = true

  onProgress({ status: 'loading', progress: 10 })

  try {
    // Step 2: Load the model
    const modelName = `Xenova/whisper-${model}`
    const transcriber = await pipeline('automatic-speech-recognition', modelName, {
      progress_callback: (progress) => {
        if (progress.status === 'downloading') {
          onProgress({ status: 'loading', progress: Math.round(progress.progress * 80) })
        }
      }
    })

    onProgress({ status: 'loading', progress: 90 })

    // Step 3: Prepare audio (convert Float32Array to the format expected)
    // Whisper expects 16kHz mono audio
    const audio = prepareAudioForWhisper(audioData, sampleRate)

    onProgress({ status: 'transcribing', progress: 0 })

    // Step 4: Transcribe with timestamps
    const result = await transcriber(audio, {
      chunk_length_s: 30,
      stride_length_s: 5,
      language: 'english', // or detect automatically
      task: 'transcribe',
      return_timestamps: true, // CRITICAL: enables word/segment timestamps
      callback_function: (progress) => {
        onProgress({ status: 'transcribing', progress: Math.round(progress * 100) })
      }
    })

    onProgress({ status: 'done', progress: 100 })

    // Step 5: Parse result into Phrase[]
    // The structure depends on the actual output from transformers.js
    const phrases: Phrase[] = parseWhisperResult(result)

    return { phrases }
  } catch (error) {
    throw new Error(`Whisper transcription failed: ${error.message}`)
  }
  */
}

/**
 * Prepare audio data for Whisper processing.
 * Whisper expects 16kHz mono PCM audio.
 *
 * NOTE: This function is exported for future use. It will be needed when implementing
 * the actual Whisper integration.
 */
export function prepareAudioForWhisper(audioData: Float32Array, sampleRate: number): Float32Array {
  // Resample to 16kHz if needed
  if (sampleRate !== 16000) {
    const ratio = sampleRate / 16000
    const newLength = Math.round(audioData.length / ratio)
    const resampled = new Float32Array(newLength)
    for (let i = 0; i < newLength; i++) {
      const srcIndex = Math.round(i * ratio)
      resampled[i] = audioData[srcIndex]
    }
    return resampled
  }
  return audioData
}

/**
 * Parse Whisper output into Phrase[] format.
 *
 * This function depends on the actual structure returned by the Whisper implementation.
 * Typically, Whisper returns segments with:
 * - start/end times (in seconds)
 * - text transcript
 * - optionally, word-level timestamps
 *
 * NOTE: This function is exported for future use. It will be needed when implementing
 * the actual Whisper integration.
 */
export function parseWhisperResult(result: unknown): Phrase[] {
  // This is a placeholder - actual implementation depends on the package used
  // Expected format might be:
  // {
  //   text: "full transcript",
  //   chunks: [
  //     { text: "hello", start: 0.0, end: 0.5 },
  //     { text: "world", start: 0.5, end: 1.0 }
  //   ]
  // }

  // Use result parameter to avoid unused variable warning
  void result

  const phrases: Phrase[] = []
  // TODO: Implement parsing based on actual output format

  return phrases
}
