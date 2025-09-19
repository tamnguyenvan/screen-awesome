// src/components/editor/timeline/CutRegionBlock.tsx
import { memo } from 'react';
import { TimelineRegion, CutRegion } from '../../../types/store';
import { cn } from '../../../lib/utils';
import { Scissors } from 'lucide-react';

interface CutRegionBlockProps {
  region: CutRegion;
  isSelected: boolean;
  isDraggable?: boolean;
  onMouseDown: (e: React.MouseEvent<HTMLDivElement>, region: TimelineRegion, type: 'move' | 'resize-left' | 'resize-right') => void;
  setRef: (el: HTMLDivElement | null) => void;
}

export const CutRegionBlock = memo(({
  region,
  isSelected,
  isDraggable = true,
  onMouseDown,
  setRef
}: CutRegionBlockProps) => {
  const isTrimRegion = !!region.trimType;
  const canMove = isDraggable && !isTrimRegion;
  const canResizeLeft = isDraggable && region.trimType !== 'start';
  const canResizeRight = isDraggable && region.trimType !== 'end';

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>, type: 'move' | 'resize-left' | 'resize-right') => {
    e.stopPropagation();
    if (!isDraggable) return;
    onMouseDown(e, region, type);
  };

  return (
    <div
      ref={setRef}
      data-region-id={region.id}
      className={cn(
        'w-full h-full pointer-events-none',
        'bg-destructive/40 backdrop-blur-[2px] border-y-2 border-destructive/80',
        isSelected && 'ring-2 ring-offset-2 ring-offset-background ring-destructive'
      )}
    >
      <div 
        className={cn(
          'relative w-full h-14 mt-[72px] flex items-center justify-center rounded-lg',
          'border-x-2 border-destructive',
          'bg-destructive/20',
          'pointer-events-auto',
          canMove ? 'cursor-grab' : 'cursor-default'
        )}
        onMouseDown={(e) => handleMouseDown(e, 'move')} 
      >
        {canResizeLeft && (
          <div
            className="absolute left-0 top-0 w-4 h-full cursor-ew-resize rounded-l-md flex items-center justify-center z-20"
            onMouseDown={(e) => handleMouseDown(e, 'resize-left')} >
            <div className="w-0.5 h-1/2 bg-white/80 rounded-full" />
          </div>
        )}
        <div className="pointer-events-none flex items-center gap-2 px-2">
          <Scissors className="w-4 h-4 text-white/70" />
          <span className="text-xs font-medium text-white/80 select-none">
            {region.trimType ? `${region.trimType.charAt(0).toUpperCase() + region.trimType.slice(1)} Trim` : 'Cut'}
          </span>
        </div>
        {canResizeRight && (
          <div
            className="absolute right-0 top-0 w-4 h-full cursor-ew-resize rounded-r-md flex items-center justify-center z-20"
            onMouseDown={(e) => handleMouseDown(e, 'resize-right')} >
            <div className="w-0.5 h-1/2 bg-white/80 rounded-full" />
          </div>
        )}
      </div>
    </div>
  );
});
CutRegionBlock.displayName = 'CutRegionBlock';