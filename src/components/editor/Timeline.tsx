// src/components/editor/Timeline.tsx
import React, { useRef, useState, MouseEvent as ReactMouseEvent, useEffect, useCallback } from 'react';
import { useEditorStore, TimelineRegion, ZoomRegion } from '../../store/editorStore';
import { cn } from '../../lib/utils';
import { Camera, Scissors, Clock } from 'lucide-react';

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

function ZoomRegionBlock({ region, left, width, isSelected, onMouseDown }: RegionBlockProps) {
  const zoomRegion = region as ZoomRegion;
  return (
    <div
      data-region-id={region.id}
      className={cn(
        "absolute h-full rounded-lg flex items-center px-3 text-primary-foreground text-xs cursor-pointer group",
        "bg-gradient-to-r from-primary to-primary/90 shadow-sm border border-primary/20",
        "transition-all duration-200 hover:shadow-md",
        isSelected && "ring-2 ring-ring z-10 shadow-lg scale-105"
      )}
      style={{ left: `${left}px`, width: `${width}px` }}
      onMouseDown={(e) => onMouseDown(e, 'move')}
    >
      <div className="flex items-center gap-2 overflow-hidden">
        <Camera size={14} className="flex-shrink-0" />
        <span className="truncate font-medium">
          {zoomRegion.zoomLevel.toFixed(1)}x Zoom
        </span>
      </div>
      
      {/* Resize handles */}
      <div
        className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-primary-foreground/20 rounded-l-lg transition-opacity duration-200"
        onMouseDown={(e) => onMouseDown(e, 'resize-left')}
      />
      <div
        className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-primary-foreground/20 rounded-r-lg transition-opacity duration-200"
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
        "absolute h-full rounded-lg flex items-center px-3 text-destructive-foreground text-xs cursor-pointer group",
        "bg-gradient-to-r from-destructive to-destructive/90 shadow-sm border border-destructive/20",
        "transition-all duration-200 hover:shadow-md",
        isSelected && "ring-2 ring-ring z-10 shadow-lg scale-105"
      )}
      style={{ left: `${left}px`, width: `${width}px` }}
      onMouseDown={(e) => onMouseDown(e, 'move')}
    >
      <div className="flex items-center gap-2 overflow-hidden">
        <Scissors size={14} className="flex-shrink-0" />
        <span className="truncate font-medium">Cut</span>
      </div>
      
      {/* Resize handles */}
      <div
        className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-destructive-foreground/20 rounded-l-lg transition-opacity duration-200"
        onMouseDown={(e) => onMouseDown(e, 'resize-left')}
      />
      <div
        className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-destructive-foreground/20 rounded-r-lg transition-opacity duration-200"
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

  const [draggingRegion, setDraggingRegion] = useState<{ 
    id: string; 
    type: 'move' | 'resize-left' | 'resize-right'; 
    initialX: number; 
    initialStartTime: number; 
    initialDuration: number; 
  } | null>(null);
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
    setDraggingRegion({ 
      id: region.id, 
      type, 
      initialX: e.clientX, 
      initialStartTime: region.startTime, 
      initialDuration: region.duration 
    });
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
          const newStartTime = Math.min(
            draggingRegion.initialStartTime + draggingRegion.initialDuration - 0.2, 
            Math.max(0, draggingRegion.initialStartTime + deltaTime)
          );
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

  // Smooth playhead animation
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
      animationFrameId = requestAnimationFrame(animatePlayhead);
    }

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [store.isPlaying, videoRef, timeToPx]);

  // Static playhead positioning when paused
  useEffect(() => {
    if (!store.isPlaying && playheadRef.current && store.duration > 0) {
      playheadRef.current.style.transform = `translateX(${timeToPx(store.currentTime)}px)`;
    }
  }, [store.currentTime, store.isPlaying, store.duration, timeToPx]);

  return (
    <div className="h-full flex flex-col bg-card/30 backdrop-blur-sm">
      {/* Timeline Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Timeline</span>
        </div>
        <div className="text-xs text-muted-foreground font-mono">
          {store.duration > 0 ? `${store.duration.toFixed(1)}s total` : 'No video loaded'}
        </div>
      </div>

      {/* Timeline Content */}
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
          {/* Time Ruler */}
          <div className="h-8 absolute top-0 left-0 right-0 border-b border-border/30">
            {store.duration > 0 && Array.from({ length: Math.floor(store.duration) + 1 }).map((_, sec) => {
              const shouldShow = pixelsPerSecond > 20 || 
                               (sec % 5 === 0 && pixelsPerSecond > 5) || 
                               (sec % 10 === 0);
              
              if (shouldShow) {
                return (
                  <div 
                    key={sec} 
                    className="absolute flex flex-col items-center" 
                    style={{ left: `${timeToPx(sec)}px` }}
                  >
                    <div className="w-px h-3 bg-border"></div>
                    <span className="text-xs text-muted-foreground font-mono mt-1">
                      {sec}s
                    </span>
                  </div>
                );
              }
              return null;
            })}
          </div>

          {/* Track Area */}
          <div className="absolute top-8 left-0 right-0 bottom-0 pt-2">
            {/* Video Track */}
            <div 
              className="h-10 rounded-lg bg-muted/30 border border-border/30 flex items-center px-4 mb-2 backdrop-blur-sm"
              style={{ width: `${store.duration * pixelsPerSecond}px` }}
            >
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-2 h-2 rounded-full bg-primary"></div>
                <span className="font-medium">Video Track</span>
              </div>
            </div>

            {/* Regions Track */}
            <div 
              className="h-10 relative rounded-lg bg-background/50 border border-border/30 backdrop-blur-sm"
              style={{ width: `${store.duration * pixelsPerSecond}px` }}
            >
              {/* Regions */}
              {[...store.zoomRegions, ...store.cutRegions].map(region => {
                const left = timeToPx(region.startTime);
                const width = timeToPx(region.duration);
                const isSelected = store.selectedRegionId === region.id;
                const props = {
                  region, left, width, isSelected,
                  onMouseDown: (e: ReactMouseEvent<HTMLDivElement>, type: 'move' | 'resize-left' | 'resize-right') => 
                    handleRegionMouseDown(e, region, type)
                };
                return region.type === 'zoom' ? 
                  <ZoomRegionBlock key={region.id} {...props} /> : 
                  <CutRegionBlock key={region.id} {...props} />;
              })}
            </div>
          </div>

          {/* Playhead */}
          {store.duration > 0 && (
            <div
              ref={playheadRef}
              className="absolute top-0 bottom-0 z-30 pointer-events-none"
            >
              {/* Playhead Line */}
              <div className="w-0.5 h-full bg-primary shadow-sm"></div>
              
              {/* Playhead Handle */}
              <div
                data-playhead-handle
                className={cn(
                  "absolute -top-1 w-5 h-5 rounded-full bg-primary border-2 border-background shadow-lg pointer-events-auto",
                  "transition-transform duration-200 hover:scale-110",
                  isDraggingPlayhead ? "cursor-grabbing scale-110" : "cursor-grab"
                )}
                style={{ transform: 'translateX(-50%)' }}
                onMouseDown={handlePlayheadMouseDown}
              >
                <div className="absolute inset-1 rounded-full bg-background opacity-20"></div>
              </div>

              {/* Current Time Label */}
              <div className="absolute -top-8 bg-primary text-primary-foreground text-xs font-mono px-2 py-1 rounded shadow-lg pointer-events-none"
                   style={{ transform: 'translateX(-50%)' }}>
                {Math.floor(store.currentTime / 60)}:{Math.floor(store.currentTime % 60).toString().padStart(2, '0')}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}