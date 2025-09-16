import { memo, MouseEvent as ReactMouseEvent } from 'react';
import { TimelineRegion } from '../../../store/editorStore';
import { cn } from '../../../lib/utils';
import { Scissors } from 'lucide-react';

interface CutRegionBlockProps {
  region: TimelineRegion;
  left: number;
  width: number;
  isSelected: boolean;
  onMouseDown: (e: ReactMouseEvent<HTMLDivElement>, region: TimelineRegion, type: 'move' | 'resize-left' | 'resize-right') => void;
  setRef: (el: HTMLDivElement | null) => void;
}

export const CutRegionBlock = memo(function CutRegionBlock({
  region,
  left,
  width,
  isSelected,
  onMouseDown,
  setRef
}: CutRegionBlockProps) {
  return (
    <div
      ref={setRef}
      data-region-id={region.id}
      className={cn(
        "absolute h-12 rounded-lg flex items-center cursor-pointer transition-all duration-200",
        "border",
        isSelected
          ? "bg-destructive/10 border-destructive/30 shadow-sm"
          : "bg-muted/60 border-border/40 hover:bg-muted/80 hover:border-border/60 shadow-xs"
      )}
      style={{ left: `${left}px`, width: `${width}px` }}
      onMouseDown={(e) => onMouseDown(e, region, 'move')}
    >
      {/* Left resize handle */}
      <div
        className="absolute left-0 top-0 w-1 h-full bg-destructive/60 rounded-l-lg cursor-ew-resize opacity-0 hover:opacity-100 transition-opacity duration-200"
        onMouseDown={(e) => onMouseDown(e, region, 'resize-left')}
      />

      {/* Content area */}
      <div className="flex-1 flex items-center justify-center gap-2 px-3">
        <Scissors className="w-3.5 h-3.5 text-destructive/80" />
        <span className="text-xs font-medium text-destructive/80">Cut</span>
      </div>

      {/* Right resize handle */}

      <div
        className="absolute right-0 top-0 w-1 h-full bg-destructive/60 rounded-r-lg cursor-ew-resize opacity-0 hover:opacity-100 transition-opacity duration-200"
        onMouseDown={(e) => onMouseDown(e, region, 'resize-right')}
      />
    </div>
  );
});