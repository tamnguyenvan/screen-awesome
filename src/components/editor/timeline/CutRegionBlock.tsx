// src/components/editor/timeline/CutRegionBlock.tsx

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
        'absolute top-0 h-[90%]', // CHANGED: Fills the entire height of the timeline container
        'bg-foreground/40 border-border/50',
        isSelected
          ? 'border-2 border-destructive z-10'
          : 'border-transparent' // Use transparent border to avoid layout shift on selection
      )}
      style={{ left: `${left}px`, width: `${width}px` }}
    >
      {/* NEW: Inner container to vertically center the content in the original position */}
      <div 
        className={cn(
          'relative w-full h-14 mt-[72px] flex items-center justify-center rounded-lg', // 72px = ruler height (48px) + top padding (24px)
          canMove ? 'cursor-move' : 'cursor-default'
        )}
        onMouseDown={(e) => handleMouseDown(e, 'move')}
      >
        {canResizeLeft && (
          <div
            className="absolute left-0 top-0 w-2 h-full cursor-ew-resize rounded-l-md flex items-center justify-center z-20"
            onMouseDown={(e) => handleMouseDown(e, 'resize-left')}
          >
            <div className="w-0.5 h-1/2 bg-destructive/80 rounded-full" />
          </div>
        )}

        <div className="pointer-events-none flex items-center gap-2 px-2">
          <Scissors className="w-4 h-4 text-white/70" />
          {width > 80 && (
            <span className="text-xs font-medium text-white/80 select-none">
              {region.trimType ? `${region.trimType.charAt(0).toUpperCase() + region.trimType.slice(1)} Trim` : 'Cut'}
            </span>
          )}
        </div>

        {canResizeRight && (
          <div
            className="absolute right-0 top-0 w-2 h-full cursor-ew-resize rounded-r-md flex items-center justify-center z-20"
            onMouseDown={(e) => handleMouseDown(e, 'resize-right')}
          >
            <div className="w-0.5 h-1/2 bg-destructive/80 rounded-full" />
          </div>
        )}
      </div>
    </div>
  );
});

CutRegionBlock.displayName = 'CutRegionBlock';