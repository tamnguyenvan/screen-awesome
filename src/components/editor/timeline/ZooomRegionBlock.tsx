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
        "absolute h-14 rounded-2xl flex items-center text-sm cursor-pointer transition-all duration-200",
        "border-2",
        isSelected 
          ? "bg-primary/15 border-primary text-primary-foreground shadow-md z-20" 
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
            ? "bg-primary/20 hover:bg-primary/30"
            : "bg-transparent hover:bg-border/20"
        )}
        onMouseDown={(e) => onMouseDown(e, region, 'resize-left')}
      >
        <div className={cn(
          "w-0.5 h-6 rounded-full",
          isSelected 
            ? "bg-primary" 
            : "bg-border"
        )} />
      </div>

      {/* Content area */}
      <div className="flex-1 flex items-center justify-center gap-2 overflow-hidden px-5">
        <Search 
          size={14} 
          className={cn(
            "flex-shrink-0",
            isSelected 
              ? "text-primary" 
              : "text-muted-foreground"
          )} 
        />
        <span className={cn(
          "truncate text-xs font-medium",
          isSelected 
            ? "text-primary" 
            : "text-muted-foreground"
        )}>
          Zoom
        </span>
      </div>

      {/* Right resize handle */}
      <div
        className={cn(
          "absolute top-0 right-0 w-2 h-full rounded-r-2xl cursor-ew-resize",
          "flex items-center justify-center transition-colors",
          isSelected
            ? "bg-primary/20 hover:bg-primary/30"
            : "bg-transparent hover:bg-border/20"
        )}
        onMouseDown={(e) => onMouseDown(e, region, 'resize-right')}
      >
        <div className={cn(
          "w-0.5 h-6 rounded-full",
          isSelected 
            ? "bg-primary" 
            : "bg-border"
        )} />
      </div>
    </div>
  );
});