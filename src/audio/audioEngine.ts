export class AudioEngine {
  private audioContext: AudioContext | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private _fileName: string = '';

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
    return this.audioBuffer;
  }

  getChannelData(): Float32Array {
    if (!this.audioBuffer) throw new Error('No audio loaded');
    if (this.audioBuffer.numberOfChannels === 1) {
      return this.audioBuffer.getChannelData(0);
    }
    const ch0 = this.audioBuffer.getChannelData(0);
    const ch1 = this.audioBuffer.getChannelData(1);
    const mono = new Float32Array(ch0.length);
    for (let i = 0; i < ch0.length; i++) {
      mono[i] = (ch0[i] + ch1[i]) / 2;
    }
    return mono;
  }

  playSegment(start: number, end: number): Promise<void> {
    return new Promise(resolve => {
      this.stop();
      if (!this.audioContext || !this.audioBuffer) return resolve();

      this.sourceNode = this.audioContext.createBufferSource();
      this.sourceNode.buffer = this.audioBuffer;
      this.sourceNode.connect(this.audioContext.destination);

      const duration = end - start;
      this.sourceNode.onended = () => resolve();
      this.sourceNode.start(0, start, duration);
    });
  }

  stop(): void {
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
