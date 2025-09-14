// src/components/editor/Timeline.tsx
import React, { useRef, useState, MouseEvent as ReactMouseEvent, useEffect, useCallback } from 'react';
import { useEditorStore, TimelineRegion, ZoomRegion } from '../../store/editorStore';
import { cn } from '../../lib/utils';
import { Camera, Scissors } from 'lucide-react';

interface TimelineProps {
  videoRef: React.RefObject<HTMLVideoElement>;
}

type RegionMouseEvent = (e: ReactMouseEvent<HTMLDivElement>, type: 'move' | 'resize-left' | 'resize-right') => void;

interface RegionBlockProps {
  region: TimelineRegion;
  left: number;
  width: number;
  isSelected: boolean;
  onMouseDown: RegionMouseEvent;
}

const PIXELS_PER_SECOND_BASE = 60;

// (RegionBlock components remain unchanged)
function ZoomRegionBlock({ region, left, width, isSelected, onMouseDown }: RegionBlockProps) {
  const zoomRegion = region as ZoomRegion;
  return (
    <div
      data-region-id={region.id}
      className={cn(
        "absolute h-full rounded-lg flex items-center px-3 text-white text-xs cursor-pointer",
        "bg-blue-600/80",
        isSelected && "ring-2 ring-yellow-400 z-10"
      )}
      style={{ left: `${left}px`, width: `${width}px` }}
      onMouseDown={(e) => onMouseDown(e, 'move')}
    >
      <div className="flex items-center gap-2 overflow-hidden">
        <Camera size={14} />
        <span className="truncate">Zoom {zoomRegion.zoomLevel}x</span>
      </div>
      <div
        className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize"
        onMouseDown={(e) => onMouseDown(e, 'resize-left')}
      />
      <div
        className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize"
        onMouseDown={(e) => onMouseDown(e, 'resize-right')}
      />
    </div>
  );
}

function CutRegionBlock({ region, left, width, isSelected, onMouseDown }: RegionBlockProps) {
  return (
    <div
      data-region-id={region.id}
      className={cn(
        "absolute h-full rounded-lg flex items-center px-3 text-white text-xs cursor-pointer",
        "bg-red-600/80",
        isSelected && "ring-2 ring-yellow-400 z-10"
      )}
      style={{ left: `${left}px`, width: `${width}px` }}
      onMouseDown={(e) => onMouseDown(e, 'move')}
    >
      <div className="flex items-center gap-2">
        <Scissors size={14} />
        <span>Cut</span>
      </div>
      <div
        className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize"
        onMouseDown={(e) => onMouseDown(e, 'resize-left')}
      />
      <div
        className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize"
        onMouseDown={(e) => onMouseDown(e, 'resize-right')}
      />
    </div>
  );
}


