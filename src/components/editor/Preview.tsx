// src/components/editor/Preview.tsx

import React, { useEffect, useMemo, useRef } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { calculateZoomTransform } from '../../lib/transform';
import { Film } from 'lucide-react';

interface PreviewProps {
  videoRef: React.RefObject<HTMLVideoElement>;
}

const generateBackgroundStyle = (backgroundState: ReturnType<typeof useEditorStore.getState>['frameStyles']['background']) => {
  switch (backgroundState.type) {
    case 'color':
      return { background: backgroundState.color || '#ffffff' };
    case 'gradient':
      return { background: `linear-gradient(135deg, ${backgroundState.gradientStart}, ${backgroundState.gradientEnd})` };
    case 'image':
    case 'wallpaper':
      return {
        backgroundImage: `url(${backgroundState.imageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      };
    default:
      return { background: 'oklch(0.2077 0.0398 265.7549)' };
  }
};

export function Preview({ videoRef }: PreviewProps) {
  const {
    frameStyles, videoUrl, isPlaying, setPlaying,
    setCurrentTime, setDuration, aspectRatio, setVideoDimensions,
    videoDimensions, isCurrentlyCut
  } = useEditorStore();

  const transformContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let animationFrameId: number;

    const updateTransform = () => {
      if (!transformContainerRef.current || !videoRef.current) return;

      const liveCurrentTime = videoRef.current.currentTime;
      const { scale, translateX, translateY } = calculateZoomTransform(liveCurrentTime);

      transformContainerRef.current.style.transform = `scale(${scale}) translate(${translateX}%, ${translateY}%)`;
    };

    updateTransform();

    const animate = () => {
      updateTransform();
      animationFrameId = requestAnimationFrame(animate);
    };

    if (isPlaying) {
      animate();
    }

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying, videoRef]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    isPlaying ? video.play() : video.pause();
  }, [isPlaying, videoRef]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    if (isPlaying && isCurrentlyCut) {
      const { cutRegions } = useEditorStore.getState();
      
      const activeCutRegion = cutRegions.find(
         r => video.currentTime >= r.startTime && video.currentTime < (r.startTime + r.duration)
      );

      if (activeCutRegion) {
         console.log(`Skipping cut region, jumping to ${activeCutRegion.startTime + activeCutRegion.duration}`);
         video.currentTime = activeCutRegion.startTime + activeCutRegion.duration;
         setCurrentTime(video.currentTime); 
      }
    }
  }, [isCurrentlyCut, isPlaying, videoRef, setCurrentTime]);

  const backgroundStyle = useMemo(() => generateBackgroundStyle(frameStyles.background), [frameStyles.background]);
  const cssAspectRatio = useMemo(() => aspectRatio.replace(':', ' / '), [aspectRatio]);

  const videoAspectRatio = useMemo(() => {
    if (videoDimensions.height === 0) return 16 / 9;
    return videoDimensions.width / videoDimensions.height;
  }, [videoDimensions]);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      setVideoDimensions({
        width: videoRef.current.videoWidth,
        height: videoRef.current.videoHeight
      });
    }
  };

  const handlePlay = () => setPlaying(true);
  const handlePause = () => setPlaying(false);

  return (
    <div
      className="transition-all duration-300 ease-out flex items-center justify-center relative overflow-hidden shadow-lg"
      style={{
        ...backgroundStyle,
        aspectRatio: cssAspectRatio,
        height: '100%',
        maxWidth: '100%',
        maxHeight: '100%',
      }}
    >
      <div
        className="w-full h-full flex items-center justify-center relative"
        style={{
          padding: `${frameStyles.padding}%`,
        }}
      >
        {videoUrl ? (
          <div
            ref={transformContainerRef}
            className="transition-transform duration-75 max-w-full max-h-full relative"
            style={{
              aspectRatio: videoAspectRatio,
              borderRadius: `${frameStyles.borderRadius}px`,
              boxShadow: frameStyles.shadow > 0 
                ? `0 ${frameStyles.shadow}px ${frameStyles.shadow * 2}px rgba(0,0,0,0.${Math.min(frameStyles.shadow * 2, 50)})`
                : 'none',
              border: frameStyles.borderWidth > 0 
                ? `${frameStyles.borderWidth}px solid ${frameStyles.borderColor}`
                : 'none',
              overflow: 'hidden',
            }}
          >
            <video
              ref={videoRef}
              src={videoUrl}
              className="w-full h-full object-cover"
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onPlay={handlePlay}
              onPause={handlePause}
              onEnded={handlePause}
            />
          </div>
        ) : (
          <div className="w-full h-full bg-muted/10 border-2 border-dashed border-border/50 rounded-xl flex flex-col items-center justify-center text-muted-foreground gap-4 transition-all duration-200 hover:border-border/80">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Film className="w-8 h-8 text-primary/70"/>
            </div>
            <div className="text-center">
              <p className="text-lg font-medium mb-1">No project loaded</p>
              <p className="text-sm text-muted-foreground/70">Load a project to begin editing</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}