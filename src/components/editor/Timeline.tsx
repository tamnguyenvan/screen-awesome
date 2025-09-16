// src/components/editor/Timeline.tsx
import React, {
  useRef, useState, MouseEvent as ReactMouseEvent,
  useEffect, useCallback, useMemo
} from 'react';
import { useEditorStore, TimelineRegion } from '../../store/editorStore';
import { ZoomRegionBlock } from './timeline/ZooomRegionBlock';
import { CutRegionBlock } from './timeline/CutRegionBlock';
import { Playhead } from './timeline/Playhead';

import { cn } from '../../lib/utils';
import { Scissors } from 'lucide-react';

interface TimelineProps {
  videoRef: React.RefObject<HTMLVideoElement>;
}
// Hàm mới: Tính toán khoảng cách vạch chia thước đo thông minh
const calculateRulerInterval = (duration: number): { major: number; minor: number } => {
  if (duration <= 0) return { major: 1, minor: 0.5 };

  const targetMajorTicks = 10; // Số lượng vạch chính mong muốn
  const roughInterval = duration / targetMajorTicks;

  // Các khoảng "đẹp": 0.1s, 0.5s, 1s, 2s, 5s, 10s, 15s, 30s, 1m, 2m, 5m...
  const niceIntervals = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];

  const major = niceIntervals.find(i => i >= roughInterval) || niceIntervals[niceIntervals.length - 1];
  const minor = major / (major > 1 ? 5 : 2); // Chia nhỏ hơn cho các khoảng lớn

  return { major, minor };
};

