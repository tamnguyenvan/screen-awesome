// src/components/editor/Timeline.tsx
import React, {
  useRef, useState, MouseEvent as ReactMouseEvent,
  useEffect, useCallback, useMemo
} from 'react';
import { useEditorStore, TimelineRegion, CutRegion } from '../../store/editorStore';
import { ZoomRegionBlock } from './timeline/ZooomRegionBlock';
import { CutRegionBlock } from './timeline/CutRegionBlock';
import { Playhead } from './timeline/Playhead';

import { cn } from '../../lib/utils';
import { Scissors } from 'lucide-react';

const MINIMUM_REGION_DURATION = 0.1; // 100ms


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
    previewCutRegion,
    selectedRegionId,
    addCutRegion,
    setPreviewCutRegion,
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

  // Format time as MM:SS or MM:MM:SS
  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hrs > 0) {
      return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
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

        const regionToUpdate = allRegions.find(r => r.id === draggingRegion.id);
        const isTrim = regionToUpdate?.type === 'cut' && ('trimType' in regionToUpdate);

        const deltaX = e.clientX - draggingRegion.initialX;
        const deltaTime = pxToTime(deltaX);

        if (draggingRegion.type === 'move') {
          const newStartTime = draggingRegion.initialStartTime + deltaTime;
          updateVideoTime(newStartTime);
          element.style.transform = `translateX(${deltaX}px)`;

        } else if (draggingRegion.type === 'resize-right') {
          const newDuration = draggingRegion.initialDuration + deltaTime;

          // FIX: Kiểm tra và xóa ngay lập tức nếu region quá nhỏ
          if (isTrim && newDuration < MINIMUM_REGION_DURATION) {
            useEditorStore.getState().deleteRegion(draggingRegion.id);
            setDraggingRegion(null); // Dừng việc kéo ngay lập tức
            document.body.style.cursor = 'default';
            return; // Thoát khỏi hàm xử lý
          }

          const safeDuration = Math.max(MINIMUM_REGION_DURATION, newDuration);
          const newEndTime = draggingRegion.initialStartTime + safeDuration;
          updateVideoTime(newEndTime);
          const newWidth = timeToPx(safeDuration);
          element.style.width = `${newWidth}px`;

        } else if (draggingRegion.type === 'resize-left') {
          // --- FIX START: Logic riêng cho Right Trim Region ---
          const isEndTrim = isTrim && regionToUpdate?.trimType === 'end';

          if (isEndTrim) {
            // BEHAVIOR: Kéo handle trái của right trim. Mép phải cố định ở cuối video.
            const newStartTime = Math.max(0, draggingRegion.initialStartTime + deltaTime);
            const newDuration = duration - newStartTime;

            if (newDuration < MINIMUM_REGION_DURATION) {
              useEditorStore.getState().deleteRegion(draggingRegion.id);
              setDraggingRegion(null);
              document.body.style.cursor = 'default';
              return;
            }

            const safeStartTime = Math.min(duration - MINIMUM_REGION_DURATION, newStartTime);
            const safeDuration = duration - safeStartTime;

            updateVideoTime(safeStartTime);
            // Cập nhật trực tiếp style left và width thay vì transform
            element.style.left = `${timeToPx(safeStartTime)}px`;
            element.style.width = `${timeToPx(safeDuration)}px`;
            element.style.transform = 'translateX(0px)'; // Đảm bảo không có transform

          } else {
            // BEHAVIOR: Logic cũ cho cut region thông thường và left trim. Mép phải cố định.
            const initialEndTime = draggingRegion.initialStartTime + draggingRegion.initialDuration;
            const newStartTime = Math.max(0, draggingRegion.initialStartTime + deltaTime);
            const newDuration = initialEndTime - newStartTime;

            if (isTrim && newDuration < MINIMUM_REGION_DURATION) {
              useEditorStore.getState().deleteRegion(draggingRegion.id);
              setDraggingRegion(null);
              document.body.style.cursor = 'default';
              return;
            }

            const safeStartTime = Math.min(initialEndTime - MINIMUM_REGION_DURATION, newStartTime);
            updateVideoTime(safeStartTime);

            const newTranslateX = timeToPx(safeStartTime - draggingRegion.initialStartTime);
            const newWidth = timeToPx(initialEndTime - safeStartTime);

            element.style.transform = `translateX(${newTranslateX}px)`;
            element.style.width = `${newWidth}px`;
          }
          // --- FIX END ---
        }
      }

      if ((isDraggingLeftStrip || isDraggingRightStrip) && timelineRef.current) {
        document.body.style.cursor = 'grabbing';
        const rect = timelineRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const timeAtMouse = pxToTime(Math.max(0, mouseX));

        let previewRegion: CutRegion | null = null;
        if (isDraggingLeftStrip) {
          previewRegion = {
            id: 'preview-cut-left',
            type: 'cut',
            startTime: 0,
            duration: Math.min(timeAtMouse, duration),
          };
        } else if (isDraggingRightStrip) {
          const startTime = Math.max(0, timeAtMouse);
          previewRegion = {
            id: 'preview-cut-right',
            type: 'cut',
            startTime: startTime,
            duration: duration - startTime,
          };
        }

        // FIX: Chỉ hiển thị preview region nếu nó đủ lớn
        if (previewRegion && previewRegion.duration >= MINIMUM_REGION_DURATION) {
          setPreviewCutRegion(previewRegion);
        } else {
          setPreviewCutRegion(null); // Ẩn preview nếu quá nhỏ
        }
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      document.body.style.cursor = 'default';
      if (isDraggingPlayhead) setIsDraggingPlayhead(false);

      if (draggingRegion) {
        const element = regionRefs.current.get(draggingRegion.id);
        if (element) {
          element.style.transform = 'translateX(0px)';
        }

        const deltaX = e.clientX - draggingRegion.initialX;
        const deltaTime = pxToTime(deltaX);
        const finalUpdates: Partial<TimelineRegion> = {};

        if (draggingRegion.type === 'move') {
          finalUpdates.startTime = Math.max(0, draggingRegion.initialStartTime + deltaTime);
        } else if (draggingRegion.type === 'resize-right') {
          finalUpdates.duration = Math.max(MINIMUM_REGION_DURATION, draggingRegion.initialDuration + deltaTime);
        } else if (draggingRegion.type === 'resize-left') {
          // --- FIX START: Logic lưu state riêng cho Right Trim Region ---
          const regionToUpdate = allRegions.find(r => r.id === draggingRegion.id);
          const isEndTrim = regionToUpdate?.type === 'cut' && regionToUpdate.trimType === 'end';

          if (isEndTrim) {
            const newStartTime = Math.max(0, draggingRegion.initialStartTime + deltaTime);
            finalUpdates.startTime = Math.min(duration - MINIMUM_REGION_DURATION, newStartTime);
            finalUpdates.duration = duration - finalUpdates.startTime;
          } else {
            // Logic cũ cho các region khác
            const newStartTime = Math.min(
              draggingRegion.initialStartTime + draggingRegion.initialDuration - MINIMUM_REGION_DURATION,
              Math.max(0, draggingRegion.initialStartTime + deltaTime)
            );
            finalUpdates.duration = (draggingRegion.initialStartTime + draggingRegion.initialDuration) - newStartTime;
            finalUpdates.startTime = newStartTime;
          }
          // --- FIX END ---
        }

        updateRegion(draggingRegion.id, finalUpdates);
        setDraggingRegion(null);
      }

      // FIX: Cập nhật logic với hằng số mới
      if ((isDraggingLeftStrip || isDraggingRightStrip) && previewCutRegion) {
        if (previewCutRegion.duration > MINIMUM_REGION_DURATION) {
          addCutRegion({
            startTime: previewCutRegion.startTime,
            duration: previewCutRegion.duration,
            trimType: isDraggingLeftStrip ? 'start' : 'end',
          });
        }
      }

      if (isDraggingLeftStrip) setIsDraggingLeftStrip(false);
      if (isDraggingRightStrip) setIsDraggingRightStrip(false);
      setPreviewCutRegion(null);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draggingRegion, isDraggingPlayhead, isDraggingLeftStrip, isDraggingRightStrip,
    pxToTime, timeToPx, updateVideoTime, updateRegion, duration, addCutRegion, setPreviewCutRegion, previewCutRegion]);

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

  const trimOverlayRegions = useMemo(() => {
    const existingTrims = cutRegions.filter(r => r.trimType);
    return previewCutRegion ? [...existingTrims, previewCutRegion] : existingTrims;
  }, [cutRegions, previewCutRegion]);

  return (
    <div className="h-full flex flex-col bg-background p-4">
      <div className="h-full flex flex-row rounded-xl overflow-hidden shadow-sm bg-card border border-border/80">
        {/* Left Strip (Static) */}
        <div
          className={cn(
            "w-6 flex-shrink-0 h-full rounded-l-xl bg-card flex items-center justify-center transition-all duration-150 cursor-ew-resize select-none border-r border-border/80",
            isDraggingLeftStrip ? "bg-primary/10" : "hover:bg-accent/50"
          )}
          onMouseDown={handleLeftStripDrag}
        >
          <div className="flex flex-col items-center gap-1">
            <Scissors size={16} className="text-muted-foreground" />
          </div>
        </div>

        {/* Scrollable Timeline Container */}
        <div
          ref={containerRef}
          className="flex-1 overflow-x-auto overflow-y-hidden bg-card/50"
          onMouseDown={handleTimelineClick}
        >
          <div
            ref={timelineRef}
            className="relative h-full min-w-full"
            style={{
              width: `${totalWidthPx}px`,
            }}
          >
            {/* Ruler */}
            <div className="h-12 sticky top-0 left-0 right-0 z-10 border-b-2 border-border/60 bg-gradient-to-b from-muted/80 to-muted/40">
              {rulerTicks.map(({ time, type }) => (
                <div
                  key={`tick-${time}`}
                  className={cn(
                    "absolute top-0 flex flex-col group",
                    time === 0 ? 'items-start' : 'items-center'
                  )}
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
                    <div className={cn(time > 0 && "translate-x-1/2 -ml-0.5")}>
                      <span className="text-xs text-foreground/90 font-mono font-medium tracking-wide">
                        {formatTime(time)}
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
            <div className="relative pt-6 space-y-4"> {/* Removed absolute positioning */}
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

                {previewCutRegion && (
                  <CutRegionBlock
                    region={previewCutRegion}
                    left={timeToPx(previewCutRegion.startTime)}
                    width={timeToPx(previewCutRegion.duration)}
                    isSelected={false}
                    isDraggable={false} // Quan trọng: Vô hiệu hóa kéo thả
                    onMouseDown={() => { }} // No-op
                    setRef={() => { }}     // No-op
                  />
                )}
              </div>
            </div>

            {trimOverlayRegions.map(region => (
              <div
                key={`overlay-${region.id}`}
                className="absolute top-0 h-full bg-gray-400/20 z-20 pointer-events-none"
                style={{
                  left: `${timeToPx(region.startTime)}px`,
                  width: `${timeToPx(region.duration)}px`,
                }}
              />
            ))}

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
          </div>
        </div>

        {/* Right Strip (Static) */}
        <div
          className={cn(
            "w-6 flex-shrink-0 h-full rounded-r-xl bg-card flex items-center justify-center transition-all duration-150 cursor-ew-resize select-none border-l border-border/80",
            isDraggingRightStrip ? "bg-primary/10" : "hover:bg-accent/50"
          )}
          onMouseDown={handleRightStripDrag}
        >
          <div className="flex flex-col items-center gap-1">
            <FlipScissorsIcon className="text-muted-foreground size-4" />
          </div>
        </div>
      </div>
    </div>
  );
}

const FlipScissorsIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={24}
    height={24}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="lucide lucide-scissors-icon lucide-scissors"
    {...props}
  >
    <g transform="translate(24,0) scale(-1,1)">
      <circle cx={6} cy={6} r={3} />
      <path d="M8.12 8.12 12 12" />
      <path d="M20 4 8.12 15.88" />
      <circle cx={6} cy={18} r={3} />
      <path d="M14.8 14.8 20 20" />
    </g>
  </svg>
);