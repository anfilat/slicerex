export class AudioEngine {
  private audioContext: AudioContext | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private _fileName: string = '';
  private playbackId = 0;
  private monoCache: Float32Array | null = null;

  get fileName(): string {
    return this._fileName;
  }

  get buffer(): AudioBuffer | null {
    return this.audioBuffer;
  }

  get duration(): number {
    return this.audioBuffer?.duration ?? 0;
  }

  async loadFile(file: File): Promise<AudioBuffer> {
    this.stop();
    this._fileName = file.name.replace(/\.[^.]+$/, '');

    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }

    const arrayBuffer = await file.arrayBuffer();
    this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
    this.monoCache = null;
    return this.audioBuffer;
  }

  getChannelData(): Float32Array {
    if (!this.audioBuffer) throw new Error('No audio loaded');
    if (this.audioBuffer.numberOfChannels === 1) {
      return this.audioBuffer.getChannelData(0);
    }
    if (this.monoCache) return this.monoCache;
    const ch0 = this.audioBuffer.getChannelData(0);
    const ch1 = this.audioBuffer.getChannelData(1);
    const mono = new Float32Array(ch0.length);
    for (let i = 0; i < ch0.length; i++) {
      mono[i] = (ch0[i] + ch1[i]) / 2;
    }
    this.monoCache = mono;
    return mono;
  }

  playSegment(start: number, end: number): Promise<void> {
    this.stop();
    const id = ++this.playbackId;

    return new Promise(resolve => {
      if (!this.audioContext || !this.audioBuffer) return resolve();

      const sourceNode = this.audioContext.createBufferSource();
      sourceNode.buffer = this.audioBuffer;
      sourceNode.connect(this.audioContext.destination);
      this.sourceNode = sourceNode;

      const duration = end - start;

      // Safety timeout: onended may not fire on some mobile browsers or when tab is backgrounded
      const timeout = setTimeout(
        () => {
          if (this.playbackId === id) resolve();
        },
        duration * 1000 + 500
      );

      sourceNode.onended = () => {
        clearTimeout(timeout);
        if (this.playbackId === id) resolve();
      };
      sourceNode.start(0, start, duration);
    });
  }

  stop(): void {
    this.playbackId++;
    try {
      this.sourceNode?.stop();
    } catch {
      // ignore if not playing
    }
    this.sourceNode = null;
  }

  destroy(): void {
    this.stop();
    this.audioContext?.close();
    this.audioContext = null;
    this.audioBuffer = null;
  }
}
