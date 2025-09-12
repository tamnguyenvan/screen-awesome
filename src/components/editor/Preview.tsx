// src/components/editor/Preview.tsx
import React, { useEffect } from 'react';
import { useEditorStore } from '../../store/editorStore';

interface PreviewProps {
  videoRef: React.RefObject<HTMLVideoElement>;
}

export function Preview({ videoRef }: PreviewProps) {
  const { frameStyles, videoUrl, isPlaying, setPlaying, setCurrentTime, setDuration } = useEditorStore();

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    isPlaying ? video.play() : video.pause();
  }, [isPlaying, videoRef]);

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

  // The outer div is the "canvas" that shows the background
  // The middle div is the "frame" that has padding/border/shadow
  // The inner video tag is the actual content
  return (
    <div
      className="w-full h-full flex items-center justify-center"
      style={{ background: frameStyles.background }}
    >
      <div
        className="transition-all duration-200 ease-in-out"
        style={{
          padding: `${frameStyles.padding}px`,
          borderRadius: `${frameStyles.borderRadius}px`,
          boxShadow: `0 0 ${frameStyles.shadow * 2}px rgba(0,0,0,0.${frameStyles.shadow})`,
          border: `${frameStyles.borderWidth}px solid ${frameStyles.borderColor}`,
          // This ensures the inner content also has rounded corners
          overflow: 'hidden',
          // A max-width/height can be useful to maintain aspect ratio
          maxWidth: '100%',
          maxHeight: '100%',
        }}
      >
        {videoUrl ? (
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full h-full object-contain"
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