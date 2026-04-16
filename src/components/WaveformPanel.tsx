import { useEffect, useRef } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.js";
import { Phrase } from "../types";
import { AudioEngine } from "../audio/audioEngine";

interface Props {
  engine: AudioEngine;
  phrases: Phrase[];
  onPhraseBoundaryChange: (id: number, startTime: number, endTime: number) => void;
}

export function WaveformPanel({ engine, phrases, onPhraseBoundaryChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const regionsPluginRef = useRef<any>(null);
  const wavBlobRef = useRef<Blob | null>(null);

  // Create WAV blob when engine buffer changes
  useEffect(() => {
    if (engine.buffer) {
      wavBlobRef.current = engine.audioBufferToWav(engine.buffer);
    }
  }, [engine.buffer]);

  // Initialize WaveSurfer once when we have a WAV blob
  useEffect(() => {
    if (!containerRef.current || !wavBlobRef.current) return;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: "#6b7280",
      progressColor: "#3b82f6",
      height: 128,
      barWidth: 2,
      barGap: 1,
    });

    const regionsPlugin = ws.registerPlugin(RegionsPlugin.create());
    wsRef.current = ws;
    regionsPluginRef.current = regionsPlugin;

    const url = URL.createObjectURL(wavBlobRef.current);
    ws.load(url);

    return () => {
      ws.destroy();
      wsRef.current = null;
      regionsPluginRef.current = null;
      URL.revokeObjectURL(url);
    };
  }, [wavBlobRef.current]);

  // Sync regions with phrases
  useEffect(() => {
    const rp = regionsPluginRef.current;
    if (!rp) return;

    const existingRegions = rp.getRegions();
    existingRegions.forEach((r: any) => r.remove());

    const colors = ["#3b82f633", "#10b98133", "#f59e0b33", "#ef444433", "#8b5cf633"];
    phrases.forEach((phrase, i) => {
      rp.addRegion({
        start: phrase.startTime,
        end: phrase.endTime,
        color: phrase.excluded ? "rgba(107, 114, 128, 0.2)" : colors[i % colors.length],
        drag: false,
        resize: true,
        content: `#${i + 1}`,
      });
    });
  }, [phrases]);

  // Handle region resize
  useEffect(() => {
    const rp = regionsPluginRef.current;
    if (!rp) return;

    const handler = (region: any) => {
      const allRegions = rp.getRegions();
      const index = allRegions.indexOf(region);
      if (index === -1) return;
      const phrase = phrases[index];
      if (!phrase) return;
      onPhraseBoundaryChange(phrase.id, region.start, region.end);
    };

    rp.on("region-updated", handler);
    return () => rp.un("region-updated", handler);
  }, [phrases, onPhraseBoundaryChange]);

  return (
    <div className="mb-6">
      <div ref={containerRef} className="bg-gray-800 rounded-lg overflow-hidden" />
    </div>
  );
}
