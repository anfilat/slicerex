import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.js';
import { Phrase } from '../types';
import { AudioEngine } from '../audio/audioEngine';

interface Props {
  engine: AudioEngine;
  phrases: Phrase[];
  onPhraseBoundaryChange: (id: number, startTime: number, endTime: number) => void;
}

export function WaveformPanel({ engine, phrases, onPhraseBoundaryChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const regionsPluginRef = useRef<any>(null);
  const [isReady, setIsReady] = useState(false);

  // Initialize WaveSurfer once when we have audio data
  useEffect(() => {
    if (!containerRef.current || !engine.buffer) return;

    const channelData = engine.getChannelData();
    const duration = engine.buffer.duration;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#6b7280',
      progressColor: '#3b82f6',
      height: 128,
      barWidth: 2,
      barGap: 1,
      interact: false,
    });

    const regionsPlugin = ws.registerPlugin(RegionsPlugin.create());
    wsRef.current = ws;
    regionsPluginRef.current = regionsPlugin;
    setIsReady(false);

    const loadPromise = ws.load('', [channelData], duration).catch(() => {});

    // Mark as ready after audio is loaded
    loadPromise.then(() => {
      setIsReady(true);
    });

    return () => {
      wsRef.current = null;
      regionsPluginRef.current = null;
      setIsReady(false);
      // Wait for load to settle before destroying to avoid AbortError from
      // the media element aborting an in-progress load during React StrictMode cleanup.
      loadPromise.then(() => ws.destroy());
    };
  }, [engine.buffer]);

  // Sync regions with phrases
  useEffect(() => {
    const rp = regionsPluginRef.current;
    if (!rp || !isReady) return;

    const existingRegions = rp.getRegions();
    existingRegions.forEach((r: any) => r.remove());

    const colors = ['#3b82f633', '#10b98133', '#f59e0b33', '#ef444433', '#8b5cf633'];
    phrases.forEach((phrase, i) => {
      rp.addRegion({
        start: phrase.startTime,
        end: phrase.endTime,
        color: phrase.excluded ? 'rgba(107, 114, 128, 0.2)' : colors[i % colors.length],
        drag: false,
        resize: true,
        content: `#${i + 1}`,
      });
    });
  }, [phrases, isReady]);

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

    rp.on('region-updated', handler);
    return () => rp.un('region-updated', handler);
  }, [phrases, onPhraseBoundaryChange]);

  return (
    <div className="mb-6">
      <div ref={containerRef} className="bg-white rounded-lg border border-gray-200 overflow-hidden" />
    </div>
  );
}