export function Timeline({ videoRef }: TimelineProps) {
  const store = useEditorStore();
  const containerRef = useRef<HTMLDivElement>(null); 
  const timelineRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);

  const [draggingRegion, setDraggingRegion] = useState<{ id: string; type: 'move' | 'resize-left' | 'resize-right'; initialX: number; initialStartTime: number; initialDuration: number; } | null>(null);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    if (containerRef.current) {
      setContainerWidth(containerRef.current.clientWidth);
    }
  }, []);

  const pixelsPerSecond = PIXELS_PER_SECOND_BASE * store.timelineZoom;
  const endPadding = containerWidth / 2 || 200;
  const totalWidthPx = (store.duration * pixelsPerSecond) + endPadding;

  const timeToPx = useCallback((time: number) => time * pixelsPerSecond, [pixelsPerSecond]);
  const pxToTime = useCallback((px: number) => px / pixelsPerSecond, [pixelsPerSecond]);

  // (Click and Drag handlers remain unchanged)
  const handleTimelineClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (draggingRegion || isDraggingPlayhead || !timelineRef.current || store.duration === 0) return;
    if ((e.target as HTMLElement).closest('[data-region-id]') || (e.target as HTMLElement).closest('[data-playhead-handle]')) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newTime = pxToTime(clickX);
    store.setCurrentTime(newTime);
    if (videoRef.current) videoRef.current.currentTime = newTime;
    store.setSelectedRegionId(null);
  };

  const handleRegionMouseDown = (e: ReactMouseEvent<HTMLDivElement>, region: TimelineRegion, type: 'move' | 'resize-left' | 'resize-right') => {
    e.stopPropagation();
    store.setSelectedRegionId(region.id);
    setDraggingRegion({ id: region.id, type, initialX: e.clientX, initialStartTime: region.startTime, initialDuration: region.duration });
  };

  const handlePlayheadMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setIsDraggingPlayhead(true);
    document.body.style.cursor = 'grabbing';
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!timelineRef.current || store.duration === 0) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      if (isDraggingPlayhead) {
        let newTime = pxToTime(mouseX);
        newTime = Math.max(0, Math.min(newTime, store.duration)); 
        store.setCurrentTime(newTime);
        if (videoRef.current) videoRef.current.currentTime = newTime;
        return;
      }
      if (draggingRegion) {
        const deltaX = e.clientX - draggingRegion.initialX;
        const deltaTime = pxToTime(deltaX);
        if (draggingRegion.type === 'move') {
          const newStartTime = Math.max(0, draggingRegion.initialStartTime + deltaTime);
          store.updateRegion(draggingRegion.id, { startTime: newStartTime });
        } else if (draggingRegion.type === 'resize-right') {
          const newDuration = Math.max(0.2, draggingRegion.initialDuration + deltaTime);
          store.updateRegion(draggingRegion.id, { duration: newDuration });
        } else if (draggingRegion.type === 'resize-left') {
          const newStartTime = Math.min(draggingRegion.initialStartTime + draggingRegion.initialDuration - 0.2, Math.max(0, draggingRegion.initialStartTime + deltaTime));
          const newDuration = (draggingRegion.initialStartTime + draggingRegion.initialDuration) - newStartTime;
          store.updateRegion(draggingRegion.id, { startTime: newStartTime, duration: newDuration });
        }
      }
    };
    const handleMouseUp = () => {
      setDraggingRegion(null);
      if (isDraggingPlayhead) {
        setIsDraggingPlayhead(false);
        document.body.style.cursor = 'default';
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
    };
  }, [draggingRegion, isDraggingPlayhead, store, videoRef, pxToTime]);


  // --- NEW: Smooth animation loop for playback ---
  useEffect(() => {
    let animationFrameId: number;

    const animatePlayhead = () => {
      if (videoRef.current && playheadRef.current) {
        const liveTime = videoRef.current.currentTime;
        const newPosition = timeToPx(liveTime);
        playheadRef.current.style.transform = `translateX(${newPosition}px)`;
      }
      animationFrameId = requestAnimationFrame(animatePlayhead);
    };

    if (store.isPlaying) {
      // Start the smooth animation loop when playing
      animationFrameId = requestAnimationFrame(animatePlayhead);
    }

    return () => {
      // Cleanup: stop the loop when isPlaying is false or component unmounts
      cancelAnimationFrame(animationFrameId);
    };
  }, [store.isPlaying, videoRef, timeToPx]);


  // --- UPDATED: This effect now ONLY runs when paused ---
  useEffect(() => {
    // This ensures the playhead is correctly positioned when NOT playing
    // (e.g., after scrubbing, clicking, or loading).
    if (!store.isPlaying && playheadRef.current && store.duration > 0) {
      playheadRef.current.style.transform = `translateX(${timeToPx(store.currentTime)}px)`;
    }
  }, [store.currentTime, store.isPlaying, store.duration, timeToPx]);


  return (
    <div ref={containerRef} className="h-full w-full flex flex-col p-2" onMouseDown={handleTimelineClick}>
      <div
        ref={timelineRef}
        className="relative min-w-full h-full"
        style={{ width: `${totalWidthPx}px` }}
      >
        {/* Ruler */}
        <div className="h-5 absolute top-0 left-0 right-0">
          {Array.from({ length: Math.floor(store.duration) + 1 }).map((_, sec) => {
            if (store.duration > 0 && pixelsPerSecond > 20 || (sec % 5 === 0 && pixelsPerSecond > 5) || (sec % 10 === 0)) {
              return (
                <div key={sec} className="absolute text-xs text-gray-400" style={{ left: `${timeToPx(sec)}px` }}>
                  <div className="h-2 w-px bg-gray-400"></div>
                  <span className="absolute -translate-x-1/2">{sec}s</span>
                </div>
              )
            }
            return null;
          })}
        </div>

        {/* Tracks Area */}
        <div className="absolute top-5 left-0 right-0" style={{width: `${store.duration * pixelsPerSecond}px`}}>
          <div className={cn("h-[50px] rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center px-2")}>
            <p className="text-sm text-gray-500">Base Video Track</p>
          </div>
          <div className={cn("h-[50px] mt-2 relative")}>
            {[...store.zoomRegions, ...store.cutRegions].map(region => {
              const left = timeToPx(region.startTime);
              const width = timeToPx(region.duration);
              const isSelected = store.selectedRegionId === region.id;
              const props = { region, left, width, isSelected,
                onMouseDown: (e: ReactMouseEvent<HTMLDivElement>, type: 'move' | 'resize-left' | 'resize-right') => handleRegionMouseDown(e, region, type)
              };
              return region.type === 'zoom' ? <ZoomRegionBlock key={region.id} {...props} /> : <CutRegionBlock key={region.id} {...props} />;
            })}
          </div>
        </div>

        {/* Playhead */}
        {store.duration > 0 && (
          <div
            ref={playheadRef}
            className="absolute top-0 bottom-0 z-20 pointer-events-none"
          >
            <div className="w-[2px] h-full bg-yellow-400"></div>
            <div
              data-playhead-handle
              className={cn(
                "absolute top-0 w-4 h-4 rounded-full bg-yellow-400 border-2 border-white dark:border-gray-800 pointer-events-auto",
                isDraggingPlayhead ? "cursor-grabbing" : "cursor-grab"
              )}
              style={{ transform: 'translateX(-50%)' }}
              onMouseDown={handlePlayheadMouseDown}
            ></div>
          </div>
        )}
      </div>
    </div>
  );
}