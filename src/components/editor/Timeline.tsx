// src/components/editor/Timeline.tsx
import React, {
  useRef, useState, MouseEvent as ReactMouseEvent,
  useEffect, useCallback, useMemo
} from 'react';
import { useEditorStore, TimelineRegion } from '../../store/editorStore';
import { ZoomRegionBlock } from './timeline/ZooomRegionBlock';
import { CutRegionBlock } from './timeline/CutRegionBlock';

import { cn } from '../../lib/utils';

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
    activeZoomRegionId,
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

  const handleTimelineClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (draggingRegion || isDraggingPlayhead || !timelineRef.current || duration === 0) return;
    if ((e.target as HTMLElement).closest('[data-region-id]') || (e.target as HTMLElement).closest('[data-playhead-handle]')) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const newTime = pxToTime(e.clientX - rect.left);
    setCurrentTime(newTime);
    if (videoRef.current) videoRef.current.currentTime = newTime;
    setSelectedRegionId(null);
  };

  const handleRegionMouseDown = useCallback((e: ReactMouseEvent<HTMLDivElement>, region: TimelineRegion, type: 'move' | 'resize-left' | 'resize-right') => {
    e.stopPropagation();
    setSelectedRegionId(region.id);
    document.body.style.cursor = type === 'move' ? 'grabbing' : 'ew-resize';
    setDraggingRegion({
      id: region.id, type,
      initialX: e.clientX, initialStartTime: region.startTime, initialDuration: region.duration
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setSelectedRegionId]);

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
    // Logic kéo thả vẫn giữ nguyên, vì nó phụ thuộc vào timeToPx/pxToTime đã được cập nhật
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingPlayhead && timelineRef.current) {
        const rect = timelineRef.current.getBoundingClientRect();
        let newTime = pxToTime(e.clientX - rect.left);
        newTime = Math.max(0, Math.min(newTime, duration));
        setCurrentTime(newTime);
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
        updateRegion(draggingRegion.id, finalUpdates);
        setDraggingRegion(null);
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingRegion, isDraggingPlayhead, videoRef, pxToTime, timeToPx]);

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
      <div
        ref={containerRef}
        className="flex-1 overflow-x-auto overflow-y-hidden border border-border/80 rounded-lg bg-muted/20"
        onMouseDown={handleTimelineClick}
      >
        <div
          ref={timelineRef}
          className="relative h-full min-w-full"
          style={{ width: `${totalWidthPx}px` }}
        >
          {/* Ruler */}
          <div className="h-8 absolute top-0 left-0 right-0 border-b border-border/50">
            {rulerTicks.map(({ time, type }) => (
              <div key={`tick-${time}`} className="absolute top-0 flex flex-col items-center" style={{ left: `${timeToPx(time)}px` }}>
                <div className={cn("w-px bg-border/80", type === 'major' ? 'h-2.5' : 'h-1.5')}></div>
                {type === 'major' && <span className="text-xs text-muted-foreground font-mono mt-1 select-none">{time}s</span>}
              </div>
            ))}
          </div>

          {/* Tracks Area */}
          <div className="absolute top-8 left-0 right-0 bottom-0 pt-4 space-y-3">
            <div className="h-24 relative">
              {allRegions.map(region => (
                region.type === 'zoom' ?
                  <ZoomRegionBlock
                    key={region.id}
                    region={region}
                    left={timeToPx(region.startTime)}
                    width={timeToPx(region.duration)}
                    isSelected={activeZoomRegionId === region.id}
                    onMouseDown={handleRegionMouseDown}
                    setRef={(el) => regionRefs.current.set(region.id, el)}
                  />
                  :
                  <CutRegionBlock
                    key={region.id}
                    region={region}
                    left={timeToPx(region.startTime)}
                    width={timeToPx(region.duration)}
                    isSelected={activeZoomRegionId === region.id}
                    onMouseDown={handleRegionMouseDown}
                    setRef={(el) => regionRefs.current.set(region.id, el)}
                  />
              ))}
            </div>
          </div>

          {/* Playhead */}
          {duration > 0 && (
            <div ref={playheadRef} className="absolute top-0 bottom-0 z-30 pointer-events-none">
              {/* Vertical line */}
              <div className="w-0.5 h-full bg-primary shadow-sm"></div>

              {/* Triangle handle */}
              <div
                data-playhead-handle
                className={cn(
                  "absolute top-0 pointer-events-auto",
                  isDraggingPlayhead ? "cursor-grabbing scale-110" : "cursor-grab"
                )}
                style={{
                  transform: 'translateX(-50%)',
                  left: '1px' // Offset để căn giữa với line
                }}
                onMouseDown={handlePlayheadMouseDown}
              >
                {/* Inverted triangle */}
                <div className="w-0 h-0 border-l-[8px] border-r-[8px] border-t-[12px] border-l-transparent border-r-transparent border-t-primary shadow-lg">
                  {/* Inner triangle for depth effect */}
                  <div className="absolute -top-[10px] -left-[6px] w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-background opacity-30"></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}