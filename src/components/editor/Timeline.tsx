// src/components/editor/Timeline.tsx
import React, { useRef, useState, MouseEvent as ReactMouseEvent, useEffect } from 'react';
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

function ZoomRegionBlock({ region, left, width, isSelected, onMouseDown }: RegionBlockProps) {
  const zoomRegion = region as ZoomRegion; // Type assertion
  return (
    <div
      data-region-id={region.id}
      className={cn(
        "absolute h-full rounded-lg flex items-center px-3 text-white text-xs cursor-pointer",
        "bg-blue-600/80", // Màu xanh cho zoom
        isSelected && "ring-2 ring-yellow-400 z-10"
      )}
      style={{ left: `${left}%`, width: `${width}%` }}
      onMouseDown={(e) => onMouseDown(e, 'move')}
    >
      <div className="flex items-center gap-2">
        <Camera size={14} />
        <span>Zoom {zoomRegion.zoomLevel}x</span>
      </div>
      {/* Resize Handles */}
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
        "bg-red-600/80", // Màu đỏ cho cut
        isSelected && "ring-2 ring-yellow-400 z-10"
      )}
      style={{ left: `${left}%`, width: `${width}%` }}
      onMouseDown={(e) => onMouseDown(e, 'move')}
    >
      <div className="flex items-center gap-2">
        <Scissors size={14} />
        <span>Cut</span>
      </div>
      {/* Resize Handles */}
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
  const timelineRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);

  // State for drag and drop
  const [draggingRegion, setDraggingRegion] = useState<{ id: string; type: 'move' | 'resize-left' | 'resize-right'; initialX: number; initialStartTime: number; initialDuration: number; } | null>(null);

  const handleTimelineClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (draggingRegion || !timelineRef.current || store.duration === 0) return;

    // Check if the click was on a region
    if ((e.target as HTMLElement).closest('[data-region-id]')) {
      return;
    }

    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const totalWidth = rect.width;

    const newTime = (clickX / totalWidth) * store.duration;
    store.setCurrentTime(newTime);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
    store.setSelectedRegionId(null);
  };

  // --- Drag and Drop Logic ---
  const handleRegionMouseDown = (
    e: ReactMouseEvent<HTMLDivElement>,
    region: TimelineRegion,
    type: 'move' | 'resize-left' | 'resize-right'
  ) => {
    e.stopPropagation();
    store.setSelectedRegionId(region.id);
    setDraggingRegion({
      id: region.id,
      type,
      initialX: e.clientX,
      initialStartTime: region.startTime,
      initialDuration: region.duration,
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingRegion || !timelineRef.current || store.duration === 0) return;

      const deltaX = e.clientX - draggingRegion.initialX;
      const timelineWidth = timelineRef.current.clientWidth;
      const deltaTime = (deltaX / timelineWidth) * store.duration;

      if (draggingRegion.type === 'move') {
        const newStartTime = Math.max(0, draggingRegion.initialStartTime + deltaTime);
        store.updateRegion(draggingRegion.id, { startTime: newStartTime });
      } else if (draggingRegion.type === 'resize-right') {
        const newDuration = Math.max(0.2, draggingRegion.initialDuration + deltaTime);
        store.updateRegion(draggingRegion.id, { duration: newDuration });
      } else if (draggingRegion.type === 'resize-left') {
        const newStartTime = Math.min(
          draggingRegion.initialStartTime + draggingRegion.initialDuration - 0.2,
          Math.max(0, draggingRegion.initialStartTime + deltaTime)
        );
        const newDuration = (draggingRegion.initialStartTime + draggingRegion.initialDuration) - newStartTime;
        store.updateRegion(draggingRegion.id, { startTime: newStartTime, duration: newDuration });
      }
    };

    const handleMouseUp = () => {
      setDraggingRegion(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draggingRegion, store.duration, store.updateRegion]);

  useEffect(() => {
    let animationFrameId: number;

    const animatePlayhead = () => {
      if (videoRef.current && playheadRef.current && store.duration > 0) {
        const percentage = (videoRef.current.currentTime / store.duration) * 100;
        playheadRef.current.style.left = `${percentage}%`;
      }
      animationFrameId = requestAnimationFrame(animatePlayhead);
    };

    if (store.isPlaying) {
      animationFrameId = requestAnimationFrame(animatePlayhead);
    } else {
      // Cập nhật vị trí lần cuối khi dừng
      if (playheadRef.current && store.duration > 0) {
        const percentage = (store.currentTime / store.duration) * 100;
        playheadRef.current.style.left = `${percentage}%`;
      }
    }

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [store.isPlaying, store.duration, videoRef, store.currentTime]);

  // --- Calculations ---
  const totalDuration = store.duration;
  const scaledWidth = 100 * store.timelineZoom; // as a percentage
  const timeToPercent = (time: number) => (time / totalDuration) * 100;

  const playheadPosition = totalDuration > 0 ? timeToPercent(store.currentTime) : 0;

  // --- Render ---
  return (
    <div className="h-full w-full flex flex-col p-2 overflow-x-auto overflow-y-hidden" onMouseDown={handleTimelineClick}>
      <div
        ref={timelineRef}
        className="relative min-w-full h-full"
        style={{ width: `${scaledWidth}%` }}
      >
        {/* Ruler */}
        <div className="h-5 absolute top-0 left-0 right-0">
          {Array.from({ length: Math.floor(totalDuration * store.timelineZoom) }).map((_, i) => (
            totalDuration > 0 && (
              <div key={i} className="absolute text-xs text-gray-400" style={{ left: `${timeToPercent(i / store.timelineZoom)}%` }}>
                |
                <span className="absolute top-2 -translate-x-1/2">{Math.round(i / store.timelineZoom)}s</span>
              </div>
            )
          ))}
        </div>

        {/* Tracks Area */}
        <div className="absolute top-5 left-0 right-0">
          {/* Base Track */}
          <div className={cn("h-[50px] rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center px-2")}>
            <p className="text-sm text-gray-500">Base Video Track</p>
          </div>

          {/* Effects Track */}
          <div className={cn("h-[50px] mt-2 relative")}>
            {[...store.zoomRegions, ...store.cutRegions].map(region => {
              const left = timeToPercent(region.startTime);
              const width = timeToPercent(region.duration);
              const isSelected = store.selectedRegionId === region.id;

              const props = {
                region,
                left,
                width,
                isSelected,
                onMouseDown: (e: ReactMouseEvent<HTMLDivElement>, type: 'move' | 'resize-left' | 'resize-right') =>
                  handleRegionMouseDown(e, region, type)
              };

              if (region.type === 'zoom') {
                return <ZoomRegionBlock key={region.id} {...props} />;
              } else {
                return <CutRegionBlock key={region.id} {...props} />;
              }
            })}
          </div>
        </div>

        {/* Playhead */}
        {totalDuration > 0 && (
          <div
            ref={playheadRef}
            className="absolute top-0 bottom-0 z-20 pointer-events-none"
            style={{ left: `${playheadPosition}%` }}
          >
            <div className="w-[2px] h-full bg-yellow-400"></div>
            <div className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-yellow-400 border-2 border-white dark:border-gray-800"></div>
          </div>
        )}
      </div>
    </div>
  );
}