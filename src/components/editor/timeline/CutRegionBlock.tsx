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
  const isTrimRegion = region.trimType === 'start' || region.trimType === 'end';
  const canResizeLeft = isDraggable && (!isTrimRegion || region.trimType === 'end');
  const canResizeRight = isDraggable && (!isTrimRegion || region.trimType === 'start');
  const isInteractive = isDraggable && !(isTrimRegion && region.trimType);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>, type: 'move' | 'resize-left' | 'resize-right') => {
    if (isTrimRegion && type === 'move') return;
    if (!isDraggable) return;
    e.stopPropagation();
    onMouseDown(e, region, type);
  };

  return (
    <div
      ref={setRef}
      data-region-id={region.id}
      className={cn(
        'absolute h-14 flex items-center justify-center rounded-lg overflow-hidden',
        'transition-colors duration-200',
        isInteractive ? 'cursor-pointer' : 'cursor-default',
        isSelected 
          ? 'bg-destructive/10 border-2 border-destructive/60' 
          : 'bg-muted/60 hover:bg-muted/80 border-2 border-border/60 hover:border-border/80'
      )}
      style={{ left: `${left}px`, width: `${width}px` }}
      onMouseDown={(e) => handleMouseDown(e, 'move')}
    >
      {canResizeLeft && (
        <div
          className="absolute left-0 top-0 w-1 h-full bg-destructive/60 cursor-ew-resize rounded-l-lg"
          onMouseDown={(e) => handleMouseDown(e, 'resize-left')}
        />
      )}

      <div className="pointer-events-none flex items-center gap-2 px-2">
        <Scissors className="w-4 h-4 text-destructive/80" />
        {width > 80 && (
          <span className="text-xs font-medium text-destructive/90">
            {region.trimType || 'Cut'}
          </span>
        )}
      </div>

      {canResizeRight && (
        <div
          className="absolute right-0 top-0 w-1 h-full bg-destructive/60 cursor-ew-resize rounded-r-lg"
          onMouseDown={(e) => handleMouseDown(e, 'resize-right')}
        />
      )}
    </div>
  );
});

CutRegionBlock.displayName = 'CutRegionBlock';