// src/components/editor/Preview.tsx

import React, { useEffect, useMemo, useRef } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { calculateZoomTransform } from '../../lib/transform';

interface PreviewProps {
  videoRef: React.RefObject<HTMLVideoElement>;
}

const generateBackgroundStyle = (backgroundState: ReturnType<typeof useEditorStore.getState>['frameStyles']['background']) => {
  switch (backgroundState.type) {
    case 'color':
      return { background: backgroundState.color || '#ffffff' };
    case 'gradient':
      return { background: `linear-gradient(145deg, ${backgroundState.gradientStart}, ${backgroundState.gradientEnd})` };
    case 'image':
    case 'wallpaper':
      return {
        backgroundImage: `url(${backgroundState.imageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      };
    default:
      return { background: '#000000' };
  }
};

export function Preview({ videoRef }: PreviewProps) {
  const {
    frameStyles, videoUrl, isPlaying, setPlaying,
    setCurrentTime, setDuration, aspectRatio, setVideoDimensions,
    videoDimensions, isCurrentlyCut
  } = useEditorStore();

  const transformContainerRef = useRef<HTMLDivElement>(null);

  // For loop to update transform
  useEffect(() => {
    let animationFrameId: number;

    const updateTransform = () => {
      if (!transformContainerRef.current || !videoRef.current) return;

      // Get current time from video element
      const liveCurrentTime = videoRef.current.currentTime;

      // Pass current time to calculateZoomTransform
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


  // --- Logic Handle Cut Region ---
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    // If playing and 'isCurrentlyCut' is on (from store)
    if (isPlaying && isCurrentlyCut) {
      // Get latest state from store (we need cutRegions array)
      const { cutRegions } = useEditorStore.getState();
      
      // Find which cut region is active
      const activeCutRegion = cutRegions.find(
         r => video.currentTime >= r.startTime && video.currentTime < (r.startTime + r.duration)
      );

      if (activeCutRegion) {
         console.log(`Skipping cut region, jumping to ${activeCutRegion.startTime + activeCutRegion.duration}`);
         // Jump video to end of cut region
         video.currentTime = activeCutRegion.startTime + activeCutRegion.duration;
         // Update store to recalculate (may turn off isCurrentlyCut)
         setCurrentTime(video.currentTime); 
      }
    }
  }, [isCurrentlyCut, isPlaying, videoRef, setCurrentTime]); // Run when isCurrentlyCut or isPlaying changes


  const backgroundStyle = useMemo(() => generateBackgroundStyle(frameStyles.background), [frameStyles.background]);
  const cssAspectRatio = useMemo(() => aspectRatio.replace(':', ' / '), [aspectRatio]);

  // Calculate video aspect ratio
  const videoAspectRatio = useMemo(() => {
    if (videoDimensions.height === 0) return 16 / 9; // fallback
    return videoDimensions.width / videoDimensions.height;
  }, [videoDimensions]);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      // This will call the setter of store,
      // and the setter will automatically update 'isCurrentlyCut'
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
    // Canvas
    <div
      className="transition-all duration-200 ease-in-out flex items-center justify-center relative"
      style={{
        ...backgroundStyle,
        aspectRatio: cssAspectRatio,
        height: '100%',
        maxWidth: '100%',
        maxHeight: '100%',
      }}
    >
      {/* Padding Container */}
      <div
        className="w-full h-full flex items-center justify-center"
        style={{
          padding: `${frameStyles.padding}%`,
        }}
      >
        {videoUrl ? (
          // Container will have aspect ratio of video
          <div
            ref={transformContainerRef}
            className="transition-transform duration-100 max-w-full max-h-full"
            style={{
              aspectRatio: videoAspectRatio,
              borderRadius: `${frameStyles.borderRadius}px`,
              boxShadow: `0 0 ${frameStyles.shadow * 2}px rgba(0,0,0,0.${frameStyles.shadow})`,
              overflow: 'hidden',
            }}
          >
            <video
              ref={videoRef}
              src={videoUrl}
              className="w-full h-full"
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onPlay={handlePlay}
              onPause={handlePause}
              onEnded={handlePause}
            />
          </div>
        ) : (
          <div className="w-full h-full bg-gray-500/20 flex items-center justify-center text-gray-500">
            <p>Load a project to begin</p>
          </div>
        )}
      </div>
    </div>
  );
}