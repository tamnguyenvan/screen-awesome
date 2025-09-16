import { memo, MouseEvent as ReactMouseEvent } from 'react';
import { TimelineRegion, ZoomRegion } from '../../../store/editorStore';
import { cn } from '../../../lib/utils';
import { Search } from 'lucide-react';

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
        "absolute h-12 rounded-lg flex items-center cursor-pointer transition-all duration-200",
        "border",
        isSelected
          ? "bg-primary/10 border-primary/30 shadow-sm"
          : "bg-muted/60 border-border/40 hover:bg-primary/20 hover:border-primary/40 shadow-xs"
      )}
      style={{ left: `${left}px`, width: `${width}px` }}
      onMouseDown={(e) => onMouseDown(e, region, 'move')}
    >
      {/* Left resize handle */}
      <div
        className="absolute left-0 top-0 w-1 h-full bg-primary/60 rounded-l-lg cursor-ew-resize opacity-0 hover:opacity-100 transition-opacity duration-200"
        onMouseDown={(e) => onMouseDown(e, region, 'resize-left')}
      />

      {/* Content area */}
      <div className="flex-1 flex items-center justify-center gap-2 px-3">
        <Search className="w-3.5 h-3.5 text-primary/80" />
        <span className="text-xs font-medium text-primary/80">Zoom</span>
      </div>

      {/* Right resize handle */}

      <div
        className="absolute right-0 top-0 w-1 h-full bg-primary/60 rounded-r-lg cursor-ew-resize opacity-0 hover:opacity-100 transition-opacity duration-200"
        onMouseDown={(e) => onMouseDown(e, region, 'resize-right')}
      />
    </div>
  );
});