import React from 'react';
import { Play, Pause, Scissors, Plus, ZoomIn, Trash2, Undo, Redo } from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import { AspectRatio } from '../../types/store';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import Slider from '../ui/slider';

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

const Rewind = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={24}
    height={24}
    viewBox="0 0 256 256"
    fill="currentColor"
    {...props}
  >
    <path d="M223.77,58a16,16,0,0,0-16.25.53L128,109.14V71.84A15.91,15.91,0,0,0,103.52,58.5L15.33,114.66a15.8,15.8,0,0,0,0,26.68l88.19,56.16A15.91,15.91,0,0,0,128,184.16v-37.3l79.52,50.64A15.91,15.91,0,0,0,232,184.16V71.84A15.83,15.83,0,0,0,223.77,58ZM112,183.93,24.18,128,112,72.06Zm104,0L128.18,128,216,72.06Z" />
  </svg>
);

export function PreviewControls({ videoRef }: PreviewControlsProps) {
  const {
    isPlaying, togglePlay, currentTime, duration, setCurrentTime,
    aspectRatio, setAspectRatio, addZoomRegion, addCutRegion,
    timelineZoom, setTimelineZoom,
    selectedRegionId, deleteRegion
  } = useEditorStore();

  const { undo, redo, pastStates, futureStates } = useEditorStore.temporal.getState();

  const handleRewind = () => {
    setCurrentTime(0);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
  }

  const handleUndo = async () => {
    undo();
  }

  const handleRedo = async () => {
    redo();
  }

  const handleDelete = () => {
    if (selectedRegionId) {
      deleteRegion(selectedRegionId);
    }
  }

  return (
    <div className={cn(
      "relative h-16 bg-card/80 backdrop-blur-sm border-t border-border/50",
      "flex items-center justify-between px-6 shadow-sm"
    )}>
      {/* Left Controls */}
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => addZoomRegion()}>
          <Plus className="w-4 h-4 mr-2" /> Add Zoom
        </Button>
        <Button variant="secondary" size="sm" onClick={() => addCutRegion()}>
          <Scissors className="w-4 h-4 mr-2" /> Add Cut
        </Button>
        <Button
          variant="secondary" size="icon" onClick={handleDelete}
          disabled={!selectedRegionId} title='Delete Selected Region (Del)'
          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
        <div className="w-px h-6 bg-border mx-2"></div>
        <div className="flex items-center gap-3">
          <ZoomIn className="w-4 h-4 text-muted-foreground" />
          <div className="w-24">
            <Slider
              min={1} max={4} step={0.5}
              value={timelineZoom}
              onChange={setTimelineZoom}
            />
          </div>
        </div>
      </div>

      {/* Center Playback Controls (Absolutely Centered) */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center gap-8">
        {/* History Controls */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={handleUndo} disabled={pastStates.length === 0} className="h-9 w-9 text-muted-foreground hover:bg-accent/50 hover:text-foreground" title='Undo (Ctrl+Z)'>
            <Undo className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleRedo} disabled={futureStates.length === 0} className="h-9 w-9 text-muted-foreground hover:bg-accent/50 hover:text-foreground" title='Redo (Ctrl+Y)'>
            <Redo className="w-5 h-5" />
          </Button>
        </div>

        {/* Main Playback Controls */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleRewind} className="h-10 w-10 text-muted-foreground hover:bg-accent/50 hover:text-foreground" title='Rewind (Ctrl+Left Arrow)'>
            <Rewind />
          </Button>
          <Button
            variant="default"
            size="icon"
            onClick={togglePlay}
            title='Play/Pause (Space)'
            className="w-14 h-14 rounded-full shadow-lg"
          >
            {isPlaying ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-1" />}
          </Button>
          <div className="flex items-baseline gap-2 font-mono text-base ml-3">
            <span className="text-foreground min-w-[4.5rem] text-right font-semibold">{formatTime(currentTime)}</span>
            <span className="text-muted-foreground text-sm">/</span>
            <span className="text-muted-foreground min-w-[4.5rem] text-left">{formatTime(duration)}</span>
          </div>
        </div>
      </div>


      {/* Right Controls */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Aspect:</span>
        <div className="w-28">
          <Select value={aspectRatio} onValueChange={(value) => setAspectRatio(value as AspectRatio)}>
            <SelectTrigger className="h-9">
              <SelectValue />
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
  );
}