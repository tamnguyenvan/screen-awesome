// src/components/editor/PreviewControls.tsx
import React from 'react';
import { Play, Pause, Rewind, Scissors, Plus, ZoomIn } from 'lucide-react';
import { useEditorStore, AspectRatio } from '../../store/editorStore';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import { TooltipProvider } from '@radix-ui/react-tooltip';

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
    isPlaying, togglePlay, currentTime, duration, setCurrentTime,
    aspectRatio, setAspectRatio, addZoomRegion, addCutRegion,
    timelineZoom, setTimelineZoom
  } = useEditorStore();

  const handleRewind = () => {
    setCurrentTime(0);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
  }

  return (
    <div className={cn(
      "h-12 flex-shrink-0 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm",
      "flex items-center justify-between px-4 border-t border-gray-200/50 dark:border-gray-700/50"
    )}>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={addZoomRegion}>
          <Plus className="w-4 h-4 mr-2" />
          Add Zoom
        </Button>
        <Button variant="outline" size="sm" onClick={addCutRegion}>
          <Scissors className="w-4 h-4 mr-2" />
          Add Cut
        </Button>
        <TooltipProvider delayDuration={100}>
          <div className={cn(
            "h-12 flex-shrink-0 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700",
            "flex items-center justify-end px-4"
          )}>
            <div className="flex items-center gap-2 w-48">
              <ZoomIn className="w-4 h-4 text-gray-500" />
              <input
                type="range"
                min="1"
                max="4"
                step="0.5"
                value={timelineZoom}
                onChange={(e) => setTimelineZoom(parseFloat(e.target.value))}
                className={cn("w-full h-2 bg-gray-300 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer")}
              />
            </div>
          </div>
        </TooltipProvider>
      </div>

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