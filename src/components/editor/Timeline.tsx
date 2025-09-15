// src/components/editor/Timeline.tsx
import React, { useRef, useState, MouseEvent as ReactMouseEvent, useEffect, useCallback, memo } from 'react';
import { useEditorStore, TimelineRegion, ZoomRegion } from '../../store/editorStore';
import { cn } from '../../lib/utils';
import { Film, Scissors } from 'lucide-react';

interface TimelineProps {
  videoRef: React.RefObject<HTMLVideoElement>;
}

interface RegionBlockProps {
  region: TimelineRegion;
  left: number;
  width: number;
  isSelected: boolean;
  onMouseDown: (e: ReactMouseEvent<HTMLDivElement>, region: TimelineRegion, type: 'move' | 'resize-left' | 'resize-right') => void;
  setRef: (el: HTMLDivElement | null) => void;
}

const PIXELS_PER_SECOND_BASE = 200;

const RegionBlock = memo(function RegionBlock({ region, left, width, isSelected, onMouseDown, setRef }: RegionBlockProps) {
  const isZoom = region.type === 'zoom';

  const baseBgColor = isZoom ? 'bg-primary' : 'bg-destructive';
  const baseTextColor = isZoom ? 'text-primary-foreground' : 'text-destructive-foreground';

  const handleBaseClasses = "absolute top-0 bottom-0 w-2.5 cursor-ew-resize flex items-center justify-center";
  const handleInnerClasses = "w-px h-3.5 bg-current opacity-50 rounded-full";

  return (
    <div
      ref={setRef}
      data-region-id={region.id}
      className={cn(
        "absolute h-14 rounded-lg flex items-center text-xs font-medium cursor-pointer transition-shadow duration-200",
        baseBgColor,
        baseTextColor,
        isSelected ? "ring-2 ring-offset-2 ring-offset-background ring-ring z-10 shadow-md" : "hover:shadow-sm"
      )}
      style={{ left: `${left}px`, width: `${width}px` }}
      onMouseDown={(e) => onMouseDown(e, region, 'move')}
    >
      <div className="flex items-center gap-2 overflow-hidden px-3">
        {isZoom ? <Film size={14} className="flex-shrink-0" /> : <Scissors size={14} className="flex-shrink-0" />}
        <span className="truncate">
          {isZoom ? `${(region as ZoomRegion).zoomLevel.toFixed(1)}x Zoom` : 'Cut'}
        </span>
      </div>

      {/* Resize handles */}
      <div
        className={cn(handleBaseClasses, "left-0 rounded-l-lg")}
        onMouseDown={(e) => onMouseDown(e, region, 'resize-left')}
      >
        <div className={handleInnerClasses} />
      </div>
      <div
        className={cn(handleBaseClasses, "right-0 rounded-r-lg")}
        onMouseDown={(e) => onMouseDown(e, region, 'resize-right')}
      >
        <div className={handleInnerClasses} />
      </div>
    </div>
  );
});

