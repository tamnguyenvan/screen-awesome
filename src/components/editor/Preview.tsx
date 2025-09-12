// src/components/editor/Preview.tsx
import React, { useEffect, useMemo } from 'react';
import { useEditorStore } from '../../store/editorStore';

interface PreviewProps {
  videoRef: React.RefObject<HTMLVideoElement>;
}

// Helper function to generate CSS background string from state (no changes here)
const generateBackgroundStyle = (backgroundState: ReturnType<typeof useEditorStore.getState>['frameStyles']['background']) => {
    switch(backgroundState.type) {
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
  const { frameStyles, videoUrl, isPlaying, setPlaying, setCurrentTime, setDuration, aspectRatio } = useEditorStore();

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    isPlaying ? video.play() : video.pause();
  }, [isPlaying, videoRef]);

  const backgroundStyle = useMemo(() => generateBackgroundStyle(frameStyles.background), [frameStyles.background]);
  const cssAspectRatio = useMemo(() => aspectRatio.replace(':', ' / '), [aspectRatio]);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };
  
  const handlePlay = () => setPlaying(true);
  const handlePause = () => setPlaying(false);

  return (
    // Canvas: This is the outermost container.
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
      {/* Padding Container: This div sits inside the canvas and provides the padding */}
      <div
        className="w-full h-full flex items-center justify-center"
        style={{
          padding: `${frameStyles.padding}%`,
          overflow: 'hidden',
        }}
      >
        {videoUrl ? (
          // The video itself will scale to fit inside the padding container
          <video
            ref={videoRef}
            src={videoUrl}
            className="object-contain max-w-full max-h-full"
            style={{
              borderRadius: `${frameStyles.borderRadius - frameStyles.borderWidth}px`,
              boxShadow: `0 0 ${frameStyles.shadow * 2}px rgba(0,0,0,0.${frameStyles.shadow})`,
            }}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onPlay={handlePlay}
            onPause={handlePause}
            onEnded={handlePause}
          />
        ) : (
          <div className="w-full h-full bg-gray-500/20 flex items-center justify-center text-gray-500">
            <p>Load a project to begin</p>
          </div>
        )}
      </div>
    </div>
  );
}