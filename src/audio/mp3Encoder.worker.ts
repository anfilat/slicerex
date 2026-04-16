self.onmessage = async (e: MessageEvent) => {
  const { audioData, sampleRate, startSample, endSample } = e.data;

  const lamejs = await import("lamejs");
  const encoder = new lamejs.Mp3Encoder(1, sampleRate, 128);

  const segment = audioData.slice(startSample, endSample);

  // Convert Float32 to Int16
  const int16 = new Int16Array(segment.length);
  for (let i = 0; i < segment.length; i++) {
    const s = Math.max(-1, Math.min(1, segment[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }

  // Encode in chunks of 1152 samples
  const mp3Chunks: Int8Array[] = [];
  for (let i = 0; i < int16.length; i += 1152) {
    const chunk = int16.subarray(i, Math.min(i + 1152, int16.length));
    const mp3buf = encoder.encodeBuffer(chunk);
    if (mp3buf.length > 0) mp3Chunks.push(mp3buf);
  }
  const mp3buf = encoder.flush();
  if (mp3buf.length > 0) mp3Chunks.push(mp3buf);

  const blob = new Blob(mp3Chunks as BlobPart[], { type: "audio/mp3" });
  self.postMessage({ blob });
};