export function Timeline({ videoRef }: TimelineProps) {
  const store = useEditorStore();
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

  useEffect(() => {
    if (containerRef.current) setContainerWidth(containerRef.current.clientWidth);
    const observer = new ResizeObserver(entries => entries[0] && setContainerWidth(entries[0].contentRect.width));
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const pixelsPerSecond = PIXELS_PER_SECOND_BASE * store.timelineZoom;
  const timeToPx = useCallback((time: number) => time * pixelsPerSecond, [pixelsPerSecond]);
  const pxToTime = useCallback((px: number) => px / pixelsPerSecond, [pixelsPerSecond]);

  const handleTimelineClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (draggingRegion || isDraggingPlayhead || !timelineRef.current || store.duration === 0) return;
    if ((e.target as HTMLElement).closest('[data-region-id]') || (e.target as HTMLElement).closest('[data-playhead-handle]')) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const newTime = pxToTime(e.clientX - rect.left);
    store.setCurrentTime(newTime);
    if (videoRef.current) videoRef.current.currentTime = newTime;
    store.setSelectedRegionId(null);
  };

  const handleRegionMouseDown = useCallback((e: ReactMouseEvent<HTMLDivElement>, region: TimelineRegion, type: 'move' | 'resize-left' | 'resize-right') => {
    e.stopPropagation();
    store.setSelectedRegionId(region.id);
    document.body.style.cursor = type === 'move' ? 'grabbing' : 'ew-resize';
    setDraggingRegion({
      id: region.id, type,
      initialX: e.clientX, initialStartTime: region.startTime, initialDuration: region.duration
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.setSelectedRegionId]);

  const handlePlayheadMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setIsDraggingPlayhead(true);
    document.body.style.cursor = 'grabbing';
  };

  useEffect(() => {
    // --- LOGIC DOM MANIPULATION GIỮ NGUYÊN ---
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingPlayhead && timelineRef.current) {
        const rect = timelineRef.current.getBoundingClientRect();
        let newTime = pxToTime(e.clientX - rect.left);
        newTime = Math.max(0, Math.min(newTime, store.duration));
        store.setCurrentTime(newTime);
        if (videoRef.current) videoRef.current.currentTime = newTime;
        return;
      }

      if (draggingRegion) {
        const element = regionRefs.current.get(draggingRegion.id);
        if (!element) return;

        const deltaX = e.clientX - draggingRegion.initialX;

        if (draggingRegion.type === 'move') {
          element.style.transform = `translateX(${deltaX}px)`;
        } else if (draggingRegion.type === 'resize-right') {
          const newWidth = timeToPx(draggingRegion.initialDuration) + deltaX;
          element.style.width = `${Math.max(timeToPx(0.2), newWidth)}px`;
        } else if (draggingRegion.type === 'resize-left') {
          const initialWidthPx = timeToPx(draggingRegion.initialDuration);
          const newWidth = Math.max(timeToPx(0.2), initialWidthPx - deltaX);
          const newTranslateX = Math.min(deltaX, initialWidthPx - timeToPx(0.2));

          element.style.transform = `translateX(${newTranslateX}px)`;
          element.style.width = `${newWidth}px`;
        }
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      document.body.style.cursor = 'default';

      if (isDraggingPlayhead) setIsDraggingPlayhead(false);

      if (draggingRegion) {
        const element = regionRefs.current.get(draggingRegion.id);
        if (element) element.style.transform = 'translateX(0px)';

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

        store.updateRegion(draggingRegion.id, finalUpdates);
        setDraggingRegion(null);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingRegion, isDraggingPlayhead, store, videoRef, pxToTime, timeToPx]);

  useEffect(() => {
    let animationFrameId: number;
    const animatePlayhead = () => {
      if (videoRef.current && playheadRef.current) {
        playheadRef.current.style.transform = `translateX(${timeToPx(videoRef.current.currentTime)}px)`;
      }
      animationFrameId = requestAnimationFrame(animatePlayhead);
    };
    if (store.isPlaying) animationFrameId = requestAnimationFrame(animatePlayhead);
    return () => cancelAnimationFrame(animationFrameId);
  }, [store.isPlaying, videoRef, timeToPx]);

  useEffect(() => {
    if (!store.isPlaying && playheadRef.current && store.duration > 0) {
      playheadRef.current.style.transform = `translateX(${timeToPx(store.currentTime)}px)`;
    }
  }, [store.currentTime, store.isPlaying, store.duration, timeToPx]);

  const totalWidthPx = (store.duration * pixelsPerSecond) + (containerWidth / 2);
  const allRegions = [...store.zoomRegions, ...store.cutRegions];

  return (
    // --- GIAO DIỆN CÂN BẰNG ---
    <div className="h-full flex flex-col bg-background">
      <div
        ref={containerRef}
        className="flex-1 overflow-x-auto overflow-y-hidden p-4"
        onMouseDown={handleTimelineClick}
      >
        <div
          ref={timelineRef}
          className="relative h-full min-w-full"
          style={{ width: `${totalWidthPx}px` }}
        >
          {/* Ruler */}
          <div className="h-8 absolute top-0 left-0 right-0 border-b border-border/50">
            {store.duration > 0 && Array.from({ length: Math.floor(store.duration) + 1 }).map((_, sec) => {
              const shouldShow = pixelsPerSecond > 20 || (sec % 5 === 0 && pixelsPerSecond > 5) || (sec % 10 === 0);
              if (shouldShow) {
                return (
                  <div key={sec} className="absolute flex flex-col items-center" style={{ left: `${timeToPx(sec)}px` }}>
                    <div className="w-px h-2.5 bg-border/80"></div>
                    <span className="text-xs text-muted-foreground font-mono mt-1">{sec}s</span>
                  </div>
                );
              }
              return null;
            })}
          </div>

          {/* Tracks Area */}
          <div className="absolute top-8 left-0 right-0 bottom-0 pt-4 space-y-3">
            {/* Regions Track */}
            <div className="h-24 relative" style={{ width: `${store.duration * pixelsPerSecond}px` }}>
              {allRegions.map(region => (
                <RegionBlock
                  key={region.id}
                  region={region}
                  left={timeToPx(region.startTime)}
                  width={timeToPx(region.duration)}
                  isSelected={store.selectedRegionId === region.id}
                  onMouseDown={handleRegionMouseDown}
                  setRef={(el) => regionRefs.current.set(region.id, el)}
                />
              ))}
            </div>
          </div>

          {/* Playhead */}
          {store.duration > 0 && (
            <div ref={playheadRef} className="absolute top-0 bottom-0 z-30 pointer-events-none">
              <div className="w-0.5 h-full bg-primary shadow-sm"></div>
              <div
                data-playhead-handle
                className={cn("absolute -top-1 w-5 h-5 rounded-full bg-primary border-2 border-background shadow-lg pointer-events-auto transition-transform duration-200 hover:scale-110", isDraggingPlayhead ? "cursor-grabbing scale-110" : "cursor-grab")}
                style={{ transform: 'translateX(-50%)' }}
                onMouseDown={handlePlayheadMouseDown}
              >
                <div className="absolute inset-1 rounded-full bg-background opacity-20"></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}