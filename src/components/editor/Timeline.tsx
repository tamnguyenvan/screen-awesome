import React, {
  useRef, useState, MouseEvent as ReactMouseEvent,
  useEffect, useCallback, useMemo, memo
} from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useEditorStore, useAllRegions } from '../../store/editorStore';
import { TimelineRegion, CutRegion } from '../../types/store';
import { ZoomRegionBlock } from './timeline/ZoomRegionBlock';
import { CutRegionBlock } from './timeline/CutRegionBlock';
import { Playhead } from './timeline/Playhead';
import { cn } from '../../lib/utils';
import { Scissors } from 'lucide-react';
import { TIMELINE } from '../../lib/constants';

const calculateRulerInterval = (duration: number): { major: number; minor: number } => {
  if (duration <= 0) return { major: 1, minor: 0.5 };
  const targetMajorTicks = 10;
  const roughInterval = duration / targetMajorTicks;
  const niceIntervals = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
  const major = niceIntervals.find(i => i >= roughInterval) || niceIntervals[niceIntervals.length - 1];
  const minor = major / (major > 1 ? 5 : 2);
  return { major, minor };
};

// OPTIMIZATION: Memoized Ruler component to prevent re-rendering on every playhead move
const Ruler = memo(({ ticks, timeToPx, formatTime }: {
  ticks: { time: number; type: string }[];
  timeToPx: (time: number) => number;
  formatTime: (seconds: number) => string;
}) => (
  <div className="h-12 sticky overflow-hidden top-0 left-0 right-0 z-10 border-b-2 border-border/60 bg-gradient-to-b from-muted/80 to-muted/40">
    {ticks.map(({ time, type }) => (
      <div
        key={`tick-${time}`}
        className="absolute top-0 flex flex-col items-center"
        style={{ left: `${timeToPx(time)}px`, transform: 'translateX(-50%)' }}
      >
        <div className={cn("bg-foreground/70 transition-all", type === 'major' ? 'w-0.5 h-6' : 'w-px h-3')} />
        {type === 'major' && (
          <span className="text-xs text-foreground/90 font-mono font-medium translate-x-1/2">
            {formatTime(time)}
          </span>
        )}
      </div>
    ))}
  </div>
));
Ruler.displayName = 'Ruler';

const FlipScissorsIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props} >
    <g transform="translate(24,0) scale(-1,1)">
      <circle cx={6} cy={6} r={3} /> <path d="M8.12 8.12 12 12" /> <path d="M20 4 8.12 15.88" /> <circle cx={6} cy={18} r={3} /> <path d="M14.8 14.8 20 20" />
    </g>
  </svg>
);


