import { memo } from 'react';
import { TimelineRegion, CutRegion } from '../../../store/editorStore';
import { cn } from '../../../lib/utils';
import { Scissors } from 'lucide-react';

interface CutRegionBlockProps {
  region: CutRegion;
  left: number;
  width: number;
  isSelected: boolean;
  isDraggable?: boolean;
  onMouseDown: (e: React.MouseEvent<HTMLDivElement>, region: TimelineRegion, type: 'move' | 'resize-left' | 'resize-right') => void;
  setRef: (el: HTMLDivElement | null) => void;
}

export const CutRegionBlock = memo(({
  region,
  left,
  width,
  isSelected,
  isDraggable = true,
  onMouseDown,
  setRef
}: CutRegionBlockProps) => {
  const isTrimRegion = !!region.trimType;
  // A trim region cannot be moved, only resized from the inner handle.
  const canMove = isDraggable && !isTrimRegion;
  // The left handle is disabled for the start trim, right handle for the end trim.
  const canResizeLeft = isDraggable && region.trimType !== 'start';
  const canResizeRight = isDraggable && region.trimType !== 'end';

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>, type: 'move' | 'resize-left' | 'resize-right') => {
    e.stopPropagation();
    if (!isDraggable) return;

    // Prevent moving trim regions
    if (type === 'move' && !canMove) return;

    onMouseDown(e, region, type);
  };

  return (
    <div
      ref={setRef}
      data-region-id={region.id}
      className={cn(
        'absolute h-14 flex items-center justify-center rounded-lg overflow-hidden',
        'border-2', // Simplified classes
        canMove ? 'cursor-move' : 'cursor-default',
        isSelected 
          ? 'bg-destructive/20 border-destructive' // Use a solid border for selection
          : 'bg-muted/60 border-border/60'
      )}
      style={{ left: `${left}px`, width: `${width}px` }}
      onMouseDown={(e) => handleMouseDown(e, 'move')}
    >
      {canResizeLeft && (
        <div
          className="absolute left-0 top-0 w-2 h-full cursor-ew-resize rounded-l-md flex items-center justify-center"
          onMouseDown={(e) => handleMouseDown(e, 'resize-left')}
        >
          <div className="w-0.5 h-1/2 bg-destructive/80 rounded-full" />
        </div>
      )}

      <div className="pointer-events-none flex items-center gap-2 px-2">
        <Scissors className="w-4 h-4 text-destructive/80" />
        {width > 80 && (
          <span className="text-xs font-medium text-destructive/90">
            {region.trimType ? `${region.trimType.charAt(0).toUpperCase() + region.trimType.slice(1)} Trim` : 'Cut'}
          </span>
        )}
      </div>

      {canResizeRight && (
        <div
          className="absolute right-0 top-0 w-2 h-full cursor-ew-resize rounded-r-md flex items-center justify-center"
          onMouseDown={(e) => handleMouseDown(e, 'resize-right')}
        >
          <div className="w-0.5 h-1/2 bg-destructive/80 rounded-full" />
        </div>
      )}
    </div>
  );
});

CutRegionBlock.displayName = 'CutRegionBlock';