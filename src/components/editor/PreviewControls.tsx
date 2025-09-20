// src/components/editor/PreviewControls.tsx
import React from 'react';
// Thêm icon Trash2 và các component Tooltip
import { Play, Pause, Rewind, Scissors, Plus, ZoomIn, Trash2, Undo, Redo, RotateCcw } from 'lucide-react';
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

export function PreviewControls({ videoRef }: PreviewControlsProps) {
  const {
    isPlaying, togglePlay, currentTime, duration, setCurrentTime,
    aspectRatio, setAspectRatio, addZoomRegion, addCutRegion,
    timelineZoom, setTimelineZoom,
    selectedRegionId, deleteRegion // Lấy thêm state và action cần thiết
  } = useEditorStore();

  const { undo, redo, clear, pastStates, futureStates } = useEditorStore.temporal.getState();

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

  const handleClear = async () => {
    clear();
  }

  const handleDelete = () => {
    if (selectedRegionId) {
      deleteRegion(selectedRegionId);
    }
  }

  return (
    <div className={cn(
      "h-16 bg-card/80 backdrop-blur-sm border-t border-border/50",
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

      {/* Center Playback Controls */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={handleUndo} disabled={pastStates.length === 0} className="w-8 h-8" title='Undo (Ctrl+Z)'>
          <Undo className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={handleRedo} disabled={futureStates.length === 0} className="w-8 h-8" title='Redo (Ctrl+Y)'>
          <Redo className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={handleClear} disabled={pastStates.length === 0} className="w-8 h-8" title='Clear History'>
          <RotateCcw className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={handleRewind} className="w-8 h-8" title='Rewind (Ctrl+Left Arrow)'>
          <Rewind className="w-5 h-5" />
        </Button>
        <Button
          variant="ghost" size="icon" onClick={togglePlay} title='Play/Pause (Space)'
          className="w-12 h-12 rounded-full bg-primary/10 hover:bg-primary/20"
        >
          {isPlaying ? <Pause className="w-6 h-6 text-primary" /> : <Play className="w-6 h-6 text-primary ml-1" />}
        </Button>
        <div className="flex items-center gap-2 font-mono text-sm">
          <span className="text-foreground min-w-[4rem] text-right">{formatTime(currentTime)}</span>
          <span className="text-muted-foreground">/</span>
          <span className="text-muted-foreground min-w-[4rem] text-left">{formatTime(duration)}</span>
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