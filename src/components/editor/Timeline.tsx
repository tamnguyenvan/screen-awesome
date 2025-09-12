// src/components/editor/Timeline.tsx
import React from 'react';
import { Play, Pause, Rewind } from 'lucide-react';
import { useEditorStore, AspectRatio } from '../../store/editorStore';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

interface TimelineProps {
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

export function Timeline({ videoRef }: TimelineProps) {
  const { isPlaying, togglePlay, currentTime, duration, setCurrentTime, aspectRatio, setAspectRatio } = useEditorStore();
  
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if(videoRef.current) {
        videoRef.current.currentTime = time;
    }
  };

  const handleRewind = () => {
    setCurrentTime(0);
    if(videoRef.current) {
      videoRef.current.currentTime = 0;
    }
  }

  return (
    <div className="p-4 flex flex-col h-full">
        {/* Track Area - Placeholder for Phase 3 */}
        <div className="flex-1 bg-gray-200/50 dark:bg-gray-900/50 rounded-lg mb-4 flex items-center justify-center">
            <p className="text-gray-500 text-sm">Zoom & Cut tracks will appear here in Phase 3</p>
        </div>

        {/* Controls Area */}
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={handleRewind}>
                    <Rewind className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={togglePlay}>
                    {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                </Button>
            </div>
            
            <span className="text-xs font-mono text-gray-600 dark:text-gray-400 w-12 text-center">{formatTime(currentTime)}</span>
            
            <input
                type="range"
                min="0"
                max={duration || 0}
                step="0.01"
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-2 bg-gray-300 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer"
            />
            
            <span className="text-xs font-mono text-gray-600 dark:text-gray-400 w-12 text-center">{formatTime(duration)}</span>
            
            {/* Aspect Ratio Dropdown*/}
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
    </div>
  );
}