export function Timeline({ videoRef }: { videoRef: React.RefObject<HTMLVideoElement> }) {
  // Select all state values
  const { currentTime, duration, timelineZoom, previewCutRegion, selectedRegionId, isPlaying } = useEditorStore(
    useShallow(state => ({
      currentTime: state.currentTime,
      duration: state.duration,
      timelineZoom: state.timelineZoom,
      previewCutRegion: state.previewCutRegion,
      selectedRegionId: state.selectedRegionId,
      isPlaying: state.isPlaying
    }))
  );

  // Use specialized hook to subscribe only to region changes
  const { zoomRegions: zoomRegionsMap, cutRegions: cutRegionsMap } = useAllRegions();

  // Convert objects to arrays and memoize them
  const zoomRegions = useMemo(() => Object.values(zoomRegionsMap), [zoomRegionsMap]);

  // Select all actions
  const { addCutRegion, deleteRegion, setPreviewCutRegion, updateRegion, setCurrentTime, setSelectedRegionId } = useEditorStore(
    useShallow(state => ({
      addCutRegion: state.addCutRegion,
      deleteRegion: state.deleteRegion,
      setPreviewCutRegion: state.setPreviewCutRegion,
      updateRegion: state.updateRegion,
      setCurrentTime: state.setCurrentTime,
      setSelectedRegionId: state.setSelectedRegionId
    }))
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const regionRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const animationFrameRef = useRef<number>();
  const isDraggingRegionHiddenRef = useRef(false);

  const [draggingRegion, setDraggingRegion] = useState<{
    id: string;
    type: 'move' | 'resize-left' | 'resize-right';
    initialX: number;
    initialStartTime: number;
    initialDuration: number;
  } | null>(null);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const [isDraggingLeftStrip, setIsDraggingLeftStrip] = useState(false);
  const [isDraggingRightStrip, setIsDraggingRightStrip] = useState(false);

  useEffect(() => {
    if (containerRef.current) setContainerWidth(containerRef.current.clientWidth);
    const observer = new ResizeObserver(entries => entries[0] && setContainerWidth(entries[0].contentRect.width));
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const pixelsPerSecond = useMemo(() => {
    if (duration === 0 || containerWidth === 0) return 200;
    return (containerWidth / duration) * timelineZoom;
  }, [duration, containerWidth, timelineZoom]);

  const timeToPx = useCallback((time: number) => time * pixelsPerSecond, [pixelsPerSecond]);
  const pxToTime = useCallback((px: number) => px / pixelsPerSecond, [pixelsPerSecond]);

  const updateVideoTime = useCallback((time: number) => {
    const clampedTime = Math.max(0, Math.min(time, duration));
    setCurrentTime(clampedTime);
    if (videoRef.current) videoRef.current.currentTime = clampedTime;
  }, [duration, setCurrentTime, videoRef]);

  const handleRegionMouseDown = useCallback((e: ReactMouseEvent<HTMLDivElement>, region: TimelineRegion, type: 'move' | 'resize-left' | 'resize-right') => {
    e.stopPropagation();

    isDraggingRegionHiddenRef.current = false;

    setSelectedRegionId(region.id);

    // Move playhead on any click, even for trim regions
    if (type === 'move' || type === 'resize-left') {
      updateVideoTime(region.startTime);
    } else if (type === 'resize-right') {
      updateVideoTime(region.startTime + region.duration);
    }

    const isTrimRegion = (region as CutRegion).trimType !== undefined;
    if (isTrimRegion && type === 'move') {
      return; // We've moved the playhead, but we prevent dragging the body of a trim region.
    }

    document.body.style.cursor = type === 'move' ? 'grabbing' : 'ew-resize';
    setDraggingRegion({ id: region.id, type, initialX: e.clientX, initialStartTime: region.startTime, initialDuration: region.duration });
  }, [setSelectedRegionId, updateVideoTime]);

  const formatTime = useCallback((seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, []);

  const rulerTicks = useMemo(() => {
    if (duration <= 0) return [];
    const { major, minor } = calculateRulerInterval(duration);
    const ticks = [];
    for (let time = 0; time <= duration; time += major) ticks.push({ time, type: 'major' });
    if (timeToPx(minor) > 20) {
      for (let time = 0; time <= duration; time += minor) {
        if (time % major !== 0) ticks.push({ time, type: 'minor' });
      }
    }
    return ticks;
  }, [duration, timeToPx]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingPlayhead && timelineRef.current) {
        const rect = timelineRef.current.getBoundingClientRect();
        updateVideoTime(pxToTime(e.clientX - rect.left));
        return;
      }

      if (draggingRegion) {
        const element = regionRefs.current.get(draggingRegion.id);
        if (!element) return;
        const deltaTime = pxToTime(e.clientX - draggingRegion.initialX);

        if (draggingRegion.type === 'move') {
          const maxStartTime = duration - draggingRegion.initialDuration;
          const intendedStartTime = draggingRegion.initialStartTime + deltaTime;
          const newStartTime = Math.max(0, Math.min(intendedStartTime, maxStartTime));

          updateVideoTime(newStartTime);
          element.style.transform = `translateX(${timeToPx(newStartTime - draggingRegion.initialStartTime)}px)`;
        } else if (draggingRegion.type === 'resize-right') {
          const maxDuration = duration - draggingRegion.initialStartTime;
          const intendedDuration = draggingRegion.initialDuration + deltaTime;

          if (intendedDuration < TIMELINE.REGION_DELETE_THRESHOLD) {
            element.style.display = 'none';
            isDraggingRegionHiddenRef.current = true;
            updateVideoTime(draggingRegion.initialStartTime);
          } else {
            const newDuration = Math.min(intendedDuration, maxDuration);
            element.style.display = 'block';
            isDraggingRegionHiddenRef.current = false;
            element.style.width = `${timeToPx(newDuration)}px`;
            updateVideoTime(draggingRegion.initialStartTime + newDuration);
          }
        } else if (draggingRegion.type === 'resize-left') {
          const initialEndTime = draggingRegion.initialStartTime + draggingRegion.initialDuration;
          const tentativeStartTime = Math.max(0, Math.min(draggingRegion.initialStartTime + deltaTime, initialEndTime));
          const newDuration = initialEndTime - tentativeStartTime;

          if (newDuration < TIMELINE.REGION_DELETE_THRESHOLD) {
            element.style.display = 'none';
            isDraggingRegionHiddenRef.current = true;
            updateVideoTime(initialEndTime);
          } else {
            const newStartTime = tentativeStartTime;
            element.style.display = 'block';
            isDraggingRegionHiddenRef.current = false;
            element.style.width = `${timeToPx(newDuration)}px`;
            element.style.transform = `translateX(${timeToPx(newStartTime - draggingRegion.initialStartTime)}px)`;
            updateVideoTime(newStartTime);
          }
        }
      }

      if ((isDraggingLeftStrip || isDraggingRightStrip) && timelineRef.current) {
        document.body.style.cursor = 'grabbing';
        const rect = timelineRef.current.getBoundingClientRect();
        const timeAtMouse = pxToTime(Math.max(0, e.clientX - rect.left));
        let newPreview: CutRegion | null = null;
        const currentDuration = useEditorStore.getState().duration;

        if (isDraggingLeftStrip) {
          const duration = Math.min(timeAtMouse, currentDuration);
          newPreview = {
            id: 'preview-cut-left', type: 'cut', startTime: 0, duration,
            trimType: 'start', zIndex: 0
          };
        } else {
          const startTime = Math.max(0, timeAtMouse);
          const duration = currentDuration - startTime;
          newPreview = {
            id: 'preview-cut-right', type: 'cut', startTime, duration,
            trimType: 'end', zIndex: 0
          };
        }
        setPreviewCutRegion(newPreview.duration >= TIMELINE.MINIMUM_REGION_DURATION ? newPreview : null);
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      document.body.style.cursor = 'default';
      setIsDraggingPlayhead(false);

      if (draggingRegion) {
        const element = regionRefs.current.get(draggingRegion.id);
        if (element) {
          element.style.transform = 'translateX(0px)';
          element.style.width = '';
          element.style.display = 'block';
        }

        if (isDraggingRegionHiddenRef.current) {
          deleteRegion(draggingRegion.id);
        } else {
          const deltaTime = pxToTime(e.clientX - draggingRegion.initialX);
          const finalUpdates: Partial<TimelineRegion> = {};

          if (draggingRegion.type === 'move') {
            const maxStartTime = duration - draggingRegion.initialDuration;
            const intendedStartTime = draggingRegion.initialStartTime + deltaTime;
            finalUpdates.startTime = Math.max(0, Math.min(intendedStartTime, maxStartTime));
            finalUpdates.duration = draggingRegion.initialDuration;
          } else if (draggingRegion.type === 'resize-right') {
            finalUpdates.startTime = draggingRegion.initialStartTime;
            const intendedDuration = draggingRegion.initialDuration + deltaTime;
            const maxDuration = duration - draggingRegion.initialStartTime;
            finalUpdates.duration = Math.max(TIMELINE.MINIMUM_REGION_DURATION, Math.min(intendedDuration, maxDuration));
          } else {
            const initialEndTime = draggingRegion.initialStartTime + draggingRegion.initialDuration;
            const newStartTime = Math.min(
              initialEndTime - TIMELINE.MINIMUM_REGION_DURATION,
              Math.max(0, draggingRegion.initialStartTime + deltaTime)
            );
            finalUpdates.duration = initialEndTime - newStartTime;
            finalUpdates.startTime = newStartTime;
          }

          if (finalUpdates.duration! < TIMELINE.REGION_DELETE_THRESHOLD) {
            deleteRegion(draggingRegion.id);
          } else {
            updateRegion(draggingRegion.id, finalUpdates);
          }
        }

        if (videoRef.current && !isDraggingRegionHiddenRef.current) {
          setCurrentTime(videoRef.current.currentTime);
        }

        setDraggingRegion(null);
        isDraggingRegionHiddenRef.current = false;
      }

      if (isDraggingLeftStrip || isDraggingRightStrip) {
        const finalPreview = useEditorStore.getState().previewCutRegion;
        const trimType = isDraggingLeftStrip ? 'start' : 'end';

        if (finalPreview) {
          addCutRegion({
            startTime: finalPreview.startTime,
            duration: finalPreview.duration,
            trimType
          });
        }
      }

      setIsDraggingLeftStrip(false);
      setIsDraggingRightStrip(false);
      setPreviewCutRegion(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [
    draggingRegion, isDraggingPlayhead, isDraggingLeftStrip, isDraggingRightStrip,
    pxToTime, timeToPx, updateVideoTime, updateRegion, addCutRegion,
    setPreviewCutRegion, deleteRegion, setCurrentTime, videoRef, duration
  ]);

  useEffect(() => {
    const animate = () => {
      if (videoRef.current && playheadRef.current) {
        const videoTime = videoRef.current.currentTime;
        playheadRef.current.style.transform = `translateX(${timeToPx(videoTime)}px)`;
      }
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(animate);
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, timeToPx, videoRef]);

  useEffect(() => {
    if (!isPlaying && playheadRef.current) {
      playheadRef.current.style.transform = `translateX(${timeToPx(currentTime)}px)`;
    }
  }, [currentTime, isPlaying, timeToPx]);

  const allCutRegionsToRender = useMemo(() => {
    const existingCuts = Object.values(cutRegionsMap);
    if (previewCutRegion && !existingCuts.some(c => c.trimType === previewCutRegion.trimType)) {
      return [...existingCuts, previewCutRegion];
    }
    return existingCuts;
  }, [cutRegionsMap, previewCutRegion]);

  return (
    <div className="h-full flex flex-col bg-background p-4">
      <div className="h-full flex flex-row rounded-xl overflow-hidden shadow-sm bg-card border border-border/80">
        {/* Left trim handle */}
        <div className="w-8 shrink-0 h-full bg-card flex items-center justify-center transition-colors cursor-ew-resize select-none border-r border-border/80 hover:bg-accent/50"
          onMouseDown={() => {
            const state = useEditorStore.getState();
            const existingLeftTrim = Object.values(state.cutRegions).find(r => r.trimType === 'start');
            if (existingLeftTrim) {
              state.deleteRegion(existingLeftTrim.id);
            }

            setIsDraggingLeftStrip(true)
          }}>
          <Scissors size={16} className="text-muted-foreground" />
        </div>

        {/* Main timeline area */}
        <div
          ref={containerRef}
          className="flex-1 overflow-x-auto overflow-y-hidden bg-card/50"
          onMouseDown={e => {
            if (duration === 0) return;
            const target = e.target as HTMLElement;
            if (target.closest('[data-region-id]')) {
              return;
            }

            const scrollableContainer = e.currentTarget as HTMLDivElement;
            const rect = scrollableContainer.getBoundingClientRect();
            const clickX = e.clientX - rect.left + scrollableContainer.scrollLeft;
            updateVideoTime(pxToTime(clickX));
            setSelectedRegionId(null);
          }}>
          <div ref={timelineRef} className="relative h-full min-w-full overflow-hidden" style={{ width: `${timeToPx(duration)}px` }}>
            <Ruler ticks={rulerTicks} timeToPx={timeToPx} formatTime={formatTime} />

            {/* Layer 2: Cut Regions (Full height overlays) */}
            <div className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none">
              {allCutRegionsToRender.map(region => {
                // ... logic tính toán z-index không đổi ...
                let z;
                if (selectedRegionId === region.id) {
                  z = 100;
                } else if (region.trimType) {
                  z = 5;
                } else {
                  z = region.zIndex ?? 10;
                }

                return (
                  <div
                    key={region.id}
                    className="absolute top-0 h-full pointer-events-auto"
                    style={{ left: `${timeToPx(region.startTime)}px`, width: `${timeToPx(region.duration)}px`, zIndex: z }}
                  >
                    <CutRegionBlock
                      region={region}
                      isSelected={selectedRegionId === region.id}
                      isDraggable={region.id !== previewCutRegion?.id}
                      isBeingDragged={draggingRegion?.id === region.id}
                      onMouseDown={handleRegionMouseDown}
                      setRef={el => regionRefs.current.set(region.id, el)}
                    />
                  </div>
                );
              })}
            </div>

            {/* Layer 3: Zoom Region Tracks */}
            <div className="relative pt-6 space-y-4">
              <div className="h-24 relative bg-gradient-to-b from-background/50 to-background/20">
                {zoomRegions.map(region => {
                  const z = selectedRegionId === region.id ? 100 : (region.zIndex ?? 10);

                  return (
                    <div
                      key={region.id}
                      className="absolute h-14"
                      style={{ left: `${timeToPx(region.startTime)}px`, width: `${timeToPx(region.duration)}px`, zIndex: z }}
                    >
                      <ZoomRegionBlock
                        region={region}
                        isSelected={selectedRegionId === region.id}
                        isBeingDragged={draggingRegion?.id === region.id}
                        onMouseDown={handleRegionMouseDown}
                        setRef={el => regionRefs.current.set(region.id, el)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Layer 4: Playhead (Always on top) */}
            {duration > 0 &&
              <div ref={playheadRef} className="absolute top-0 bottom-0 z-[200]" style={{ transform: `translateX(${timeToPx(currentTime)}px)`, pointerEvents: "none" }}>
                <Playhead height={Math.floor((timelineRef.current?.clientHeight ?? 200) * 0.9)} isDragging={isDraggingPlayhead} onMouseDown={(e) => { e.stopPropagation(); setIsDraggingPlayhead(true); document.body.style.cursor = 'grabbing'; }} />
              </div>
            }
          </div>
        </div>

        {/* Right trim handle */}
        <div className="w-8 shrink-0 h-full bg-card flex items-center justify-center transition-colors cursor-ew-resize select-none border-l border-border/80 hover:bg-accent/50"
          onMouseDown={() => {
            const state = useEditorStore.getState();
            const existingRightTrim = Object.values(state.cutRegions).find(r => r.trimType === 'end');
            if (existingRightTrim) {
              state.deleteRegion(existingRightTrim.id);
            }
            setIsDraggingRightStrip(true);
          }}>
          <FlipScissorsIcon className="text-muted-foreground size-4" />
        </div>
      </div>
    </div>
  );
}