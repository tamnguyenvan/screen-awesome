// src/components/editor/Toolbar.tsx

import { Scissors, ZoomIn, Plus } from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import { Button } from '../ui/button';
import { TooltipProvider } from '../ui/tooltip';
import { cn } from '../../lib/utils';

export function Toolbar() {
  const { addZoomRegion, addCutRegion, timelineZoom, setTimelineZoom } = useEditorStore();

  return (
    <TooltipProvider delayDuration={100}>
      <div className={cn(
        "h-12 flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700",
        "flex items-center justify-between px-4"
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
        </div>
        
        <div className="flex items-center gap-2 w-48">
          <ZoomIn className="w-4 h-4 text-gray-500" />
          <input
            type="range"
            min="1"
            max="10"
            step="0.5"
            value={timelineZoom}
            onChange={(e) => setTimelineZoom(parseFloat(e.target.value))}
            className={cn("w-full h-2 bg-gray-300 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer")}
          />
        </div>
      </div>
    </TooltipProvider>
  );
}