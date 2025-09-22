import { memo } from 'react';
import { TimelineRegion, ZoomRegion } from '../../../types/store';
import { cn } from '../../../lib/utils';
import { Search } from 'lucide-react';

interface ZoomRegionBlockProps {
  region: ZoomRegion;
  isSelected: boolean;
  isDragging: boolean;
  onMouseDown: (e: React.MouseEvent<HTMLDivElement>, region: TimelineRegion, type: 'move' | 'resize-left' | 'resize-right') => void;
  setRef: (el: HTMLDivElement | null) => void;
}

const areEqual = (prevProps: ZoomRegionBlockProps, nextProps: ZoomRegionBlockProps) => {
  return (
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isDragging === nextProps.isDragging &&
    prevProps.region.id === nextProps.region.id &&
    prevProps.region.startTime === nextProps.region.startTime &&
    prevProps.region.duration === nextProps.region.duration
  );
};

export const ZoomRegionBlock = memo(({
  region,
  isSelected,
  isDragging,
  onMouseDown,
  setRef
}: ZoomRegionBlockProps) => {
  void isDragging
  const handleResizeMouseDown = (e: React.MouseEvent<HTMLDivElement>, type: 'resize-left' | 'resize-right') => {
    e.stopPropagation();
    onMouseDown(e, region, type);
  };

  return (
    <div
      ref={setRef}
      data-region-id={region.id}
      className={cn(
        'w-full h-full rounded-lg overflow-hidden relative',
        'cursor-grab border-2 bg-muted',
        isSelected && [
          'shadow-lg shadow-primary/20',
          'transform -translate-y-2'
        ],
        isSelected ? 'border-primary' : 'border-border',
        isSelected ? 'z-20' : 'z-10'
      )}
      style={{ willChange: 'transform, width' }}
      onMouseDown={(e) => onMouseDown(e, region, 'move')}
    >
      <div
        className="absolute left-0 top-0 w-4 h-full cursor-ew-resize rounded-l-md flex items-center justify-center z-30"
        onMouseDown={(e) => handleResizeMouseDown(e, 'resize-left')} >
        <div className={cn("w-0.5 h-1/2 bg-gray-500/50 rounded-full", isSelected && "bg-primary")} />
      </div>

      {isSelected && (
        <div className="absolute inset-0 bg-primary/20" />
      )}

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
        <div className="flex items-center gap-2 px-2">
          <Search className={cn("w-4 h-4", isSelected ? "text-primary" : "text-foreground/80")} />
          <span className={cn(
            "text-xs font-medium select-none", isSelected ? "text-primary" : "text-foreground/80")}>
            Zoom
          </span>
        </div>
      </div>

      <div
        className="absolute right-0 top-0 w-4 h-full cursor-ew-resize rounded-r-md flex items-center justify-center z-30"
        onMouseDown={(e) => handleResizeMouseDown(e, 'resize-right')} >
        <div className={cn("w-0.5 h-1/2 bg-gray-500/50 rounded-full", isSelected && "bg-primary")} />
      </div>
    </div>
  );
}, areEqual);

ZoomRegionBlock.displayName = 'ZoomRegionBlock';