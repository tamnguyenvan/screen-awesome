// src/components/editor/Preview.tsx
import React, { useEffect, useMemo } from 'react';
import { useEditorStore } from '../../store/editorStore';

interface PreviewProps {
  videoRef: React.RefObject<HTMLVideoElement>;
}

// Helper function to generate CSS background string from state
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
  const { frameStyles, videoUrl, isPlaying, setPlaying, setCurrentTime, setDuration } = useEditorStore();

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    isPlaying ? video.play() : video.pause();
  }, [isPlaying, videoRef]);

  // Memoize the background style to prevent re-calculation on every render
  const backgroundStyle = useMemo(() => generateBackgroundStyle(frameStyles.background), [frameStyles.background]);

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
    <div
      className="w-full h-full flex items-center justify-center transition-all duration-200 ease-in-out"
      style={backgroundStyle}
    >
      <div
        className="transition-all duration-200 ease-in-out"
        style={{
          padding: `${frameStyles.padding}%`,
          overflow: 'hidden',
          maxWidth: '100%',
          maxHeight: '100%',
          backgroundColor: 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {videoUrl ? (
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