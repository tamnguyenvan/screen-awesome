// src/components/editor/PreviewControls.tsx
import React from 'react';
import { Play, Pause, Rewind } from 'lucide-react';
import { useEditorStore, AspectRatio } from '../../store/editorStore';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

interface PreviewControlsProps {
  videoRef: React.RefObject<HTMLVideoElement>;
}

function formatTime(seconds: number): string {
    if (isNaN(seconds) || seconds < 0) {
        return '00:00';
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function PreviewControls({ videoRef }: PreviewControlsProps) {
  const { 
    isPlaying, togglePlay, currentTime, duration, setCurrentTime, aspectRatio, setAspectRatio 
  } = useEditorStore();
  
  const handleRewind = () => {
    setCurrentTime(0);
    if(videoRef.current) {
      videoRef.current.currentTime = 0;
    }
  }

  return (
    <div className={cn(
      "h-12 flex-shrink-0 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm",
      "flex items-center gap-4 px-4 border-t border-gray-200/50 dark:border-gray-700/50"
    )}>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={handleRewind}>
          <Rewind className="w-5 h-5" />
        </Button>
        <Button variant="ghost" size="icon" onClick={togglePlay}>
          {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
        </Button>
      </div>
      
      <span className="text-xs font-mono text-gray-600 dark:text-gray-400 w-12 text-center">
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>
      
      <div className="flex-grow"></div> {/* Spacer */}

      <select
          value={aspectRatio}
          onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
          className={cn(
              "bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600",
              "rounded-md text-xs px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          )}
      >
          <option value="16:9">16:9</option>
          <option value="9:16">9:16</option>
          <option value="4:3">4:3</option>
          <option value="3:4">3:4</option>
          <option value="1:1">1:1</option>
      </select>
    </div>
  );
}