export function Timeline({ videoRef }: TimelineProps) {
  const {
    isPlaying,
    currentTime,
    duration,
    timelineZoom,
    zoomRegions,
    cutRegions,
    selectedRegionId,
    addCutRegionFromStrip,
    updateRegion,
    setCurrentTime,
    setSelectedRegionId,
  } = useEditorStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);

  const regionRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

  const [draggingRegion, setDraggingRegion] = useState<{
    id: string; type: 'move' | 'resize-left' | 'resize-right';
    initialX: number; initialStartTime: number; initialDuration: number;
  } | null>(null);

  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);

  // Add these states to the component (before the return statement):
  const [isDraggingLeftStrip, setIsDraggingLeftStrip] = useState(false);
  const [isDraggingRightStrip, setIsDraggingRightStrip] = useState(false);

  const handleLeftStripDrag = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setIsDraggingLeftStrip(true);
    document.body.style.cursor = 'grab';
  }, []);

  const handleRightStripDrag = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setIsDraggingRightStrip(true);
    document.body.style.cursor = 'grab';
  }, []);

  useEffect(() => {
    if (containerRef.current) setContainerWidth(containerRef.current.clientWidth);
    const observer = new ResizeObserver(entries => entries[0] && setContainerWidth(entries[0].contentRect.width));
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // --- LOGIC TÍNH TOÁN PIXEL MỚI ---
  const pixelsPerSecond = useMemo(() => {
    if (duration === 0 || containerWidth === 0) {
      return 200; // Giá trị mặc định khi chưa có video
    }
    // Ở 1x, timeline vừa khít container. Các mức zoom khác sẽ nhân lên.
    const basePps = containerWidth / duration;
    return basePps * timelineZoom;
  }, [duration, containerWidth, timelineZoom]);

  const timeToPx = useCallback((time: number) => time * pixelsPerSecond, [pixelsPerSecond]);
  const pxToTime = useCallback((px: number) => px / pixelsPerSecond, [pixelsPerSecond]);

  const totalWidthPx = duration * pixelsPerSecond;

  // --- END LOGIC MỚI ---

  // CHANGE START: Helper function to update video time cleanly
  const updateVideoTime = useCallback((time: number) => {
    const clampedTime = Math.max(0, Math.min(time, duration));
    setCurrentTime(clampedTime);
    if (videoRef.current) {
      videoRef.current.currentTime = clampedTime;
    }
  }, [duration, setCurrentTime, videoRef]);
  // CHANGE END

  const handleTimelineClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (draggingRegion || isDraggingPlayhead || !timelineRef.current || duration === 0) return;
    if ((e.target as HTMLElement).closest('[data-region-id]') || (e.target as HTMLElement).closest('[data-playhead-handle]')) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const newTime = pxToTime(e.clientX - rect.left);
    updateVideoTime(newTime); // Use helper
    setSelectedRegionId(null);
  };

  const handleRegionMouseDown = useCallback((e: ReactMouseEvent<HTMLDivElement>, region: TimelineRegion, type: 'move' | 'resize-left' | 'resize-right') => {
    e.stopPropagation();
    setSelectedRegionId(region.id);

    // CHANGE START: Set playhead on initial click
    // When resizing left, it feels better to snap to the left edge
    // When resizing right, it feels better to snap to the right edge
    if (type === 'move' || type === 'resize-left') {
      updateVideoTime(region.startTime);
    } else if (type === 'resize-right') {
      updateVideoTime(region.startTime + region.duration);
    }
    // CHANGE END

    document.body.style.cursor = type === 'move' ? 'grabbing' : 'ew-resize';
    setDraggingRegion({
      id: region.id, type,
      initialX: e.clientX, initialStartTime: region.startTime, initialDuration: region.duration
    });
  }, [setSelectedRegionId, updateVideoTime]); // Add updateVideoTime to dependencies

  const handlePlayheadMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setIsDraggingPlayhead(true);
    document.body.style.cursor = 'grabbing';
  };

  // Memoize ruler ticks for performance
  const rulerTicks = useMemo(() => {
    if (duration <= 0) return [];

    const interval = calculateRulerInterval(duration);
    const ticks = [];

    for (let time = 0; time <= duration; time += interval.major) {
      ticks.push({ time, type: 'major' });
    }

    // Add minor ticks if there's enough space
    if (timeToPx(interval.minor) > 20) {
      for (let time = 0; time <= duration; time += interval.minor) {
        if (time % interval.major !== 0) {
          ticks.push({ time, type: 'minor' });
        }
      }
    }
    return ticks;
  }, [duration, timeToPx]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingPlayhead && timelineRef.current) {
        const rect = timelineRef.current.getBoundingClientRect();
        const newTime = pxToTime(e.clientX - rect.left);
        updateVideoTime(newTime); // Use helper
        return;
      }

      if (draggingRegion) {
        const element = regionRefs.current.get(draggingRegion.id);
        if (!element) return;
        const deltaX = e.clientX - draggingRegion.initialX;

        // CHANGE START: Update playhead while dragging/resizing
        const deltaTime = pxToTime(deltaX);

        if (draggingRegion.type === 'move') {
          const newStartTime = draggingRegion.initialStartTime + deltaTime;
          updateVideoTime(newStartTime);
          element.style.transform = `translateX(${deltaX}px)`;

        } else if (draggingRegion.type === 'resize-right') {
          const newDuration = Math.max(0.2, draggingRegion.initialDuration + deltaTime);
          const newEndTime = draggingRegion.initialStartTime + newDuration;
          updateVideoTime(newEndTime);
          const newWidth = timeToPx(newDuration);
          element.style.width = `${newWidth}px`;

        } else if (draggingRegion.type === 'resize-left') {
          const newStartTime = Math.min(
            draggingRegion.initialStartTime + draggingRegion.initialDuration - 0.2,
            draggingRegion.initialStartTime + deltaTime
          );
          updateVideoTime(newStartTime);

          const initialWidthPx = timeToPx(draggingRegion.initialDuration);
          const newWidth = Math.max(timeToPx(0.2), initialWidthPx - deltaX);
          const newTranslateX = Math.min(deltaX, initialWidthPx - timeToPx(0.2));
          element.style.transform = `translateX(${newTranslateX}px)`;
          element.style.width = `${newWidth}px`;
        }
        // CHANGE END
      }

      if (isDraggingLeftStrip && timelineRef.current) {
        // Visual feedback while dragging from left strip
        document.body.style.cursor = 'grabbing';
      }

      if (isDraggingRightStrip && timelineRef.current) {
        // Visual feedback while dragging from right strip
        document.body.style.cursor = 'grabbing';
      }
    };
    const handleMouseUp = (e: MouseEvent) => {
      document.body.style.cursor = 'default';
      if (isDraggingPlayhead) setIsDraggingPlayhead(false);
      if (draggingRegion) {
        const element = regionRefs.current.get(draggingRegion.id);
        if (element) {
          // Reset visual transform after drag, the position is now controlled by state
          element.style.transform = 'translateX(0px)';
        }

        const deltaX = e.clientX - draggingRegion.initialX;
        const deltaTime = pxToTime(deltaX);
        const finalUpdates: Partial<TimelineRegion> = {};

        if (draggingRegion.type === 'move') {
          finalUpdates.startTime = Math.max(0, draggingRegion.initialStartTime + deltaTime);
        } else if (draggingRegion.type === 'resize-right') {
          finalUpdates.duration = Math.max(0.2, draggingRegion.initialDuration + deltaTime);
        } else if (draggingRegion.type === 'resize-left') {
          const newStartTime = Math.min(
            draggingRegion.initialStartTime + draggingRegion.initialDuration - 0.2,
            Math.max(0, draggingRegion.initialStartTime + deltaTime)
          );
          finalUpdates.duration = (draggingRegion.initialStartTime + draggingRegion.initialDuration) - newStartTime;
          finalUpdates.startTime = newStartTime;
        }
        updateRegion(draggingRegion.id, finalUpdates);
        setDraggingRegion(null);
      }

      if (isDraggingLeftStrip && timelineRef.current) {
        const rect = timelineRef.current.getBoundingClientRect();
        const dropTime = pxToTime(e.clientX - rect.left);
        if (dropTime > 0 && dropTime < duration) {
          // Add cut region from left strip position to drop position
          // const newCutRegion = {
          //   id: `cut-${Date.now()}`,
          //   type: 'cut' as const,
          //   startTime: 0,
          //   duration: Math.min(dropTime, duration),
          // };
          addCutRegionFromStrip();
        }
        setIsDraggingLeftStrip(false);
      }

      if (isDraggingRightStrip && timelineRef.current) {
        const rect = timelineRef.current.getBoundingClientRect();
        const dropTime = pxToTime(e.clientX - rect.left);
        if (dropTime > 0 && dropTime < duration) {
          // Add cut region from drop position to end
          // const newCutRegion = {
          //   id: `cut-${Date.now()}`,
          //   type: 'cut' as const,
          //   startTime: dropTime,
          //   duration: duration - dropTime,
          // };
          addCutRegionFromStrip();
        }
        setIsDraggingRightStrip(false);
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draggingRegion, isDraggingPlayhead, isDraggingLeftStrip, isDraggingRightStrip,
    pxToTime, timeToPx, updateVideoTime, updateRegion, duration]);

  useEffect(() => {
    let animationFrameId: number;
    const animatePlayhead = () => {
      if (videoRef.current && playheadRef.current) {
        playheadRef.current.style.transform = `translateX(${timeToPx(videoRef.current.currentTime)}px)`;
      }
      animationFrameId = requestAnimationFrame(animatePlayhead);
    };
    if (isPlaying) animationFrameId = requestAnimationFrame(animatePlayhead);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, videoRef, timeToPx]);

  useEffect(() => {
    if (!isPlaying && playheadRef.current && duration > 0) {
      playheadRef.current.style.transform = `translateX(${timeToPx(currentTime)}px)`;
    }
  }, [currentTime, isPlaying, duration, timeToPx]);

  const allRegions = [...zoomRegions, ...cutRegions];

  return (
    <div className="h-full flex flex-col bg-background p-4">
      <div className="h-full flex flex-row rounded-lg overflow-hidden shadow-sm">
        {/* Left Strip */}
        <div
          className={cn(
            "w-12 h-full rounded-l-lg bg-card border border-border/80 flex items-center justify-center transition-all duration-150 cursor-grab select-none cursor-ew-resize",
            isDraggingLeftStrip ? "bg-primary/10 border-primary/40 cursor-grabbing scale-105" : "hover:bg-accent/50 hover:border-accent-foreground/20"
          )}
          onMouseDown={handleLeftStripDrag}
        >
          <div className="flex flex-col items-center gap-1">
            <Scissors size={20} className="text-muted-foreground" />
          </div>
        </div>

        <div
          ref={containerRef}
          className="flex-1 overflow-x-auto overflow-y-hidden border-y border-border/80 bg-card/50"
          onMouseDown={handleTimelineClick}
        >
          <div
            ref={timelineRef}
            className="relative h-full min-w-full"
            style={{ width: `${totalWidthPx}px` }}
          >
            {/* Ruler */}
            <div className="h-12 absolute top-0 left-0 right-0 border-b-2 border-border/60 bg-gradient-to-b from-muted/80 to-muted/40">
              {rulerTicks.map(({ time, type }) => (
                <div
                  key={`tick-${time}`}
                  className="absolute top-0 flex flex-col items-center group"
                  style={{ left: `${timeToPx(time)}px` }}
                >
                  {/* tick marks */}
                  <div className={cn(
                    "bg-foreground/70 transition-all duration-150",
                    type === 'major'
                      ? 'w-0.5 h-6 shadow-sm group-hover:bg-primary group-hover:h-7'
                      : 'w-px h-3 group-hover:bg-foreground group-hover:h-4'
                  )}></div>

                  {/* time labels */}
                  {type === 'major' && (
                    <div className="translate-x-1/2 -ml-0.5">
                      <span className="text-xs text-foreground/90 font-mono font-medium tracking-wide">
                        {time >= 60 ? `${Math.floor(time / 60)}:${String(time % 60).padStart(2, '0')}` : `${time}s`}
                      </span>
                    </div>
                  )}
                </div>
              ))}

              {/* Ruler background pattern */}
              <div className="absolute inset-0 opacity-5">
                <div className="w-full h-full bg-gradient-to-r from-transparent via-foreground/10 to-transparent"></div>
              </div>
            </div>

            {/* Tracks Area */}
            <div className="absolute top-12 left-0 right-0 bottom-0 pt-6 space-y-4">
              <div className="h-24 relative bg-gradient-to-b from-background/50 to-background/20">
                {allRegions.map(region => (
                  region.type === 'zoom' ?
                    <ZoomRegionBlock
                      key={region.id}
                      region={region}
                      left={timeToPx(region.startTime)}
                      width={timeToPx(region.duration)}
                      isSelected={selectedRegionId === region.id}
                      onMouseDown={handleRegionMouseDown}
                      setRef={(el) => regionRefs.current.set(region.id, el)}
                    />
                    :
                    <CutRegionBlock
                      key={region.id}
                      region={region}
                      left={timeToPx(region.startTime)}
                      width={timeToPx(region.duration)}
                      isSelected={selectedRegionId === region.id}
                      onMouseDown={handleRegionMouseDown}
                      setRef={(el) => regionRefs.current.set(region.id, el)}
                    />
                ))}
              </div>
            </div>

            {/* Playhead */}
            {duration > 0 && (
              <div
                ref={playheadRef}
                className="absolute top-0 bottom-0 z-30"
                style={{ pointerEvents: "none" }}
              >
                <Playhead
                  height={timelineRef.current?.clientHeight ?? 200}
                  isDragging={isDraggingPlayhead}
                  onMouseDown={handlePlayheadMouseDown}
                />
              </div>
            )}

            {/* Drag indicators when dragging from strips */}
            {(isDraggingLeftStrip || isDraggingRightStrip) && (
              <div className="absolute inset-0 pointer-events-none z-20">
                <div className="w-full h-full border-2 border-dashed border-primary/50 bg-primary/5 rounded-lg animate-pulse">
                  <div className="absolute inset-4 border border-dashed border-primary/30 rounded"></div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Strip */}
        <div
          className={cn(
            "w-12 h-full rounded-r-lg bg-card border border-border/80 flex items-center justify-center transition-all duration-150 cursor-grab select-none cursor-ew-resize",
            isDraggingRightStrip ? "bg-primary/10 border-primary/40 cursor-grabbing scale-105" : "hover:bg-accent/50 hover:border-accent-foreground/20"
          )}
          onMouseDown={handleRightStripDrag}
        >
          <div className="flex flex-col items-center gap-1">
            <Scissors size={20} className="text-muted-foreground" />
          </div>
        </div>
      </div>
    </div>
  );
}