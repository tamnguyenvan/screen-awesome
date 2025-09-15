import { memo, MouseEvent as ReactMouseEvent } from 'react';
import { TimelineRegion, ZoomRegion } from '../../../store/editorStore';
import { cn } from '../../../lib/utils';
import { Film } from 'lucide-react';

interface ZoomRegionBlockProps {
  region: ZoomRegion;
  left: number;
  width: number;
  isSelected: boolean;
  onMouseDown: (e: ReactMouseEvent<HTMLDivElement>, region: TimelineRegion, type: 'move' | 'resize-left' | 'resize-right') => void;
  setRef: (el: HTMLDivElement | null) => void;
}

export const ZoomRegionBlock = memo(function ZoomRegionBlock({ 
  region, 
  left, 
  width, 
  isSelected, 
  onMouseDown, 
  setRef 
}: ZoomRegionBlockProps) {
  return (
    <div
      ref={setRef}
      data-region-id={region.id}
      className={cn(
        "absolute h-18 rounded-lg flex items-center text-sm cursor-pointer transition-all duration-200 border border-gray-400/60",
        isSelected 
          ? "bg-primary/90 text-primary-foreground border-2 border-primary z-10 shadow-lg" 
          : "bg-gray-200 text-gray-700 hover:bg-gray-300 shadow-sm"
      )}
      style={{ left: `${left}px`, width: `${width}px` }}
      onMouseDown={(e) => onMouseDown(e, region, 'move')}
    >
      {/* Left resize strip */}
      <div
        className={cn(
          "absolute top-0 left-0 w-3 h-full rounded-l-lg cursor-ew-resize flex items-center justify-center",
          isSelected ? "bg-primary" : "bg-gray-400/60 hover:bg-gray-500/60"
        )}
        onMouseDown={(e) => onMouseDown(e, region, 'resize-left')}
      >
        <div className="w-0.5 h-6 bg-white/50 rounded-full" />
      </div>

      {/* Content area */}
      <div className="flex-1 flex items-center justify-center gap-3 overflow-hidden px-5">
        <Film size={18} className="flex-shrink-0" />
        <span className="truncate text-sm">
          {region.zoomLevel.toFixed(1)}x Zoom
        </span>
      </div>

      {/* Right resize strip */}
      <div
        className={cn(
          "absolute top-0 right-0 w-3 h-full rounded-r-lg cursor-ew-resize flex items-center justify-center",
          isSelected ? "bg-primary" : "bg-gray-400/60 hover:bg-gray-500/60"
        )}
        onMouseDown={(e) => onMouseDown(e, region, 'resize-right')}
      >
        <div className="w-0.5 h-6 bg-white/50 rounded-full" />
      </div>
    </div>
  );
});