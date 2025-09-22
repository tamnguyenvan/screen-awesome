import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useEditorStore } from '../../../store/editorStore';

interface FocusPointPickerProps {
  regionId: string;
  targetX: number;
  targetY: number;
  startTime: number;
  onTargetChange: (coords: { x: number, y: number }) => void;
}

export function FocusPointPicker({ regionId, targetX, targetY, startTime, onTargetChange }: FocusPointPickerProps) {
  void regionId
  const videoUrl = useEditorStore.getState().videoUrl;
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [videoDims, setVideoDims] = useState({ width: 0, height: 0 });

  // Seek video to the start of the region when the component mounts
  useEffect(() => {
    const video = videoRef.current;
    if (video && video.readyState >= 1) { // HAVE_METADATA
      video.currentTime = startTime;
    }
  }, [startTime]);

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (video) {
      setVideoDims({ width: video.videoWidth, height: video.videoHeight });
      video.currentTime = startTime;
    }
  };

  // Handle mouse events to select focus point
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container || videoDims.width === 0) return;

    const updatePosition = (clientX: number, clientY: number) => {
      const rect = container.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;

      const clampedX = Math.max(0, Math.min(x, rect.width));
      const clampedY = Math.max(0, Math.min(y, rect.height));

      // Convert from display coordinates to video origin coordinates
      const nativeX = (clampedX / rect.width) * videoDims.width;
      const nativeY = (clampedY / rect.height) * videoDims.height;

      onTargetChange({ x: nativeX, y: nativeY });
    };

    updatePosition(e.clientX, e.clientY);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      updatePosition(moveEvent.clientX, moveEvent.clientY);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [videoDims, onTargetChange]);

  const reticleLeft = videoDims.width > 0 ? (targetX / videoDims.width) * 100 : 50;
  const reticleTop = videoDims.height > 0 ? (targetY / videoDims.height) * 100 : 50;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Focus Point</h4>
      <p className="text-xs text-muted-foreground -mt-1 mb-3">Click and drag the circle to set the zoom point.</p>
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        className="relative aspect-video w-full bg-black rounded-lg overflow-hidden cursor-crosshair"
      >
        <video
          ref={videoRef}
          src={videoUrl ?? ''}
          className="w-full h-full object-contain"
          onLoadedMetadata={handleLoadedMetadata}
          muted
        />
        <div
          className="absolute w-6 h-6 rounded-full border-2 border-primary bg-primary/20 backdrop-blur-sm shadow-lg pointer-events-none transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
          style={{
            left: `${reticleLeft}%`,
            top: `${reticleTop}%`,
          }}
        >
          <div className="w-1 h-1 bg-primary rounded-full" />
        </div>
      </div>
    </div>
  );
}