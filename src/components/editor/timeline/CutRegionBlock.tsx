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
        "absolute h-14 rounded-2xl flex items-center text-sm cursor-pointer transition-all duration-200",
        "border-2",
        isSelected 
          ? "bg-destructive/15 border-destructive text-destructive-foreground shadow-md z-20" 
          : "bg-muted/80 border-border/60 text-muted-foreground hover:bg-muted hover:border-border shadow-sm"
      )}
      style={{ left: `${left}px`, width: `${width}px` }}
      onMouseDown={(e) => onMouseDown(e, region, 'move')}
    >
      {/* Left resize handle */}
      <div
        className={cn(
          "absolute top-0 left-0 w-2 h-full rounded-l-2xl cursor-ew-resize",
          "flex items-center justify-center transition-colors",
          isSelected
            ? "bg-destructive/20 hover:bg-destructive/30"
            : "bg-transparent hover:bg-border/20"
        )}
        onMouseDown={(e) => onMouseDown(e, region, 'resize-left')}
      >
        <div className={cn(
          "w-0.5 h-6 rounded-full",
          isSelected 
            ? "bg-destructive" 
            : "bg-border"
        )} />
      </div>

      {/* Content area */}
      <div className="flex-1 flex items-center justify-center gap-2 overflow-hidden px-5">
        <Scissors 
          size={14} 
          className={cn(
            "flex-shrink-0",
            isSelected 
              ? "text-destructive" 
              : "text-muted-foreground"
          )} 
        />
        <span className={cn(
          "truncate text-xs font-medium",
          isSelected 
            ? "text-destructive" 
            : "text-muted-foreground"
        )}>
          Cut
        </span>
      </div>

      {/* Right resize handle */}
      <div
        className={cn(
          "absolute top-0 right-0 w-2 h-full rounded-r-2xl cursor-ew-resize",
          "flex items-center justify-center transition-colors",
          isSelected
            ? "bg-destructive/20 hover:bg-destructive/30"
            : "bg-transparent hover:bg-border/20"
        )}
        onMouseDown={(e) => onMouseDown(e, region, 'resize-right')}
      >
        <div className={cn(
          "w-0.5 h-6 rounded-full",
          isSelected 
            ? "bg-destructive" 
            : "bg-border"
        )} />
      </div>
    </div>
  );
});