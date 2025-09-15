// src/components/editor/PreviewControls.tsx
import React from 'react';
import { Play, Pause, Rewind, Scissors, Plus, ZoomIn } from 'lucide-react';
import { useEditorStore, AspectRatio } from '../../store/editorStore';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

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
      "h-16 bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl",
      "flex items-center justify-between px-6 shadow-sm"
    )}>
      {/* Left Controls */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={addZoomRegion}
          className="bg-background/50 hover:bg-accent/80 border-border/50 text-foreground font-medium px-4 py-2 rounded-lg transition-all duration-200"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Zoom
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={addCutRegion}
          className="bg-background/50 hover:bg-accent/80 border-border/50 text-foreground font-medium px-4 py-2 rounded-lg transition-all duration-200"
        >
          <Scissors className="w-4 h-4 mr-2" />
          Add Cut
        </Button>

        {/* Timeline Zoom Control */}
        <div className="flex items-center gap-3 ml-6 px-4 py-2 bg-background/30 rounded-lg border border-border/30">
          <ZoomIn className="w-4 h-4 text-muted-foreground" />
          <div className="w-24">
            <Input
              type="range"
              min="0.5"
              max="5"
              step="0.25"
              value={timelineZoom}
              onChange={(e) => setTimelineZoom(parseFloat(e.target.value))}
              className="w-full h-2 bg-muted rounded-full appearance-none cursor-pointer accent-primary slider"
              style={{
                background: `linear-gradient(to right, oklch(var(--primary)) 0%, oklch(var(--primary)) ${((timelineZoom - 0.5) / 4.5) * 100}%, oklch(var(--muted)) ${((timelineZoom - 0.5) / 4.5) * 100}%, oklch(var(--muted)) 100%)`
              }}
            />
          </div>
          <span className="text-xs text-muted-foreground font-mono min-w-[2.5rem]">
            {timelineZoom.toFixed(1)}x
          </span>
        </div>
      </div>

      {/* Center Playback Controls */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRewind}
          className="w-10 h-10 rounded-full hover:bg-accent/80 transition-all duration-200"
        >
          <Rewind className="w-5 h-5" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="w-14 h-14 rounded-full bg-primary/10 hover:bg-primary/20 transition-all duration-200 border-2 border-primary/20"
          onClick={togglePlay}
        >
          {isPlaying ? (
            <Pause className="w-6 h-6 text-primary" />
          ) : (
            <Play className="w-6 h-6 text-primary ml-0.5" />
          )}
        </Button>

        <div className="flex items-center gap-2 px-3 py-2 bg-background/30 rounded-lg border border-border/30">
          <span className="text-sm font-mono text-foreground font-medium min-w-[5rem] text-center">
            {formatTime(currentTime)}
          </span>
          <div className="w-px h-4 bg-border/50"></div>
          <span className="text-sm font-mono text-muted-foreground min-w-[5rem] text-center">
            {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground font-medium">Aspect:</span>
          <div className="w-28">
            <Select
              value={aspectRatio}
              onValueChange={(value) => setAspectRatio(value as AspectRatio)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select ratio..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="16:9">16:9</SelectItem>
                <SelectItem value="9:16">9:16</SelectItem>
                <SelectItem value="4:3">4:3</SelectItem>
                <SelectItem value="3:4">3:4</SelectItem>
                <SelectItem value="1:1">1:1</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}