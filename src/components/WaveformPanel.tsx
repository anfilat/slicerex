import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.js';
import type { Region } from 'wavesurfer.js/dist/plugins/regions.js';
import ZoomPlugin from 'wavesurfer.js/dist/plugins/zoom.js';
import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline.js';
import { Phrase } from '../types';
import { AudioEngine } from '../audio/audioEngine';

const REGION_COLORS = ['#3b82f633', '#10b98133', '#f59e0b33', '#ef444433', '#8b5cf633'] as const;
const EXCLUDED_COLOR = 'rgba(107, 114, 128, 0.2)';

interface Props {
  engine: AudioEngine;
  phrases: Phrase[];
  scrollToPhrase: number | null;
  currentPhraseIndex: number;
  onPhraseBoundaryChange: (id: number, startTime: number, endTime: number) => void;
  onRegionClick?: (phraseIndex: number) => void;
}

export function WaveformPanel({
  engine,
  phrases,
  scrollToPhrase,
  currentPhraseIndex,
  onPhraseBoundaryChange,
  onRegionClick,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const regionsPluginRef = useRef<RegionsPlugin | null>(null);
  const regionByPhraseIdRef = useRef<Map<number, Region>>(new Map());
  const phrasesRef = useRef(phrases);
  phrasesRef.current = phrases;
  const [isReady, setIsReady] = useState(false);
  const [loadError, setLoadError] = useState(false);

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

    ws.registerPlugin(ZoomPlugin.create({ exponentialZooming: true }));
    ws.registerPlugin(TimelinePlugin.create());

    const regionsPlugin = ws.registerPlugin(RegionsPlugin.create());
    wsRef.current = ws;
    regionsPluginRef.current = regionsPlugin;
    setIsReady(false);

    setLoadError(false);

    const loadPromise = ws
      .load('', [channelData], duration)
      .then(() => setIsReady(true))
      .catch(() => setLoadError(true));

    return () => {
      wsRef.current = null;
      regionsPluginRef.current = null;
      setIsReady(false);
      // Wait for load to settle before destroying to avoid AbortError from
      // the media element aborting an in-progress load during React StrictMode cleanup.
      loadPromise.then(() => ws.destroy());
    };
  }, [engine.buffer]);

  // Sync regions with phrases using diff to avoid destroying regions mid-drag
  useEffect(() => {
    const rp = regionsPluginRef.current;
    if (!rp || !isReady) return;

    const regionMap = regionByPhraseIdRef.current;
    const phraseIds = new Set(phrases.map(p => p.id));

    // Remove regions whose phrase no longer exists (merged/split)
    for (const [phraseId, region] of regionMap) {
      if (!phraseIds.has(phraseId)) {
        region.remove();
        regionMap.delete(phraseId);
      }
    }

    // Update existing regions or create new ones
    phrases.forEach((phrase, i) => {
      const color = phrase.excluded ? EXCLUDED_COLOR : REGION_COLORS[i % REGION_COLORS.length];
      const existing = regionMap.get(phrase.id);

      if (existing) {
        existing.setOptions({
          start: phrase.startTime,
          end: phrase.endTime,
          color,
          content: `#${i + 1}`,
        });
      } else {
        const region = rp.addRegion({
          id: `phrase-${phrase.id}`,
          start: phrase.startTime,
          end: phrase.endTime,
          color,
          drag: false,
          resize: true,
          content: `#${i + 1}`,
        });
        regionMap.set(phrase.id, region);
      }
    });
  }, [phrases, isReady]);

  // Handle region resize — uses ref to avoid stale closures and resubscription
  useEffect(() => {
    const rp = regionsPluginRef.current;
    if (!rp) return;

    const handler = (region: Region) => {
      const regionId = region.id;
      if (!regionId.startsWith('phrase-')) return;
      const phraseId = Number(regionId.replace('phrase-', ''));
      if (Number.isNaN(phraseId)) return;

      const phrase = phrasesRef.current.find(p => p.id === phraseId);
      if (!phrase) return;

      onPhraseBoundaryChange(phrase.id, region.start, region.end);
    };

    rp.on('region-updated', handler);
    return () => rp.un('region-updated', handler);
  }, [onPhraseBoundaryChange]);

  // Handle region click — resolves phrase index by region ID
  useEffect(() => {
    const rp = regionsPluginRef.current;
    if (!rp || !onRegionClick) return;

    const handler = (region: Region) => {
      const regionId = region.id;
      if (!regionId.startsWith('phrase-')) return;
      const phraseId = Number(regionId.replace('phrase-', ''));
      if (Number.isNaN(phraseId)) return;

      const index = phrasesRef.current.findIndex(p => p.id === phraseId);
      if (index !== -1) onRegionClick(index);
    };

    rp.on('region-clicked', handler);
    return () => rp.un('region-clicked', handler);
  }, [onRegionClick]);

  // Scroll to phrase region
  useEffect(() => {
    if (scrollToPhrase === null) return;
    const phrase = phrases[scrollToPhrase];
    const ws = wsRef.current;
    if (!phrase || !ws) return;
    ws.setScrollTime(phrase.startTime);
  }, [scrollToPhrase, phrases]);

  // Highlight current phrase region
  useEffect(() => {
    if (!isReady) return;
    const regionMap = regionByPhraseIdRef.current;

    phrases.forEach((phrase, i) => {
      const region = regionMap.get(phrase.id);
      if (!region) return;
      const isCurrent = i === currentPhraseIndex;
      const baseColor = phrase.excluded ? EXCLUDED_COLOR : REGION_COLORS[i % REGION_COLORS.length];
      region.setOptions({ color: isCurrent ? '#3b82f680' : baseColor });
    });
  }, [currentPhraseIndex, phrases, isReady]);

  if (loadError) {
    return (
      <div className="mb-4 shrink-0">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load waveform. The audio data could not be rendered.
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 shrink-0">
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <div ref={containerRef} className="bg-white" />
      </div>
    </div>
  );
}
